import logger from '../utils/logger';
import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { isDevelopment } from '../config/env';
import { useToastStore } from './toastStore';

// ============================================
// 全局WebSocket实例跟踪（避免StrictMode重复初始化）
// ============================================
let globalSocketInstance: Socket | null = null;
let isSocketConnecting = false;
let currentReconnectAttempt = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

// 设备状态
interface DeviceStatus {
  device_id: string;
  status: string;
  timestamp?: string;
}

// 通知类型
interface NotificationData {
  id: number;
  message: string;
  type: string;
  timestamp?: string;
}

// 积分更新
interface ScoreUpdate {
  user_id: number;
  score_change: number;
  timestamp: string;
}

// ============================================
// 5. WebSocket状态 - WebSocket Store
// ============================================
interface WebSocketState {
  socket: Socket | null;
  isConnected: boolean;
  lastNotification: NotificationData | null;
  deviceStatuses: Record<string, string>;
  alerts: NotificationData[];
  scoreUpdates: ScoreUpdate[];
  initSocket: (url?: string) => void;
  disconnectSocket: () => void;
  subscribe: (room: string) => void;
  unsubscribe: (room: string) => void;
  emit: (event: string, data?: unknown) => void;
}

export const useWebSocketStore = create<WebSocketState>()((set, get) => ({
  socket: null,
  isConnected: false,
  lastNotification: null,
  deviceStatuses: {},
  alerts: [],
  scoreUpdates: [],

  initSocket: (_url = '') => {
    // 使用全局变量跟踪WebSocket实例，避免StrictMode重复初始化
    if (globalSocketInstance && globalSocketInstance.connected) {
      return;
    }

    // 如果正在连接中，跳过
    if (isSocketConnecting) {
      return;
    }

    // 断开旧连接
    if (globalSocketInstance) {
      globalSocketInstance.disconnect();
      globalSocketInstance = null;
    }

    isSocketConnecting = true;

    // 指数退避重连延迟计算器（用于日志输出）
    const calculateReconnectionDelay = (attempt: number): number => {
      const delay = BASE_RECONNECT_DELAY * Math.pow(2, attempt);
      // 添加抖动避免惊群效应
      const jitter = Math.random() * 1000;
      return Math.min(delay + jitter, MAX_RECONNECT_DELAY);
    };

    const socketUrl = isDevelopment ? 'http://localhost:5000' : window.location.origin;

    const socketInstance = io(socketUrl, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: BASE_RECONNECT_DELAY,
      reconnectionDelayMax: MAX_RECONNECT_DELAY,
    });

    globalSocketInstance = socketInstance;

    socketInstance.on('connect', () => {
      isSocketConnecting = false;
      currentReconnectAttempt = 0;
      set({ socket: socketInstance, isConnected: true });
      logger.log('[WebSocket] 连接成功');
    });

    socketInstance.on('disconnect', (reason: string) => {
      isSocketConnecting = false;
      set({ isConnected: false });
      logger.log(`[WebSocket] 连接断开: ${reason}`);
    });

    socketInstance.on('connect_error', (error: Error) => {
      isSocketConnecting = false;
      currentReconnectAttempt++;
      if (currentReconnectAttempt <= MAX_RECONNECT_ATTEMPTS) {
        const delay = calculateReconnectionDelay(currentReconnectAttempt);
        logger.log(
          `[WebSocket] 连接失败 (${currentReconnectAttempt}/${MAX_RECONNECT_ATTEMPTS}), ${(
            delay / 1000
          ).toFixed(1)}s后重试: ${error.message}`
        );
      } else {
        logger.error('[WebSocket] 重连失败超过最大次数，停止重连');
        useToastStore.getState().error('WebSocket连接失败，请刷新页面重试');
        currentReconnectAttempt = 0;
      }
    });

    socketInstance.on('notification', (data: NotificationData) => {
      set({ lastNotification: data });
      useToastStore.getState().info(data.message || '收到新通知');
    });

    socketInstance.on('device_status', (data: DeviceStatus) => {
      set((state) => ({
        deviceStatuses: {
          ...state.deviceStatuses,
          [data.device_id]: data.status,
        },
      }));
    });

    socketInstance.on('alert', (data: NotificationData) => {
      set((state) => ({
        alerts: [data, ...state.alerts].slice(0, 100),
      }));
    });

    socketInstance.on('score_update', (data: ScoreUpdate) => {
      set((state) => ({
        scoreUpdates: [data, ...state.scoreUpdates].slice(0, 50),
      }));
      window.dispatchEvent(new CustomEvent('score_update', { detail: data }));
    });

    set({ socket: socketInstance });
  },

  disconnectSocket: () => {
    if (globalSocketInstance) {
      globalSocketInstance.disconnect();
      globalSocketInstance = null;
      isSocketConnecting = false;
      set({ socket: null, isConnected: false });
    }
  },

  subscribe: (room) => {
    get().socket?.emit('subscribe', { room });
  },

  unsubscribe: (room) => {
    get().socket?.emit('unsubscribe', { room });
  },

  emit: (event, data) => {
    get().socket?.emit(event, data);
  },
}));
