from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import models, schemas
from ..deps import get_current_user, get_db
from ..models import UserRole

router = APIRouter(prefix="/categories", tags=["categories"])


def require_therapist(current_user: models.User):
    """Verificar que el usuario es terapeuta"""
    if current_user.role != UserRole.THERAPIST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los terapeutas pueden gestionar categorías"
        )


# ==== CREATE ====

@router.post("/", response_model=schemas.ExerciseCategoryOut)
def create_category(
    data: schemas.ExerciseCategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Crear una nueva categoría de ejercicio"""
    require_therapist(current_user)
    
    category = models.ExerciseCategory(
        therapist_id=current_user.id,
        name=data.name,
        description=data.description,
        color=data.color,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


# ==== READ ====

@router.get("/", response_model=list[schemas.ExerciseCategoryOut])
def list_my_categories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Listar categorías del terapeuta actual"""
    require_therapist(current_user)
    
    categories = db.query(models.ExerciseCategory).filter(
        models.ExerciseCategory.therapist_id == current_user.id,
        models.ExerciseCategory.is_deleted.is_(False),
    ).all()
    
    return categories


@router.get("/{category_id}", response_model=schemas.ExerciseCategoryOut)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Obtener una categoría específica"""
    require_therapist(current_user)
    
    category = db.query(models.ExerciseCategory).filter(
        models.ExerciseCategory.id == category_id,
        models.ExerciseCategory.therapist_id == current_user.id,
        models.ExerciseCategory.is_deleted.is_(False),
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada"
        )
    
    return category


# ==== UPDATE ====

@router.put("/{category_id}", response_model=schemas.ExerciseCategoryOut)
def update_category(
    category_id: int,
    data: schemas.ExerciseCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Actualizar una categoría"""
    require_therapist(current_user)
    
    category = db.query(models.ExerciseCategory).filter(
        models.ExerciseCategory.id == category_id,
        models.ExerciseCategory.therapist_id == current_user.id,
        models.ExerciseCategory.is_deleted.is_(False),
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada"
        )
    
    if data.name is not None:
        category.name = data.name
    if data.description is not None:
        category.description = data.description
    if data.color is not None:
        category.color = data.color
    
    db.commit()
    db.refresh(category)
    return category


# ==== DELETE ====

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Eliminar una categoría (borrado lógico)"""
    require_therapist(current_user)
    
    category = db.query(models.ExerciseCategory).filter(
        models.ExerciseCategory.id == category_id,
        models.ExerciseCategory.therapist_id == current_user.id,
        models.ExerciseCategory.is_deleted.is_(False),
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada"
        )
    
    from datetime import datetime, timezone
    category.is_deleted = True
    category.deleted_at = datetime.now(timezone.utc)
    db.commit()
    
    return None
