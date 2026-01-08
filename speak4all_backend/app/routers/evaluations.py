from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

from ..database import get_db
from .. import models, schemas
from ..deps import get_current_user

router = APIRouter(prefix="/evaluations", tags=["evaluations"])


def require_therapist(user: models.User):
    if user.role != models.UserRole.THERAPIST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo terapeutas pueden crear evaluaciones."
        )


def therapist_can_access_submission(
    db: Session,
    therapist_id: int,
    submission_id: int
) -> models.Submission:
    """Verifica que el terapeuta sea dueño del curso"""
    sub = (
        db.query(models.Submission)
        .join(models.CourseExercise, models.Submission.course_exercise_id == models.CourseExercise.id)
        .join(models.Course, models.CourseExercise.course_id == models.Course.id)
        .filter(
            models.Submission.id == submission_id,
            models.Course.therapist_id == therapist_id,
        )
        .first()
    )
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entrega no encontrada o no tienes permiso."
        )
    return sub


# ==== CREAR EVALUACIÓN ====

@router.post("/", response_model=schemas.EvaluationOut)
def create_evaluation(
    body: schemas.EvaluationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Crea una evaluación para una entrega usando la rúbrica"""
    require_therapist(current_user)
    
    # Verificar que la entrega existe y el terapeuta puede acceder
    sub = therapist_can_access_submission(db, current_user.id, body.submission_id)
    
    # Verificar que la rúbrica existe y es la correcta
    rubric = db.query(models.RubricTemplate).filter(
        models.RubricTemplate.id == body.rubric_template_id,
        models.RubricTemplate.is_deleted.is_(False),
    ).first()
    
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rúbrica no encontrada."
        )
    
    # Calcular puntuación total
    total_score = 0
    criterion_scores = []
    
    for score_data in body.criterion_scores:
        # Verificar que el criterio existe en la rúbrica
        criteria = db.query(models.RubricCriteria).filter(
            models.RubricCriteria.id == score_data.rubric_criteria_id,
            models.RubricCriteria.rubric_template_id == rubric.id,
            models.RubricCriteria.is_deleted.is_(False),
        ).first()
        
        if not criteria:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Criterio {score_data.rubric_criteria_id} no existe en la rúbrica."
            )
        
        # Verificar que el nivel existe en el criterio
        level = db.query(models.RubricLevel).filter(
            models.RubricLevel.id == score_data.rubric_level_id,
            models.RubricLevel.rubric_criteria_id == score_data.rubric_criteria_id,
            models.RubricLevel.is_deleted.is_(False),
        ).first()
        
        if not level:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Nivel {score_data.rubric_level_id} no existe en el criterio."
            )
        
        # Validar que los puntos no excedan el máximo
        if score_data.points_awarded > criteria.max_points:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Los puntos {score_data.points_awarded} exceden el máximo de {criteria.max_points}."
            )
        
        total_score += score_data.points_awarded
        criterion_scores.append(score_data)
    
    # Validar que la puntuación total no exceede el máximo de la rúbrica
    if total_score > rubric.max_score:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La puntuación total {total_score} excede el máximo de {rubric.max_score}."
        )
    
    # Crear evaluación
    evaluation = models.Evaluation(
        submission_id=body.submission_id,
        rubric_template_id=body.rubric_template_id,
        therapist_id=current_user.id,
        total_score=total_score,
        notes=body.notes,
        is_locked=True,  # Bloquear inmediatamente después de crear
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(evaluation)
    db.flush()
    
    # Crear puntajes por criterio
    for score_data in criterion_scores:
        crit_score = models.EvaluationCriterionScore(
            evaluation_id=evaluation.id,
            rubric_criteria_id=score_data.rubric_criteria_id,
            rubric_level_id=score_data.rubric_level_id,
            points_awarded=score_data.points_awarded,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(crit_score)
    
    db.commit()
    db.refresh(evaluation, ["criterion_scores"])
    return evaluation


# ==== OBTENER EVALUACIÓN ====

@router.get("/{evaluation_id}", response_model=schemas.EvaluationOut)
def get_evaluation(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Obtiene una evaluación específica"""
    evaluation = db.query(models.Evaluation).filter(
        models.Evaluation.id == evaluation_id,
        models.Evaluation.is_deleted.is_(False),
    ).options(
        joinedload(models.Evaluation.criterion_scores)
    ).first()
    
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluación no encontrada."
        )
    
    # Verificar acceso
    if current_user.role == models.UserRole.THERAPIST:
        therapist_can_access_submission(db, current_user.id, evaluation.submission_id)
    elif current_user.role == models.UserRole.STUDENT:
        sub = db.query(models.Submission).filter(
            models.Submission.id == evaluation.submission_id,
            models.Submission.student_id == current_user.id,
        ).first()
        
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para ver esta evaluación."
            )
    
    return evaluation


# ==== OBTENER EVALUACIÓN POR ENTREGA ====

