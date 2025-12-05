"""
WebSocket Connection Manager for real-time updates in courses
Manages connections per course and broadcasts updates to connected clients
"""

from typing import Dict, Set
from fastapi import WebSocket
import logging
import json

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections organized by course ID"""

    def __init__(self):
        # course_id -> set of WebSocket connections
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, course_id: int):
        """Accept and register a new WebSocket connection for a course"""
        await websocket.accept()
        if course_id not in self.active_connections:
            self.active_connections[course_id] = set()
        self.active_connections[course_id].add(websocket)
        logger.info(f"Client connected to course {course_id}. Total: {len(self.active_connections[course_id])}")

    def disconnect(self, websocket: WebSocket, course_id: int):
        """Remove a WebSocket connection from a course"""
        if course_id in self.active_connections:
            self.active_connections[course_id].discard(websocket)
            if not self.active_connections[course_id]:
                del self.active_connections[course_id]
            logger.info(f"Client disconnected from course {course_id}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send a message to a specific WebSocket connection"""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")

    async def broadcast_to_course(self, course_id: int, message: dict):
        """Broadcast a message to all connections in a specific course"""
        if course_id not in self.active_connections:
            logger.debug(f"No active connections for course {course_id}")
            return

        message_str = json.dumps(message)
        disconnected = []

        for connection in self.active_connections[course_id]:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.error(f"Error broadcasting to course {course_id}: {e}")
                disconnected.append(connection)

        # Clean up disconnected clients
        for connection in disconnected:
            self.disconnect(connection, course_id)

    async def broadcast_exercise_published(self, course_id: int, course_exercise_data: dict):
        """Broadcast when a new exercise is published to a course"""
        await self.broadcast_to_course(course_id, {
            "type": "exercise_published",
            "data": course_exercise_data
        })

    async def broadcast_exercise_deleted(self, course_id: int, data: dict):
        """Broadcast when an exercise is removed from a course"""
        await self.broadcast_to_course(course_id, {
            "type": "exercise_deleted",
            "data": data,
        })

    async def broadcast_submission_created(self, course_id: int, submission_data: dict):
        """Broadcast when a student submits an exercise"""
        await self.broadcast_to_course(course_id, {
            "type": "submission_created",
            "data": submission_data
        })

    async def broadcast_submission_updated(self, course_id: int, submission_data: dict):
        """Broadcast when a submission status is updated"""
        await self.broadcast_to_course(course_id, {
            "type": "submission_updated",
            "data": submission_data
        })

    async def broadcast_student_joined(self, course_id: int, student_data: dict):
        """Broadcast when a student joins a course"""
        await self.broadcast_to_course(course_id, {
            "type": "student_joined",
            "data": student_data
        })

    async def broadcast_student_removed(self, course_id: int, student_id: int):
        """Broadcast when a student is removed from a course"""
        await self.broadcast_to_course(course_id, {
            "type": "student_removed",
            "data": {"student_id": student_id}
        })

    async def broadcast_join_request(self, course_id: int, request_data: dict):
        """Broadcast when a new join request is made"""
        await self.broadcast_to_course(course_id, {
            "type": "join_request",
            "data": request_data
        })


# Global instance
manager = ConnectionManager()
