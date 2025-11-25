# app/routers/course_groups.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter()


# ==== LISTAR GRUPOS DEL USUARIO ====

@router.get("/", response_model=list[schemas.CourseGroupOut])
def list_course_groups(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Lista todos los grupos de cursos del usuario actual.
    """
    groups = db.query(models.CourseGroup).filter(
        models.CourseGroup.user_id == current_user.id,
        models.CourseGroup.is_deleted.is_(False),
    ).order_by(models.CourseGroup.created_at.desc()).all()

    return groups


# ==== CREAR GRUPO ====

@router.post("/", response_model=schemas.CourseGroupOut, status_code=status.HTTP_201_CREATED)
def create_course_group(
    data: schemas.CourseGroupCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Crea un nuevo grupo de cursos para el usuario actual.
    """
    group = models.CourseGroup(
        user_id=current_user.id,
        name=data.name,
        color=data.color,
    )

    db.add(group)
    db.commit()
    db.refresh(group)
    return group


# ==== ACTUALIZAR GRUPO ====

@router.put("/{group_id}", response_model=schemas.CourseGroupOut)
def update_course_group(
    group_id: int,
    data: schemas.CourseGroupUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Actualiza un grupo de cursos (solo el dueño).
    """
    group = db.query(models.CourseGroup).filter(
        models.CourseGroup.id == group_id,
        models.CourseGroup.user_id == current_user.id,
        models.CourseGroup.is_deleted.is_(False),
    ).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado.",
        )

    if data.name is not None:
        group.name = data.name
    if data.color is not None:
        group.color = data.color

    db.commit()
    db.refresh(group)
    return group


# ==== ELIMINAR GRUPO ====

@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Elimina lógicamente un grupo de cursos (solo el dueño).
    """
    group = db.query(models.CourseGroup).filter(
        models.CourseGroup.id == group_id,
        models.CourseGroup.user_id == current_user.id,
        models.CourseGroup.is_deleted.is_(False),
    ).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado.",
        )

    group.is_deleted = True
    group.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return


# ==== ASIGNAR CURSO A GRUPO ====

@router.post("/{group_id}/courses", response_model=schemas.CourseGroupAssignmentOut)
def assign_course_to_group(
    group_id: int,
    data: schemas.CourseGroupAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Asigna un curso a un grupo.
    """
    # Verificar que el grupo pertenece al usuario
    group = db.query(models.CourseGroup).filter(
        models.CourseGroup.id == group_id,
        models.CourseGroup.user_id == current_user.id,
        models.CourseGroup.is_deleted.is_(False),
    ).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado.",
        )

    # Verificar que el curso existe y pertenece al usuario
    # (terapeuta = dueño del curso, estudiante = está inscrito)
    if current_user.role == models.UserRole.THERAPIST:
        course = db.query(models.Course).filter(
            models.Course.id == data.course_id,
            models.Course.therapist_id == current_user.id,
            models.Course.deleted_at.is_(None),
        ).first()
    else:  # STUDENT
        course = db.query(models.Course).join(models.CourseStudent).filter(
            models.Course.id == data.course_id,
            models.CourseStudent.student_id == current_user.id,
            models.CourseStudent.is_active.is_(True),
            models.Course.deleted_at.is_(None),
        ).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Curso no encontrado o no tienes acceso.",
        )

    # Verificar si ya existe la asignación
    existing = db.query(models.CourseGroupAssignment).filter(
        models.CourseGroupAssignment.course_group_id == group_id,
        models.CourseGroupAssignment.course_id == data.course_id,
    ).first()

    if existing:
        return existing

    # Crear asignación
    assignment = models.CourseGroupAssignment(
        course_group_id=group_id,
        course_id=data.course_id,
    )

    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


# ==== REMOVER CURSO DE GRUPO ====

@router.delete("/{group_id}/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_course_from_group(
    group_id: int,
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Remueve un curso de un grupo.
    """
    # Verificar que el grupo pertenece al usuario
    group = db.query(models.CourseGroup).filter(
        models.CourseGroup.id == group_id,
        models.CourseGroup.user_id == current_user.id,
        models.CourseGroup.is_deleted.is_(False),
    ).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado.",
        )

    # Buscar y eliminar la asignación
    assignment = db.query(models.CourseGroupAssignment).filter(
        models.CourseGroupAssignment.course_group_id == group_id,
        models.CourseGroupAssignment.course_id == course_id,
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El curso no está asignado a este grupo.",
        )

    db.delete(assignment)
    db.commit()
    return


# ==== LISTAR CURSOS DE UN GRUPO ====

@router.get("/{group_id}/courses", response_model=list[schemas.CourseOut])
def list_courses_in_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Lista todos los cursos asignados a un grupo.
    """
    # Verificar que el grupo pertenece al usuario
    group = db.query(models.CourseGroup).filter(
        models.CourseGroup.id == group_id,
        models.CourseGroup.user_id == current_user.id,
        models.CourseGroup.is_deleted.is_(False),
    ).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado.",
        )

    # Obtener cursos del grupo
    courses = db.query(models.Course).join(models.CourseGroupAssignment).filter(
        models.CourseGroupAssignment.course_group_id == group_id,
        models.Course.deleted_at.is_(None),
    ).all()

    return courses
