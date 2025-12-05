"""
WebSocket router for real-time course updates
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
import logging

from ..database import get_db
from ..websocket_manager import manager
from .. import models
from ..deps import get_current_user_ws

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/courses/{course_id}")
async def websocket_course_endpoint(
    websocket: WebSocket,
    course_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time course updates.
    Clients connect with: ws://localhost:8000/ws/courses/{course_id}?token={jwt_token}
    """
    # Verify token and get user
    try:
        user = await get_current_user_ws(token, db)
    except Exception as e:
        logger.error(f"WebSocket authentication failed: {e}")
        db.close()  # Asegurar que se cierre la conexión
        await websocket.close(code=1008)  # Policy violation
        return

    # Verify user has access to this course
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.deleted_at.is_(None)
    ).first()

    if not course:
        logger.warning(f"Course {course_id} not found")
        db.close()  # Asegurar que se cierre la conexión
        await websocket.close(code=1008)
        return

    # Check if user is therapist (owner) or enrolled student
    has_access = False
    if user.role == models.UserRole.THERAPIST and course.therapist_id == user.id:
        has_access = True
    elif user.role == models.UserRole.STUDENT:
        # Check if student is enrolled
        enrollment = db.query(models.CourseStudent).filter(
            models.CourseStudent.course_id == course_id,
            models.CourseStudent.student_id == user.id,
            models.CourseStudent.deleted_at.is_(None)
        ).first()
        if enrollment:
            has_access = True

    if not has_access:
        logger.warning(f"User {user.id} has no access to course {course_id}")
        db.close()  # Asegurar que se cierre la conexión
        await websocket.close(code=1008)
        return

    # Cerrar la DB session después de validación, no la necesitamos en el loop
    db.close()

    # Connect client
    await manager.connect(websocket, course_id)

    try:
        # Send initial connection confirmation
        await manager.send_personal_message(
            '{"type":"connected","message":"Connected to course updates"}',
            websocket
        )

        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            # Echo back for ping/pong if needed
            if data == "ping":
                await manager.send_personal_message('{"type":"pong"}', websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket, course_id)
        logger.info(f"Client disconnected from course {course_id}")
    except Exception as e:
        logger.error(f"WebSocket error in course {course_id}: {e}")
        manager.disconnect(websocket, course_id)
