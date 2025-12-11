from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
import logging

from datetime import datetime, timezone

from ..database import get_db
from .. import models, schemas
from ..deps import get_current_user
from ..services import storage
import secrets

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/", response_model=schemas.CourseOut)
def create_course(
    data: schemas.CourseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.UserRole.THERAPIST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo terapeutas pueden crear cursos",
        )

    join_code = secrets.token_urlsafe(6)  # ej: 'sKds_a'
    course = models.Course(
        therapist_id=current_user.id,
        name=data.name,
        description=data.description,
        join_code=join_code,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    logger.info(f"Curso creado: {course.name} (ID: {course.id}, código: {join_code}) por terapeuta {current_user.id}")
    return course


@router.post("/join", response_model=schemas.CourseJoinRequestOut)
def request_join_course(
    data: schemas.JoinCourseRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo estudiantes pueden unirse a cursos",
        )

    course = db.query(models.Course).filter(
        models.Course.join_code == data.join_code,
        models.Course.deleted_at.is_(None),
    ).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Curso no encontrado",
        )

    # evitar duplicados
    existing = db.query(models.CourseJoinRequest).filter(
        models.CourseJoinRequest.course_id == course.id,
        models.CourseJoinRequest.student_id == current_user.id,
    ).first()
    if existing:
        avatar_url = None
        try:
            if current_user.avatar_path:
                avatar_url = storage.generate_signed_url(current_user.avatar_path)
        except Exception:
            avatar_url = None
        return schemas.CourseJoinRequestOut(
            id=existing.id,
            course_id=existing.course_id,
            student_id=existing.student_id,
            status=existing.status,
            created_at=existing.created_at,
            student_full_name=current_user.full_name,
            student_email=current_user.email,
            student_avatar_path=current_user.avatar_path,
            student_avatar_url=avatar_url,
        )

    req = models.CourseJoinRequest(
        course_id=course.id,
        student_id=current_user.id,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    avatar_url = None
    try:
        if current_user.avatar_path:
            avatar_url = storage.generate_signed_url(current_user.avatar_path)
    except Exception:
        avatar_url = None
    return schemas.CourseJoinRequestOut(
        id=req.id,
        course_id=req.course_id,
        student_id=req.student_id,
        status=req.status,
        created_at=req.created_at,
        student_full_name=current_user.full_name,
        student_email=current_user.email,
        student_avatar_path=current_user.avatar_path,
        student_avatar_url=avatar_url,
    )


@router.get("/my", response_model=schemas.PaginatedResponse[schemas.CourseOut])
def list_my_courses(
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Validar parámetros
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 10
    if page_size > 100:
        page_size = 100

    # Como terapeuta: cursos que creó
    if current_user.role == models.UserRole.THERAPIST:
        query = db.query(models.Course).filter(
            models.Course.therapist_id == current_user.id,
            models.Course.deleted_at.is_(None),
        )
    else:
        # Como estudiante: cursos donde está en CourseStudent
        query = (
            db.query(models.Course)
            .join(models.CourseStudent, models.CourseStudent.course_id == models.Course.id)
            .filter(
                models.CourseStudent.student_id == current_user.id,
                models.CourseStudent.is_active.is_(True),
                models.Course.deleted_at.is_(None),
            )
        )

    # Contar total
    total = query.count()
    
    # Aplicar paginación
    offset = (page - 1) * page_size
    courses = query.offset(offset).limit(page_size).all()
    
    # Calcular total de páginas
    total_pages = (total + page_size - 1) // page_size
    
    return schemas.PaginatedResponse(
        items=courses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )




# ==== HELPER PARA VALIDAR QUE EL USUARIO ES TERAPEUTA DEL CURSO ====

def get_course_owned_or_404(
    db: Session,
    course_id: int,
    current_user: models.User,
) -> models.Course:
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.deleted_at.is_(None),
    ).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Curso no encontrado",
        )

    if course.therapist_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No eres el terapeuta de este curso",
        )

    return course


# ==== 1) LISTAR SOLICITUDES PENDIENTES DE UN CURSO ====

