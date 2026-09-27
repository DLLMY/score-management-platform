import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// 注意：所有 import 必须在 vi.mock 之前（eslint import/first），
// vi.mock 在运行时由 vitest 自动提升到模块顶部，故仍能正确劫持 'socket.io-client'。
import {
  useGlobalStore,
  usePermissionStore,
  useThemeStore,
  useToastStore,
  useWebSocketStore,
} from '../index';

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
  },
}));
const { mockGetAdminRoles } = vi.hoisted(() => ({ mockGetAdminRoles: vi.fn() }));
const { mockSocket, mockIo, socketHandlers } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const emit = vi.fn();
  const disconnect = vi.fn();
  // 显式声明 emit/disconnect 为 Mock，避免 Record<string, unknown> 丢失调用类型
  // （否则 mockClear/toHaveBeenCalledWith 都不可用）
  const socket: {
    connected: boolean;
    emit: typeof emit;
    disconnect: typeof disconnect;
    on: (event: string, cb: (...args: unknown[]) => void) => unknown;
  } = {
    connected: false,
    emit,
    disconnect,
    on: (event, cb) => {
      handlers[event] = cb;
      return socket;
    },
  };
  // 形参需具名，否则 mock.calls 被推断为空元组 → mock.calls[0][0] 报 TS2493
  return {
    mockSocket: socket,
    socketHandlers: handlers,
    mockIo: vi.fn((_url?: string, _opts?: unknown) => socket),
  };
});

vi.mock('../../utils/logger', () => ({ default: mockLogger }));
vi.mock('../../services/rbacApi', () => ({ default: { getAdminRoles: mockGetAdminRoles } }));
vi.mock('../../config/env', () => ({ isDevelopment: true }));
vi.mock('socket.io-client', () => ({ io: mockIo, Socket: {} }));

/** 触发某个 socket 事件回调（返回是否注册过该事件） */
const fireSocket = (event: string, ...args: unknown[]): boolean => {
  const cb = socketHandlers[event];
  if (!cb) return false;
  cb(...args);
  return true;
};

const resetAll = () => {
  localStorage.clear();
  useGlobalStore.setState({
    isLoading: false,
    loadingMessage: '',
    error: null,
    isOnline: true,
  });
  useToastStore.setState({ toasts: [] });
  useThemeStore.setState({ theme: 'light' });
  useWebSocketStore.getState().disconnectSocket();
  useWebSocketStore.setState({
    socket: null,
    isConnected: false,
    lastNotification: null,
    deviceStatuses: {},
    alerts: [],
    scoreUpdates: [],
  });
  usePermissionStore.setState({
    permissions: [],
    roles: [],
    isLoading: true,
    error: null,
    isAdmin: false,
    isSuperAdmin: false,
  });
  Object.keys(socketHandlers).forEach((k) => delete socketHandlers[k]);
  mockIo.mockClear();
  mockSocket.emit.mockClear();
  mockSocket.disconnect.mockClear();
  mockGetAdminRoles.mockReset();
  mockLogger.error.mockClear();
  mockLogger.log.mockClear();
};

beforeEach(resetAll);
afterEach(() => {
  document.documentElement.classList.remove('dark');
  vi.useRealTimers();
});

// ==================================================================
describe('useGlobalStore', () => {
  it('初始状态为未加载、无错误且在线', () => {
    const s = useGlobalStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.loadingMessage).toBe('');
    expect(s.error).toBeNull();
    expect(s.isOnline).toBe(true);
  });

  it('showLoading 默认文案 / hideLoading 复位', () => {
    useGlobalStore.getState().showLoading();
    expect(useGlobalStore.getState().isLoading).toBe(true);
    expect(useGlobalStore.getState().loadingMessage).toBe('加载中...');

    useGlobalStore.getState().showLoading('导入中...');
    expect(useGlobalStore.getState().loadingMessage).toBe('导入中...');

    useGlobalStore.getState().hideLoading();
    expect(useGlobalStore.getState().isLoading).toBe(false);
    expect(useGlobalStore.getState().loadingMessage).toBe('');
  });

  it('setError / clearError / setOnline', () => {
    useGlobalStore.getState().setError('出错了');
    expect(useGlobalStore.getState().error).toBe('出错了');
    useGlobalStore.getState().clearError();
    expect(useGlobalStore.getState().error).toBeNull();

    useGlobalStore.getState().setOnline(false);
    expect(useGlobalStore.getState().isOnline).toBe(false);
  });

  it('showToast 委托给 toast store', () => {
    useGlobalStore.getState().showToast('保存成功');
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ message: '保存成功', type: 'success' });

    useGlobalStore.getState().showToast('注意', 'warning');
    expect(useToastStore.getState().toasts[1].type).toBe('warning');
  });

  it('initNetworkListener 监听 online/offline 并联动 toast', () => {
    useGlobalStore.getState().initNetworkListener();

    window.dispatchEvent(new Event('offline'));
    expect(useGlobalStore.getState().isOnline).toBe(false);
    expect(useToastStore.getState().toasts.slice(-1)[0]).toMatchObject({
      message: '网络连接已断开，请检查网络',
      type: 'error',
    });

    window.dispatchEvent(new Event('online'));
    expect(useGlobalStore.getState().isOnline).toBe(true);
    expect(useToastStore.getState().toasts.slice(-1)[0]).toMatchObject({
      message: '网络连接已恢复',
      type: 'success',
    });
  });
});

