from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..deps import get_current_user

router = APIRouter(prefix="/profiles", tags=["profiles"])


def require_therapist(user: models.User):
    if user.role != models.UserRole.THERAPIST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo terapeutas pueden gestionar perfiles."
        )


# ==== CREATE PROFILE ====

@router.post("/", response_model=schemas.ProfileOut)
def create_profile(
    body: schemas.ProfileCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Crear un nuevo perfil de estudiante para personalización de ejercicios con IA"""
    require_therapist(current_user)
    
    profile = models.Profile(
        therapist_id=current_user.id,
        name=body.name,
        description=body.description,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    
    db.add(profile)
    db.commit()
    db.refresh(profile)
    
    return profile


# ==== GET ALL PROFILES ====

@router.get("/", response_model=list[schemas.ProfileOut])
def get_profiles(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Obtener todos los perfiles del terapeuta actual"""
    require_therapist(current_user)
    
    profiles = db.query(models.Profile).filter(
        models.Profile.therapist_id == current_user.id,
        models.Profile.is_deleted.is_(False),
    ).order_by(models.Profile.created_at.desc()).all()
    
    return profiles


# ==== GET PROFILE BY ID ====

@router.get("/{profile_id}", response_model=schemas.ProfileOut)
def get_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Obtener un perfil específico"""
    require_therapist(current_user)
    
    profile = db.query(models.Profile).filter(
        models.Profile.id == profile_id,
        models.Profile.therapist_id == current_user.id,
        models.Profile.is_deleted.is_(False),
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil no encontrado."
        )
    
    return profile


# ==== UPDATE PROFILE ====

@router.put("/{profile_id}", response_model=schemas.ProfileOut)
def update_profile(
    profile_id: int,
    body: schemas.ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Actualizar un perfil existente"""
    require_therapist(current_user)
    
    profile = db.query(models.Profile).filter(
        models.Profile.id == profile_id,
        models.Profile.therapist_id == current_user.id,
        models.Profile.is_deleted.is_(False),
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil no encontrado."
        )
    
    if body.name is not None:
        profile.name = body.name
    
    if body.description is not None:
        profile.description = body.description
    
    profile.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(profile)
    
    return profile


# ==== DELETE PROFILE ====

@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Eliminar un perfil (soft delete)"""
    require_therapist(current_user)
    
    profile = db.query(models.Profile).filter(
        models.Profile.id == profile_id,
        models.Profile.therapist_id == current_user.id,
        models.Profile.is_deleted.is_(False),
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil no encontrado."
        )
    
    profile.is_deleted = True
    profile.deleted_at = datetime.now(timezone.utc)
    
    db.commit()
    
    return None
