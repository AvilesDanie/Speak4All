'use client';

import React, { createContext, useContext, useCallback, useState, ReactNode } from 'react';

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
