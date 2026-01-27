'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useWebSocket, WebSocketMessage } from '@/hooks/useWebSocket';
import { useNotification } from '@/contexts/NotificationContext';
import { BackendUser } from '@/services/auth';
import { fetchJSON } from '@/services/apiClient';

/**
 * Componente global que escucha notificaciones de entregas en TODOS los cursos del usuario
 * Siempre se renderiza (incluso en páginas de curso)
 * Mantiene conexiones WebSocket activas a todos los cursos del terapeuta
 */
export function GlobalSubmissionNotifier() {
    const [courses, setCourses] = useState<any[]>([]);
    const [token, setToken] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    // Deduplicado global para mensajes de entregas
    const seenSubmissionIdsRef = useRef<Set<string>>(new Set());

    // Solo en cliente, cargar datos de localStorage y cursos
    useEffect(() => {
        setMounted(true);

        const loadUserAndCourses = () => {
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
            } else {
                setRole(null);
                setCourses([]);
                return;
            }

            if (!storedToken) {
                setCourses([]);
                return;
            }
            
            // Cargar cursos del usuario para conectar a sus WebSockets
            fetchJSON('/courses/my', {
                token: storedToken,
                method: 'GET',
            })
                .then(data => {
                    const coursesData = (data as any).items || data;
                    setCourses(coursesData || []);
                })
                .catch(err => {
                    console.error('[GlobalSubmissionNotifier] ❌ Error fetching courses:', err);
                });
        };

        loadUserAndCourses();

        // Escuchar cambios en localStorage (login/logout)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'backend_token' || e.key === 'backend_user') {
                loadUserAndCourses();
            }
        };

        // Escuchar logout
        const handleLogout = () => {
            setToken(null);
            setRole(null);
            setCourses([]);
            seenSubmissionIdsRef.current.clear();
        };

        // Escuchar login
        const handleLogin = () => {
            loadUserAndCourses();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('user-logout', handleLogout);
        window.addEventListener('user-login', handleLogin);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('user-logout', handleLogout);
            window.removeEventListener('user-login', handleLogin);
        };
    }, []);

    // Solo mostrar este componente si es terapeuta
    if (role !== 'THERAPIST') {
        return null;
    }

    return (
        <>
            {courses.map((course) => (
                <SubmissionListener 
                    key={course.id} 
                    course={course}
                    token={token} 
                    seenSubmissionIdsRef={seenSubmissionIdsRef}
                />
            ))}
        </>
    );
}

interface SubmissionListenerProps {
    course: any;
    token: string | null;
    seenSubmissionIdsRef: React.MutableRefObject<Set<string>>;
}

function SubmissionListener({ course, token, seenSubmissionIdsRef }: SubmissionListenerProps) {
    const [message, setMessage] = useState<WebSocketMessage | null>(null);
    const { showNotification } = useNotification();
    const userRef = useRef<{ id: number | null; role: string | null }>({ id: null, role: null });
    const courseId = course.id;
    const courseSlug = course.slug;

    // Leer usuario una sola vez
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const userRaw = window.localStorage.getItem('backend_user');
        if (userRaw) {
            try {
                const user = JSON.parse(userRaw) as { id: number; role: string };
                userRef.current = { id: user.id, role: user.role };
            } catch {
                userRef.current = { id: null, role: null };
            }
        }
    }, []);

    const handleMessage = useCallback((msg: WebSocketMessage) => {
        // Solo procesar eventos de entregas
        if (['submission_created', 'submission_updated', 'submission_deleted'].includes(msg.type)) {
            // Crear ID único para deduplicado - MUY ESPECÍFICO (incluye timestamp del servidor si existe)
            // Esto bloquea solo duplicados INMEDIATOS de la misma acción, no futuras acciones en la misma entrega
            const uniqueId = msg.data?.submission_id || msg.data?.course_exercise_id || 'unknown';
            const messageId = `${msg.type}:${uniqueId}:${courseId}:${msg.data?.timestamp || Date.now()}`;
            
            // Verificar en dedup global SOLAMENTE
            if (seenSubmissionIdsRef.current.has(messageId)) {
                return;
            }
            
            // Marcar como procesado
            seenSubmissionIdsRef.current.add(messageId);
            
            // Mostrar la notificación DIRECTAMENTE aquí
            const data = msg.data as any;
            const studentName = data?.student_name || 'Estudiante';
            const exerciseName = data?.exercise_name || 'Ejercicio desconocido';
            const hasAudio = data?.has_audio || false;

            if (msg.type === 'submission_created') {
                const audioStatus = hasAudio ? 'con audio' : 'sin audio';
                
                showNotification({
                    severity: 'success',
                    summary: `Nueva entrega`,
                    detail: `${studentName} realizó una entrega al ejercicio "${exerciseName}" (${audioStatus})`,
                    life: 5000,
                    type: 'submission_created',
                });
            } else if (msg.type === 'submission_updated') {
                const audioStatus = hasAudio ? 'con audio' : 'sin audio';
                
                showNotification({
                    severity: 'info',
                    summary: `Entrega actualizada`,
                    detail: `${studentName} actualizó su entrega del ejercicio "${exerciseName}" (${audioStatus})`,
                    type: 'submission_updated',
                    life: 5000,
                });
            } else if (msg.type === 'submission_deleted') {
                
                showNotification({
                    severity: 'warn',
                    summary: `Entrega anulada`,
                    detail: `${studentName} anuló su entrega del ejercicio "${exerciseName}"`,
                    type: 'submission_deleted',
                    life: 4000,
                });
            }
            
            // Limpiar después de 3 segundos SOLAMENTE para bloquear inmediatos duplicados en ese intervalo
            setTimeout(() => {
                seenSubmissionIdsRef.current.delete(messageId);
            }, 3000);
        }
    }, [courseId, seenSubmissionIdsRef, showNotification]);

    // Conectar a WebSocket del curso
    useWebSocket({
        courseId,
        token,
        onMessage: handleMessage,
        enabled: !!courseId && !!token,
    });

    return null;
}
