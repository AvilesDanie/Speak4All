from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_

from ..database import get_db
from .. import models, schemas
from ..deps import get_current_user

router = APIRouter(prefix="/progress", tags=["progress"])


def require_therapist(user: models.User):
    if user.role != models.UserRole.THERAPIST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo terapeutas pueden administrar ponderaciones y progreso."
        )


# ==== SET EXERCISE WEIGHTING ====

@router.post("/weightings", response_model=schemas.ExerciseWeightingOut)
def set_exercise_weighting(
    body: schemas.ExerciseWeightingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Define el peso/ponderación de un ejercicio para el progreso general"""
    require_therapist(current_user)
    
    # Verificar que el ejercicio pertenece al terapeuta
    ce = db.query(models.CourseExercise).join(
        models.Course, models.CourseExercise.course_id == models.Course.id
    ).filter(
        models.CourseExercise.id == body.course_exercise_id,
        models.Course.therapist_id == current_user.id,
    ).first()
    
    if not ce:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ejercicio no encontrado."
        )
    
    # Verificar si ya existe ponderación
    existing = db.query(models.ExerciseWeighting).filter(
        models.ExerciseWeighting.course_exercise_id == body.course_exercise_id
    ).first()
    
    if existing:
        existing.weight = body.weight
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing
    
    weighting = models.ExerciseWeighting(
        course_exercise_id=body.course_exercise_id,
        therapist_id=current_user.id,
        weight=body.weight,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(weighting)
    db.commit()
    db.refresh(weighting)
    return weighting


# ==== GET EXERCISE WEIGHTING ====

@router.get("/weightings/{course_exercise_id}", response_model=schemas.ExerciseWeightingOut)
def get_exercise_weighting(
    course_exercise_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Obtiene el peso de un ejercicio"""
    require_therapist(current_user)
    
    # Verificar acceso
    ce = db.query(models.CourseExercise).join(
        models.Course, models.CourseExercise.course_id == models.Course.id
    ).filter(
        models.CourseExercise.id == course_exercise_id,
        models.Course.therapist_id == current_user.id,
    ).first()
    
    if not ce:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ejercicio no encontrado."
        )
    
    weighting = db.query(models.ExerciseWeighting).filter(
        models.ExerciseWeighting.course_exercise_id == course_exercise_id
    ).first()
    
    if not weighting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ponderación no encontrada."
        )
    
    return weighting


# ==== GET ALL WEIGHTINGS FOR A COURSE ====

