# app/routers/exercises.py
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..deps import get_current_user
from ..services import ai_exercises  # 👈 hay que exponer el módulo en __init__.py de services

router = APIRouter()


def require_therapist(user: models.User):
    if user.role != models.UserRole.THERAPIST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los terapeutas pueden gestionar ejercicios",
        )


# ==== 1) PREVIEW: generar texto con IA ====

@router.post("/preview", response_model=schemas.ExerciseGenerateResponse)
def generate_exercise_preview(
    body: schemas.ExerciseGenerateRequest,
    current_user: models.User = Depends(get_current_user),
):
    """
    El terapeuta manda un prompt en lenguaje natural.
    La IA devuelve:
      - marked_text: con [REP]...[/REP]
      - text: limpio, sin [REP], para mostrar en pantalla.
    """
    require_therapist(current_user)

    marked = ai_exercises.generate_marked_text_from_prompt(body.prompt)
    clean = ai_exercises.strip_rep_tags(marked)

    return schemas.ExerciseGenerateResponse(
        text=clean,
        marked_text=marked,
    )


# ==== 2) CREAR EJERCICIO (texto + audio) ====

@router.post("/", response_model=schemas.ExerciseOut, status_code=status.HTTP_201_CREATED)
def create_exercise(
    body: schemas.ExerciseCreateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Crea un ejercicio persistente:
      - Guarda en BD: name, prompt, texto limpio, audio_path, therapist_id.
      - Genera el audio usando marked_text (o text si no viene marcado).
    """
    require_therapist(current_user)

    # 1) elegir texto marcado para TTS
    marked = body.marked_text or body.text

    # 2) generar audio; lo guardamos relativo a la raíz del proyecto
    base_dir = Path.cwd()
    audio_rel_path = ai_exercises.build_audio_from_marked_text(marked, base_dir=base_dir)

    # 3) texto limpio (sin [REP]) por si el front envió marked_text diferente
    clean_text = ai_exercises.strip_rep_tags(marked)

    exercise = models.Exercise(
        therapist_id=current_user.id,
        name=body.name,
        prompt=body.prompt,
        text=clean_text,
        audio_path=str(audio_rel_path),
        folder_id=body.folder_id,
    )

    db.add(exercise)
    db.commit()
    db.refresh(exercise)

    return exercise


# ==== 3) LISTAR EJERCICIOS DEL TERAPEUTA ====

@router.get("/mine", response_model=schemas.PaginatedResponse[schemas.ExerciseOut])
def list_my_exercises(
    page: int = 1,
    page_size: int = 10,
    folder_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_therapist(current_user)

    # Validar parámetros
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 10
    if page_size > 100:
        page_size = 100

    # Construir query base
    query = db.query(models.Exercise).filter(
        models.Exercise.therapist_id == current_user.id,
        models.Exercise.is_deleted.is_(False),
    )

    # Filtrar por carpeta si se especifica
    if folder_id is not None:
        query = query.filter(models.Exercise.folder_id == folder_id)

    query = query.order_by(models.Exercise.created_at.desc())

    # Contar total
    total = query.count()
    
    # Aplicar paginación
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    
    # Calcular total de páginas
    total_pages = (total + page_size - 1) // page_size
    
    return schemas.PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


# ==== 5) ACTUALIZAR CARPETA DE UN EJERCICIO ====

@router.patch("/{exercise_id}/folder", response_model=schemas.ExerciseOut)
def update_exercise_folder(
    exercise_id: int,
    # Hacer opcional el parámetro para permitir quitar la carpeta simplemente omitiéndolo.
    folder_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Actualiza la carpeta de un ejercicio (o la remueve si folder_id es None).
    """
    require_therapist(current_user)

    exercise = db.query(models.Exercise).filter(
        models.Exercise.id == exercise_id,
        models.Exercise.therapist_id == current_user.id,
        models.Exercise.is_deleted.is_(False),
    ).first()

    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ejercicio no encontrado o ya está eliminado."
        )

    # Verificar que la carpeta existe y pertenece al terapeuta (solo si se envía)
    if folder_id is not None:
        folder = db.query(models.ExerciseFolder).filter(
            models.ExerciseFolder.id == folder_id,
            models.ExerciseFolder.therapist_id == current_user.id,
            models.ExerciseFolder.is_deleted.is_(False),
        ).first()

        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Carpeta no encontrada."
            )

    exercise.folder_id = folder_id
    exercise.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(exercise)
    return exercise


# ==== 6) ELIMINAR (LÓGICAMENTE) UN EJERCICIO ====

@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exercise(
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Elimina lógicamente un ejercicio (solo el terapeuta dueño).
    También marca como eliminados todos los CourseExercise asociados.
    """
    require_therapist(current_user)

    exercise = db.query(models.Exercise).filter(
        models.Exercise.id == exercise_id,
        models.Exercise.therapist_id == current_user.id,
        models.Exercise.is_deleted.is_(False),
    ).first()

    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ejercicio no encontrado o ya está eliminado."
        )

    # Marcar ejercicio como eliminado
    exercise.is_deleted = True
    exercise.deleted_at = datetime.now(timezone.utc)

    # Marcar todas las publicaciones de este ejercicio como eliminadas
    db.query(models.CourseExercise).filter(
        models.CourseExercise.exercise_id == exercise_id,
        models.CourseExercise.is_deleted.is_(False),
    ).update({
        "is_deleted": True,
        "deleted_at": datetime.now(timezone.utc)
    }, synchronize_session=False)

    db.commit()
    return