// ==================================================================
describe('useToastStore', () => {
  it('addToast 默认 success / 3000ms，可指定类型与时长', () => {
    useToastStore.getState().addToast('默认');
    useToastStore.getState().addToast('自定义', 'error', 100);
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(2);
    expect(toasts[0]).toMatchObject({ message: '默认', type: 'success', duration: 3000 });
    expect(toasts[1]).toMatchObject({ message: '自定义', type: 'error', duration: 100 });
    expect(toasts[0].id).not.toBe(toasts[1].id);
  });

  it('到时长后自动移除对应 toast', () => {
    vi.useFakeTimers();
    useToastStore.getState().addToast('自动消失', 'info', 1000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('removeToast 按 id 精确移除；clearAllToasts 清空', () => {
    useToastStore.getState().addToast('a');
    useToastStore.getState().addToast('b');
    const [first] = useToastStore.getState().toasts;
    useToastStore.getState().removeToast(first.id);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    useToastStore.getState().clearAllToasts();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it.each([
    ['success', 'S'],
    ['error', 'E'],
    ['warning', 'W'],
    ['info', 'I'],
  ] as const)('%s 快捷方法注入对应类型', (method, text) => {
    useToastStore.getState()[method](text);
    expect(useToastStore.getState().toasts[0]).toMatchObject({ message: text, type: method });
  });
});

// ==================================================================
describe('useThemeStore', () => {
  it('initTheme：localStorage 已有偏好时优先采用', () => {
    localStorage.setItem('theme-storage', JSON.stringify({ state: { theme: 'dark' }, version: 0 }));
    useThemeStore.getState().initTheme();
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('initTheme：无偏好时跟随系统（matchMedia）', () => {
    // theme store 带 persist：beforeEach 的 setState 会把 'theme-storage' 写回 localStorage，
    // 必须先清掉，否则会走进「已有偏好」分支（prefers-color-scheme 用例失效）。
    localStorage.removeItem('theme-storage');
    window.matchMedia = ((q: string) => ({
      matches: true,
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    useThemeStore.getState().initTheme();
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('setTheme 更改主题并同步到 documentElement 的 dark 类', () => {
    useThemeStore.getState().setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(useThemeStore.getState().isDark()).toBe(true);

    useThemeStore.getState().setTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(useThemeStore.getState().isDark()).toBe(false);
  });

  it('toggleTheme 在明暗间往返', () => {
    expect(useThemeStore.getState().theme).toBe('light');
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('dark');
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
  });
});

// ==================================================================
describe('useWebSocketStore', () => {
  const connect = () => {
    useWebSocketStore.getState().initSocket();
    fireSocket('connect');
  };

  it('initSocket 建立连接并记录 socket 实例', () => {
    useWebSocketStore.getState().initSocket();
    expect(mockIo).toHaveBeenCalledTimes(1);
    expect(mockIo.mock.calls[0][0]).toBe('http://localhost:5000'); // isDevelopment=true
    expect(mockIo.mock.calls[0][1]).toMatchObject({
      path: '/socket.io',
      reconnectionAttempts: 10,
    });
    expect(useWebSocketStore.getState().socket).toBe(mockSocket);
  });

  it('已连接时重复 initSocket 直接跳过（防 StrictMode 双初始化）', () => {
    connect();
    mockSocket.connected = true;
    useWebSocketStore.getState().initSocket();
    expect(mockIo).toHaveBeenCalledTimes(1);
    mockSocket.connected = false;
  });

  it('connect 事件置为已连接；disconnect 事件回落到离线', () => {
    useWebSocketStore.getState().initSocket();
    fireSocket('connect');
    expect(useWebSocketStore.getState().isConnected).toBe(true);

    fireSocket('disconnect', 'transport close');
    expect(useWebSocketStore.getState().isConnected).toBe(false);
    expect(mockLogger.log).toHaveBeenCalledWith('[WebSocket] 连接断开: transport close');
  });

  it('connect_error 在阈值内记录退避日志', () => {
    useWebSocketStore.getState().initSocket();
    fireSocket('connect_error', new Error('boom'));
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('[WebSocket] 连接失败 (1/10)')
    );
  });

  it('connect_error 超过最大重连次数后提示并复位计数', () => {
    useWebSocketStore.getState().initSocket();
    for (let i = 0; i < 11; i++) {
      fireSocket('connect_error', new Error('boom'));
    }
    expect(mockLogger.error).toHaveBeenCalledWith('[WebSocket] 重连失败超过最大次数，停止重连');
    expect(useToastStore.getState().toasts.slice(-1)[0]).toMatchObject({
      message: 'WebSocket连接失败，请刷新页面重试',
      type: 'error',
    });
  });

  it('notification 事件记录最新通知并弹 info', () => {
    useWebSocketStore.getState().initSocket();
    fireSocket('notification', { id: 1, message: '你有新作业', type: 'homework' });
    expect(useWebSocketStore.getState().lastNotification).toEqual({
      id: 1,
      message: '你有新作业',
      type: 'homework',
    });
    expect(useToastStore.getState().toasts.slice(-1)[0]).toMatchObject({
      message: '你有新作业',
      type: 'info',
    });
  });

  it('notification 缺 message 时回落到默认文案', () => {
    useWebSocketStore.getState().initSocket();
    fireSocket('notification', { id: 2, type: 'x' });
    expect(useToastStore.getState().toasts.slice(-1)[0]).toMatchObject({ message: '收到新通知' });
  });

  it('device_status 按 device_id 累加/覆盖设备状态', () => {
    useWebSocketStore.getState().initSocket();
    fireSocket('device_status', { device_id: 'd1', status: 'online' });
    fireSocket('device_status', { device_id: 'd2', status: 'offline' });
    fireSocket('device_status', { device_id: 'd1', status: 'error' });
    expect(useWebSocketStore.getState().deviceStatuses).toEqual({ d1: 'error', d2: 'offline' });
  });

  it('alert 新告警前置入列且最多保留 100 条', () => {
    useWebSocketStore.getState().initSocket();
    fireSocket('alert', { id: 1, message: 'first', type: 'a' });
    fireSocket('alert', { id: 2, message: 'second', type: 'a' });
    expect(useWebSocketStore.getState().alerts[0]).toEqual({
      id: 2,
      message: 'second',
      type: 'a',
    });

    for (let i = 3; i <= 105; i++) {
      fireSocket('alert', { id: i, message: `m${i}`, type: 'a' });
    }
    expect(useWebSocketStore.getState().alerts).toHaveLength(100);
    expect(useWebSocketStore.getState().alerts[0]).toMatchObject({ id: 105 });
  });

  it('score_update 前置入列、截断至 50 条并广播 CustomEvent', () => {
    useWebSocketStore.getState().initSocket();
    const listener = vi.fn();
    window.addEventListener('score_update', listener);

    fireSocket('score_update', { user_id: 1, score_change: 5, timestamp: 't1' });
    expect(useWebSocketStore.getState().scoreUpdates[0]).toMatchObject({ user_id: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    for (let i = 2; i <= 55; i++) {
      fireSocket('score_update', { user_id: i, score_change: i, timestamp: `t${i}` });
    }
    expect(useWebSocketStore.getState().scoreUpdates).toHaveLength(50);
    expect(useWebSocketStore.getState().scoreUpdates[0]).toMatchObject({ user_id: 55 });

    window.removeEventListener('score_update', listener);
  });

  it('disconnectSocket 断开并清空连接态', () => {
    connect();
    useWebSocketStore.getState().disconnectSocket();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(useWebSocketStore.getState().socket).toBeNull();
    expect(useWebSocketStore.getState().isConnected).toBe(false);
  });

  it('disconnectSocket 在无连接时安全空转', () => {
    useWebSocketStore.getState().disconnectSocket();
    expect(useWebSocketStore.getState().socket).toBeNull();
  });

  it('subscribe / unsubscribe / emit 委托给 socket.emit', () => {
    connect();
    useWebSocketStore.getState().subscribe('class-1');
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', { room: 'class-1' });

    useWebSocketStore.getState().unsubscribe('class-1');
    expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe', { room: 'class-1' });

    useWebSocketStore.getState().emit('ping', { a: 1 });
    expect(mockSocket.emit).toHaveBeenCalledWith('ping', { a: 1 });
  });

  it('无 socket 时 subscribe/emit 不抛错', () => {
    expect(() => useWebSocketStore.getState().subscribe('x')).not.toThrow();
    expect(() => useWebSocketStore.getState().emit('x', 1)).not.toThrow();
  });
});

// ==================================================================
describe('usePermissionStore', () => {
  it('初始状态为空权限且处于加载中', () => {
    const s = usePermissionStore.getState();
    expect(s.permissions).toEqual([]);
    expect(s.roles).toEqual([]);
    expect(s.isLoading).toBe(true);
  });

  it('setPermissions 计算 isAdmin / isSuperAdmin（持久化由 fetchAndApply 负责）', () => {
    usePermissionStore.getState().setPermissions(['score.view'], ['super_admin']);
    const s = usePermissionStore.getState();
    expect(s.isSuperAdmin).toBe(true);
    expect(s.isAdmin).toBe(true);
    expect(s.isLoading).toBe(false);
    expect(s.error).toBeNull();

    usePermissionStore.getState().setPermissions(['p'], ['teacher']);
    expect(usePermissionStore.getState().isAdmin).toBe(false);
    expect(usePermissionStore.getState().isSuperAdmin).toBe(false);
  });

  describe('权限判定', () => {
    it('持有 all 时对任意权限放行', () => {
      usePermissionStore.getState().setPermissions(['all'], ['admin']);
      const s = usePermissionStore.getState();
      expect(s.hasPermission('anything')).toBe(true);
      expect(s.hasAnyPermission(['a', 'b'])).toBe(true);
      expect(s.hasAllPermissions(['a', 'b'])).toBe(true);
    });

    it('精确权限下 hasPermission 命中判断', () => {
      usePermissionStore.getState().setPermissions(['score.view'], ['teacher']);
      const s = usePermissionStore.getState();
      expect(s.hasPermission('score.view')).toBe(true);
      expect(s.hasPermission('score.delete')).toBe(false);
    });

    it('hasAnyPermission 命中其一即真；全部未命中为假', () => {
      usePermissionStore.getState().setPermissions(['a'], ['teacher']);
      const s = usePermissionStore.getState();
      expect(s.hasAnyPermission(['b', 'a'])).toBe(true);
      expect(s.hasAnyPermission(['b', 'c'])).toBe(false);
    });

    it('hasAllPermissions 需全部命中', () => {
      usePermissionStore.getState().setPermissions(['a', 'b'], ['teacher']);
      const s = usePermissionStore.getState();
      expect(s.hasAllPermissions(['a', 'b'])).toBe(true);
      expect(s.hasAllPermissions(['a', 'c'])).toBe(false);
    });
  });

  it('fetchAndApply 成功：落库权限与角色', async () => {
    mockGetAdminRoles.mockResolvedValue({ roles: ['teacher'], permissions: ['score.entry'] });
    await usePermissionStore.getState().fetchAndApply(7);

    expect(mockGetAdminRoles).toHaveBeenCalledWith(7);
    expect(usePermissionStore.getState().permissions).toEqual(['score.entry']);
    expect(usePermissionStore.getState().roles).toEqual(['teacher']);
    expect(localStorage.getItem('user_roles')).toBe('["teacher"]');
  });

  it('fetchAndApply 后端返回空权限时按角色兜底', async () => {
    mockGetAdminRoles.mockResolvedValue({ roles: ['admin'], permissions: [] });
    await usePermissionStore.getState().fetchAndApply(1);
    expect(usePermissionStore.getState().permissions).toEqual(['all']);
  });

  it('fetchAndApply 返回 null 时按异常处理', async () => {
    mockGetAdminRoles.mockResolvedValue(null);
    localStorage.setItem('admin', JSON.stringify({ id: 3, role: 'teacher' }));
    await usePermissionStore.getState().fetchAndApply(3);

    expect(mockLogger.error).toHaveBeenCalled();
    const s = usePermissionStore.getState();
    expect(s.roles).toEqual(['teacher']);
    expect(s.permissions).toContain('score.view');
  });

  it('fetchAndApply 异常且 localStorage.admin 损坏时清空权限', async () => {
    mockGetAdminRoles.mockRejectedValue(new Error('network'));
    localStorage.setItem('admin', '{not-json');
    await usePermissionStore.getState().fetchAndApply(3);

    const s = usePermissionStore.getState();
    expect(s.permissions).toEqual([]);
    expect(s.roles).toEqual([]);
    expect(s.error).toBe('network');
    expect(s.isLoading).toBe(false);
  });

  it('fetchAndApply 异常且无 admin 缓存时清空权限', async () => {
    mockGetAdminRoles.mockRejectedValue(new Error('offline'));
    await usePermissionStore.getState().fetchAndApply(3);

    const s = usePermissionStore.getState();
    expect(s.permissions).toEqual([]);
    expect(s.error).toBe('offline');
    expect(s.isLoading).toBe(false);
  });

  it('loadPermissions：isLoading 为 false 时直接返回', async () => {
    usePermissionStore.setState({ isLoading: false });
    await usePermissionStore.getState().loadPermissions(1);
    expect(mockGetAdminRoles).not.toHaveBeenCalled();
  });

  it('loadPermissions：缓存新鲜时直接落地并后台静默刷新', async () => {
    localStorage.setItem('user_permissions', JSON.stringify(['score.view']));
    localStorage.setItem('user_roles', JSON.stringify(['teacher']));
    localStorage.setItem('permission_cache_ts', String(Date.now()));
    mockGetAdminRoles.mockResolvedValue({ roles: ['teacher'], permissions: ['score.view'] });

    await usePermissionStore.getState().loadPermissions(5);

    expect(usePermissionStore.getState().permissions).toEqual(['score.view']);
    // 后台静默刷新是浮点 Promise，需等待其真正落到 API 层
    await vi.waitFor(() => expect(mockGetAdminRoles).toHaveBeenCalledWith(5));
  });

  it('loadPermissions：缓存为空数组视为失效并回源', async () => {
    localStorage.setItem('user_permissions', JSON.stringify([]));
    localStorage.setItem('user_roles', JSON.stringify(['teacher']));
    localStorage.setItem('permission_cache_ts', String(Date.now()));
    mockGetAdminRoles.mockResolvedValue({ roles: ['admin'], permissions: [] });

    await usePermissionStore.getState().loadPermissions(5);

    expect(usePermissionStore.getState().permissions).toEqual(['all']);
  });

  it('loadPermissions：无缓存时走网络加载', async () => {
    mockGetAdminRoles.mockResolvedValue({ roles: ['teacher'], permissions: ['class.view'] });
    usePermissionStore.setState({ isLoading: true });
    await usePermissionStore.getState().loadPermissions(9);
    expect(usePermissionStore.getState().permissions).toEqual(['class.view']);
  });

  it('clearPermissions 清空权限与本地缓存', () => {
    usePermissionStore.getState().setPermissions(['p'], ['teacher']);
    usePermissionStore.getState().clearPermissions();
    expect(usePermissionStore.getState().permissions).toEqual([]);
    expect(localStorage.getItem('user_permissions')).toBeNull();
  });

  it('reloadPermissions：无 admin 时清空权限', () => {
    usePermissionStore.getState().reloadPermissions();
    expect(usePermissionStore.getState().permissions).toEqual([]);
  });

  it('reloadPermissions：有合法 admin 时重新加载', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 11, role: 'teacher' }));
    localStorage.setItem('user_permissions', JSON.stringify(['p']));
    mockGetAdminRoles.mockResolvedValue({ roles: ['teacher'], permissions: ['score.entry'] });

    usePermissionStore.getState().reloadPermissions();

    expect(localStorage.getItem('user_permissions')).toBeNull();
    await vi.waitFor(() =>
      expect(usePermissionStore.getState().permissions).toEqual(['score.entry'])
    );
  });

  it('reloadPermissions：admin 缓存损坏时清空权限', () => {
    localStorage.setItem('admin', '{bad');
    usePermissionStore.getState().reloadPermissions();
    expect(usePermissionStore.getState().permissions).toEqual([]);
  });
});
