from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from ..database import get_db
from .. import models, schemas
from ..deps import get_current_user

router = APIRouter()


def require_therapist(user: models.User):
    if user.role != models.UserRole.THERAPIST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo terapeutas pueden gestionar estudiantes del curso."
        )

def require_student(user: models.User):
    if user.role != models.UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo estudiantes pueden ver sus ejercicios del curso."
        )



def get_course_owned_by_therapist(
    db: Session,
    course_id: int,
    therapist_id: int,
) -> models.Course:
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.therapist_id == therapist_id,
        models.Course.is_active.is_(True),
    ).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Curso no encontrado o no pertenece al terapeuta."
        )

    return course


# ==== Resumen por estudiante en un curso ====

@router.get(
    "/{course_id}/students/progress",
    response_model=list[schemas.StudentProgressSummary],
)
def list_course_students_progress(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Devuelve, para cada estudiante del curso:
    - nombre, email
    - total de ejercicios publicados en el curso
    - cantidad de ejercicios entregados (DONE)
    - fecha de última entrega
    """
    require_therapist(current_user)
    course = get_course_owned_by_therapist(db, course_id, current_user.id)

    # Total de ejercicios publicados en el curso
    total_ex = db.query(models.CourseExercise).filter(
        models.CourseExercise.course_id == course.id,
        models.CourseExercise.is_deleted.is_(False),
    ).count()

    # Estudiantes activos en el curso
    cs = (
        db.query(models.CourseStudent, models.User)
        .join(models.User, models.User.id == models.CourseStudent.student_id)
        .filter(
            models.CourseStudent.course_id == course.id,
            models.CourseStudent.is_active.is_(True),
        )
        .all()
    )

    # Submissions por estudiante
    subs = (
        db.query(
            models.Submission.student_id,
            func.sum(
                case(
                    (models.Submission.status == models.SubmissionStatus.DONE, 1),
                    else_=0,
                )
            ).label("done_count"),
            func.max(models.Submission.updated_at).label("last_submission_at"),
        )
        .join(
            models.CourseExercise,
            models.Submission.course_exercise_id == models.CourseExercise.id,
        )
        .filter(
            models.CourseExercise.course_id == course.id,
            models.CourseExercise.is_deleted.is_(False),
        )
        .group_by(models.Submission.student_id)
        .all()
    )


    done_map = {row.student_id: (row.done_count, row.last_submission_at) for row in subs}

    result: list[schemas.StudentProgressSummary] = []
    for cs_row, user in cs:
        done_count, last_at = done_map.get(user.id, (0, None))
        result.append(
            schemas.StudentProgressSummary(
                student_id=user.id,
                full_name=user.full_name,
                email=user.email,
                total_exercises=total_ex,
                done_exercises=done_count,
                last_submission_at=last_at,
            )
        )

    return result


# ==== Detalle por estudiante: lista de ejercicios y estado ====

@router.get(
    "/{course_id}/students/{student_id}/exercises",
    response_model=list[schemas.StudentExerciseStatus],
)
def list_student_exercises_status(
    course_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Muestra, para un estudiante específico en un curso:
    - cada ejercicio publicado
    - estado de submission (PENDING / DONE)
    - fecha de entrega si existe
    """
    require_therapist(current_user)
    course = get_course_owned_by_therapist(db, course_id, current_user.id)

    # Verificar que el estudiante esté en el curso
    cs = db.query(models.CourseStudent).filter(
        models.CourseStudent.course_id == course.id,
        models.CourseStudent.student_id == student_id,
        models.CourseStudent.is_active.is_(True),
    ).first()

    if not cs:
        raise HTTPException(
            status_code=404,
            detail="El estudiante no pertenece a este curso."
        )

    # Traer todos los ejercicios del curso y las submissions del estudiante
    ce_list = (
        db.query(models.CourseExercise, models.Exercise)
        .join(models.Exercise, models.Exercise.id == models.CourseExercise.exercise_id)
        .filter(
            models.CourseExercise.course_id == course.id,
            models.CourseExercise.is_deleted.is_(False),
        )
        .all()
    )

    subs = (
        db.query(models.Submission)
        .filter(
            models.Submission.student_id == student_id,
        )
        .all()
    )
    subs_map = {s.course_exercise_id: s for s in subs}

    result: list[schemas.StudentExerciseStatus] = []
    for ce, ex in ce_list:
        s = subs_map.get(ce.id)
        status = s.status if s else models.SubmissionStatus.PENDING
        submitted_at = s.updated_at if s else None

        result.append(
            schemas.StudentExerciseStatus(
                course_exercise_id=ce.id,
                exercise_name=ex.name,
                due_date=ce.due_date,
                status=status,
                submitted_at=submitted_at,
            )
        )

    # ordenamos por due_date o por published_at si quieres afinar luego
    result.sort(key=lambda x: (x.due_date or datetime.max.replace(tzinfo=timezone.utc)))
    return result





@router.get(
    "/{course_id}/me/exercises",
    response_model=list[schemas.StudentExerciseStatus],
)
def list_my_exercises_status(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Muestra, para el estudiante autenticado en un curso:
    - cada ejercicio publicado en el curso
    - estado de submission (PENDING / DONE)
    - fecha de entrega si existe
    """
    require_student(current_user)

    # Verificar que el curso exista y esté activo
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.is_active.is_(True),
    ).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Curso no encontrado."
        )

    # Verificar que el estudiante pertenezca al curso
    cs = db.query(models.CourseStudent).filter(
        models.CourseStudent.course_id == course.id,
        models.CourseStudent.student_id == current_user.id,
        models.CourseStudent.is_active.is_(True),
    ).first()

    if not cs:
        raise HTTPException(
            status_code=403,
            detail="No estás inscrito en este curso."
        )

    # Traer todos los ejercicios del curso
    ce_list = (
        db.query(models.CourseExercise, models.Exercise)
        .join(models.Exercise, models.Exercise.id == models.CourseExercise.exercise_id)
        .filter(
            models.CourseExercise.course_id == course.id,
            models.CourseExercise.is_deleted.is_(False),
        )
        .all()
    )

    # Traer las submissions del estudiante actual (en cualquier curso; se filtrará por id)
    subs = (
        db.query(models.Submission)
        .filter(
            models.Submission.student_id == current_user.id,
        )
        .all()
    )
    subs_map = {s.course_exercise_id: s for s in subs}

    result: list[schemas.StudentExerciseStatus] = []
    for ce, ex in ce_list:
        s = subs_map.get(ce.id)
        status = s.status if s else models.SubmissionStatus.PENDING
        submitted_at = s.updated_at if s else None

        result.append(
            schemas.StudentExerciseStatus(
                course_exercise_id=ce.id,
                exercise_name=ex.name,
                due_date=ce.due_date,
                status=status,
                submitted_at=submitted_at,
            )
        )

    # ordenamos por fecha de entrega
    result.sort(key=lambda x: (x.due_date or datetime.max.replace(tzinfo=timezone.utc)))
    return result