@router.get("/course/{course_id}/weightings", response_model=list[schemas.ExerciseWeightingOut])
def get_course_weightings(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Obtiene todas las ponderaciones de un curso"""
    require_therapist(current_user)
    
    # Verificar que el curso pertenece al terapeuta
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.therapist_id == current_user.id,
    ).first()
    
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Curso no encontrado."
        )
    
    weightings = db.query(models.ExerciseWeighting).join(
        models.CourseExercise,
        models.ExerciseWeighting.course_exercise_id == models.CourseExercise.id
    ).filter(
        models.CourseExercise.course_id == course_id
    ).all()
    
    return weightings


# ==== CALCULATE STUDENT PROGRESS ====

@router.get("/student/{student_id}/course/{course_id}", 
            response_model=schemas.StudentProgressWithEvaluation)
def get_student_progress(
    student_id: int,
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Calcula el progreso general ponderado de un estudiante en un curso.
    
    Fórmula:
    Progreso = (Suma de (Calificación_evaluación * Peso_ejercicio)) / (Suma de Pesos)
    
    Solo terapeutas pueden ver el progreso de todos los estudiantes.
    Los estudiantes solo pueden ver su propio progreso.
    """
    # Verificar acceso
    if current_user.role == models.UserRole.THERAPIST:
        # Verificar que el curso pertenece al terapeuta
        course = db.query(models.Course).filter(
            models.Course.id == course_id,
            models.Course.therapist_id == current_user.id,
        ).first()
        
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Curso no encontrado."
            )
    
    elif current_user.role == models.UserRole.STUDENT:
        if current_user.id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes ver el progreso de otros estudiantes."
            )
    
    # Obtener datos del estudiante
    student = db.query(models.User).filter(
        models.User.id == student_id
    ).first()
    
    if not student or student.role != models.UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estudiante no encontrado."
        )
    
    # Obtener ejercicios del curso
    course_exercises = db.query(models.CourseExercise).filter(
        models.CourseExercise.course_id == course_id,
        models.CourseExercise.is_deleted.is_(False),
    ).all()
    
    if not course_exercises:
        return schemas.StudentProgressWithEvaluation(
            student_id=student_id,
            full_name=student.full_name,
            email=student.email,
            avatar_path=student.avatar_path,
            weighted_score=0.0,
            total_exercises=0,
            evaluated_exercises=0,
            evaluations_summary="Sin ejercicios en el curso."
        )
    
    total_weight = 0
    weighted_score_sum = 0
    evaluated_count = 0
    
    for ce in course_exercises:
        # Obtener peso del ejercicio (por defecto 1)
        weighting = db.query(models.ExerciseWeighting).filter(
            models.ExerciseWeighting.course_exercise_id == ce.id
        ).first()
        
        weight = weighting.weight if weighting else 1
        total_weight += weight
        
        # Obtener evaluación del estudiante para este ejercicio
        evaluation = db.query(models.Evaluation).join(
            models.Submission,
            models.Evaluation.submission_id == models.Submission.id
        ).filter(
            models.Submission.course_exercise_id == ce.id,
            models.Submission.student_id == student_id,
            models.Evaluation.is_deleted.is_(False),
        ).first()
        
        if evaluation:
            evaluated_count += 1
            # Normalizar la puntuación a una escala de 0-100
            rubric = db.query(models.RubricTemplate).filter(
                models.RubricTemplate.id == evaluation.rubric_template_id
            ).first()
            
            if rubric and rubric.max_score > 0:
                normalized_score = (evaluation.total_score / rubric.max_score) * 100
                weighted_score_sum += normalized_score * weight
    
    # Calcular promedio ponderado
    weighted_score = (weighted_score_sum / total_weight) if total_weight > 0 else 0.0
    
    summary = f"Evaluado en {evaluated_count}/{len(course_exercises)} ejercicios. Promedio ponderado: {weighted_score:.1f}%"
    
    return schemas.StudentProgressWithEvaluation(
        student_id=student_id,
        full_name=student.full_name,
        email=student.email,
        avatar_path=student.avatar_path,
        weighted_score=round(weighted_score, 2),
        total_exercises=len(course_exercises),
        evaluated_exercises=evaluated_count,
        evaluations_summary=summary
    )


# ==== GET ALL STUDENTS PROGRESS IN COURSE ====

