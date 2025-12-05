'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { useNotification } from './NotificationContext';
import { NotificationType } from './StoredNotificationContext';

export interface ExerciseNotification {
    id: string;
    courseId: number;
    exerciseName: string;
    therapistName?: string;
    courseName?: string;
    timestamp: Date;
    summary?: string;
    detail?: string;
    severity?: 'info' | 'warn' | 'error' | 'success';
    type?: NotificationType;
}

interface ExerciseNotificationContextType {
    addNotification: (notification: Omit<ExerciseNotification, 'id' | 'timestamp'>) => void;
    notifications: ExerciseNotification[];
    triggerRefresh: (courseId: number) => void;
    refreshTrigger: { courseId: number; timestamp: number } | null;
}

const ExerciseNotificationContext = createContext<ExerciseNotificationContextType | null>(null);

export function ExerciseNotificationProvider({ children }: { children: ReactNode }) {
    const { showNotification } = useNotification();
    const [notifications, setNotifications] = useState<ExerciseNotification[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState<{ courseId: number; timestamp: number } | null>(null);
    const [isReady, setIsReady] = useState(false);
    const dedupRef = useRef<Set<string>>(new Set());

    // Esperar a que el NotificationContext esté listo
    useEffect(() => {
        setIsReady(true);
    }, []);

    const addNotification = useCallback((notification: Omit<ExerciseNotification, 'id' | 'timestamp'>) => {
        // Build dedup key - MUY específico para evitar cualquier duplicado
        const dedupKey = `${notification.courseId}:${notification.exerciseName}:${notification.summary}:${Date.now().toString().slice(-3)}`;
        console.log('=== addNotification called ===');
        console.log('dedupKey:', dedupKey);
        console.log('dedupRef.current has key:', dedupRef.current.has(dedupKey));
        console.log('isReady:', isReady);
        
        if (dedupRef.current.has(dedupKey)) {
            console.log('❌ Notification BLOCKED - duplicate in ExerciseNotificationContext');
            return;
        }
        
        if (!isReady) {
            console.log('⏳ ExerciseNotificationContext not ready yet, queueing notification');
            // Reintentar después de 100ms si no está listo
            setTimeout(() => {
                addNotification(notification);
            }, 100);
            return;
        }
        
        dedupRef.current.add(dedupKey);
        console.log('✅ Added to dedupRef - Will be removed after 5s');
        // Mantener en dedup durante 5 segundos para prevenir duplicados
        setTimeout(() => {
            dedupRef.current.delete(dedupKey);
            console.log('🧹 Dedup key removed after 5s:', dedupKey);
        }, 5000);

        const id = `${Date.now()}-${Math.random()}`;
        const newNotification: ExerciseNotification = {
            summary: notification.summary,
            detail: notification.detail,
            severity: notification.severity || 'info',
            ...notification,
            id,
            timestamp: new Date(),
        };

        setNotifications((prev) => [newNotification, ...prev]);

        // Mostrar el toast usando el NotificationContext
        console.log('📤 Calling showNotification with:', newNotification.summary);
        showNotification({
            severity: newNotification.severity || 'info',
            summary: newNotification.summary || 'Nuevo ejercicio',
            detail: newNotification.detail || `${newNotification.therapistName || 'El terapeuta'} ha publicado un nuevo ejercicio: "${newNotification.exerciseName}"` + (newNotification.courseName ? ` en el curso "${newNotification.courseName}"` : ''),
            life: 5000,
            type: newNotification.type || 'exercise_published',
        });

        // Auto-remove notification after 10 seconds
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, 10000);
    }, [showNotification, isReady]);

    const triggerRefresh = useCallback((courseId: number) => {
        console.log('Triggering refresh for course:', courseId);
        setRefreshTrigger({ courseId, timestamp: Date.now() });
    }, []);

    // WebSocket setup ha sido movido a GlobalWebSocketListener para mejor control de timing

    return (
        <ExerciseNotificationContext.Provider
            value={{
                addNotification,
                notifications,
                triggerRefresh,
                refreshTrigger,
            }}
        >
            {children}
        </ExerciseNotificationContext.Provider>
    );
}

export function useExerciseNotifications() {
    const context = useContext(ExerciseNotificationContext);
    if (!context) {
        throw new Error('useExerciseNotifications must be used within ExerciseNotificationProvider');
    }
    return context;
}
