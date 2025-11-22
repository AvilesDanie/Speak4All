# app/routers/course_exercises.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter()


def require_therapist(user: models.User):
    if user.role != models.UserRole.THERAPIST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los terapeutas pueden publicar ejercicios."
        )


def require_student(user: models.User):
    if user.role != models.UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los estudiantes pueden acceder a esta vista."
        )


# ==== PUBLICAR ====

@router.post("/", response_model=schemas.CourseExerciseOut)
def publish_exercise_to_course(
    body: schemas.CourseExerciseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Publica un ejercicio existente en un curso (solo terapeuta).
    """
    require_therapist(current_user)

    # Verificar que el curso pertenece al terapeuta
    course = db.query(models.Course).filter(
        models.Course.id == body.course_id,
        models.Course.therapist_id == current_user.id,
        models.Course.is_active.is_(True)
    ).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Curso no encontrado o no pertenece al terapeuta."
        )

    # Verificar que el ejercicio pertenece al terapeuta
    exercise = db.query(models.Exercise).filter(
        models.Exercise.id == body.exercise_id,
        models.Exercise.therapist_id == current_user.id,
        models.Exercise.is_deleted.is_(False)
    ).first()

    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ejercicio no encontrado o no pertenece al terapeuta."
        )

    course_ex = models.CourseExercise(
        course_id=course.id,
        exercise_id=exercise.id,
        published_at=datetime.now(timezone.utc),
        due_date=body.due_date,
    )

    db.add(course_ex)
    db.commit()
    db.refresh(course_ex)
    return course_ex


# ==== LISTAR ejercicios publicados en un curso ====

@router.get("/{course_id}", response_model=list[schemas.CourseExerciseOut])
def list_course_exercises(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Lista los ejercicios publicados en un curso.
    - Si es terapeuta: solo puede ver los de sus cursos.
    - Si es estudiante: solo los cursos a los que pertenece.
    """
    query = db.query(models.CourseExercise).options(joinedload(models.CourseExercise.exercise))

    if current_user.role == models.UserRole.THERAPIST:
        query = query.join(models.Course).filter(
            models.Course.therapist_id == current_user.id,
            models.Course.id == course_id
        )
    elif current_user.role == models.UserRole.STUDENT:
        query = query.join(models.Course).join(models.CourseStudent).filter(
            models.CourseStudent.student_id == current_user.id,
            models.Course.id == course_id
        )
    else:
        raise HTTPException(status_code=403, detail="Rol no permitido.")

    items = query.filter(models.CourseExercise.is_deleted.is_(False)).order_by(
        models.CourseExercise.published_at.desc()
    ).all()

    return items
