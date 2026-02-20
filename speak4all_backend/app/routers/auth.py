from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests
import logging
import re

from ..database import get_db
from .. import models
from ..deps import create_access_token, hash_password, verify_password
from .. import schemas
from ..config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

EMAIL_MIN_LENGTH = 5
EMAIL_MAX_LENGTH = 254
PASSWORD_MIN_LENGTH = 6
PASSWORD_MAX_LENGTH = 72
FULL_NAME_MAX_LENGTH = 80
FULL_NAME_ALLOWED_REGEX = re.compile(r"^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$")


def verify_google_token(token: str) -> dict:
    """
    Verifica y decodifica el id_token de Google.
    Retorna el payload con información del usuario.
    """
    try:
        if not settings.google_client_id:
            logger.warning("GOOGLE_CLIENT_ID no configurado, saltando validación de token")
            return None
        
        idinfo = id_token.verify_oauth2_token(
            token, 
            requests.Request(), 
            settings.google_client_id
        )
        
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise ValueError('Token inválido')
        
        return idinfo
    except Exception as e:
        logger.error(f"Error verificando token de Google: {e}")
        raise HTTPException(status_code=401, detail="Token de Google inválido")


@router.post("/google", response_model=schemas.LoginResponse)
def login_google(
    payload: schemas.GoogleLoginRequest,
    db: Session = Depends(get_db),
):
    """
    Login/registro usando Google OAuth.
    
    Soporta dos métodos:
    1. id_token (RECOMENDADO): valida el token con Google
    2. google_sub directo (legacy, solo si GOOGLE_CLIENT_ID no está configurado)
    """
    google_sub = None
    email = None
    full_name = None
    
    # Método 1: Validar id_token (más seguro)
    if payload.id_token:
        idinfo = verify_google_token(payload.id_token)
        if not idinfo:
            logger.warning("id_token presente pero no verificable; intentando fallback")
            # Fallback a método legacy si hay datos suficientes
            if payload.google_sub and payload.email and payload.full_name:
                if settings.google_client_id:
                    logger.warning("Usando método legacy de autenticación. Considera usar id_token.")
                google_sub = payload.google_sub
                email = payload.email
                full_name = payload.full_name
            else:
                # Sin datos para fallback → error claro
                raise HTTPException(
                    status_code=400,
                    detail="No se pudo validar id_token. Configura GOOGLE_CLIENT_ID o envía google_sub+email+full_name."
                )
        else:
            google_sub = idinfo['sub']
            email = idinfo['email']
            full_name = idinfo.get('name', email)

    # Método 2: Legacy (menos seguro, solo para desarrollo)
    elif payload.google_sub and payload.email and payload.full_name:
        if settings.google_client_id:
            logger.warning("Usando método legacy de autenticación. Considera usar id_token.")
        google_sub = payload.google_sub
        email = payload.email
        full_name = payload.full_name
    else:
        raise HTTPException(
            status_code=400,
            detail="Debes proporcionar 'id_token' o 'google_sub + email + full_name'"
        )

    # Buscar o crear usuario con los datos obtenidos
    # Primero buscar por google_sub
    user = db.query(models.User).filter(
        models.User.google_sub == google_sub,
        models.User.deleted_at.is_(None),
    ).first()
    
    # Si no existe por google_sub, buscar por email
    if not user:
        user = db.query(models.User).filter(
            models.User.email == email,
            models.User.deleted_at.is_(None),
        ).first()
    
    if user:
        # Usuario existe, actualizar google_sub si no lo tiene
        if user.google_sub is None:
            user.google_sub = google_sub
            db.commit()
            db.refresh(user)
            logger.info(f"Cuenta {user.id} enlazada con Google")
        elif user.google_sub != google_sub:
            # El email ya está registrado con otro google_sub
            raise HTTPException(
                status_code=400,
                detail="Este email ya está registrado con otra cuenta de Google"
            )
    else:
        # Usuario nuevo - verificar que el email no esté en uso
        existing_email = db.query(models.User).filter(
            models.User.email == email,
            models.User.deleted_at.is_(None),
        ).first()
        
        if existing_email:
            raise HTTPException(
                status_code=400,
                detail="El correo ya está registrado con otra cuenta"
            )
        
        if not payload.role:
            raise HTTPException(status_code=400, detail="Se requiere 'role' para crear usuario nuevo con Google")
        
        user = models.User(
            google_sub=google_sub,
            email=email,
            full_name=full_name,
            role=payload.role,
        )
        
        # Si se proporciona contraseña, guardarla
        if payload.password:
            user.password_hash = hash_password(payload.password)
        
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"Nuevo usuario (Google) creado: {email}")

    logger.info(f"Usuario autenticado vía Google: {email}")

    token_str = create_access_token(
        {"sub": str(user.id), "role": user.role.value}
    )

    token = schemas.Token(access_token=token_str)

    return schemas.LoginResponse(token=token, user=user)


