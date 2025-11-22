from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..deps import create_access_token
from .. import schemas

router = APIRouter()


@router.post("/google", response_model=schemas.LoginResponse)
def login_google(
    payload: schemas.GoogleLoginRequest,
    db: Session = Depends(get_db),
):
    """
    Login/registro usando datos de Google ya verificados en el frontend.
    Más adelante puedes cambiar esto para recibir solo id_token.
    """
    user = db.query(models.User).filter(
        models.User.google_sub == payload.google_sub,
        models.User.deleted_at.is_(None),
    ).first()

    if not user:
        user = models.User(
            google_sub=payload.google_sub,
            email=payload.email,
            full_name=payload.full_name,
            role=payload.role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token_str = create_access_token(
        {"sub": str(user.id), "role": user.role.value}
    )

    token = schemas.Token(access_token=token_str)

    return schemas.LoginResponse(token=token, user=user)

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
