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
    console.log('NotificationProvider mounted, setting isReady = true');
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
        console.log('Processing queued notification:', notification.summary);
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
    
    console.log('=== showNotification called ===');
    console.log('notification:', notification);
    console.log('notifKey:', notifKey);
    console.log('Already shown:', shownNotificationsRef.current.has(notifKey));
    console.log('isReady:', isReady);
    console.log('toastRef.current exists:', !!toastRef.current);
    console.log('toastRef.current ref:', toastRef.current);
    
    // BLOQUEAR si ya se mostró esta notificación
    if (shownNotificationsRef.current.has(notifKey)) {
      console.log('❌ Toast BLOCKED - identical notification already shown');
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
    });
    
    // Bloqueo por rol: terapeutas solo ven entregas (creada/anulada); estudiantes solo ejercicios (publicado/eliminado)
    const role = userRoleRef.current;
    const allowedForTherapist =
      notificationType === 'submission_created' || notificationType === 'submission_deleted';
    const allowedForStudent =
      notificationType === 'exercise_published' || notificationType === 'exercise_deleted';

    if (role === 'THERAPIST' && !allowedForTherapist) {
      console.log(`🔇 Toast BLOCKED - type ${notificationType} no permitido para terapeuta`);
      shownNotificationsRef.current.add(notifKey);
      setTimeout(() => {
        shownNotificationsRef.current.delete(notifKey);
      }, 5000);
      return;
    }

    if (role === 'STUDENT' && !allowedForStudent) {
      console.log(`🔇 Toast BLOCKED - type ${notificationType} no permitido para estudiante`);
      shownNotificationsRef.current.add(notifKey);
      setTimeout(() => {
        shownNotificationsRef.current.delete(notifKey);
      }, 5000);
      return;
    }

    // Si este tipo de notificación está deshabilitado, no mostrar toast
    if (!storedNotifications.toastEnabledTypes.has(notificationType)) {
      console.log(`🔇 Toast BLOCKED - notification type "${notificationType}" is disabled`);
      shownNotificationsRef.current.add(notifKey);
      setTimeout(() => {
        shownNotificationsRef.current.delete(notifKey);
      }, 5000);
      return;
    }
    
    // Si los toasts están silenciados globalmente, no mostrar
    if (!storedNotifications.showAllToasts) {
      console.log('🔇 Toast BLOCKED - all toasts are muted');
      shownNotificationsRef.current.add(notifKey);
      setTimeout(() => {
        shownNotificationsRef.current.delete(notifKey);
      }, 5000);
      return;
    }
    
    // SIEMPRE queue si no está listo o si el ref no existe
    if (!toastRef.current) {
      console.log('⏳ Toast ref not available yet, queuing notification');
      notificationQueueRef.current.push(notification);
      return;
    }

    if (!isReady) {
      console.log('⏳ Toast not ready yet, queuing notification');
      notificationQueueRef.current.push(notification);
      return;
    }

    // Marcar como mostrado
    shownNotificationsRef.current.add(notifKey);
    console.log('✅ Added to shownNotifications - Will be removed after 5s');
    
    // Mantener la restricción por 5 segundos para bloquear duplicados
    setTimeout(() => {
      shownNotificationsRef.current.delete(notifKey);
      console.log('🧹 Toast dedup key removed after 5s:', notifKey);
    }, 5000);

    console.log('📤 Calling toast.show()');
    try {
      toastRef.current.show({
        severity: notification.severity,
        summary: notification.summary,
        detail: notification.detail,
        life: notification.life || 4000,
        sticky: false,
      });
      console.log('✅ Toast.show() executed successfully');
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
