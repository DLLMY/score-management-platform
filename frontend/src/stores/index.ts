/**
 * 统一状态管理 - Zustand Stores
 * 所有状态管理统一使用Zustand，移除Context API
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';
import { Device, User } from '../types';
import api from '../services/api';
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

// 规则类型
interface Rule {
  id: number;
  name: string;
  description: string;
  category_id: number | null;
  score: number;
  is_active: boolean;
  max_per_day: number;
  min_interval: number;
  daily_limit?: number;
  score_min?: number;
  score_max?: number;
}

// 分类类型
interface Category {
  id: number;
  name: string;
  color: string;
}

// 积分记录类型
interface ScoreRecord {
  id: number;
  user_id: number;
  rule_id: number;
  score: number;
  description: string;
  created_at: string;
  admin_id: number;
}

// 审批类型
interface Approval {
  id: number;
  user_id: number;
  user_name?: string;
  title: string;
  description: string;
  type: 'score_adjust' | 'special_reward' | 'other';
  score_change?: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approve_time?: string;
  comment?: string;
}

// ============================================
// 1. 认证状态 - Auth Store
// ============================================
interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  getToken: () => string | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: (token, user) => set({
        token,
        user,
        isAuthenticated: true,
      }),

      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
        localStorage.removeItem('auth-storage');
      },

      updateUser: (userData) => set({
        user: { ...get().user, ...userData } as User,
      }),

      getToken: () => get().token,
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

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
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
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

    const socketUrl = isDevelopment 
      ? 'http://localhost:5000'
      : window.location.origin;

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
      console.log('[WebSocket] 连接成功');
    });

    socketInstance.on('disconnect', (reason: string) => {
      isSocketConnecting = false;
      set({ isConnected: false });
      console.log(`[WebSocket] 连接断开: ${reason}`);
    });

    socketInstance.on('connect_error', (error: Error) => {
      isSocketConnecting = false;
      currentReconnectAttempt++;
      if (currentReconnectAttempt <= MAX_RECONNECT_ATTEMPTS) {
        const delay = calculateReconnectionDelay(currentReconnectAttempt);
        console.log(`[WebSocket] 连接失败 (${currentReconnectAttempt}/${MAX_RECONNECT_ATTEMPTS}), ${(delay / 1000).toFixed(1)}s后重试: ${error.message}`);
      } else {
        console.error('[WebSocket] 重连失败超过最大次数，停止重连');
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
// 6. 用户管理状态 - User Store
// ============================================
interface UserState {
  users: User[];
  selectedUser: User | null;
  loading: boolean;
  error: string | null;
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  updateUser: (userId: number, updates: Partial<User>) => void;
  deleteUser: (userId: number) => void;
  setSelectedUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchUsers: () => Promise<void>;
}

export const useUserStore = create<UserState>()((set) => ({
  users: [],
  selectedUser: null,
  loading: false,
  error: null,

  setUsers: (users) => set({ users }),

  addUser: (user) => set((state) => ({
    users: [...state.users, user],
  })),

  updateUser: (userId, updates) => set((state) => ({
    users: state.users.map((u) =>
      u.id === userId ? { ...u, ...updates } : u
    ),
  })),

  deleteUser: (userId) => set((state) => ({
    users: state.users.filter((u) => u.id !== userId),
  })),

  setSelectedUser: (user) => set({ selectedUser: user }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.users.getAll();
      set({ users: response.users || [], loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
}));

// ============================================
// 7. 设备管理状态 - Device Store
// ============================================
interface DeviceState {
  devices: Device[];
  selectedDevice: Device | null;
  loading: boolean;
  error: string | null;
  setDevices: (devices: Device[]) => void;
  addDevice: (device: Device) => void;
  updateDevice: (deviceId: number, updates: Partial<Device>) => void;
  deleteDevice: (deviceId: number) => void;
  setSelectedDevice: (device: Device | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useDeviceStore = create<DeviceState>()((set) => ({
  devices: [],
  selectedDevice: null,
  loading: false,
  error: null,

  setDevices: (devices) => set({ devices }),

  addDevice: (device) => set((state) => ({
    devices: [...state.devices, device],
  })),

  updateDevice: (deviceId, updates) => set((state) => ({
    devices: state.devices.map((d) =>
      d.id === deviceId ? { ...d, ...updates } : d
    ),
  })),

  deleteDevice: (deviceId) => set((state) => ({
    devices: state.devices.filter((d) => d.id !== deviceId),
  })),

  setSelectedDevice: (device) => set({ selectedDevice: device }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),
}));

// ============================================
// 8. 积分管理状态 - Score Store
// ============================================
interface ScoreState {
  rules: Rule[];
  records: ScoreRecord[];
  categories: Category[];
  selectedRule: Rule | null;
  loading: boolean;
  error: string | null;
  setRules: (rules: Rule[]) => void;
  addRule: (rule: Rule) => void;
  updateRule: (ruleId: number, updates: Partial<Rule>) => void;
  deleteRule: (ruleId: number) => void;
  setRecords: (records: ScoreRecord[]) => void;
  addRecord: (record: ScoreRecord) => void;
  setCategories: (categories: Category[]) => void;
  setSelectedRule: (rule: Rule | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useScoreStore = create<ScoreState>()((set) => ({
  rules: [],
  records: [],
  categories: [],
  selectedRule: null,
  loading: false,
  error: null,

  setRules: (rules) => set({ rules }),

  addRule: (rule) => set((state) => ({
    rules: [...state.rules, rule],
  })),

  updateRule: (ruleId, updates) => set((state) => ({
    rules: state.rules.map((r) =>
      r.id === ruleId ? { ...r, ...updates } : r
    ),
  })),

  deleteRule: (ruleId) => set((state) => ({
    rules: state.rules.filter((r) => r.id !== ruleId),
  })),

  setRecords: (records) => set({ records }),

  addRecord: (record) => set((state) => ({
    records: [record, ...state.records],
  })),

  setCategories: (categories) => set({ categories }),

  setSelectedRule: (rule) => set({ selectedRule: rule }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),
}));

// ============================================
// 9. 通知管理状态 - Notification Store
// ============================================
interface Notification {
  id: number;
  message: string;
  type: string;
  read?: boolean;
  created_at?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: number) => void;
  markAllAsRead: () => void;
  setNotifications: (notifications: Notification[]) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications],
    unreadCount: state.unreadCount + 1,
  })),

  markAsRead: (notificationId) => set((state) => ({
    notifications: state.notifications.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n
    ),
    unreadCount: Math.max(0, state.unreadCount - 1),
  })),

  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, read: true })),
    unreadCount: 0,
  })),

  setNotifications: (notifications) => set({
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
  }),

  clearNotifications: () => set({
    notifications: [],
    unreadCount: 0,
  }),
}));

// ============================================
// 10. UI布局状态 - UI Store
// ============================================
interface UIState {
  sidebarOpen: boolean;
  compactMode: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleCompactMode: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      compactMode: false,

      toggleSidebar: () => set((state) => ({
        sidebarOpen: !state.sidebarOpen,
      })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      toggleCompactMode: () => set((state) => ({
        compactMode: !state.compactMode,
      })),
    }),
    {
      name: 'ui-settings',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        compactMode: state.compactMode,
      }),
    }
  )
);

// ============================================
// 11. 仪表盘状态 - Dashboard Store
// ============================================
interface DashboardStats {
  totalUsers?: number;
  totalScore?: number;
  todayRecords?: number;
  pendingApprovals?: number;
}

interface DashboardState {
  stats: DashboardStats | null;
  recentActivity: unknown[];
  loading: boolean;
  error: string | null;
  setStats: (stats: DashboardStats | null) => void;
  setRecentActivity: (activity: unknown[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  stats: null,
  recentActivity: [],
  loading: false,
  error: null,

  setStats: (stats) => set({ stats }),

  setRecentActivity: (activity) => set({ recentActivity: activity }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),
}));

// ============================================
// 12. 审批状态 - Approval Store
// ============================================
interface ApprovalState {
  approvals: Approval[];
  pendingApprovals: Approval[];
  loading: boolean;
  error: string | null;
  setApprovals: (approvals: Approval[]) => void;
  setPendingApprovals: (pending: Approval[]) => void;
  addApproval: (approval: Approval) => void;
  updateApproval: (approvalId: number, updates: Partial<Approval>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useApprovalStore = create<ApprovalState>()((set) => ({
  approvals: [],
  pendingApprovals: [],
  loading: false,
  error: null,

  setApprovals: (approvals) => set({ approvals }),

  setPendingApprovals: (pending) => set({ pendingApprovals: pending }),

  addApproval: (approval) => set((state) => ({
    approvals: [...state.approvals, approval],
    pendingApprovals: approval.status === 'pending'
      ? [...state.pendingApprovals, approval]
      : state.pendingApprovals,
  })),

  updateApproval: (approvalId, updates) => set((state) => ({
    approvals: state.approvals.map((a) =>
      a.id === approvalId ? { ...a, ...updates } : a
    ),
    pendingApprovals: updates.status !== 'pending'
      ? state.pendingApprovals.filter((a) => a.id !== approvalId)
      : state.pendingApprovals,
  })),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),
}));

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
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (permissionCodes: string[]) => boolean;
  hasAllPermissions: (permissionCodes: string[]) => boolean;
  setPermissions: (permissions: string[], roles: string[]) => void;
  reloadPermissions: () => void;
  clearPermissions: () => void;
}

let permissionCacheTimestamp = 0;
const PERMISSION_CACHE_TTL = 5 * 60 * 1000;

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      permissions: [],
      roles: [],
      isLoading: true,
      error: null,
      isAdmin: false,
      isSuperAdmin: false,

      loadPermissions: async (adminId: number) => {
        const { isLoading } = get();
        if (!isLoading) {
          return;
        }

        const now = Date.now();
        const cachedPermissions = localStorage.getItem('user_permissions');
        const cachedRoles = localStorage.getItem('user_roles');
        
        if (cachedPermissions && cachedRoles && now - permissionCacheTimestamp < PERMISSION_CACHE_TTL) {
          try {
            const permissions = JSON.parse(cachedPermissions);
            const roles = JSON.parse(cachedRoles);
            get().setPermissions(permissions, roles);
            return;
          } catch {
          }
        }

        set({ isLoading: true, error: null });
        try {
          const rbacApi = await import('../services/rbacApi');
          const result = await rbacApi.default.getAdminRoles(adminId);
          
          const permissions = result.permissions || [];
          const roles = result.roles || [];
          
          permissionCacheTimestamp = Date.now();
          localStorage.setItem('user_permissions', JSON.stringify(permissions));
          localStorage.setItem('user_roles', JSON.stringify(roles));
          
          get().setPermissions(permissions, roles);
        } catch (error) {
          console.error('Failed to load permissions:', error);
          const adminStr = localStorage.getItem('admin');
          if (adminStr) {
            try {
              const admin = JSON.parse(adminStr);
              const defaultPermissions = admin.role === 'admin' 
                ? ['all'] 
                : ['student.view', 'class.view', 'subject.view', 'rule.view', 'score.view', 'score.entry'];
              const defaultRoles = [admin.role || 'teacher'];
              get().setPermissions(defaultPermissions, defaultRoles);
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
        localStorage.removeItem('user_permissions');
        localStorage.removeItem('user_roles');
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
  auth: useAuthStore,
  global: useGlobalStore,
  toast: useToastStore,
  theme: useThemeStore,
  websocket: useWebSocketStore,
  user: useUserStore,
  device: useDeviceStore,
  score: useScoreStore,
  notification: useNotificationStore,
  ui: useUIStore,
  dashboard: useDashboardStore,
  approval: useApprovalStore,
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
    } catch {
    }
  }
};