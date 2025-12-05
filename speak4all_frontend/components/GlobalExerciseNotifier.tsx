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
    const [courseIds, setCourseIds] = useState<number[]>([]);
    const [token, setToken] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    // Deduplicado global para mensajes de ejercicios
    const seenExerciseIdsRef = useRef<Set<string>>(new Set());

    // Solo en cliente, cargar datos de localStorage y cursos
    useEffect(() => {
        console.log('[GlobalExerciseNotifier] Component mounted on client');
        setMounted(true);

        const storedToken = window.localStorage.getItem('backend_token');
        console.log('[GlobalExerciseNotifier] Token from localStorage:', !!storedToken);
        setToken(storedToken);

        const userRaw = window.localStorage.getItem('backend_user');
        console.log('[GlobalExerciseNotifier] User from localStorage:', !!userRaw);
        if (userRaw) {
            try {
                const user = JSON.parse(userRaw) as BackendUser;
                console.log('[GlobalExerciseNotifier] User role:', user.role);
                setRole(user.role);
            } catch {
                console.log('[GlobalExerciseNotifier] Error parsing user');
                setRole(null);
            }
        }

        if (!storedToken) {
            console.log('[GlobalExerciseNotifier] No token, cannot load courses');
            return;
        }

        console.log('[GlobalExerciseNotifier] Fetching courses...');
        // Cargar cursos del usuario para conectar a sus WebSockets
        fetch('http://localhost:8000/courses/my', {
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
                    const courses = data.items || data;
                    const ids = courses.map((c: any) => c.id);
                    console.log('[GlobalExerciseNotifier] ✅ Loaded', ids.length, 'courses:', ids);
                    setCourseIds(ids);
                }
            })
            .catch(err => {
                console.error('[GlobalExerciseNotifier] ❌ Error fetching courses:', err);
            });
    }, []);

    console.log('[GlobalExerciseNotifier] Rendering with role:', role, 'courseIds:', courseIds);

    // Solo mostrar este componente si es estudiante
    if (role !== 'STUDENT') {
        console.log('[GlobalExerciseNotifier] Not a student, returning null');
        return null;
    }

    return (
        <>
            {courseIds.map((courseId) => (
                <ExerciseListener 
                    key={courseId} 
                    courseId={courseId} 
                    token={token} 
                    seenExerciseIdsRef={seenExerciseIdsRef}
                />
            ))}
        </>
    );
}

interface ExerciseListenerProps {
    courseId: number;
    token: string | null;
    seenExerciseIdsRef: React.MutableRefObject<Set<string>>;
}

function ExerciseListener({ courseId, token, seenExerciseIdsRef }: ExerciseListenerProps) {
    const { addNotification, triggerRefresh } = useExerciseNotifications();
    const [courseData, setCourseData] = useState<any>(null);

    // Cargar datos del curso para obtener su nombre
    useEffect(() => {
        if (!token) return;
        
        const loadCourse = async () => {
            try {
                const res = await fetch(`http://localhost:8000/courses/${courseId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setCourseData(data);
                }
            } catch (err) {
                console.error('[ExerciseListener] Error loading course data:', err);
            }
        };

        loadCourse();
    }, [courseId, token]);

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
            // Usar el nombre del curso del mensaje si existe
            const courseName = msg.data?.course_name || courseData?.name || `Curso ${courseId}`;
            if (msg.type === "exercise_published") {
                addNotification({
                    courseId,
                    courseName,
                    exerciseName: msg.data?.exercise_name || msg.data?.name || "Nuevo ejercicio",
                    therapistName: msg.data?.therapist_name,
                    summary: "Nuevo ejercicio",
                    detail: `${msg.data?.therapist_name || "El terapeuta"} ha publicado \"${msg.data?.exercise_name || msg.data?.name || "Nuevo ejercicio"}\" en el curso \"${courseName}\"`,
                    type: "exercise_published",
                });
                triggerRefresh(courseId);
            } else if (msg.type === "exercise_deleted") {
                addNotification({
                    courseId,
                    courseName,
                    exerciseName: msg.data?.exercise_name || "Ejercicio",
                    therapistName: msg.data?.therapist_name,
                    summary: "Ejercicio eliminado",
                    detail: `${msg.data?.therapist_name || "El terapeuta"} eliminó \"${msg.data?.exercise_name || "Ejercicio"}\" del curso \"${courseName}\"`,
                    severity: "warn",
                    type: "exercise_deleted",
                });
                triggerRefresh(courseId);
            }
            // Limpiar después de 5 segundos
            setTimeout(() => {
                seenExerciseIdsRef.current.delete(messageId);
            }, 5000); // Solo 5 segundos de deduplicación
        }
    }, [courseId, courseData, addNotification, triggerRefresh, seenExerciseIdsRef]);

    // Conectar a WebSocket del curso
    useWebSocket({
        courseId,
        token,
        onMessage: handleMessage,
        enabled: !!courseId && !!token,
    });

    return null;
}
