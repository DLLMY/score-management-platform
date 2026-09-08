/**
 * Zustand Store类型定义
 */

import { StateCreator, StoreApi, UseBoundStore } from 'zustand';
import {
  User,
  Device,
  ScoreRule,
  ScoreRecord,
  ScoreCategory,
  Notification,
  Approval,
  Toast,
  ToastType,
  ThemeMode,
  DeviceStatus,
  DashboardStats,
  RecentActivity,
  ID,
} from './index';

// ============================================
// Store基础类型
// ============================================

export type StoreState<T = unknown> = {
  loading: boolean;
  error: string | null;
  data?: T;
};

export type AsyncActions = {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
};

// ============================================
// Auth Store类型
// ============================================

export interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
}

export interface AuthActions {
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  getToken: () => string | null;
}

export type AuthStore = AuthState & AuthActions;

// ============================================
// Global Store类型
// ============================================

export interface GlobalState {
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  isOnline: boolean;
}

export interface GlobalActions {
  showLoading: (message?: string) => void;
  hideLoading: () => void;
  setError: (error: string) => void;
  clearError: () => void;
  setOnline: (status: boolean) => void;
  initNetworkListener: () => void;
  showToast: (message: string, type?: ToastType) => void;
}

export type GlobalStore = GlobalState & GlobalActions;

// ============================================
// Toast Store类型
// ============================================

export interface ToastState {
  toasts: Toast[];
}

export interface ToastActions {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: ID) => void;
  clearAllToasts: () => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

export type ToastStore = ToastState & ToastActions;

// ============================================
// Theme Store类型
// ============================================

export interface ThemeState {
  theme: ThemeMode;
}

export interface ThemeActions {
  initTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  applyTheme: () => void;
  isDark: () => boolean;
}

export type ThemeStore = ThemeState & ThemeActions;

// ============================================
// WebSocket Store类型
// ============================================

export interface WebSocketState {
  socket: unknown | null;
  isConnected: boolean;
  lastNotification: Notification | null;
  deviceStatuses: Record<string, DeviceStatus>;
  alerts: Notification[];
  scoreUpdates: unknown[];
}

export interface WebSocketActions {
  initSocket: (url?: string) => void;
  disconnectSocket: () => void;
  subscribe: (room: string) => void;
  unsubscribe: (room: string) => void;
  emit: (event: string, data: unknown) => void;
}

export type WebSocketStore = WebSocketState & WebSocketActions;

// ============================================
// User Store类型
// ============================================

export interface UserState {
  users: User[];
  selectedUser: User | null;
  loading: boolean;
  error: string | null;
}

export interface UserActions {
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  updateUser: (userId: ID, updates: Partial<User>) => void;
  deleteUser: (userId: ID) => void;
  setSelectedUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchUsers: () => Promise<void>;
}

export type UserStore = UserState & UserActions;

// ============================================
// Device Store类型
// ============================================

export interface DeviceState {
  devices: Device[];
  selectedDevice: Device | null;
  loading: boolean;
  error: string | null;
}

export interface DeviceActions {
  setDevices: (devices: Device[]) => void;
  addDevice: (device: Device) => void;
  updateDevice: (deviceId: ID, updates: Partial<Device>) => void;
  deleteDevice: (deviceId: ID) => void;
  setSelectedDevice: (device: Device | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export type DeviceStore = DeviceState & DeviceActions;

// ============================================
// Score Store类型
// ============================================

export interface ScoreState {
  rules: ScoreRule[];
  records: ScoreRecord[];
  categories: ScoreCategory[];
  selectedRule: ScoreRule | null;
  loading: boolean;
  error: string | null;
}

export interface ScoreActions {
  setRules: (rules: ScoreRule[]) => void;
  addRule: (rule: ScoreRule) => void;
  updateRule: (ruleId: ID, updates: Partial<ScoreRule>) => void;
  deleteRule: (ruleId: ID) => void;
  setRecords: (records: ScoreRecord[]) => void;
  addRecord: (record: ScoreRecord) => void;
  setCategories: (categories: ScoreCategory[]) => void;
  setSelectedRule: (rule: ScoreRule | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export type ScoreStore = ScoreState & ScoreActions;

// ============================================
// Notification Store类型
// ============================================

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
}

export interface NotificationActions {
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: ID) => void;
  markAllAsRead: () => void;
  setNotifications: (notifications: Notification[]) => void;
  clearNotifications: () => void;
}

export type NotificationStore = NotificationState & NotificationActions;

// ============================================
// UI Store类型
// ============================================

export interface UIState {
  sidebarOpen: boolean;
  compactMode: boolean;
}

export interface UIActions {
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleCompactMode: () => void;
}

export type UIStore = UIState & UIActions;

// ============================================
// Dashboard Store类型
// ============================================

export interface DashboardState {
  stats: DashboardStats | null;
  recentActivity: RecentActivity[];
  loading: boolean;
  error: string | null;
}

export interface DashboardActions {
  setStats: (stats: DashboardStats) => void;
  setRecentActivity: (activity: RecentActivity[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export type DashboardStore = DashboardState & DashboardActions;

// ============================================
// Approval Store类型
// ============================================

export interface ApprovalState {
  approvals: Approval[];
  pendingApprovals: Approval[];
  loading: boolean;
  error: string | null;
}

export interface ApprovalActions {
  setApprovals: (approvals: Approval[]) => void;
  setPendingApprovals: (pending: Approval[]) => void;
  addApproval: (approval: Approval) => void;
  updateApproval: (approvalId: ID, updates: Partial<Approval>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export type ApprovalStore = ApprovalState & ApprovalActions;

// ============================================
// Store Hook类型
// ============================================

export type UseAuthStore = UseBoundStore<StoreApi<AuthStore>>;
export type UseGlobalStore = UseBoundStore<StoreApi<GlobalStore>>;
export type UseToastStore = UseBoundStore<StoreApi<ToastStore>>;
export type UseThemeStore = UseBoundStore<StoreApi<ThemeStore>>;
export type UseWebSocketStore = UseBoundStore<StoreApi<WebSocketStore>>;
export type UseUserStore = UseBoundStore<StoreApi<UserStore>>;
export type UseDeviceStore = UseBoundStore<StoreApi<DeviceStore>>;
export type UseScoreStore = UseBoundStore<StoreApi<ScoreStore>>;
export type UseNotificationStore = UseBoundStore<StoreApi<NotificationStore>>;
export type UseUIStore = UseBoundStore<StoreApi<UIStore>>;
export type UseDashboardStore = UseBoundStore<StoreApi<DashboardStore>>;
export type UseApprovalStore = UseBoundStore<StoreApi<ApprovalStore>>;

// ============================================
// Store创建器类型
// ============================================

export type AuthStoreCreator = StateCreator<AuthStore>;
export type GlobalStoreCreator = StateCreator<GlobalStore>;
export type ToastStoreCreator = StateCreator<ToastStore>;
export type ThemeStoreCreator = StateCreator<ThemeStore>;
export type WebSocketStoreCreator = StateCreator<WebSocketStore>;
export type UserStoreCreator = StateCreator<UserStore>;
export type DeviceStoreCreator = StateCreator<DeviceStore>;
export type ScoreStoreCreator = StateCreator<ScoreStore>;
export type NotificationStoreCreator = StateCreator<NotificationStore>;
export type UIStoreCreator = StateCreator<UIStore>;
export type DashboardStoreCreator = StateCreator<DashboardStore>;
export type ApprovalStoreCreator = StateCreator<ApprovalStore>;
