import { useEffect, useRef, useCallback, useState } from 'react';

const getWsUrl = () => {
  if (process.env.REACT_APP_WS_URL) {
    return process.env.REACT_APP_WS_URL;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
};

export const useWebSocket = (options = {}) => {
  const {
    autoConnect = true,
    rooms = [],
    onNotification,
    onDeviceStatus,
    onScoreUpdate,
    onAlert,
    onSystem,
    onConnect,
    onDisconnect,
  } = options;

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  const subscribeRef = useRef(null);
  subscribeRef.current = (room) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'subscribe', room }));
    }
  };

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(getWsUrl());

      ws.onopen = () => {
        setIsConnected(true);
        rooms.forEach(room => subscribeRef.current(room));
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          switch (data.type || data.event) {
            case 'notification':
              onNotification?.(data);
              break;
            case 'device_status':
              onDeviceStatus?.(data);
              break;
            case 'score_update':
              onScoreUpdate?.(data);
              break;
            case 'alert':
              onAlert?.(data);
              break;
            case 'system':
              onSystem?.(data);
              break;
            default:
              break;
          }
        } catch (e) {
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        onDisconnect?.();
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
      };

      wsRef.current = ws;
    } catch (error) {
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [rooms, onNotification, onDeviceStatus, onScoreUpdate, onAlert, onSystem, onConnect, onDisconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const subscribe = useCallback((room) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'subscribe', room }));
    }
  }, []);

  const unsubscribe = useCallback((room) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'unsubscribe', room }));
    }
  }, []);

  const sendMessage = useCallback((event, data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, ...data }));
    }
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    sendMessage,
  };
};

export default useWebSocket;
