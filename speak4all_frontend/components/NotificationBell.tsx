'use client';

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Sidebar } from 'primereact/sidebar';
import { useStoredNotifications, StoredNotification, NotificationType } from '@/contexts/StoredNotificationContext';

export function NotificationBell() {
  const {
    notifications,
    removeNotification,
    clearByType,
    clearVisibleNotifications,
    unreadCount,
    toastEnabledTypes,
    toggleToastType,
    trayVisibleTypes,
    toggleTrayType,
  } = useStoredNotifications();
  const [visible, setVisible] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem('backend_user');
    if (raw) {
      try {
        const user = JSON.parse(raw) as { role?: string };
        setUserRole(user.role || null);
      } catch {
        setUserRole(null);
      }
    }
  }, []);

  const allowedTypes: NotificationType[] = userRole === 'THERAPIST'
    ? ['submission_created', 'submission_deleted']
    : ['exercise_published', 'exercise_deleted'];

  const filteredNotifications = notifications
    .filter((n) => trayVisibleTypes.has(n.type))
    .filter((n) => allowedTypes.includes(n.type));

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success':
        return '#10b981';
      case 'info':
        return '#3b82f6';
      case 'warn':
        return '#f59e0b';
      case 'error':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'success':
        return 'pi-check-circle';
      case 'info':
        return 'pi-info-circle';
      case 'warn':
        return 'pi-exclamation-triangle';
      case 'error':
        return 'pi-times-circle';
      default:
        return 'pi-circle';
    }
  };

  return (
    <>
      <Button
        icon="pi pi-bell"
        className="p-button-rounded p-button-text"
        onClick={() => setVisible(true)}
        style={{ position: 'relative', color: 'white' }}
      >
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '0px',
              right: '0px',
              minWidth: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              borderRadius: '50%',
              backgroundColor: '#9999cc',
              color: 'white',
              zIndex: 10,
            }}
          >
            {unreadCount}
          </span>
        )}
      </Button>

      <Sidebar visible={visible} onHide={() => setVisible(false)} position="right" style={{ width: '380px' }}>
        <div className="h-full flex flex-column">
          <div className="flex justify-content-between align-items-center mb-4 border-bottom-1 surface-border pb-3">
            <h3 className="m-0 text-lg font-semibold">Notificaciones</h3>
            {filteredNotifications.length > 0 && (
              <Button
                label="Limpiar"
                icon="pi pi-trash"
                className="p-button-text p-button-sm"
                onClick={clearVisibleNotifications}
              />
            )}
          </div>

          <div className="mb-4 pb-3 border-bottom-1 surface-border">
            <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-500">Notificaciones emergentes:</p>
            <div className="flex flex-wrap gap-2">
              {allowedTypes.map((type) => (
                <button
                  key={`toast-${type}`}
                  onClick={() => toggleToastType(type)}
                  className="flex align-items-center gap-2 m-0 text-sm cursor-pointer p-2 border-round surface-50 hover:surface-100 transition"
                  style={{ 
                    transition: 'all 0.2s',
                    border: toastEnabledTypes.has(type) ? '2px solid #3b82f6' : '2px solid #d0d0d0',
                    flex: '1 0 calc(50% - 0.5rem)',
                    minWidth: '130px',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <span className="text-sm">
                    {type === 'submission_created' && '📤 Entrega'}
                    {type === 'submission_deleted' && '❌ Eliminada'}
                    {type === 'exercise_published' && '✅ Nuevo'}
                    {type === 'exercise_deleted' && '🗑️ Eliminado'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 pb-3 border-bottom-1 surface-border">
            <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-500">Historial:</p>
            <div className="flex flex-wrap gap-2">
              {allowedTypes.map((type) => {
                const count = notifications.filter((n) => n.type === type).length;
                return (
                  <button
                    key={`tray-${type}`}
                    onClick={() => toggleTrayType(type)}
                    className="flex flex-column align-items-center justify-content-center gap-1 p-2 border-round surface-50 hover:surface-100 transition relative"
                    style={{ 
                      transition: 'all 0.2s',
                      border: trayVisibleTypes.has(type) ? '2px solid #10b981' : '2px solid #d0d0d0',
                      flex: '1 0 calc(50% - 0.5rem)',
                      minWidth: '130px',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <span className="text-sm font-semibold text-center">
                      {type === 'submission_created' && '📤 Entregas'}
                      {type === 'submission_deleted' && '❌ Eliminadas'}
                      {type === 'exercise_published' && '✅ Nuevos'}
                      {type === 'exercise_deleted' && '🗑️ Eliminados'}
                    </span>
                    {count > 0 && (
                      <span className="text-xs font-bold text-600">({count})</span>
                    )}
                    {count > 0 && (
                      <Button
                        icon="pi pi-trash"
                        className="p-button-text p-button-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearByType(type);
                        }}
                        style={{ padding: '0.1rem', height: '20px', width: '20px', position: 'absolute', top: '2px', right: '2px' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredNotifications.length === 0 ? (
            <div className="flex flex-column align-items-center justify-content-center flex-1 gap-2">
              <i className="pi pi-inbox text-600" style={{ fontSize: '2rem' }} />
              <p className="text-center text-600 m-0">No hay notificaciones</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-column gap-2">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="surface-50 border-round-lg p-3 flex flex-column gap-2"
                    style={{ borderLeft: `4px solid ${getSeverityColor(notification.severity)}` }}
                  >
                    <div className="flex justify-content-between align-items-start gap-2">
                      <div className="flex gap-2 flex-1 min-w-0">
                        <i
                          className={`pi ${getSeverityIcon(notification.severity)}`}
                          style={{ color: getSeverityColor(notification.severity), marginTop: '2px' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="m-0 font-semibold text-sm">{notification.summary}</p>
                          {notification.detail && (
                            <p className="m-0 mt-1 text-xs text-600 word-wrap">{notification.detail}</p>
                          )}
                          <p className="m-0 mt-1 text-xs text-500">
                            {notification.timestamp.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        icon="pi pi-times"
                        className="p-button-rounded p-button-text p-button-sm"
                        onClick={() => removeNotification(notification.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Sidebar>
    </>
  );
}
