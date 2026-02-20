from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..deps import get_current_user

router = APIRouter(prefix="/profiles", tags=["profiles"])

PROFILE_NAME_MAX_LENGTH = 80
PROFILE_DESCRIPTION_MAX_LENGTH = 500


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
    
    normalized_name = body.name.strip()
    normalized_description = body.description.strip()

    if not normalized_name or not normalized_description:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nombre y descripción son obligatorios.",
        )

    if len(normalized_name) > PROFILE_NAME_MAX_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El nombre no puede superar {PROFILE_NAME_MAX_LENGTH} caracteres.",
        )

    if len(normalized_description) > PROFILE_DESCRIPTION_MAX_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La descripción no puede superar {PROFILE_DESCRIPTION_MAX_LENGTH} caracteres.",
        )

    profile = models.Profile(
        therapist_id=current_user.id,
        name=normalized_name,
        description=normalized_description,
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
        normalized_name = body.name.strip()
        if not normalized_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre no puede estar vacío.",
            )
        if len(normalized_name) > PROFILE_NAME_MAX_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El nombre no puede superar {PROFILE_NAME_MAX_LENGTH} caracteres.",
            )
        profile.name = normalized_name
    
    if body.description is not None:
        normalized_description = body.description.strip()
        if not normalized_description:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La descripción no puede estar vacía.",
            )
        if len(normalized_description) > PROFILE_DESCRIPTION_MAX_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La descripción no puede superar {PROFILE_DESCRIPTION_MAX_LENGTH} caracteres.",
            )
        profile.description = normalized_description
    
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
