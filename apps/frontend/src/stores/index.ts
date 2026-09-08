import logger from '../utils/logger';
/**
 * 统一状态管理 - Zustand Stores
 * 所有状态管理统一使用Zustand，移除Context API
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';
import { isDevelopment } from '../config/env';

// ============================================
// 全局WebSocket实例跟踪（避免StrictMode重复初始化）
// ============================================
let globalSocketInstance: Socket | null = null;
let isSocketConnecting = false;
let currentReconnectAttempt = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

// ============================================
// 类型定义
// ============================================

// Toast消息类型
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

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
// 2. 全局UI状态 - Global Store
// ============================================
interface GlobalState {
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  isOnline: boolean;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setOnline: (status: boolean) => void;
  initNetworkListener: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const useGlobalStore = create<GlobalState>()((set) => ({
  isLoading: false,
  loadingMessage: '',
  error: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  showLoading: (message = '加载中...') => set({ isLoading: true, loadingMessage: message }),
  hideLoading: () => set({ isLoading: false, loadingMessage: '' }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  setOnline: (status) => set({ isOnline: status }),
  initNetworkListener: () => {
    window.addEventListener('online', () => {
      set({ isOnline: true });
      useToastStore.getState().addToast('网络连接已恢复', 'success');
    });
    window.addEventListener('offline', () => {
      set({ isOnline: false });
      useToastStore.getState().addToast('网络连接已断开，请检查网络', 'error');
    });
  },
  showToast: (message, type = 'success') => {
    useToastStore.getState().addToast(message, type);
  },
}));

// ============================================
// 3. Toast状态 - Toast Store
// ============================================
interface ToastState {
  toasts: Toast[];
  addToast: (
    message: string,
    type?: 'success' | 'error' | 'warning' | 'info',
    duration?: number
  ) => void;
  removeToast: (id: number) => void;
  clearAllToasts: () => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],

  addToast: (message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }],
    }));

    setTimeout(() => {
      get().removeToast(id);
    }, duration);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAllToasts: () => set({ toasts: [] }),

  success: (message) => get().addToast(message, 'success'),
  error: (message) => get().addToast(message, 'error'),
  warning: (message) => get().addToast(message, 'warning'),
  info: (message) => get().addToast(message, 'info'),
}));

// ============================================
// 4. 主题状态 - Theme Store
// ============================================
interface ThemeState {
  theme: 'light' | 'dark';
  initTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  applyTheme: () => void;
  isDark: () => boolean;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light' as const,

      initTheme: () => {
        const saved = localStorage.getItem('theme-storage');
        if (saved) {
          const parsed = JSON.parse(saved);
          set({ theme: parsed.state?.theme || 'light' });
        } else {
          const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          set({ theme: systemDark ? 'dark' : 'light' });
        }
        get().applyTheme();
      },

      setTheme: (theme) => {
        set({ theme });
        get().applyTheme();
      },

      toggleTheme: () => {
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        }));
        get().applyTheme();
      },

      applyTheme: () => {
        const { theme } = get();
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },

      isDark: () => get().theme === 'dark',
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);

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

// ============================================

// ============================================
// 13. 权限管理状态 - Permission Store
// ============================================
interface PermissionState {
  permissions: string[];
  roles: string[];
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loadPermissions: (adminId: number) => Promise<void>;
  fetchAndApply: (adminId: number) => Promise<void>;
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (permissionCodes: string[]) => boolean;
  hasAllPermissions: (permissionCodes: string[]) => boolean;
  setPermissions: (permissions: string[], roles: string[]) => void;
  reloadPermissions: () => void;
  clearPermissions: () => void;
}

let permissionCacheTimestamp = 0;
const PERMISSION_CACHE_TTL = 5 * 60 * 1000;
const PERMISSION_CACHE_TS_KEY = 'permission_cache_ts';

// 后端返回空权限（或缓存为空）时，按角色给可用默认集，避免登录后永远卡在"加载权限..."
function defaultPermissionsForRoles(roles: string[]): string[] {
  if (roles.some((r) => ['admin', 'super_admin'].includes(r))) {
    return ['all'];
  }
  return [
    'student.view',
    'class.view',
    'subject.view',
    'rule.view',
    'score.view',
    'score.entry',
    'device.view',
    'exam.view',
    'algorithm.view',
    'notification.view',
    'homework.view',
    'attendance.view',
    'mental_health.view',
    'activity.view',
    'study_group.view',
    'study_guide.view',
  ];
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      permissions: [],
      roles: [],
      isLoading: true,
      error: null,
      isAdmin: false,
      isSuperAdmin: false,

      // 真实拉取并落库；空权限按角色兜底，避免登录后永远卡在"加载权限..."
      fetchAndApply: async (adminId: number) => {
        try {
          const rbacApi = await import('../services/rbacApi');
          const result = await rbacApi.default.getAdminRoles(adminId);

          const roles = result.roles || [];
          let permissions = result.permissions || [];
          if (permissions.length === 0) {
            // 后端未返回显式权限时，按角色给可用默认集，杜绝空权限死锁
            permissions = defaultPermissionsForRoles(roles);
          }

          permissionCacheTimestamp = Date.now();
          localStorage.setItem(PERMISSION_CACHE_TS_KEY, String(permissionCacheTimestamp));
          localStorage.setItem('user_permissions', JSON.stringify(permissions));
          localStorage.setItem('user_roles', JSON.stringify(roles));

          get().setPermissions(permissions, roles);
        } catch (error) {
          logger.error('Failed to load permissions:', error);
          const adminStr = localStorage.getItem('admin');
          if (adminStr) {
            try {
              const admin = JSON.parse(adminStr);
              const roles = [admin.role || 'teacher'];
              get().setPermissions(defaultPermissionsForRoles(roles), roles);
            } catch {
              set({
                error: (error as Error).message,
                isLoading: false,
                permissions: [],
                roles: [],
                isAdmin: false,
                isSuperAdmin: false,
              });
            }
          } else {
            set({
              error: (error as Error).message,
              isLoading: false,
              permissions: [],
              roles: [],
              isAdmin: false,
              isSuperAdmin: false,
            });
          }
        }
      },

      loadPermissions: async (adminId: number) => {
        const { isLoading } = get();
        if (!isLoading) {
          return;
        }

        const cachedPermissions = localStorage.getItem('user_permissions');
        const cachedRoles = localStorage.getItem('user_roles');
        const cachedTs = Number(localStorage.getItem(PERMISSION_CACHE_TS_KEY) || 0);
        const cacheFresh =
          cachedPermissions && cachedRoles && Date.now() - cachedTs < PERMISSION_CACHE_TTL;

        if (cacheFresh) {
          try {
            const permissions = JSON.parse(cachedPermissions);
            const roles = JSON.parse(cachedRoles);
            // 空权限缓存视为无效，强制回源，避免陈旧空缓存永久阻塞
            if (!Array.isArray(permissions) || permissions.length === 0) {
              throw new Error('empty cached permissions');
            }
            get().setPermissions(permissions, roles);
            // 后台静默刷新（不重置 isLoading，不阻塞 UI），纠正陈旧/空缓存
            void get().fetchAndApply(adminId);
            return;
          } catch {
            // 缓存解析失败或为空，继续走网络加载
          }
        }

        set({ isLoading: true, error: null });
        await get().fetchAndApply(adminId);
      },

      hasPermission: (permissionCode) => {
        const { permissions } = get();
        if (permissions.includes('all')) return true;
        return permissions.includes(permissionCode);
      },

      hasAnyPermission: (permissionCodes) => {
        const { permissions } = get();
        if (permissions.includes('all')) return true;
        return permissionCodes.some((code) => permissions.includes(code));
      },

      hasAllPermissions: (permissionCodes) => {
        const { permissions } = get();
        if (permissions.includes('all')) return true;
        return permissionCodes.every((code) => permissions.includes(code));
      },

      setPermissions: (permissions, roles) => {
        const isSuperAdmin = roles.includes('super_admin');
        const isAdmin = roles.some((r) => ['admin', 'super_admin'].includes(r));
        set({
          permissions,
          roles,
          isLoading: false,
          error: null,
          isAdmin,
          isSuperAdmin,
        });
      },

      reloadPermissions: () => {
        permissionCacheTimestamp = 0;
        localStorage.removeItem(PERMISSION_CACHE_TS_KEY);
        localStorage.removeItem('user_permissions');
        localStorage.removeItem('user_roles');
        // 先置为加载中，否则 loadPermissions 的 !isLoading 守卫会直接跳过，导致"重新加载"无效
        set({ isLoading: true, error: null });
        const adminStr = localStorage.getItem('admin');
        if (adminStr) {
          try {
            const admin = JSON.parse(adminStr);
            get().loadPermissions(admin.id);
          } catch {
            get().clearPermissions();
          }
        } else {
          get().clearPermissions();
        }
      },

      clearPermissions: () => {
        set({
          permissions: [],
          roles: [],
          isLoading: false,
          error: null,
          isAdmin: false,
          isSuperAdmin: false,
        });
        localStorage.removeItem('user_permissions');
        localStorage.removeItem('user_roles');
      },
    }),
    {
      name: 'permission-storage',
      partialize: (state) => ({
        permissions: state.permissions,
        roles: state.roles,
        isAdmin: state.isAdmin,
        isSuperAdmin: state.isSuperAdmin,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state.isLoading = true;
            state.error = null;
          }
        };
      },
    }
  )
);

// ============================================
// 导出所有stores
// ============================================
export const stores = {
  global: useGlobalStore,
  toast: useToastStore,
  theme: useThemeStore,
  websocket: useWebSocketStore,
  permission: usePermissionStore,
};

// 初始化所有stores
export const initStores = (): void => {
  useThemeStore.getState().initTheme();
  useGlobalStore.getState().initNetworkListener();

  const adminStr = localStorage.getItem('admin');
  if (adminStr) {
    try {
      const admin = JSON.parse(adminStr);
      usePermissionStore.getState().loadPermissions(admin.id);
    } catch {}
  }
};
