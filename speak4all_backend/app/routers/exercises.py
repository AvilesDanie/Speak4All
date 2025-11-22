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
    )

    db.add(exercise)
    db.commit()
    db.refresh(exercise)

    return exercise


# ==== 3) LISTAR EJERCICIOS DEL TERAPEUTA ====

@router.get("/mine", response_model=list[schemas.ExerciseOut])
def list_my_exercises(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_therapist(current_user)

    items = db.query(models.Exercise).filter(
        models.Exercise.therapist_id == current_user.id,
        models.Exercise.is_deleted.is_(False),
    ).order_by(models.Exercise.created_at.desc()).all()

    return items