@router.get("/submission/{submission_id}", response_model=schemas.EvaluationOut | None)
def get_evaluation_by_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Obtiene la evaluación de una entrega (si existe)"""
    # Verificar acceso a la entrega
    sub = db.query(models.Submission).filter(
        models.Submission.id == submission_id
    ).first()
    
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entrega no encontrada."
        )
    
    if current_user.role == models.UserRole.THERAPIST:
        therapist_can_access_submission(db, current_user.id, submission_id)
    elif current_user.role == models.UserRole.STUDENT:
        if sub.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para ver esta entrega."
            )
    
    evaluation = db.query(models.Evaluation).filter(
        models.Evaluation.submission_id == submission_id,
        models.Evaluation.is_deleted.is_(False),
    ).options(
        joinedload(models.Evaluation.criterion_scores)
    ).first()
    
    return evaluation


# ==== ACTUALIZAR EVALUACIÓN ====

@router.put("/{evaluation_id}", response_model=schemas.EvaluationOut)
def update_evaluation(
    evaluation_id: int,
    body: schemas.EvaluationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Actualiza una evaluación existente"""
    require_therapist(current_user)
    
    evaluation = db.query(models.Evaluation).filter(
        models.Evaluation.id == evaluation_id,
        models.Evaluation.is_deleted.is_(False),
    ).first()
    
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluación no encontrada."
        )
    
    # Verificar que el usuario sea el creador
    if evaluation.therapist_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el terapeuta que creó la evaluación puede actualizarla."
        )
    
    # Verificar si está bloqueada
    if evaluation.is_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta evaluación ya está finalizada y no se puede modificar."
        )
    
    # Si se proporcionan nuevas puntuaciones
    if body.criterion_scores:
        # Eliminar puntajes antiguos
        db.query(models.EvaluationCriterionScore).filter(
            models.EvaluationCriterionScore.evaluation_id == evaluation_id
        ).delete()
        
        # Calcular nuevas puntuaciones
        total_score = 0
        rubric = db.query(models.RubricTemplate).filter(
            models.RubricTemplate.id == evaluation.rubric_template_id
        ).first()
        
        for score_data in body.criterion_scores:
            # Verificar criterio
            criteria = db.query(models.RubricCriteria).filter(
                models.RubricCriteria.id == score_data.rubric_criteria_id,
                models.RubricCriteria.rubric_template_id == rubric.id,
                models.RubricCriteria.is_deleted.is_(False),
            ).first()
            
            if not criteria:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Criterio {score_data.rubric_criteria_id} no existe."
                )
            
            # Verificar nivel
            level = db.query(models.RubricLevel).filter(
                models.RubricLevel.id == score_data.rubric_level_id,
                models.RubricLevel.rubric_criteria_id == score_data.rubric_criteria_id,
                models.RubricLevel.is_deleted.is_(False),
            ).first()
            
            if not level:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Nivel {score_data.rubric_level_id} no existe."
                )
            
            if score_data.points_awarded > criteria.max_points:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Los puntos exceden el máximo permitido."
                )
            
            total_score += score_data.points_awarded
            
            crit_score = models.EvaluationCriterionScore(
                evaluation_id=evaluation_id,
                rubric_criteria_id=score_data.rubric_criteria_id,
                rubric_level_id=score_data.rubric_level_id,
                points_awarded=score_data.points_awarded,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(crit_score)
        
        if total_score > rubric.max_score:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La puntuación total excede el máximo permitido."
            )
        
        evaluation.total_score = total_score
    
    if body.notes is not None:
        evaluation.notes = body.notes
    
    evaluation.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(evaluation, ["criterion_scores"])
    return evaluation


# ==== ELIMINAR EVALUACIÓN ====

@router.delete("/{evaluation_id}")
def delete_evaluation(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Marca una evaluación como eliminada"""
    require_therapist(current_user)
    
    evaluation = db.query(models.Evaluation).filter(
        models.Evaluation.id == evaluation_id,
        models.Evaluation.is_deleted.is_(False),
    ).first()
    
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluación no encontrada."
        )
    
    if evaluation.therapist_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el terapeuta que creó la evaluación puede eliminarla."
        )
    
    evaluation.is_deleted = True
    evaluation.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"detail": "Evaluación eliminada."}


# ==== LISTAR EVALUACIONES POR EJERCICIO (para el terapeuta) ====

@router.get("/exercise/{course_exercise_id}/all", response_model=list[schemas.EvaluationOut])
def list_evaluations_for_exercise(
    course_exercise_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Lista todas las evaluaciones de un ejercicio de curso"""
    require_therapist(current_user)
    
    # Verificar que el ejercicio pertenece al terapeuta
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
    
    evaluations = db.query(models.Evaluation).join(
        models.Submission, models.Evaluation.submission_id == models.Submission.id
    ).filter(
        models.Submission.course_exercise_id == course_exercise_id,
        models.Evaluation.is_deleted.is_(False),
    ).options(
        joinedload(models.Evaluation.criterion_scores)
    ).all()
    
    return evaluations
