'use client';

import React, { createContext, useContext, useRef, ReactNode, useCallback, useState, useEffect } from 'react';
import { Toast } from 'primereact/toast';

export interface Notification {
  severity: 'success' | 'info' | 'warn' | 'error';
  summary: string;
  detail?: string;
  life?: number;
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
  // Deduplicación a nivel de Toast - AGRESIVA
  const shownNotificationsRef = useRef<Set<string>>(new Set());

  // Esperar a que el componente se monte
  useEffect(() => {
    console.log('NotificationProvider mounted, setting isReady = true');
    setIsReady(true);
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
  }, [isReady]);

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
