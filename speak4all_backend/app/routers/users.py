from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import Optional
from pathlib import Path
import secrets

from ..database import get_db
from ..deps import get_current_user, hash_password, verify_password
from ..models import User
from ..schemas import UserOut, UserProfileUpdate, ChangePasswordRequest
from ..services import storage

router = APIRouter(prefix="/users", tags=["users"])

ALLOWED_AVATAR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_AVATAR_SIZE_MB = 5


@router.get("/me", response_model=UserOut)
def get_my_profile(current_user: User = Depends(get_current_user)):
    """Obtener perfil del usuario actual"""
    # Agregar el campo has_password dinámicamente
    user_dict = {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "created_at": current_user.created_at,
        "avatar_path": current_user.avatar_path,
        "has_password": bool(current_user.password_hash)
    }
    return user_dict


@router.put("/me", response_model=UserOut)
def update_my_profile(
    profile_update: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Actualizar perfil del usuario actual"""
    
    # Actualizar solo los campos proporcionados
    if profile_update.full_name is not None:
        current_user.full_name = profile_update.full_name
    
    if profile_update.email is not None:
        # Verificar que el email no esté en uso por otro usuario
        existing = db.query(User).filter(
            User.email == profile_update.email,
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        current_user.email = profile_update.email
    
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Subir o actualizar foto de perfil del usuario"""
    
    # Validar extensión
    file_ext = Path(file.filename or "").suffix.lower()
    if file_ext not in ALLOWED_AVATAR_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_AVATAR_EXTENSIONS)}"
        )
    
    # Validar tamaño
    file.file.seek(0, 2)  # Ir al final
    file_size = file.file.tell()
    file.file.seek(0)  # Volver al inicio
    
    if file_size > MAX_AVATAR_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max size: {MAX_AVATAR_SIZE_MB}MB"
        )
    
    # Eliminar avatar anterior si existe en storage
    if current_user.avatar_path:
        try:
            storage.delete_blob(current_user.avatar_path)
        except Exception:
            # Si falla el borrado, continuamos; no bloquea la subida
            pass

    # Generar nombre único para el archivo en GCS
    random_name = secrets.token_urlsafe(16)
    blob_name = f"avatars/{current_user.id}_{random_name}{file_ext}"

    # Subir a GCS
    storage.upload_fileobj(
        file_obj=file.file,
        destination_blob_name=blob_name,
        content_type=file.content_type,
    )

    # Actualizar usuario con el blob name
    current_user.avatar_path = blob_name
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.delete("/me/avatar", response_model=UserOut)
def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Eliminar foto de perfil del usuario"""
    
    if current_user.avatar_path:
        try:
            storage.delete_blob(current_user.avatar_path)
        except Exception:
            pass
        current_user.avatar_path = None
        db.commit()
        db.refresh(current_user)
    
    return current_user


@router.post("/me/change-password")
def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cambiar o establecer contraseña del usuario"""
    
    # Si el usuario NO tiene contraseña (solo OAuth), permitir establecer una nueva
    if not current_user.password_hash:
        # Establecer contraseña por primera vez
        current_user.password_hash = hash_password(password_data.new_password)
        db.commit()
        return {"message": "Password set successfully"}
    
    # Si el usuario YA tiene contraseña, validar la actual
    if not password_data.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is required to change password"
        )
    
    # Verificar contraseña actual
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect current password"
        )
    
    # Actualizar contraseña
    current_user.password_hash = hash_password(password_data.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}


@router.get("/me/avatar-url")
def get_my_avatar_url(current_user: User = Depends(get_current_user)):
    """Obtener URL firmada del avatar del usuario"""
    if not current_user.avatar_path:
        return {"url": None}

    # Generamos URL firmada desde GCS
    try:
        signed_url = storage.generate_signed_url(current_user.avatar_path, minutes=60)
        return {"url": signed_url}
    except Exception:
        return {"url": None}
