from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_

from ..database import get_db
from .. import models, schemas
from ..deps import get_current_user

router = APIRouter(prefix="/rubrics", tags=["rubrics"])


def require_therapist(user: models.User):
    if user.role != models.UserRole.THERAPIST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo terapeutas pueden administrar rúbricas."
        )


def therapist_can_access_course_exercise(
    db: Session,
    therapist_id: int,
    course_exercise_id: int
) -> models.CourseExercise:
    """Verifica que el terapeuta sea dueño del curso"""
    ce = (
        db.query(models.CourseExercise)
        .join(models.Course, models.CourseExercise.course_id == models.Course.id)
        .filter(
            models.CourseExercise.id == course_exercise_id,
            models.Course.therapist_id == therapist_id,
        )
        .first()
    )
    if not ce:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ejercicio de curso no encontrado o no tienes permiso."
        )
    return ce


def rubric_has_evaluations(db: Session, rubric_template_id: int) -> bool:
    """Verifica si una rúbrica tiene evaluaciones asociadas"""
    evaluation = db.query(models.Evaluation).filter(
        models.Evaluation.rubric_template_id == rubric_template_id,
        models.Evaluation.is_deleted.is_(False),
    ).first()
    return evaluation is not None


# ==== CREAR RÚBRICA VACÍA ====