@router.get(
    "/{course_id}/requests",
    response_model=list[schemas.CourseJoinRequestOut],
)
def list_join_requests(
    course_id: int,
    status: str | None = Query(
        None,
        description="Estado de la solicitud. Valores: PENDING,ACCEPTED,REJECTED,ALL. Por defecto: PENDING",
    ),
    from_date: datetime | None = Query(None, description="Fecha inicial (ISO 8601)"),
    to_date: datetime | None = Query(None, description="Fecha final (ISO 8601)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    course = get_course_owned_or_404(db, course_id, current_user)

    # Determinar estados a filtrar
    if status is None:
        statuses: list[models.JoinRequestStatus] | None = [models.JoinRequestStatus.PENDING]
    else:
        normalized = status.upper()
        if normalized == "ALL":
            statuses = None  # sin filtro
        else:
            statuses = []
            for part in normalized.split(","):
                part = part.strip()
                try:
                    statuses.append(models.JoinRequestStatus(part))
                except ValueError:
                    continue
            if not statuses:
                statuses = [models.JoinRequestStatus.PENDING]

    query = (
        db.query(models.CourseJoinRequest, models.User)
        .join(models.User, models.User.id == models.CourseJoinRequest.student_id)
        .filter(models.CourseJoinRequest.course_id == course.id)
    )

    if statuses:
        query = query.filter(models.CourseJoinRequest.status.in_(statuses))
    if from_date:
        query = query.filter(models.CourseJoinRequest.created_at >= from_date)
    if to_date:
        query = query.filter(models.CourseJoinRequest.created_at <= to_date)

    reqs = query.order_by(models.CourseJoinRequest.created_at.desc()).all()

    out: list[schemas.CourseJoinRequestOut] = []
    for req, student in reqs:
        # construir URL firmada si hay avatar_path
        avatar_url = None
        try:
            if student.avatar_path:
                avatar_url = storage.generate_signed_url(student.avatar_path)
        except Exception:
            avatar_url = None

        out.append(
            schemas.CourseJoinRequestOut(
                id=req.id,
                course_id=req.course_id,
                student_id=req.student_id,
                status=req.status,
                created_at=req.created_at,
                student_full_name=student.full_name,
                student_email=student.email,
                student_avatar_path=student.avatar_path,
                student_avatar_url=avatar_url,
            )
        )

    return out


# ==== 2) ACEPTAR / RECHAZAR UNA SOLICITUD ====

@router.post(
    "/{course_id}/requests/{request_id}/decision",
    response_model=schemas.CourseJoinRequestOut,
)
def decide_join_request(
    course_id: int,
    request_id: int,
    decision: schemas.JoinRequestDecision,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    course = get_course_owned_or_404(db, course_id, current_user)

    req = db.query(models.CourseJoinRequest).filter(
        models.CourseJoinRequest.id == request_id,
        models.CourseJoinRequest.course_id == course.id,
    ).first()

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada",
        )

    now = datetime.now(timezone.utc)

    if decision.accept:
        # Permitir aceptar pendientes o rechazadas
        if req.status == models.JoinRequestStatus.ACCEPTED:
            # ya aceptada: devolver tal cual
            pass
        else:
            req.status = models.JoinRequestStatus.ACCEPTED
            req.decided_at = now

            # si se acepta, creamos CourseStudent (si no existe ya)
            existing = db.query(models.CourseStudent).filter(
                models.CourseStudent.course_id == course.id,
                models.CourseStudent.student_id == req.student_id,
                models.CourseStudent.deleted_at.is_(None),
            ).first()

            if not existing:
                cs = models.CourseStudent(
                    course_id=course.id,
                    student_id=req.student_id,
                )
                db.add(cs)
    else:
        # Rechazar solo si no estaba aceptada
        if req.status == models.JoinRequestStatus.ACCEPTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La solicitud ya fue aceptada",
            )
        if req.status != models.JoinRequestStatus.REJECTED:
            req.status = models.JoinRequestStatus.REJECTED
            req.decided_at = now

    db.commit()
    db.refresh(req)

    student = db.query(models.User).filter(models.User.id == req.student_id).first()
    avatar_url = None
    try:
        if student and student.avatar_path:
            avatar_url = storage.generate_signed_url(student.avatar_path)
    except Exception:
        avatar_url = None

    return schemas.CourseJoinRequestOut(
        id=req.id,
        course_id=req.course_id,
        student_id=req.student_id,
        status=req.status,
        created_at=req.created_at,
        student_full_name=student.full_name if student else None,
        student_email=student.email if student else None,
        student_avatar_path=student.avatar_path if student else None,
        student_avatar_url=avatar_url,
    )


# ==== 3) LISTAR ESTUDIANTES + PROGRESO EN UN CURSO ====

@router.get(
    "/{course_id}/students",
    response_model=list[schemas.StudentProgressOut],
)
def list_course_students(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    course = get_course_owned_or_404(db, course_id, current_user)

    # Subquery: total de ejercicios publicados en el curso
    total_exercises = (
        db.query(func.count(models.CourseExercise.id))
        .filter(
            models.CourseExercise.course_id == course.id,
            models.CourseExercise.is_deleted.is_(False),
        )
        .scalar()
    )

    # Query principal: alumnos + progreso
    # Usamos left join sobre submissions para contar cuántos DONE tiene cada uno
    rows = (
        db.query(
            models.CourseStudent.id.label("course_student_id"),
            models.User.id.label("student_id"),
            models.User.full_name.label("student_name"),
            models.User.avatar_path.label("avatar_path"),
            func.count(
                func.nullif(
                    models.Submission.status != models.SubmissionStatus.DONE,
                    True,
                )
            ).label("completed_exercises"),
            func.max(models.Submission.created_at).label("last_submission_at"),
        )
        .join(models.User, models.User.id == models.CourseStudent.student_id)
        .outerjoin(
            models.Submission,
            models.Submission.course_exercise_id.in_(
                db.query(models.CourseExercise.id).filter(
                    models.CourseExercise.course_id == course.id,
                    models.CourseExercise.is_deleted.is_(False),
                )
            )
            & (models.Submission.student_id == models.CourseStudent.student_id),
        )
        .filter(
            models.CourseStudent.course_id == course.id,
            models.CourseStudent.is_active.is_(True),
            models.CourseStudent.deleted_at.is_(None),
        )
        .group_by(models.CourseStudent.id, models.User.id, models.User.full_name)
        .all()
    )

    results: list[schemas.StudentProgressOut] = []
    for r in rows:
        # Generar URL firmada para el avatar si existe
        avatar_url = None
        if r.avatar_path:
            try:
                avatar_url = storage.generate_signed_url(r.avatar_path, minutes=60)
            except Exception:
                avatar_url = None
        
        results.append(
            schemas.StudentProgressOut(
                course_student_id=r.course_student_id,
                student_id=r.student_id,
                student_name=r.student_name,
                avatar_path=avatar_url,  # Ahora es una URL firmada
                completed_exercises=int(r.completed_exercises or 0),
                total_exercises=int(total_exercises or 0),
                last_submission_at=r.last_submission_at,
            )
        )

    return results


# ==== 4) ELIMINAR (LÓGICAMENTE) A UN ESTUDIANTE DEL CURSO ====

@router.delete(
    "/{course_id}/students/{course_student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_student_from_course(
    course_id: int,
    course_student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    course = get_course_owned_or_404(db, course_id, current_user)

    cs = db.query(models.CourseStudent).filter(
        models.CourseStudent.id == course_student_id,
        models.CourseStudent.course_id == course.id,
        models.CourseStudent.deleted_at.is_(None),
    ).first()

    if not cs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alumno no encontrado en este curso",
        )

    cs.is_active = False
    cs.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return


# ==== 5) ELIMINAR (LÓGICAMENTE) UN CURSO ====

@router.delete(
    "/{course_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Elimina lógicamente un curso (solo el terapeuta dueño).
    Marca el curso como eliminado y desactiva a todos los estudiantes.
    """
    course = get_course_owned_or_404(db, course_id, current_user)

    if course.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El curso ya está eliminado",
        )

    # Marcar curso como eliminado
    course.is_active = False
    course.deleted_at = datetime.now(timezone.utc)

    # Desactivar todos los estudiantes del curso
    db.query(models.CourseStudent).filter(
        models.CourseStudent.course_id == course_id,
        models.CourseStudent.deleted_at.is_(None),
    ).update({
        "is_active": False,
        "deleted_at": datetime.now(timezone.utc)
    }, synchronize_session=False)

    db.commit()
    return