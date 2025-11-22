from datetime import datetime, timezone
from pathlib import Path
import shutil

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    status,
)
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..deps import get_current_user

router = APIRouter()

# Carpeta base donde guardaremos los audios de entregas
BASE_SUBMISSIONS_DIR = Path("media/submissions")


def require_student(user: models.User):
    if user.role != models.UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo estudiantes pueden realizar entregas."
        )


def check_due_date(course_ex: models.CourseExercise):
    """Lanza error si el ejercicio ya venció."""
    if course_ex.is_deleted:
        raise HTTPException(status_code=404, detail="Ejercicio no disponible.")
    if course_ex.due_date and datetime.now(timezone.utc) > course_ex.due_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El tiempo límite del ejercicio ya venció."
        )


def get_course_exercise_for_student(
    db: Session,
    course_exercise_id: int,
    student_id: int,
) -> models.CourseExercise:
    """
    Verifica:
    - que el CourseExercise existe,
    - que el curso asociado existe,
    - que el estudiante está inscrito en ese curso.
    """
    course_ex = (
        db.query(models.CourseExercise)
        .join(models.Course)
        .join(models.CourseStudent, models.CourseStudent.course_id == models.Course.id)
        .filter(
            models.CourseExercise.id == course_exercise_id,
            models.CourseExercise.is_deleted.is_(False),
            models.CourseStudent.student_id == student_id,
            models.CourseStudent.is_active.is_(True),
        )
        .first()
    )

    if not course_ex:
        raise HTTPException(
            status_code=404,
            detail="No tienes acceso a este ejercicio o no existe."
        )

    return course_ex


def get_or_create_submission(
    db: Session,
    student_id: int,
    course_exercise_id: int,
) -> models.Submission:
    sub = (
        db.query(models.Submission)
        .filter(
            models.Submission.student_id == student_id,
            models.Submission.course_exercise_id == course_exercise_id,
        )
        .first()
    )
    if sub:
        return sub

    sub = models.Submission(
        student_id=student_id,
        course_exercise_id=course_exercise_id,
        status=models.SubmissionStatus.PENDING,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(sub)
    db.flush()  # para tener id
    return sub


def save_submission_audio(
    file: UploadFile,
    course_ex: models.CourseExercise,
    student_id: int,
) -> str:
    """
    Guarda el audio en disco y devuelve el path (string).
    Estructura: media/submissions/{course_id}/{course_ex_id}/{student_id}/timestamp_nombre.mp3
    """
    BASE_SUBMISSIONS_DIR.mkdir(parents=True, exist_ok=True)

    course_id = course_ex.course_id
    ce_id = course_ex.id

    # Asegura carpeta por curso / ejercicio / estudiante
    target_dir = BASE_SUBMISSIONS_DIR / str(course_id) / str(ce_id) / str(student_id)
    target_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    # Forzar extensión .mp3 (puedes afinarlo según tu front)
    filename = f"{ts}_{file.filename}"
    dest = target_dir / filename

    with dest.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Devolvemos el path relativo a la carpeta base del proyecto
    return str(dest.as_posix())


# ========== ENDPOINTS ==========

@router.post(
    "/course-exercises/{course_exercise_id}/submit",
    response_model=schemas.SubmissionOut,
)
async def submit_exercise(
    course_exercise_id: int,
    mark_done: bool = True,
    audio: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Crear o actualizar una entrega de un ejercicio de curso.

    Reglas:
    - Solo estudiantes.
    - Debe estar inscrito en el curso de ese ejercicio.
    - Solo se permite dentro del tiempo límite (si hay due_date).
    - Si se envía audio, se guarda y la entrega se marca como DONE automáticamente.
    - Si no hay audio pero mark_done=True, se marca como DONE (entrega sin audio).
    """
    require_student(current_user)

    course_ex = get_course_exercise_for_student(
        db, course_exercise_id, current_user.id
    )
    check_due_date(course_ex)

    submission = get_or_create_submission(
        db, current_user.id, course_exercise_id
    )

    # Si se adjunta audio, lo guardamos
    if audio is not None:
        # Puedes validar tipo aquí si quieres: audio.content_type == "audio/mpeg", etc.
        audio_path = save_submission_audio(audio, course_ex, current_user.id)
        submission.audio_path = audio_path
        submission.status = models.SubmissionStatus.DONE
    else:
        # Sin audio, solo marcar o no como hecho
        submission.status = (
            models.SubmissionStatus.DONE if mark_done else models.SubmissionStatus.PENDING
        )

    submission.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(submission)
    return submission


@router.patch(
    "/{submission_id}/status",
    response_model=schemas.SubmissionOut,
)
def update_submission_status(
    submission_id: int,
    body: schemas.SubmissionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Marcar o desmarcar una entrega como realizada.
    Solo estudiante dueño de la entrega.
    Solo dentro del tiempo límite.
    """
    require_student(current_user)

    sub = db.query(models.Submission).filter(
        models.Submission.id == submission_id,
        models.Submission.student_id == current_user.id,
    ).first()

    if not sub:
        raise HTTPException(status_code=404, detail="Entrega no encontrada.")

    # Revisar due_date desde el CourseExercise
    course_ex = db.query(models.CourseExercise).filter(
        models.CourseExercise.id == sub.course_exercise_id,
        models.CourseExercise.is_deleted.is_(False),
    ).first()

    if not course_ex:
        raise HTTPException(status_code=404, detail="Ejercicio no disponible.")

    check_due_date(course_ex)

    sub.status = (
        models.SubmissionStatus.DONE if body.done else models.SubmissionStatus.PENDING
    )
    sub.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sub)
    return sub


@router.delete(
    "/{submission_id}/audio",
    response_model=schemas.SubmissionOut,
)
def delete_submission_audio(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Borra el audio asociado a una entrega.
    Solo estudiante dueño de la entrega.
    Solo dentro del tiempo límite.
    No borra el registro, solo pone audio_path=None.
    """
    require_student(current_user)

    sub = db.query(models.Submission).filter(
        models.Submission.id == submission_id,
        models.Submission.student_id == current_user.id,
    ).first()

    if not sub:
        raise HTTPException(status_code=404, detail="Entrega no encontrada.")

    course_ex = db.query(models.CourseExercise).filter(
        models.CourseExercise.id == sub.course_exercise_id,
        models.CourseExercise.is_deleted.is_(False),
    ).first()

    if not course_ex:
        raise HTTPException(status_code=404, detail="Ejercicio no disponible.")

    check_due_date(course_ex)

    # Opción: también puedes intentar borrar el archivo físico.
    # Para respetar "borrado lógico", solo limpiamos la referencia en BD.
    sub.audio_path = None
    sub.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sub)
    return sub
