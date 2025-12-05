'use client';

import React, { createContext, useContext, useCallback, useState, ReactNode, useEffect } from 'react';

// Tipos específicos para filtrar por evento
export type NotificationType =
  | 'exercise_published'
  | 'exercise_deleted'
  | 'submission_created'
  | 'submission_updated'
  | 'submission_deleted';

export interface StoredNotification {
  id: string;
  timestamp: Date;
  severity: 'success' | 'info' | 'warn' | 'error';
  summary: string;
  detail?: string;
  type: NotificationType;
  exerciseId?: number;
  submissionId?: number;
  courseId?: number;
  courseSlug?: string;
}

interface StoredNotificationContextType {
  notifications: StoredNotification[];
  addNotification: (notification: Omit<StoredNotification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  clearByType: (type: NotificationType) => void;
  clearVisibleNotifications: () => void;
  showAllToasts: boolean;
  setShowAllToasts: (show: boolean) => void;
  toastEnabledTypes: Set<NotificationType>;
  toggleToastType: (type: NotificationType) => void;
  trayVisibleTypes: Set<NotificationType>;
  toggleTrayType: (type: NotificationType) => void;
  unreadCount: number;
}

const StoredNotificationContext = createContext<StoredNotificationContextType | undefined>(undefined);

export function StoredNotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [showAllToasts, setShowAllToasts] = useState(true);
  const [toastEnabledTypes, setToastEnabledTypes] = useState<Set<NotificationType>>(
    new Set([
      'exercise_published',
      'exercise_deleted',
      'submission_created',
      'submission_updated',
      'submission_deleted',
    ] as NotificationType[])
  );
  const [trayVisibleTypes, setTrayVisibleTypes] = useState<Set<NotificationType>>(
    new Set([
      'exercise_published',
      'exercise_deleted',
      'submission_created',
      'submission_updated',
      'submission_deleted',
    ] as NotificationType[])
  );

  // Obtener userId al montar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const userRaw = localStorage.getItem('backend_user');
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw) as { id: number };
        setUserId(user.id);
      } catch (err) {
        console.error('Error parsing user:', err);
      }
    }
  }, []);

  // Cargar notificaciones desde localStorage cuando tengamos userId
  useEffect(() => {
    if (typeof window === 'undefined' || userId === null) return;
    
    const storageKey = `stored_notifications_${userId}`;
    const stored = localStorage.getItem(storageKey);
    
    // Limpiar notificaciones existentes antes de cargar las nuevas
    setNotifications([]);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const notificationsWithDates = parsed.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }));
        setNotifications(notificationsWithDates);
      } catch (err) {
        console.error('❌ Error loading notifications from localStorage:', err);
      }
    }
    setIsLoaded(true);
  }, [userId]);

  // Guardar notificaciones en localStorage cuando cambien (solo después de cargar)
  useEffect(() => {
    if (typeof window === 'undefined' || !isLoaded || userId === null) return;
    const storageKey = `stored_notifications_${userId}`;
    localStorage.setItem(storageKey, JSON.stringify(notifications));
  }, [notifications, isLoaded, userId]);

  const addNotification = useCallback((notification: Omit<StoredNotification, 'id' | 'timestamp'>) => {
    const id = `${Date.now()}-${Math.random()}`;
    const newNotification: StoredNotification = {
      ...notification,
      id,
      timestamp: new Date(),
    };
    setNotifications((prev) => [newNotification, ...prev]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const clearByType = useCallback((type: NotificationType) => {
    setNotifications((prev) => prev.filter((n) => n.type !== type));
  }, []);

  const clearVisibleNotifications = useCallback(() => {
    setNotifications((prev) => prev.filter((n) => !trayVisibleTypes.has(n.type)));
  }, [trayVisibleTypes]);

  const toggleToastType = useCallback((type: NotificationType) => {
    setToastEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const toggleTrayType = useCallback((type: NotificationType) => {
    setTrayVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const unreadCount = notifications.length;

  return (
    <StoredNotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearNotifications,
        clearByType,
        clearVisibleNotifications,
        showAllToasts,
        setShowAllToasts,
        toastEnabledTypes,
        toggleToastType,
        trayVisibleTypes,
        toggleTrayType,
        unreadCount,
      }}
    >
      {children}
    </StoredNotificationContext.Provider>
  );
}

export function useStoredNotifications() {
  const context = useContext(StoredNotificationContext);
  if (!context) {
    throw new Error('useStoredNotifications debe ser usado dentro de StoredNotificationProvider');
  }
  return context;
}
