'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useWebSocket, WebSocketMessage } from '@/hooks/useWebSocket';
import { useNotification } from '@/contexts/NotificationContext';
import { BackendUser } from '@/services/auth';

/**
 * Componente global que escucha notificaciones de entregas en TODOS los cursos del usuario
 * Siempre se renderiza (incluso en páginas de curso)
 * Mantiene conexiones WebSocket activas a todos los cursos del terapeuta
 */
export function GlobalSubmissionNotifier() {
    const [courseIds, setCourseIds] = useState<number[]>([]);
    const [token, setToken] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    // Deduplicado global para mensajes de entregas
    const seenSubmissionIdsRef = useRef<Set<string>>(new Set());

    // Solo en cliente, cargar datos de localStorage y cursos
    useEffect(() => {
        console.log('[GlobalSubmissionNotifier] Component mounted on client');
        setMounted(true);

        const storedToken = window.localStorage.getItem('backend_token');
        console.log('[GlobalSubmissionNotifier] Token from localStorage:', !!storedToken);
        setToken(storedToken);

        const userRaw = window.localStorage.getItem('backend_user');
        console.log('[GlobalSubmissionNotifier] User from localStorage:', !!userRaw);
        if (userRaw) {
            try {
                const user = JSON.parse(userRaw) as BackendUser;
                console.log('[GlobalSubmissionNotifier] User role:', user.role);
                setRole(user.role);
            } catch {
                console.log('[GlobalSubmissionNotifier] Error parsing user');
                setRole(null);
            }
        }

        if (!storedToken) {
            console.log('[GlobalSubmissionNotifier] No token, cannot load courses');
            return;
        }

        console.log('[GlobalSubmissionNotifier] Fetching courses...');
        // Cargar cursos del usuario para conectar a sus WebSockets
        fetch('http://localhost:8000/courses/my', {
            headers: { Authorization: `Bearer ${storedToken}` },
        })
            .then(res => {
                if (res.ok) {
                    return res.json();
                }
                console.error('[GlobalSubmissionNotifier] Error loading courses:', res.status);
                return null;
            })
            .then(data => {
                if (data) {
                    const courses = data.items || data;
                    const ids = courses.map((c: any) => c.id);
                    console.log('[GlobalSubmissionNotifier] ✅ Loaded', ids.length, 'courses:', ids);
                    setCourseIds(ids);
                }
            })
            .catch(err => {
                console.error('[GlobalSubmissionNotifier] ❌ Error fetching courses:', err);
            });
    }, []);

    // Solo mostrar este componente si es terapeuta
    if (role !== 'THERAPIST') {
        console.log('[GlobalSubmissionNotifier] Not a THERAPIST, returning null');
        return null;
    }

    console.log('[GlobalSubmissionNotifier] Rendering with', courseIds.length, 'courses:', courseIds);

    if (courseIds.length === 0 && token) {
        console.log('[GlobalSubmissionNotifier] ⚠️ Token present but no courses found');
    }

    return (
        <>
            {courseIds.length > 0 && courseIds.map((courseId) => (
                <SubmissionListener 
                    key={courseId} 
                    courseId={courseId} 
                    token={token} 
                    seenSubmissionIdsRef={seenSubmissionIdsRef}
                />
            ))}
        </>
    );
}

interface SubmissionListenerProps {
    courseId: number;
    token: string | null;
    seenSubmissionIdsRef: React.MutableRefObject<Set<string>>;
}

function SubmissionListener({ courseId, token, seenSubmissionIdsRef }: SubmissionListenerProps) {
    const [message, setMessage] = useState<WebSocketMessage | null>(null);
    const { showNotification } = useNotification();
    const userRef = useRef<{ id: number | null; role: string | null }>({ id: null, role: null });

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
        console.log('[SubmissionListener] Received message:', msg.type, { courseId });
        
        // Solo procesar eventos de entregas
        if (['submission_created', 'submission_updated', 'submission_deleted'].includes(msg.type)) {
            // Crear ID único para deduplicado - MUY ESPECÍFICO (incluye timestamp del servidor si existe)
            // Esto bloquea solo duplicados INMEDIATOS de la misma acción, no futuras acciones en la misma entrega
            const uniqueId = msg.data?.submission_id || msg.data?.course_exercise_id || 'unknown';
            const messageId = `${msg.type}:${uniqueId}:${courseId}:${msg.data?.timestamp || Date.now()}`;
            
            // Verificar en dedup global SOLAMENTE
            if (seenSubmissionIdsRef.current.has(messageId)) {
                console.log('[SubmissionListener] Global duplicate detected, skipping:', messageId);
                return;
            }
            
            // Marcar como procesado
            seenSubmissionIdsRef.current.add(messageId);
            console.log('[SubmissionListener] Processing new message:', messageId);
            
            // Mostrar la notificación DIRECTAMENTE aquí
            const data = msg.data as any;
            const studentName = data?.student_name || 'Estudiante';
            const exerciseName = data?.exercise_name || 'Ejercicio desconocido';
            const hasAudio = data?.has_audio || false;

            if (msg.type === 'submission_created') {
                const audioStatus = hasAudio ? 'con audio' : 'sin audio';
                console.log('[SubmissionListener] 📤 Showing submission_created notification');
                showNotification({
                    severity: 'success',
                    summary: `Nueva entrega`,
                    detail: `${studentName} realizó una entrega al ejercicio "${exerciseName}" (${audioStatus})`,
                    life: 5000,
                    type: 'submission_created',
                });
            } else if (msg.type === 'submission_updated') {
                const audioStatus = hasAudio ? 'con audio' : 'sin audio';
                console.log('[SubmissionListener] 📤 Showing submission_updated notification');
                showNotification({
                    severity: 'info',
                    summary: `Entrega actualizada`,
                    detail: `${studentName} actualizó su entrega del ejercicio "${exerciseName}" (${audioStatus})`,
                    type: 'submission_updated',
                    life: 5000,
                });
            } else if (msg.type === 'submission_deleted') {
                console.log('[SubmissionListener] 📤 Showing submission_deleted notification');
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
