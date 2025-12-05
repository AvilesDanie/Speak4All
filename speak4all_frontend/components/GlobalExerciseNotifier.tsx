'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useWebSocket, WebSocketMessage } from '@/hooks/useWebSocket';
import { useExerciseNotifications } from '@/contexts/ExerciseNotificationContext';
import { BackendUser } from '@/services/auth';

/**
 * Componente global que escucha notificaciones de ejercicios publicados/eliminados
 * Siempre se renderiza (incluso en páginas de curso)
 * Mantiene conexiones WebSocket activas a todos los cursos del estudiante
 */
export function GlobalExerciseNotifier() {
    const [courses, setCourses] = useState<any[]>([]);
    const [token, setToken] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    // Deduplicado global para mensajes de ejercicios
    const seenExerciseIdsRef = useRef<Set<string>>(new Set());

    // Solo en cliente, cargar datos de localStorage y cursos
    useEffect(() => {
        setMounted(true);

        const storedToken = window.localStorage.getItem('backend_token');
        setToken(storedToken);

        const userRaw = window.localStorage.getItem('backend_user');
        if (userRaw) {
            try {
                const user = JSON.parse(userRaw) as BackendUser;
                setRole(user.role);
            } catch {
                setRole(null);
            }
        }

        if (!storedToken) {
            return;
        }
        // Cargar cursos del usuario para conectar a sus WebSockets
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
        fetch(`${apiBase}/courses/my`, {
            headers: { Authorization: `Bearer ${storedToken}` },
        })
            .then(res => {
                if (res.ok) {
                    return res.json();
                }
                console.error('[GlobalExerciseNotifier] Error loading courses:', res.status);
                return null;
            })
            .then(data => {
                if (data) {
                    const coursesData = data.items || data;
                    setCourses(coursesData);
                }
            })
            .catch(err => {
                console.error('[GlobalExerciseNotifier] ❌ Error fetching courses:', err);
            });
    }, []);

    // Solo mostrar este componente si es estudiante
    if (role !== 'STUDENT') {
        return null;
    }

    return (
        <>
            {courses.map((course) => (
                <ExerciseListener 
                    key={course.id} 
                    course={course}
                    token={token} 
                    seenExerciseIdsRef={seenExerciseIdsRef}
                />
            ))}
        </>
    );
}

interface ExerciseListenerProps {
    course: any;
    token: string | null;
    seenExerciseIdsRef: React.MutableRefObject<Set<string>>;
}

function ExerciseListener({ course, token, seenExerciseIdsRef }: ExerciseListenerProps) {
    const { addNotification, triggerRefresh } = useExerciseNotifications();
    const courseId = course.id;
    const courseName = course.name;
    const courseSlug = course.slug;

    const handleMessage = useCallback((msg: WebSocketMessage) => {
        // Solo procesar eventos de ejercicios
        if (["exercise_published", "exercise_deleted"].includes(msg.type)) {
            const exerciseId = msg.data?.exercise_id || msg.data?.id;
            const eventCourseId = msg.data?.course_id || msg.data?.courseId;
            // Solo mostrar si el evento corresponde a este curso
            if (eventCourseId && eventCourseId !== courseId) {
                return;
            }
            const messageId = `${msg.type}:${exerciseId}:${courseId}`;
            if (seenExerciseIdsRef.current.has(messageId)) {
                return;
            }
            seenExerciseIdsRef.current.add(messageId);
            // Usar el nombre del curso del mensaje si existe, sino usar el que tenemos
            const displayCourseName = msg.data?.course_name || courseName;
            
            if (msg.type === "exercise_published") {
                addNotification({
                    courseId,
                    exerciseId,
                    courseSlug,
                    courseName: displayCourseName,
                    exerciseName: msg.data?.exercise_name || msg.data?.name || "Nuevo ejercicio",
                    therapistName: msg.data?.therapist_name,
                    summary: "Nuevo ejercicio",
                    detail: `${msg.data?.therapist_name || "El terapeuta"} ha publicado "${msg.data?.exercise_name || msg.data?.name || "Nuevo ejercicio"}" en el curso "${displayCourseName}"`,
                    type: "exercise_published",
                });
                triggerRefresh(courseId);
            } else if (msg.type === "exercise_deleted") {
                addNotification({
                    courseId,
                    exerciseId,
                    courseSlug,
                    courseName: displayCourseName,
                    exerciseName: msg.data?.exercise_name || "Ejercicio",
                    therapistName: msg.data?.therapist_name,
                    summary: "Ejercicio eliminado",
                    detail: `${msg.data?.therapist_name || "El terapeuta"} eliminó "${msg.data?.exercise_name || "Ejercicio"}" del curso "${displayCourseName}"`,
                    severity: "warn",
                    type: "exercise_deleted",
                });
                triggerRefresh(courseId);
            }
            // Limpiar después de 5 segundos
            setTimeout(() => {
                seenExerciseIdsRef.current.delete(messageId);
            }, 5000);
        }
    }, [courseId, courseName, courseSlug, addNotification, triggerRefresh, seenExerciseIdsRef]);

    // Conectar a WebSocket del curso
    useWebSocket({
        courseId,
        token,
        onMessage: handleMessage,
        enabled: !!courseId && !!token,
    });

    return null;
}