@router.post("/{course_exercise_id}/create-empty", response_model=schemas.RubricTemplateOut)
def create_empty_rubric(
    course_exercise_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Crea una rúbrica vacía (sin criterios) para un ejercicio.
    Los criterios se agregarán posteriormente.
    """
    require_therapist(current_user)
    
    ce = therapist_can_access_course_exercise(db, current_user.id, course_exercise_id)
    
    # Verificar que no exista ya una rúbrica
    existing = db.query(models.RubricTemplate).filter(
        models.RubricTemplate.course_exercise_id == course_exercise_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una rúbrica para este ejercicio."
        )
    
    # Crear rúbrica vacía
    rubric = models.RubricTemplate(
        course_exercise_id=course_exercise_id,
        therapist_id=current_user.id,
        max_score=100,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(rubric)
    db.commit()
    db.refresh(rubric, ["criteria"])
    return rubric


# ==== CREAR RÚBRICA POR DEFECTO ====

@router.post("/{course_exercise_id}/create-default", response_model=schemas.RubricTemplateOut)
def create_default_rubric(
    course_exercise_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Crea una rúbrica por defecto para un ejercicio.
    Viene con criterios base: Pronunciación, Fluidez, Comprensión.
    """
    require_therapist(current_user)
    
    ce = therapist_can_access_course_exercise(db, current_user.id, course_exercise_id)
    
    # Verificar que no exista ya una rúbrica
    existing = db.query(models.RubricTemplate).filter(
        models.RubricTemplate.course_exercise_id == course_exercise_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una rúbrica para este ejercicio."
        )
    
    # Crear rúbrica base (100 puntos totales)
    rubric = models.RubricTemplate(
        course_exercise_id=course_exercise_id,
        therapist_id=current_user.id,
        max_score=100,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(rubric)
    db.flush()  # Para obtener el ID
    
    # Criterios por defecto
    default_criteria = [
        {
            "name": "Pronunciación",
            "description": "Claridad y corrección de la pronunciación",
            "max_points": 25,
            "levels": [
                {"name": "Excelente", "points": 25, "order": 3},
                {"name": "Bueno", "points": 20, "order": 2},
                {"name": "Aceptable", "points": 15, "order": 1},
                {"name": "Insuficiente", "points": 0, "order": 0},
            ]
        },
        {
            "name": "Fluidez",
            "description": "Continuidad y naturalidad en el habla",
            "max_points": 25,
            "levels": [
                {"name": "Excelente", "points": 25, "order": 3},
                {"name": "Bueno", "points": 20, "order": 2},
                {"name": "Aceptable", "points": 15, "order": 1},
                {"name": "Insuficiente", "points": 0, "order": 0},
            ]
        },
        {
            "name": "Comprensión",
            "description": "Demostración de comprensión del contenido",
            "max_points": 25,
            "levels": [
                {"name": "Excelente", "points": 25, "order": 3},
                {"name": "Bueno", "points": 20, "order": 2},
                {"name": "Aceptable", "points": 15, "order": 1},
                {"name": "Insuficiente", "points": 0, "order": 0},
            ]
        },
        {
            "name": "Participación",
            "description": "Nivel de participación y esfuerzo",
            "max_points": 25,
            "levels": [
                {"name": "Excelente", "points": 25, "order": 3},
                {"name": "Bueno", "points": 20, "order": 2},
                {"name": "Aceptable", "points": 15, "order": 1},
                {"name": "Insuficiente", "points": 0, "order": 0},
            ]
        },
    ]
    
    for idx, crit_data in enumerate(default_criteria):
        criteria = models.RubricCriteria(
            rubric_template_id=rubric.id,
            name=crit_data["name"],
            description=crit_data["description"],
            max_points=crit_data["max_points"],
            order=idx,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(criteria)
        db.flush()
        
        for level_data in crit_data["levels"]:
            level = models.RubricLevel(
                rubric_criteria_id=criteria.id,
                name=level_data["name"],
                points=level_data["points"],
                order=level_data["order"],
                created_at=datetime.now(timezone.utc),
            )
            db.add(level)
    
    db.commit()
    db.refresh(rubric, ["criteria"])
    return rubric


# ==== OBTENER RÚBRICA ====

@router.get("/{course_exercise_id}", response_model=schemas.RubricTemplateOut)
def get_rubric(
    course_exercise_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Obtiene la rúbrica de un ejercicio de curso (terapeuta o estudiante inscrito)"""
    
    # Verificar acceso según rol
    if current_user.role == models.UserRole.THERAPIST:
        # Terapeuta debe ser dueño del curso
        therapist_can_access_course_exercise(db, current_user.id, course_exercise_id)
    elif current_user.role == models.UserRole.STUDENT:
        # Estudiante debe estar inscrito en el curso
        ce = db.query(models.CourseExercise).filter(
            models.CourseExercise.id == course_exercise_id,
            models.CourseExercise.is_deleted.is_(False),
        ).first()
        
        if not ce:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ejercicio no encontrado."
            )
        
        # Verificar que el estudiante esté inscrito en el curso
        student_in_course = db.query(models.CourseStudent).filter(
            models.CourseStudent.course_id == ce.course_id,
            models.CourseStudent.student_id == current_user.id,
        ).first()
        
        if not student_in_course:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes acceso a este ejercicio."
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para ver rúbricas."
        )
    
    rubric = db.query(models.RubricTemplate).filter(
        models.RubricTemplate.course_exercise_id == course_exercise_id,
        models.RubricTemplate.is_deleted.is_(False),
    ).options(
        joinedload(models.RubricTemplate.criteria).joinedload(models.RubricCriteria.levels)
    ).first()
    
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rúbrica no encontrada."
        )
    
    return rubric


# ==== VERIFICAR SI RÚBRICA TIENE EVALUACIONES ====

@router.get("/{course_exercise_id}/has-evaluations")
def check_rubric_has_evaluations(
    course_exercise_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Verifica si una rúbrica tiene evaluaciones asociadas"""
    require_therapist(current_user)
    ce = therapist_can_access_course_exercise(db, current_user.id, course_exercise_id)
    
    rubric = db.query(models.RubricTemplate).filter(
        models.RubricTemplate.course_exercise_id == course_exercise_id,
        models.RubricTemplate.is_deleted.is_(False),
    ).first()
    
    if not rubric:
        return {"has_evaluations": False}
    
    has_evals = rubric_has_evaluations(db, rubric.id)
    return {"has_evaluations": has_evals}


# ==== ACTUALIZAR MÁXIMA PUNTUACIÓN ====

@router.put("/{course_exercise_id}", response_model=schemas.RubricTemplateOut)
def update_rubric(
    course_exercise_id: int,
    body: schemas.RubricTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Actualiza la puntuación máxima de una rúbrica"""
    require_therapist(current_user)
    ce = therapist_can_access_course_exercise(db, current_user.id, course_exercise_id)
    
    rubric = db.query(models.RubricTemplate).filter(
        models.RubricTemplate.course_exercise_id == course_exercise_id,
        models.RubricTemplate.is_deleted.is_(False),
    ).first()
    
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rúbrica no encontrada."
        )
    
    if rubric_has_evaluations(db, rubric.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede modificar una rúbrica que ya tiene evaluaciones."
        )
    
    if body.max_score:
        rubric.max_score = body.max_score
    
    rubric.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rubric, ["criteria"])
    return rubric


# ==== AGREGAR CRITERIO ====

@router.post("/{course_exercise_id}/criteria", response_model=schemas.RubricCriteriaOut)
def add_criterion(
    course_exercise_id: int,
    body: schemas.RubricCriteriaCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Agrega un criterio a la rúbrica"""
    require_therapist(current_user)
    ce = therapist_can_access_course_exercise(db, current_user.id, course_exercise_id)
    
    rubric = db.query(models.RubricTemplate).filter(
        models.RubricTemplate.course_exercise_id == course_exercise_id,
        models.RubricTemplate.is_deleted.is_(False),
    ).first()
    
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rúbrica no encontrada."
        )
    
    if rubric_has_evaluations(db, rubric.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede modificar una rúbrica que ya tiene evaluaciones."
        )
    
    criteria = models.RubricCriteria(
        rubric_template_id=rubric.id,
        name=body.name,
        description=body.description,
        max_points=body.max_points,
        order=body.order,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(criteria)
    db.flush()
    
    # Agregar niveles si se proporcionan
    for level_data in body.levels:
        level = models.RubricLevel(
            rubric_criteria_id=criteria.id,
            name=level_data.name,
            description=level_data.description,
            points=level_data.points,
            order=level_data.order,
            created_at=datetime.now(timezone.utc),
        )
        db.add(level)
    
    db.commit()
    db.refresh(criteria, ["levels"])
    return criteria


# ==== ACTUALIZAR CRITERIO ====

@router.put("/criteria/{criteria_id}", response_model=schemas.RubricCriteriaOut)
def update_criterion(
    criteria_id: int,
    body: schemas.RubricCriteriaUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Actualiza un criterio de la rúbrica"""
    require_therapist(current_user)
    
    criteria = db.query(models.RubricCriteria).filter(
        models.RubricCriteria.id == criteria_id,
        models.RubricCriteria.is_deleted.is_(False),
    ).first()
    
    if not criteria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Criterio no encontrado."
        )
    
    # Verificar que el usuario sea el propietario
    rubric = db.query(models.RubricTemplate).filter(
        models.RubricTemplate.id == criteria.rubric_template_id
    ).first()
    
    if rubric.therapist_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para editar este criterio."
        )
    
    if rubric_has_evaluations(db, rubric.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede modificar una rúbrica que ya tiene evaluaciones."
        )
    
    if body.name:
        criteria.name = body.name
    if body.description is not None:
        criteria.description = body.description
    if body.max_points:
        criteria.max_points = body.max_points
    if body.order is not None:
        criteria.order = body.order
    
    criteria.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(criteria, ["levels"])
    return criteria


# ==== ELIMINAR CRITERIO (lógico) ====

@router.delete("/criteria/{criteria_id}")
def delete_criterion(
    criteria_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Marca un criterio como eliminado"""
    require_therapist(current_user)
    
    criteria = db.query(models.RubricCriteria).filter(
        models.RubricCriteria.id == criteria_id,
        models.RubricCriteria.is_deleted.is_(False),
    ).first()
    
    if not criteria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Criterio no encontrado."
        )
    
    # Verificar que el usuario sea el propietario
    rubric = db.query(models.RubricTemplate).filter(
        models.RubricTemplate.id == criteria.rubric_template_id
    ).first()
    
    if rubric.therapist_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para eliminar este criterio."
        )
    
    if rubric_has_evaluations(db, rubric.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede modificar una rúbrica que ya tiene evaluaciones."
        )
    
    criteria.is_deleted = True
    criteria.updated_at = datetime.now(timezone.utc)
    
    # Marcar niveles como eliminados
    for level in criteria.levels:
        level.is_deleted = True
    
    db.commit()
    return {"detail": "Criterio eliminado."}


# ==== ACTUALIZAR NIVELES DE UN CRITERIO ====

@router.put("/criteria/{criteria_id}/levels/{level_id}", response_model=schemas.RubricLevelOut)
def update_level(
    criteria_id: int,
    level_id: int,
    body: schemas.RubricLevelUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Actualiza un nivel dentro de un criterio"""
    require_therapist(current_user)
    
    level = db.query(models.RubricLevel).filter(
        models.RubricLevel.id == level_id,
        models.RubricLevel.rubric_criteria_id == criteria_id,
        models.RubricLevel.is_deleted.is_(False),
    ).first()
    
    if not level:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nivel no encontrado."
        )
    
    # Verificar que el usuario sea el propietario
    criteria = db.query(models.RubricCriteria).filter(
        models.RubricCriteria.id == criteria_id
    ).first()
    
    rubric = db.query(models.RubricTemplate).filter(
        models.RubricTemplate.id == criteria.rubric_template_id
    ).first()
    
    if rubric.therapist_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para editar este nivel."
        )
    
    if rubric_has_evaluations(db, rubric.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede modificar una rúbrica que ya tiene evaluaciones."
        )
    
    if body.name:
        level.name = body.name
    if body.description is not None:
        level.description = body.description
    if body.points is not None:
        level.points = body.points
    if body.order is not None:
        level.order = body.order
    
    db.commit()
    db.refresh(level)
    return level


# ==== AGREGAR NIVEL A UN CRITERIO ====

@router.post("/criteria/{criteria_id}/levels", response_model=schemas.RubricLevelOut)
def add_level(
    criteria_id: int,
    body: schemas.RubricLevelCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Agrega un nivel a un criterio"""
    require_therapist(current_user)
    
    criteria = db.query(models.RubricCriteria).filter(
        models.RubricCriteria.id == criteria_id,
        models.RubricCriteria.is_deleted.is_(False),
    ).first()
    
    if not criteria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Criterio no encontrado."
        )
    
    # Verificar que el usuario sea el propietario
    rubric = db.query(models.RubricTemplate).filter(
        models.RubricTemplate.id == criteria.rubric_template_id
    ).first()
    
    if rubric.therapist_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para editar este criterio."
        )
    
    if rubric_has_evaluations(db, rubric.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede modificar una rúbrica que ya tiene evaluaciones."
        )
    
    level = models.RubricLevel(
        rubric_criteria_id=criteria_id,
        name=body.name,
        description=body.description,
        points=body.points,
        order=body.order,
        created_at=datetime.now(timezone.utc),
    )
    db.add(level)
    db.commit()
    db.refresh(level)
    return level


# ==== ELIMINAR NIVEL ====

@router.delete("/criteria/{criteria_id}/levels/{level_id}")
def delete_level(
    criteria_id: int,
    level_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Marca un nivel como eliminado"""
    require_therapist(current_user)
    
    level = db.query(models.RubricLevel).filter(
        models.RubricLevel.id == level_id,
        models.RubricLevel.rubric_criteria_id == criteria_id,
        models.RubricLevel.is_deleted.is_(False),
    ).first()
    
    if not level:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nivel no encontrado."
        )
    
    # Verificar que el usuario sea el propietario
    criteria = db.query(models.RubricCriteria).filter(
        models.RubricCriteria.id == criteria_id
    ).first()
    
    rubric = db.query(models.RubricTemplate).filter(
        models.RubricTemplate.id == criteria.rubric_template_id
    ).first()
    
    if rubric.therapist_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para eliminar este nivel."
        )
    
    if rubric_has_evaluations(db, rubric.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede modificar una rúbrica que ya tiene evaluaciones."
        )
    
    level.is_deleted = True
    db.commit()
    return {"detail": "Nivel eliminado."}
