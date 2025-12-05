import React, { useEffect, useCallback, useRef } from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import { WebSocketMessage } from './useWebSocket';

interface SubmissionEvent {
  type: 'submission_created' | 'submission_updated' | 'submission_deleted';
  student_name: string;
  exercise_name: string;
  has_audio?: boolean;
}

/**
 * Hook para mostrar notificaciones de entregas con detalles completos
 * Integrado con WebSocket y NotificationContext
 * Incluye debounce para evitar notificaciones duplicadas
 */
export function useSubmissionNotifications(message: WebSocketMessage | null) {
  const { showNotification } = useNotification();
  const lastMessageIdRef = useRef<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userRef = useRef<{ id: number | null; role: string | null }>({ id: null, role: null });
  const [isReady, setIsReady] = React.useState(false);

  // Esperar a que el NotificationContext esté listo
  useEffect(() => {
    setIsReady(true);
  }, []);

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

  useEffect(() => {
    if (!message || !isReady) {
      return;
    }

    console.log('useSubmissionNotifications received message:', message);
    console.log('isReady:', isReady, 'userRole:', userRef.current.role);

    // Solo terapeutas deben ver estas notificaciones
    if (userRef.current.role !== 'THERAPIST') {
      return;
    }

    // Validar que el mensaje está dirigido al terapeuta dueño del curso
    const therapistId = (message.data as any)?.therapist_id;
    if (therapistId && userRef.current.id && therapistId !== userRef.current.id) {
      console.log('Notification not for this therapist, skipping');
      return;
    }

    // Crear un ID único para el mensaje
    const messageId = `${message.type}:${JSON.stringify(message.data)}`;
    
    // Si es el mismo mensaje reciente, ignorarlo (debounce)
    if (messageId === lastMessageIdRef.current) {
      console.log('Duplicate message detected in notification hook, skipping');
      return;
    }

    // Limpiar el timeout anterior si existe
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    lastMessageIdRef.current = messageId;

    const data = message.data as any;
    const studentName = data?.student_name || 'Estudiante';
    const exerciseName = data?.exercise_name || 'Ejercicio desconocido';
    const hasAudio = data?.has_audio || false;

    if (message.type === 'submission_created') {
      const audioStatus = hasAudio ? 'con audio' : 'sin audio';
      console.log('Showing submission_created notification');
      showNotification({
        severity: 'success',
        summary: `Nueva entrega`,
        detail: `${studentName} realizó una entrega al ejercicio "${exerciseName}" (${audioStatus})`,
        life: 5000,
        type: 'submission_created',
      });
    } else if (message.type === 'submission_updated') {
      const audioStatus = hasAudio ? 'con audio' : 'sin audio';
      console.log('Showing submission_updated notification');
      showNotification({
        severity: 'info',
        summary: `Entrega actualizada`,
        detail: `${studentName} actualizó su entrega del ejercicio "${exerciseName}" (${audioStatus})`,
        life: 5000,
        type: 'submission_updated',
      });
    } else if (message.type === 'submission_deleted') {
      console.log('Showing submission_deleted notification with data:', data);
      showNotification({
        severity: 'warn',
        summary: `Entrega anulada`,
        detail: `${studentName} anuló su entrega del ejercicio "${exerciseName}"`,
        life: 4000,
        type: 'submission_deleted',
      });
    }

    // Limpiar el ID después de 5 segundos para permitir notificaciones similares después
    debounceTimeoutRef.current = setTimeout(() => {
      lastMessageIdRef.current = null;
      debounceTimeoutRef.current = null;
    }, 5000);
  }, [message, showNotification, isReady]);
}
