import { useEffect, useRef, useCallback, useState } from 'react';

export type WebSocketMessage = {
  type: 'connected' | 'pong' | 'exercise_published' | 'exercise_deleted' | 'submission_created' | 'submission_updated' | 'submission_deleted' | 'student_joined' | 'student_removed' | 'join_request' | 'observation_created' | 'evaluation_created' | 'evaluation_updated';
  message?: string;
  data?: any;
};

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

interface UseWebSocketOptions {
  courseId: number | null;
  token: string | null;
  onMessage?: WebSocketEventHandler;
  enabled?: boolean;
}

/**
 * Custom hook for WebSocket connection to course updates
 * Automatically reconnects on disconnect and handles token authentication
 */
export function useWebSocket({ courseId, token, onMessage, enabled = true }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const onMessageRef = useRef(onMessage);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<WebSocketMessage | null>(null);

  // Keep onMessageRef in sync with onMessage
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (!courseId || !token || !enabled) {
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const url = `${wsUrl}/ws/courses/${courseId}?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const parsedMessage: WebSocketMessage = JSON.parse(event.data);
          setMessage(parsedMessage);
          onMessageRef.current?.(parsedMessage);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnection after 3 seconds if not a normal closure
        if (event.code !== 1000 && enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      setError('Failed to create connection');
    }
  }, [courseId, token, enabled]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User initiated disconnect');
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    }
  }, []);

  // Connect on mount or when dependencies change
  useEffect(() => {
    if (enabled && courseId && token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [courseId, token, enabled, connect, disconnect]);

  // Ping interval to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      sendMessage('ping');
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(pingInterval);
  }, [isConnected, sendMessage]);

  return {
    isConnected,
    error,
    message,
    sendMessage,
    disconnect,
  };
}
