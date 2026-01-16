from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from .. import models, schemas
from ..deps import get_current_user

router = APIRouter()


def _attach_therapist_name(rows):
    """Agregar nombre del terapeuta a cada observación para la respuesta.

    Maneja filas devueltas como SQLAlchemy Row, tuplas o instancias directas.
    """
    enriched: list[models.Observation] = []
    for row in rows:
        obs = None
        full_name = None
        # Caso 1: ya es una instancia del modelo
        if isinstance(row, models.Observation):
            obs = row
        else:
            # Intentar desempaquetar como (obs, full_name)
            try:
                maybe_obs, maybe_name = row  # soporta Row/tuple
                obs = maybe_obs
                full_name = maybe_name
            except Exception:
                # Fallback para RowMapping
                try:
                    mapping = row._mapping  # type: ignore[attr-defined]
                    obs = mapping[models.Observation]
                    full_name = mapping[models.User.full_name]
                except Exception:
                    pass
        if obs is not None:
            try:
                setattr(obs, "therapist_name", full_name)
            except Exception:
                # Si no se puede setear, ignorar y continuar
                pass
            enriched.append(obs)
    return enriched


def require_therapist(user: models.User):
    if user.role != models.UserRole.THERAPIST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo terapeutas pueden crear observaciones."
        )


def require_student(user: models.User):
    if user.role != models.UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo estudiantes pueden ver sus observaciones."
        )


def therapist_can_access_submission(
    db: Session,
    therapist_id: int,
    submission_id: int
) -> models.Submission:
    """
    Verifica que el terapeuta sea dueño del curso del ejercicio
    al que pertenece la entrega.
    """
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
            detail="Entrega no encontrada o no pertenece a tus cursos."
        )
    return sub


# ==== Crear observación (terapeuta) ====

@router.post("/", response_model=schemas.ObservationOut)
def create_observation(
    body: schemas.ObservationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_therapist(current_user)

    sub = therapist_can_access_submission(db, current_user.id, body.submission_id)

    obs = models.Observation(
        submission_id=sub.id,
        therapist_id=current_user.id,
        text=body.text,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        is_deleted=False,
    )
    db.add(obs)
    db.commit()
    db.refresh(obs)
    obs.therapist_name = current_user.full_name
    return obs


# ==== Editar observación (solo el terapeuta que la creó) ====

@router.put("/{observation_id}", response_model=schemas.ObservationOut)
def update_observation(
    observation_id: int,
    body: schemas.ObservationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_therapist(current_user)

    obs = db.query(models.Observation).filter(
        models.Observation.id == observation_id,
        models.Observation.is_deleted.is_(False),
    ).first()

    if not obs:
        raise HTTPException(status_code=404, detail="Observación no encontrada.")

    if obs.therapist_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo puedes editar tus propias observaciones.")

    obs.text = body.text
    obs.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obs)
    obs.therapist_name = current_user.full_name
    return obs


# ==== Borrado lógico de observación ====

@router.delete("/{observation_id}", response_model=schemas.ObservationOut)
def delete_observation(
    observation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_therapist(current_user)

    obs = db.query(models.Observation).filter(
        models.Observation.id == observation_id,
        models.Observation.is_deleted.is_(False),
    ).first()

    if not obs:
        raise HTTPException(status_code=404, detail="Observación no encontrada.")

    if obs.therapist_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo puedes borrar tus propias observaciones.")

    obs.is_deleted = True
    obs.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obs)
    obs.therapist_name = current_user.full_name
    return obs


# ==== Listar observaciones de una entrega (terapeuta) ====

@router.get("/submission/{submission_id}", response_model=list[schemas.ObservationOut])
def list_observations_for_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Terapeuta: ve todas las observaciones sobre una entrega de su curso.
    Estudiante: ve solo las observaciones de SU entrega.
    """
    if current_user.role == models.UserRole.THERAPIST:
        # Validar acceso
        therapist_can_access_submission(db, current_user.id, submission_id)
        q = db.query(
            models.Observation,
            models.User.full_name,
        ).join(models.User, models.Observation.therapist_id == models.User.id).filter(
            models.Observation.submission_id == submission_id,
            models.Observation.is_deleted.is_(False),
        )
        rows = q.order_by(models.Observation.created_at.asc()).all()
        return _attach_therapist_name(rows)

    elif current_user.role == models.UserRole.STUDENT:
        # Verificar que la entrega es del estudiante
        sub = db.query(models.Submission).filter(
            models.Submission.id == submission_id,
            models.Submission.student_id == current_user.id,
        ).first()

        if not sub:
            raise HTTPException(status_code=404, detail="Entrega no encontrada.")

        q = db.query(
            models.Observation,
            models.User.full_name,
        ).join(models.User, models.Observation.therapist_id == models.User.id).filter(
            models.Observation.submission_id == submission_id,
            models.Observation.is_deleted.is_(False),
        )
        rows = q.order_by(models.Observation.created_at.asc()).all()
        return _attach_therapist_name(rows)

    else:
        raise HTTPException(status_code=403, detail="Rol no permitido.")