@router.get("/course/{course_id}/all", response_model=list[schemas.StudentProgressWithEvaluation])
def get_course_students_progress(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Obtiene el progreso de todos los estudiantes en un curso.
    Solo terapeutas pueden acceder a esto.
    """
    require_therapist(current_user)
    
    # Verificar que el curso pertenece al terapeuta
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.therapist_id == current_user.id,
    ).first()
    
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Curso no encontrado."
        )
    
    # Obtener todos los estudiantes del curso
    course_students = db.query(models.CourseStudent).filter(
        models.CourseStudent.course_id == course_id,
        models.CourseStudent.is_active.is_(True),
    ).all()
    
    progress_list = []
    for cs in course_students:
        # Calcular progreso para cada estudiante
        student = db.query(models.User).filter(
            models.User.id == cs.student_id
        ).first()
        
        # Obtener ejercicios del curso
        course_exercises = db.query(models.CourseExercise).filter(
            models.CourseExercise.course_id == course_id,
            models.CourseExercise.is_deleted.is_(False),
        ).all()
        
        total_weight = 0
        weighted_score_sum = 0
        evaluated_count = 0
        
        for ce in course_exercises:
            weighting = db.query(models.ExerciseWeighting).filter(
                models.ExerciseWeighting.course_exercise_id == ce.id
            ).first()
            
            weight = weighting.weight if weighting else 1
            total_weight += weight
            
            evaluation = db.query(models.Evaluation).join(
                models.Submission,
                models.Evaluation.submission_id == models.Submission.id
            ).filter(
                models.Submission.course_exercise_id == ce.id,
                models.Submission.student_id == cs.student_id,
                models.Evaluation.is_deleted.is_(False),
            ).first()
            
            if evaluation:
                evaluated_count += 1
                rubric = db.query(models.RubricTemplate).filter(
                    models.RubricTemplate.id == evaluation.rubric_template_id
                ).first()
                
                if rubric and rubric.max_score > 0:
                    normalized_score = (evaluation.total_score / rubric.max_score) * 100
                    weighted_score_sum += normalized_score * weight
        
        weighted_score = (weighted_score_sum / total_weight) if total_weight > 0 else 0.0
        summary = f"Evaluado en {evaluated_count}/{len(course_exercises)} ejercicios. Promedio: {weighted_score:.1f}%"
        
        progress_list.append(
            schemas.StudentProgressWithEvaluation(
                student_id=cs.student_id,
                full_name=student.full_name,
                email=student.email,
                avatar_path=student.avatar_path,
                weighted_score=round(weighted_score, 2),
                total_exercises=len(course_exercises),
                evaluated_exercises=evaluated_count,
                evaluations_summary=summary
            )
        )
    
    return progress_list


# ==== GET SUBMISSION WITH COMPLETE EVALUATION INFO ====

@router.get("/submission/{submission_id}/complete", 
            response_model=schemas.SubmissionWithEvaluation)
def get_submission_with_evaluation(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Obtiene una entrega con toda su información:
    - Datos de entrega
    - Datos del estudiante
    - Evaluación (si existe)
    - Observaciones
    - Rúbrica
    """
    submission = db.query(models.Submission).filter(
        models.Submission.id == submission_id
    ).first()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entrega no encontrada."
        )
    
    # Verificar acceso
    if current_user.role == models.UserRole.THERAPIST:
        # Verificar que es propietario del curso
        ce = db.query(models.CourseExercise).join(
            models.Course, models.CourseExercise.course_id == models.Course.id
        ).filter(
            models.CourseExercise.id == submission.course_exercise_id,
            models.Course.therapist_id == current_user.id,
        ).first()
        
        if not ce:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para ver esta entrega."
            )
    
    elif current_user.role == models.UserRole.STUDENT:
        if submission.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes ver la entrega de otros estudiantes."
            )
    
    # Obtener datos asociados
    student = db.query(models.User).filter(
        models.User.id == submission.student_id
    ).first()
    
    evaluation = db.query(models.Evaluation).filter(
        models.Evaluation.submission_id == submission_id,
        models.Evaluation.is_deleted.is_(False),
    ).options(
        joinedload(models.Evaluation.criterion_scores)
    ).first()
    
    observations = db.query(models.Observation).filter(
        models.Observation.submission_id == submission_id,
        models.Observation.is_deleted.is_(False),
    ).order_by(models.Observation.created_at.asc()).all()
    
    rubric = None
    if evaluation:
        rubric = db.query(models.RubricTemplate).filter(
            models.RubricTemplate.id == evaluation.rubric_template_id,
            models.RubricTemplate.is_deleted.is_(False),
        ).options(
            joinedload(models.RubricTemplate.criteria).joinedload(models.RubricCriteria.levels)
        ).first()
    
    return schemas.SubmissionWithEvaluation(
        submission=submission,
        student=student,
        evaluation=evaluation,
        observations=observations,
        rubric=rubric
    )