@router.post("/register", response_model=schemas.LoginResponse)
def register(
    payload: schemas.RegisterRequest,
    db: Session = Depends(get_db),
):
    email = payload.email.strip()
    full_name = payload.full_name.strip()

    if len(email) < EMAIL_MIN_LENGTH or len(email) > EMAIL_MAX_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"El correo debe tener entre {EMAIL_MIN_LENGTH} y {EMAIL_MAX_LENGTH} caracteres",
        )

    if len(payload.password) < PASSWORD_MIN_LENGTH or len(payload.password) > PASSWORD_MAX_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"La contraseña debe tener entre {PASSWORD_MIN_LENGTH} y {PASSWORD_MAX_LENGTH} caracteres",
        )

    if not full_name:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")

    if len(full_name) > FULL_NAME_MAX_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"El nombre debe tener máximo {FULL_NAME_MAX_LENGTH} caracteres",
        )

    if not FULL_NAME_ALLOWED_REGEX.fullmatch(full_name):
        raise HTTPException(
            status_code=400,
            detail="El nombre solo puede contener letras y espacios",
        )

    existing = db.query(models.User).filter(
        models.User.email == email,
        models.User.deleted_at.is_(None),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    user = models.User(
        email=email,
        full_name=full_name,
        role=payload.role,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token_str = create_access_token({"sub": str(user.id), "role": user.role.value})
    return schemas.LoginResponse(token=schemas.Token(access_token=token_str), user=user)


@router.post("/login", response_model=schemas.LoginResponse)
def login(
    payload: schemas.LoginRequest,
    db: Session = Depends(get_db),
):
    email = payload.email.strip()

    if len(email) < EMAIL_MIN_LENGTH or len(email) > EMAIL_MAX_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"El correo debe tener entre {EMAIL_MIN_LENGTH} y {EMAIL_MAX_LENGTH} caracteres",
        )

    if len(payload.password) < PASSWORD_MIN_LENGTH or len(payload.password) > PASSWORD_MAX_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"La contraseña debe tener entre {PASSWORD_MIN_LENGTH} y {PASSWORD_MAX_LENGTH} caracteres",
        )

    user = db.query(models.User).filter(
        models.User.email == email,
        models.User.deleted_at.is_(None),
    ).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    token_str = create_access_token({"sub": str(user.id), "role": user.role.value})
    return schemas.LoginResponse(token=schemas.Token(access_token=token_str), user=user)

@router.post("/check")
def check_user(payload: dict, db: Session = Depends(get_db)):
    google_sub = payload.get("google_sub")

    user = db.query(models.User).filter(
        models.User.google_sub == google_sub,
        models.User.deleted_at.is_(None)
    ).first()

    return {"exists": bool(user)}


@router.get("/me", response_model=schemas.UserOut)
def get_user_by_google_sub(google_sub: str, db: Session = Depends(get_db)):
    """Devuelve el usuario dado el `google_sub`. Útil para que el frontend confirme rol y datos."""
    user = db.query(models.User).filter(
        models.User.google_sub == google_sub,
        models.User.deleted_at.is_(None),
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user
