import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children, url = '' }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState(null);
  const [deviceStatuses, setDeviceStatuses] = useState({});
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const socketInstance = io(`${url}/ws`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    socketInstance.on('notification', (data) => {
      setLastNotification(data);
    });

    socketInstance.on('device_status', (data) => {
      setDeviceStatuses(prev => ({
        ...prev,
        [data.device_id]: data.status,
      }));
    });

    socketInstance.on('alert', (data) => {
      setAlerts(prev => [data, ...prev].slice(0, 100));
    });

    socketInstance.on('score_update', (data) => {
      window.dispatchEvent(new CustomEvent('score_update', { detail: data }));
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [url]);

  const subscribe = (room) => {
    socket?.emit('subscribe', { room });
  };

  const unsubscribe = (room) => {
    socket?.emit('unsubscribe', { room });
  };

  const value = {
    socket,
    isConnected,
    lastNotification,
    deviceStatuses,
    alerts,
    subscribe,
    unsubscribe,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
};

export default WebSocketProvider;
