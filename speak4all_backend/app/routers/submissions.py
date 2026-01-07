from datetime import datetime, timezone
from pathlib import Path
import logging

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
from ..config import settings
from ..websocket_manager import manager
from sqlalchemy import and_
from app.services.storage import upload_fileobj, generate_signed_url, delete_blob


logger = logging.getLogger(__name__)
router = APIRouter()



def validate_media_file(file: UploadFile) -> None:
    """
    Valida que el archivo subido sea de imagen o video y no exceda el límite de tamaño.
    """
    # Validar tipo de contenido
    allowed_types = [t.strip() for t in settings.allowed_media_types.split(",")]
    
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, WebP) y videos (MP4, WebM, QuickTime)"
        )
    
    # Validar tamaño (leer en chunks para no cargar todo en memoria)
    max_size = settings.max_upload_size_mb * 1024 * 1024  # MB a bytes
    file.file.seek(0, 2)  # Ir al final del archivo
    file_size = file.file.tell()
    file.file.seek(0)  # Volver al inicio
    
    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo excede el tamaño máximo permitido de {settings.max_upload_size_mb}MB"
        )
    
    logger.info(f"Archivo validado: {file.filename} ({file_size / 1024:.2f}KB, {file.content_type})")


def require_student(user: models.User):
    if user.role != models.UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo estudiantes pueden realizar entregas."
        )

def require_therapist(user: models.User):
    if user.role != models.UserRole.THERAPIST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo terapeutas pueden acceder a esta información."
        )

def get_course_exercise_for_therapist(
    db: Session,
    course_exercise_id: int,
    therapist_id: int,
) -> models.CourseExercise:
    """
    Verifica:
    - que el CourseExercise existe y no está borrado
    - que pertenece a un curso cuyo therapist_id es el usuario actual
    """
    course_ex = (
        db.query(models.CourseExercise)
        .join(models.Course, models.Course.id == models.CourseExercise.course_id)
        .filter(
            models.CourseExercise.id == course_exercise_id,
            models.CourseExercise.is_deleted.is_(False),
            models.Course.therapist_id == therapist_id,
        )
        .first()
    )

    if not course_ex:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ejercicio no encontrado o no tienes permisos sobre este curso.",
        )

    return course_ex



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
    # Solo obtener si existe; la creación se hace en submit_exercise después de subir media
    sub = (
        db.query(models.Submission)
        .filter(
            models.Submission.student_id == student_id,
            models.Submission.course_exercise_id == course_exercise_id,
        )
        .first()
    )
    return sub


def save_submission_media(
    file: UploadFile,
    course_ex: models.CourseExercise,
    student_id: int,
) -> str:
    """
    Sube la imagen/video a Google Cloud Storage y devuelve el blob_name.

    Estructura en el bucket:
      submissions/{course_id}/{course_ex_id}/{student_id}/timestamp_nombre_original.ext
    """
    course_id = course_ex.course_id
    ce_id = course_ex.id

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"{ts}_{file.filename}"

    blob_name = f"submissions/{course_id}/{ce_id}/{student_id}/{filename}"

    # Asegurar que el puntero del archivo está al inicio
    file.file.seek(0)

    upload_fileobj(
        file_obj=file.file,
        destination_blob_name=blob_name,
        content_type=file.content_type,
    )

    return blob_name


# ========== ENDPOINTS ==========

