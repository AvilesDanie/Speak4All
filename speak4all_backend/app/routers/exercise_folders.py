# app/routers/exercise_folders.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter()


def require_therapist(user: models.User):
    if user.role != models.UserRole.THERAPIST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los terapeutas pueden gestionar carpetas de ejercicios.",
        )


# ==== LISTAR CARPETAS DEL TERAPEUTA ====

@router.get("/", response_model=list[schemas.ExerciseFolderOut])
def list_exercise_folders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Lista todas las carpetas de ejercicios del terapeuta actual.
    """
    require_therapist(current_user)

    folders = db.query(models.ExerciseFolder).filter(
        models.ExerciseFolder.therapist_id == current_user.id,
        models.ExerciseFolder.is_deleted.is_(False),
    ).order_by(models.ExerciseFolder.created_at.desc()).all()

    return folders


# ==== CREAR CARPETA ====

@router.post("/", response_model=schemas.ExerciseFolderOut, status_code=status.HTTP_201_CREATED)
def create_exercise_folder(
    data: schemas.ExerciseFolderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Crea una nueva carpeta de ejercicios para el terapeuta actual.
    """
    require_therapist(current_user)

    folder = models.ExerciseFolder(
        therapist_id=current_user.id,
        name=data.name,
        color=data.color,
    )

    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


# ==== ACTUALIZAR CARPETA ====

@router.put("/{folder_id}", response_model=schemas.ExerciseFolderOut)
def update_exercise_folder(
    folder_id: int,
    data: schemas.ExerciseFolderUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Actualiza una carpeta de ejercicios (solo el dueño).
    """
    require_therapist(current_user)

    folder = db.query(models.ExerciseFolder).filter(
        models.ExerciseFolder.id == folder_id,
        models.ExerciseFolder.therapist_id == current_user.id,
        models.ExerciseFolder.is_deleted.is_(False),
    ).first()

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Carpeta no encontrada.",
        )

    if data.name is not None:
        folder.name = data.name
    if data.color is not None:
        folder.color = data.color

    db.commit()
    db.refresh(folder)
    return folder


# ==== ELIMINAR CARPETA ====

@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exercise_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Elimina lógicamente una carpeta de ejercicios (solo el dueño).
    Los ejercicios dentro de la carpeta NO se eliminan, solo quedan sin carpeta.
    """
    require_therapist(current_user)

    folder = db.query(models.ExerciseFolder).filter(
        models.ExerciseFolder.id == folder_id,
        models.ExerciseFolder.therapist_id == current_user.id,
        models.ExerciseFolder.is_deleted.is_(False),
    ).first()

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Carpeta no encontrada.",
        )

    # Remover la carpeta de todos los ejercicios
    db.query(models.Exercise).filter(
        models.Exercise.folder_id == folder_id
    ).update({"folder_id": None}, synchronize_session=False)

    # Eliminar la carpeta
    folder.is_deleted = True
    folder.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return
