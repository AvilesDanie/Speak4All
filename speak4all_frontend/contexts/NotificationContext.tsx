'use client';

import React, { createContext, useContext, useRef, ReactNode, useCallback, useState, useEffect } from 'react';
import { Toast } from 'primereact/toast';
import { useStoredNotifications, NotificationType } from './StoredNotificationContext';

export interface Notification {
  severity: 'success' | 'info' | 'warn' | 'error';
  summary: string;
  detail?: string;
  life?: number;
  type?: NotificationType;
  exerciseId?: number;
  submissionId?: number;
  courseId?: number;
  courseSlug?: string;
}

interface NotificationContextType {
  showNotification: (notification: Notification) => void;
  toastRef: React.RefObject<Toast>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const toastRef = useRef<Toast>(null);
  const [isReady, setIsReady] = useState(false);
  const notificationQueueRef = useRef<Notification[]>([]);
  const processingQueueRef = useRef(false);
  const userRoleRef = useRef<string | null>(null);
  // Deduplicación a nivel de Toast - AGRESIVA
  const shownNotificationsRef = useRef<Set<string>>(new Set());
  const storedNotifications = useStoredNotifications();

  // Esperar a que el componente se monte
  useEffect(() => {
    setIsReady(true);

    if (typeof window !== 'undefined') {
      const userRaw = window.localStorage.getItem('backend_user');
      if (userRaw) {
        try {
          const user = JSON.parse(userRaw) as { role?: string };
          userRoleRef.current = user.role || null;
        } catch {
          userRoleRef.current = null;
        }
      }
    }
  }, []);

  // Procesar cola de notificaciones cuando está listo
  useEffect(() => {
    if (!isReady) return;
    
    const processQueue = () => {
      if (processingQueueRef.current || notificationQueueRef.current.length === 0) {
        return;
      }
      
      processingQueueRef.current = true;
      const notification = notificationQueueRef.current.shift();
      
      if (notification && toastRef.current) {
        toastRef.current.show({
          severity: notification.severity,
          summary: notification.summary,
          detail: notification.detail,
          life: notification.life || 4000,
          sticky: false,
        });
      }
      
      processingQueueRef.current = false;
      
      // Procesar siguiente notificación después de un pequeño delay
      if (notificationQueueRef.current.length > 0) {
        setTimeout(processQueue, 300);
      }
    };

    processQueue();
  }, [isReady]);

  const showNotification = useCallback((notification: Notification) => {
    // Crear key de deduplicación única y específica
    const notifKey = `${notification.severity}:${notification.summary}:${notification.detail || ''}`;
    
    // BLOQUEAR si ya se mostró esta notificación
    if (shownNotificationsRef.current.has(notifKey)) {
      return;
    }
    
    // SIEMPRE guardar en el historial de notificaciones
    const notificationType: NotificationType =
      notification.type || 'exercise_published';
    storedNotifications.addNotification({
      severity: notification.severity,
      summary: notification.summary,
      detail: notification.detail,
      type: notificationType,
      exerciseId: notification.exerciseId,
      submissionId: notification.submissionId,
      courseId: notification.courseId,
      courseSlug: notification.courseSlug,
    });
    
    // Bloqueo por rol: terapeutas solo ven entregas (creada/anulada); estudiantes solo ejercicios (publicado/eliminado)
    const role = userRoleRef.current;
    const allowedForTherapist =
      notificationType === 'submission_created' || notificationType === 'submission_deleted';
    const allowedForStudent =
      notificationType === 'exercise_published' || notificationType === 'exercise_deleted';

    if (role === 'THERAPIST' && !allowedForTherapist) {
      shownNotificationsRef.current.add(notifKey);
      setTimeout(() => {
        shownNotificationsRef.current.delete(notifKey);
      }, 5000);
      return;
    }

    if (role === 'STUDENT' && !allowedForStudent) {
      shownNotificationsRef.current.add(notifKey);
      setTimeout(() => {
        shownNotificationsRef.current.delete(notifKey);
      }, 5000);
      return;
    }

    // Si este tipo de notificación está deshabilitado, no mostrar toast
    if (!storedNotifications.toastEnabledTypes.has(notificationType)) {
      shownNotificationsRef.current.add(notifKey);
      setTimeout(() => {
        shownNotificationsRef.current.delete(notifKey);
      }, 5000);
      return;
    }
    
    // Si los toasts están silenciados globalmente, no mostrar
    if (!storedNotifications.showAllToasts) {
      shownNotificationsRef.current.add(notifKey);
      setTimeout(() => {
        shownNotificationsRef.current.delete(notifKey);
      }, 5000);
      return;
    }
    
    // SIEMPRE queue si no está listo o si el ref no existe
    if (!toastRef.current) {
      notificationQueueRef.current.push(notification);
      return;
    }

    if (!isReady) {
      notificationQueueRef.current.push(notification);
      return;
    }

    // Marcar como mostrado
    shownNotificationsRef.current.add(notifKey);
    
    // Mantener la restricción por 5 segundos para bloquear duplicados
    setTimeout(() => {
      shownNotificationsRef.current.delete(notifKey);
    }, 5000);
    try {
      toastRef.current.show({
        severity: notification.severity,
        summary: notification.summary,
        detail: notification.detail,
        life: notification.life || 4000,
        sticky: false,
      });
    } catch (err) {
      console.error('❌ Error calling toast.show():', err);
      // Si hay error, meter a la cola para reintentar
      notificationQueueRef.current.push(notification);
    }
  }, [isReady, storedNotifications.showAllToasts, storedNotifications.toastEnabledTypes, storedNotifications]);

  return (
    <NotificationContext.Provider value={{ showNotification, toastRef }}>
      {children}
      <Toast 
        ref={toastRef} 
        position="top-right"
        style={{ zIndex: 9999 }}
        baseZIndex={9999}
      />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification debe ser usado dentro de NotificationProvider');
  }
  return context;
}