@router.post(
    "/course-exercises/{course_exercise_id}/submit",
    response_model=schemas.SubmissionOut,
)
async def submit_exercise(
    course_exercise_id: int,
    media: UploadFile = File(...),  # Obligatorio: foto o video
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Crear o actualizar una entrega de un ejercicio de curso.

    Reglas:
    - Solo estudiantes.
    - Debe estar inscrito en el curso de ese ejercicio.
    - Solo se permite dentro del tiempo límite (si hay due_date).
    - OBLIGATORIO: Se debe enviar una foto o video como evidencia.
    """
    require_student(current_user)

    course_ex = get_course_exercise_for_student(
        db, course_exercise_id, current_user.id
    )
    check_due_date(course_ex)

    existing_submission = get_or_create_submission(
        db, current_user.id, course_exercise_id
    )

    # Validar y guardar el archivo de media (obligatorio)
    validate_media_file(media)
    
    # Si ya existía una media anterior, eliminarla del storage
    if existing_submission and existing_submission.media_path:
        try:
            delete_blob(existing_submission.media_path)
            logger.info(f"Media anterior eliminada de GCS: {existing_submission.media_path}")
        except Exception as e:
            logger.warning(f"No se pudo eliminar la media anterior de GCS: {e}")
    
    media_path = save_submission_media(media, course_ex, current_user.id)

    if existing_submission:
        submission = existing_submission
        submission.media_path = media_path
        submission.status = models.SubmissionStatus.DONE
        submission.updated_at = datetime.now(timezone.utc)
        logger.info(f"Media actualizada para submission {submission.id}: {media_path}")
    else:
        submission = models.Submission(
            student_id=current_user.id,
            course_exercise_id=course_exercise_id,
            status=models.SubmissionStatus.DONE,
            media_path=media_path,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(submission)
        logger.info(f"Media guardada para nueva submission: {media_path}")

    db.commit()
    db.refresh(submission)
    
    # Broadcast to connected clients con información detallada
    exercise_name = course_ex.exercise.name if course_ex.exercise else 'Ejercicio'
    student_name = current_user.full_name
    has_media = submission.media_path is not None
    therapist_id = course_ex.course.therapist_id if course_ex.course else None
    
    await manager.broadcast_to_course(
        course_ex.course_id,
        {
            "type": "submission_created",
            "data": {
                "course_id": course_ex.course_id,
                "course_exercise_id": course_exercise_id,
                "student_id": current_user.id,
                "student_name": student_name,
                "exercise_name": exercise_name,
                "therapist_id": therapist_id,
                "has_media": has_media,
                "submission_id": submission.id,
            }
        }
    )
    
    return submission




@router.delete(
    "/course-exercises/{course_exercise_id}/cancel",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def cancel_submission(
    course_exercise_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Anula completamente una entrega del estudiante.
    Solo puede hacerlo el estudiante dueño de la entrega.
    Elimina el registro de la base de datos y el archivo de media.
    """
    require_student(current_user)

    # Buscar la entrega
    sub = db.query(models.Submission).filter(
        models.Submission.course_exercise_id == course_exercise_id,
        models.Submission.student_id == current_user.id,
    ).first()

    if not sub:
        raise HTTPException(
            status_code=404, 
            detail="No tienes ninguna entrega para este ejercicio."
        )

    # Verificar que el ejercicio sigue disponible
    course_ex = db.query(models.CourseExercise).filter(
        models.CourseExercise.id == course_exercise_id,
        models.CourseExercise.is_deleted.is_(False),
    ).first()

    if not course_ex:
        raise HTTPException(
            status_code=404, 
            detail="Ejercicio no disponible."
        )

    # Verificar fecha límite
    check_due_date(course_ex)

    # Borrar el archivo de Google Cloud Storage si existe
    if sub.media_path:
        try:
            delete_blob(sub.media_path)
            logger.info(f"Media eliminada de GCS al cancelar submission: {sub.media_path}")
        except Exception as e:
            logger.warning(f"No se pudo eliminar la media de GCS: {e}")

    # Obtener datos necesarios antes de eliminar
    course_id = course_ex.course_id
    student_id = sub.student_id
    student_name = current_user.full_name
    exercise_name = course_ex.exercise.name if course_ex.exercise else "Ejercicio"
    therapist_id = course_ex.course.therapist_id if course_ex.course else None

    # Eliminar la entrega
    db.delete(sub)
    db.commit()

    # Notificar vía WebSocket
    await manager.broadcast_to_course(
        course_id,
        {
            "type": "submission_deleted",
            "data": {
                "course_id": course_id,
                "course_exercise_id": course_exercise_id,
                "student_id": student_id,
                "student_name": student_name,
                "exercise_name": exercise_name,
                "therapist_id": therapist_id,
            }
        }
    )

    return None




@router.get(
    "/course-exercises/{course_exercise_id}/students",
    response_model=list[schemas.SubmissionListItem],
)
def list_submissions_by_course_exercise_for_therapist(
    course_exercise_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Lista de TODOS los estudiantes de ese curso (CourseExercise),
    indicando si:
    - entregaron con audio
    - entregaron sin audio
    - no entregaron

    Solo puede verlo el terapeuta dueño del curso.
    """
    require_therapist(current_user)

    # Verifica que el ejercicio pertenece a un curso del terapeuta
    course_ex = get_course_exercise_for_therapist(
        db, course_exercise_id, current_user.id
    )

    # Traemos TODOS los alumnos activos del curso, con outer join a Submission
    q = (
        db.query(
            models.CourseStudent.student_id,
            models.User.full_name,
            models.User.email,
            models.Submission.id.label("submission_id"),
            models.Submission.status.label("status"),
            models.Submission.media_path.label("media_path"),
            models.Submission.created_at.label("submitted_at"),
        )
        .join(models.User, models.User.id == models.CourseStudent.student_id)
        .outerjoin(
            models.Submission,
            and_(
                models.Submission.student_id == models.CourseStudent.student_id,
                models.Submission.course_exercise_id == course_exercise_id,
            ),
        )
        .filter(
            models.CourseStudent.course_id == course_ex.course_id,
            models.CourseStudent.is_active.is_(True),
        )
        .order_by(models.User.full_name.asc())
    )

    rows = q.all()

    items: list[schemas.SubmissionListItem] = []
    for row in rows:
        has_media = row.media_path is not None

        item = schemas.SubmissionListItem(
            student_id=row.student_id,
            full_name=row.full_name,
            email=row.email,
            submission_id=row.submission_id,
            status=row.status,  # puede ser None si no hay entrega
            has_media=has_media,
            media_path=row.media_path,
            submitted_at=row.submitted_at,
        )
        items.append(item)

    return items



@router.get(
    "/course-exercises/{course_exercise_id}/students/{student_id}",
    response_model=schemas.SubmissionDetailOut,
)
def get_submission_detail_for_student_and_exercise(
    course_exercise_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Devuelve el detalle de la entrega de UN estudiante concreto
    para un CourseExercise concreto.

    Solo puede verlo el terapeuta dueño del curso.
    """
    require_therapist(current_user)

    # Confirma que el ejercicio pertenece a un curso del terapeuta
    _ = get_course_exercise_for_therapist(
        db, course_exercise_id, current_user.id
    )

    # Buscamos la entrega + datos del estudiante, asegurando
    # que el curso también pertenece al terapeuta
    row = (
        db.query(models.Submission, models.User, models.Course, models.CourseExercise)
        .join(models.User, models.User.id == models.Submission.student_id)
        .join(models.CourseExercise, models.CourseExercise.id == models.Submission.course_exercise_id)
        .join(models.Course, models.Course.id == models.CourseExercise.course_id)
        .filter(
            models.Submission.course_exercise_id == course_exercise_id,
            models.Submission.student_id == student_id,
            models.Course.therapist_id == current_user.id,
            models.CourseExercise.is_deleted.is_(False),
        )
        .first()
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entrega no encontrada para este estudiante y ejercicio.",
        )

    submission, student, _, _ = row

    submission_out = schemas.SubmissionOut.model_validate(submission)
    student_out = schemas.UserOut.model_validate(student)

    return schemas.SubmissionDetailOut(
        submission=submission_out,
        student=student_out,
    )


@router.get("/my/count")
def get_my_submissions_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Devuelve el conteo de entregas según el rol del usuario:
    - STUDENT: cuenta sus propias entregas
    - THERAPIST: cuenta todas las entregas recibidas en sus cursos
    """
    if current_user.role == models.UserRole.STUDENT:
        # Contar entregas del estudiante
        count = (
            db.query(models.Submission)
            .filter(models.Submission.student_id == current_user.id)
            .count()
        )
    else:  # THERAPIST
        # Contar entregas de todos los estudiantes en cursos del terapeuta
        count = (
            db.query(models.Submission)
            .join(models.CourseExercise)
            .join(models.Course)
            .filter(
                models.Course.therapist_id == current_user.id,
                models.Course.is_active.is_(True),
                models.Course.deleted_at.is_(None),
            )
            .count()
        )
    
    return {"count": count}


@router.get(
    "/courses/{course_id}/students/{student_id}/exercises-status",
    response_model=list[schemas.StudentExerciseStatus],
)
def list_student_exercises_status_in_course(
    course_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Devuelve el estado de TODAS las entregas de un estudiante
    para todos los CourseExercises de un curso.

    Solo puede verlo el terapeuta dueño del curso.
    
    Ruta: /submissions/courses/{course_id}/students/{student_id}/exercises-status
    """
    # 1) Asegurarnos que es terapeuta
    require_therapist(current_user)

    # 2) Verificar que el curso pertenece a este terapeuta
    course = (
        db.query(models.Course)
        .filter(
            models.Course.id == course_id,
            models.Course.therapist_id == current_user.id,
            models.Course.is_active.is_(True),
            models.Course.deleted_at.is_(None),
        )
        .first()
    )
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Curso no encontrado o no tienes permisos sobre este curso.",
        )

    # 3) Verificar que el estudiante está inscrito en este curso
    course_student = (
        db.query(models.CourseStudent)
        .filter(
            models.CourseStudent.course_id == course_id,
            models.CourseStudent.student_id == student_id,
            models.CourseStudent.is_active.is_(True),
        )
        .first()
    )
    if not course_student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El estudiante no está inscrito en este curso.",
        )

    # 4) Obtener TODOS los CourseExercises del curso,
    #    con outer join a Submission para ese estudiante
    q = (
        db.query(
            models.CourseExercise.id.label("course_exercise_id"),
            models.Exercise.name.label("exercise_name"),
            models.CourseExercise.due_date.label("due_date"),
            models.Submission.status.label("submission_status"),
            models.Submission.created_at.label("submitted_at"),
            models.Submission.media_path.label("media_path"),
        )
        .join(models.Exercise, models.Exercise.id == models.CourseExercise.exercise_id)
        .outerjoin(
            models.Submission,
            and_(
                models.Submission.course_exercise_id == models.CourseExercise.id,
                models.Submission.student_id == student_id,
            ),
        )
        .filter(
            models.CourseExercise.course_id == course_id,
            models.CourseExercise.is_deleted.is_(False),
        )
        .order_by(models.CourseExercise.published_at.asc())
    )

    rows = q.all()

    items: list[schemas.StudentExerciseStatus] = []
    for row in rows:
        # Si no hay submission, consideramos status = PENDING y submitted_at = None
        status = row.submission_status or models.SubmissionStatus.PENDING

        item = schemas.StudentExerciseStatus(
            course_exercise_id=row.course_exercise_id,
            exercise_name=row.exercise_name,
            due_date=row.due_date,
            status=status,
            submitted_at=row.submitted_at,
            has_media=bool(row.media_path),
        )
        items.append(item)

    return items



@router.get(
    "/{submission_id}/media-url",
    response_model=dict,
)
def get_submission_media_url(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Obtiene la URL firmada para acceder a la evidencia (foto/video) de una submission.
    Solo el terapeuta del curso o el estudiante dueño pueden acceder.
    """
    sub = db.query(models.Submission).filter(
        models.Submission.id == submission_id
    ).first()

    if not sub or not sub.media_path:
        raise HTTPException(status_code=404, detail="Media no encontrada")

    url = generate_signed_url(sub.media_path, minutes=60)
    return {"url": url}
