import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardLogic } from '../useDashboardLogic';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    classes: { getAll: vi.fn() },
    users: { getAll: vi.fn() },
    records: { getAll: vi.fn() },
    devices: { getAll: vi.fn() },
    notifications: { getAll: vi.fn() },
    dashboard: { getData: vi.fn() },
    algorithm: {
      getStatistics: vi.fn(),
      getClusters: vi.fn(),
      getWarnings: vi.fn(),
    },
  },
}));

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const wsState = {
  isConnected: false,
  deviceStatuses: {} as Record<string, string>,
  scoreUpdates: [] as Array<{ user_id: number; score_change: number }>,
};

vi.mock('../../../services/api', () => ({ default: mockApi }));
vi.mock('../../../utils/logger', () => ({ default: mockLogger }));
vi.mock('../../../hooks', () => ({ useThrottledCallback: (fn: any) => fn }));
vi.mock('../../../stores', () => ({
  useWebSocketStore: () => ({
    initSocket: vi.fn(),
    subscribe: vi.fn(),
    isConnected: wsState.isConnected,
    deviceStatuses: wsState.deviceStatuses,
    scoreUpdates: wsState.scoreUpdates,
  }),
}));

beforeEach(() => {
  Object.values(mockApi).forEach((g: any) => Object.values(g).forEach((fn: any) => fn.mockReset()));
  mockLogger.error.mockClear();
  wsState.deviceStatuses = {};
  wsState.scoreUpdates = [];
});

const setup = () => renderHook(() => useDashboardLogic());

const settle = async (result: any) => {
  await waitFor(() => expect(result.current.state.loading).toBe(false));
  await waitFor(() => expect(mockApi.algorithm.getStatistics).toHaveBeenCalled());
};

describe('useDashboardLogic', () => {
  it('挂载后加载高优先级数据并清除 loading/error', async () => {
    mockApi.classes.getAll.mockResolvedValue([{ id: 1, name: 'C1' }]);
    mockApi.users.getAll.mockResolvedValue([{ id: 1, class_name: 'C1', current_score: 50 }]);
    mockApi.devices.getAll.mockResolvedValue([{ device_id: 'd1' }]);
    mockApi.notifications.getAll.mockResolvedValue([{ id: 1, title: 'n' }]);
    mockApi.records.getAll.mockResolvedValue([{ id: 1 }]);
    mockApi.dashboard.getData.mockResolvedValue({
      total_users: 5,
      today_records: 3,
      avg_score: 80,
      online_devices: 2,
    });
    mockApi.algorithm.getStatistics.mockResolvedValue(null);
    mockApi.algorithm.getClusters.mockResolvedValue(null);
    mockApi.algorithm.getWarnings.mockResolvedValue(null);

    const { result } = setup();
    await settle(result);

    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.users).toHaveLength(1);
    expect(result.current.state.devices).toHaveLength(1);
    expect(result.current.state.notifications).toHaveLength(1);
    expect(result.current.state.records).toHaveLength(1);
    expect(result.current.dashboardError).toBe(false);
    expect(result.current.state.statistics.onlineDevices).toBe(2);
  });

  it('dashboard.getData 为空 -> dashboardError=true 且由 users/devices 兜底统计', async () => {
    mockApi.classes.getAll.mockResolvedValue([]);
    mockApi.users.getAll.mockResolvedValue([{ id: 1, class_name: 'C1', current_score: 10 }]);
    mockApi.devices.getAll.mockResolvedValue([{ device_id: 'd1', is_online: true }]);
    mockApi.notifications.getAll.mockResolvedValue([]);
    mockApi.records.getAll.mockResolvedValue([]);
    mockApi.dashboard.getData.mockResolvedValue(null);
    mockApi.algorithm.getStatistics.mockResolvedValue(null);
    mockApi.algorithm.getClusters.mockResolvedValue(null);
    mockApi.algorithm.getWarnings.mockResolvedValue(null);

    const { result } = setup();
    await settle(result);

    expect(result.current.dashboardError).toBe(true);
    expect(result.current.state.statistics.totalUsers).toBe(1);
    expect(result.current.state.statistics.onlineDevices).toBe(1);
    expect(result.current.state.statistics.totalScore).toBe(10);
  });

  it('users.getAll 返回 {users:[...]} 包裹结构能正确解包', async () => {
    mockApi.classes.getAll.mockResolvedValue([]);
    mockApi.users.getAll.mockResolvedValue({
      users: [{ id: 9, class_name: 'C9', current_score: 1 }],
    });
    mockApi.devices.getAll.mockResolvedValue([]);
    mockApi.notifications.getAll.mockResolvedValue([]);
    mockApi.records.getAll.mockResolvedValue([]);
    mockApi.dashboard.getData.mockResolvedValue({
      total_users: 0,
      today_records: 0,
      avg_score: 0,
      online_devices: 0,
    });
    mockApi.algorithm.getStatistics.mockResolvedValue(null);
    mockApi.algorithm.getClusters.mockResolvedValue(null);
    mockApi.algorithm.getWarnings.mockResolvedValue(null);

    const { result } = setup();
    await settle(result);
    expect(result.current.state.users).toHaveLength(1);
    expect(result.current.state.users[0].id).toBe(9);
  });

  it('users.getAll 抛错 -> fetchUsers 返回 null，users 保持空', async () => {
    mockApi.classes.getAll.mockResolvedValue([]);
    mockApi.users.getAll.mockRejectedValue(new Error('net'));
    mockApi.devices.getAll.mockResolvedValue([]);
    mockApi.notifications.getAll.mockResolvedValue([]);
    mockApi.records.getAll.mockResolvedValue([]);
    mockApi.dashboard.getData.mockResolvedValue({
      total_users: 0,
      today_records: 0,
      avg_score: 0,
      online_devices: 0,
    });
    mockApi.algorithm.getStatistics.mockResolvedValue(null);
    mockApi.algorithm.getClusters.mockResolvedValue(null);
    mockApi.algorithm.getWarnings.mockResolvedValue(null);

    const { result } = setup();
    await settle(result);
    expect(result.current.state.users).toHaveLength(0);
    expect(mockLogger.error).toHaveBeenCalledWith('获取用户数据失败:', expect.any(Error));
  });

  it('deviceStatuses 推送 -> 更新设备 online 状态', async () => {
    mockApi.classes.getAll.mockResolvedValue([]);
    mockApi.users.getAll.mockResolvedValue([]);
    mockApi.devices.getAll.mockResolvedValue([{ device_id: 'd1', is_online: false }]);
    mockApi.notifications.getAll.mockResolvedValue([]);
    mockApi.records.getAll.mockResolvedValue([]);
    mockApi.dashboard.getData.mockResolvedValue({
      total_users: 0,
      today_records: 0,
      avg_score: 0,
      online_devices: 0,
    });
    mockApi.algorithm.getStatistics.mockResolvedValue(null);
    mockApi.algorithm.getClusters.mockResolvedValue(null);
    mockApi.algorithm.getWarnings.mockResolvedValue(null);

    const { result, rerender } = setup();
    await settle(result);
    expect(result.current.state.devices[0].is_online).toBe(false);

    wsState.deviceStatuses = { d1: 'online' };
    await act(async () => {
      rerender();
    });
    await waitFor(() => expect(result.current.state.devices[0].is_online).toBe(true));
  });

  it('scoreUpdates 推送 -> 更新用户分数与统计总分', async () => {
    mockApi.classes.getAll.mockResolvedValue([]);
    mockApi.users.getAll.mockResolvedValue([{ id: 1, class_name: 'C1', current_score: 50 }]);
    mockApi.devices.getAll.mockResolvedValue([]);
    mockApi.notifications.getAll.mockResolvedValue([]);
    mockApi.records.getAll.mockResolvedValue([]);
    mockApi.dashboard.getData.mockResolvedValue(null);
    mockApi.algorithm.getStatistics.mockResolvedValue(null);
    mockApi.algorithm.getClusters.mockResolvedValue(null);
    mockApi.algorithm.getWarnings.mockResolvedValue(null);

    const { result, rerender } = setup();
    await settle(result);

    wsState.scoreUpdates = [{ user_id: 1, score_change: 5 }];
    await act(async () => {
      rerender();
    });
    await waitFor(() => expect(result.current.state.users[0].current_score).toBe(55));
    // dashboard.getData 返回 null 时 totalScore 由用户分数之和兜底（50），再叠加推送 +5 → 55
    expect(result.current.state.statistics.totalScore).toBe(55);
  });

  it('handleRefresh 触发一次刷新（REFRESHING 复位）', async () => {
    mockApi.classes.getAll.mockResolvedValue([]);
    mockApi.users.getAll.mockResolvedValue([]);
    mockApi.devices.getAll.mockResolvedValue([]);
    mockApi.notifications.getAll.mockResolvedValue([]);
    mockApi.records.getAll.mockResolvedValue([]);
    mockApi.dashboard.getData.mockResolvedValue({
      total_users: 0,
      today_records: 0,
      avg_score: 0,
      online_devices: 0,
    });
    mockApi.algorithm.getStatistics.mockResolvedValue(null);
    mockApi.algorithm.getClusters.mockResolvedValue(null);
    mockApi.algorithm.getWarnings.mockResolvedValue(null);

    const { result } = setup();
    await settle(result);
    const before = mockApi.dashboard.getData.mock.calls.length;
    await act(async () => {
      result.current.handleRefresh();
    });
    await waitFor(() =>
      expect(mockApi.dashboard.getData.mock.calls.length).toBeGreaterThan(before)
    );
    expect(result.current.state.isRefreshing).toBe(false);
  });

  it('filteredUsers：selectedClass 过滤并按分数降序', async () => {
    mockApi.classes.getAll.mockResolvedValue([]);
    mockApi.users.getAll.mockResolvedValue([
      { id: 1, class_name: 'C1', current_score: 10 },
      { id: 2, class_name: 'C2', current_score: 90 },
      { id: 3, class_name: 'C1', current_score: 70 },
    ]);
    mockApi.devices.getAll.mockResolvedValue([]);
    mockApi.notifications.getAll.mockResolvedValue([]);
    mockApi.records.getAll.mockResolvedValue([]);
    mockApi.dashboard.getData.mockResolvedValue(null);
    mockApi.algorithm.getStatistics.mockResolvedValue(null);
    mockApi.algorithm.getClusters.mockResolvedValue(null);
    mockApi.algorithm.getWarnings.mockResolvedValue(null);

    const { result } = setup();
    await settle(result);
    await act(async () => {
      result.current.setSelectedClass('C1');
    });
    const ids = result.current.filteredUsers.map((u: any) => u.id);
    expect(ids).toEqual([3, 1]); // 仅 C1，按分数降序
  });

  it('classes 排序与 classGroups 按未分班分组', async () => {
    mockApi.classes.getAll.mockResolvedValue([
      { id: 1, name: '三班' },
      { id: 2, name: '一班' },
    ]);
    mockApi.users.getAll.mockResolvedValue([
      { id: 1, class_name: '一班', current_score: 1 },
      { id: 2, class_name: undefined, current_score: 2 },
    ]);
    mockApi.devices.getAll.mockResolvedValue([]);
    mockApi.notifications.getAll.mockResolvedValue([]);
    mockApi.records.getAll.mockResolvedValue([]);
    mockApi.dashboard.getData.mockResolvedValue(null);
    mockApi.algorithm.getStatistics.mockResolvedValue(null);
    mockApi.algorithm.getClusters.mockResolvedValue(null);
    mockApi.algorithm.getWarnings.mockResolvedValue(null);

    const { result } = setup();
    await settle(result);
    expect(result.current.classes).toEqual(['一班', '三班']);
    const groupNames = result.current.classGroups.map((g: any) => g.class_name);
    expect(groupNames).toContain('一班');
    expect(groupNames).toContain('未分班');
  });

  it('fetchAlgorithmData 部分接口失败（.catch 兜底 null）不抛错', async () => {
    mockApi.classes.getAll.mockResolvedValue([]);
    mockApi.users.getAll.mockResolvedValue([]);
    mockApi.devices.getAll.mockResolvedValue([]);
    mockApi.notifications.getAll.mockResolvedValue([]);
    mockApi.records.getAll.mockResolvedValue([]);
    mockApi.dashboard.getData.mockResolvedValue({
      total_users: 0,
      today_records: 0,
      avg_score: 0,
      online_devices: 0,
    });
    mockApi.algorithm.getStatistics.mockRejectedValue(new Error('alg down'));
    mockApi.algorithm.getClusters.mockResolvedValue({ clusters: [] });
    mockApi.algorithm.getWarnings.mockResolvedValue(null);

    const { result } = setup();
    await settle(result);
    // .catch 兜底后 algorithmData 仍被写入（statistics 为 null）
    expect(result.current.state.algorithmData.statistics).toBeNull();
    expect(result.current.state.algorithmData.clusters).toEqual({ clusters: [] });
  });

  it('devices.getAll 抛错 → fetchDevices 返回 null，onlineDevices 走 0 兜底分支', async () => {
    mockApi.classes.getAll.mockResolvedValue([]);
    mockApi.users.getAll.mockResolvedValue([]);
    mockApi.devices.getAll.mockRejectedValue(new Error('dev down'));
    mockApi.notifications.getAll.mockResolvedValue([]);
    mockApi.records.getAll.mockResolvedValue([]);
    mockApi.dashboard.getData.mockResolvedValue({
      total_users: 0,
      today_records: 0,
      avg_score: 0,
      online_devices: 0,
    });
    mockApi.algorithm.getStatistics.mockResolvedValue(null);
    mockApi.algorithm.getClusters.mockResolvedValue(null);
    mockApi.algorithm.getWarnings.mockResolvedValue(null);

    const { result } = setup();
    await settle(result);
    // deviceList 为 null → `deviceList !== null` 假分支 + onlineDevices 兜底 0
    expect(mockLogger.error).toHaveBeenCalledWith('获取设备数据失败:', expect.any(Error));
    expect(result.current.state.devices).toHaveLength(0);
    expect(result.current.state.statistics.onlineDevices).toBe(0);
  });

  it('records.getAll 抛错 → fetchRecords 返回 null，records 走空兜底分支', async () => {
    mockApi.classes.getAll.mockResolvedValue([]);
    mockApi.users.getAll.mockResolvedValue([]);
    mockApi.devices.getAll.mockResolvedValue([]);
    mockApi.notifications.getAll.mockResolvedValue([]);
    mockApi.records.getAll.mockRejectedValue(new Error('rec down'));
    mockApi.dashboard.getData.mockResolvedValue({
      total_users: 0,
      today_records: 0,
      avg_score: 0,
      online_devices: 0,
    });
    mockApi.algorithm.getStatistics.mockResolvedValue(null);
    mockApi.algorithm.getClusters.mockResolvedValue(null);
    mockApi.algorithm.getWarnings.mockResolvedValue(null);

    const { result } = setup();
    await settle(result);
    // recordsList 为 null → `recordsList !== null` 假分支
    expect(mockLogger.error).toHaveBeenCalledWith('获取记录数据失败:', expect.any(Error));
    expect(result.current.state.records).toHaveLength(0);
  });

  it('notifications.getAll 抛错 → fetchNotifications 返回 null，notifications 走空兜底分支', async () => {
    mockApi.classes.getAll.mockResolvedValue([]);
    mockApi.users.getAll.mockResolvedValue([]);
    mockApi.devices.getAll.mockResolvedValue([]);
    mockApi.notifications.getAll.mockRejectedValue(new Error('n down'));
    mockApi.records.getAll.mockResolvedValue([]);
    mockApi.dashboard.getData.mockResolvedValue({
      total_users: 0,
      today_records: 0,
      avg_score: 0,
      online_devices: 0,
    });
    mockApi.algorithm.getStatistics.mockResolvedValue(null);
    mockApi.algorithm.getClusters.mockResolvedValue(null);
    mockApi.algorithm.getWarnings.mockResolvedValue(null);

    const { result } = setup();
    await settle(result);
    // notificationsList 为 null → `notificationsList !== null` 假分支
    expect(mockLogger.error).toHaveBeenCalledWith('获取通知数据失败:', expect.any(Error));
    expect(result.current.state.notifications).toHaveLength(0);
  });

  it('dashboard.getData 抛错（.catch 兜底 null）→ 走 else 分支置 dashboardError 并复位 loading', async () => {
    mockApi.classes.getAll.mockResolvedValue([]);
    mockApi.users.getAll.mockResolvedValue([]);
    mockApi.devices.getAll.mockResolvedValue([]);
    mockApi.notifications.getAll.mockResolvedValue([]);
    mockApi.records.getAll.mockResolvedValue([]);
    mockApi.dashboard.getData.mockRejectedValue(new Error('dash down'));
    mockApi.algorithm.getStatistics.mockResolvedValue(null);
    mockApi.algorithm.getClusters.mockResolvedValue(null);
    mockApi.algorithm.getWarnings.mockResolvedValue(null);

    const { result } = setup();
    await settle(result);
    // fetchHighPriorityData 中 dashboardData 经 .catch 兜底为 null → else 分支显示警示条
    expect(result.current.dashboardError).toBe(true);
    expect(result.current.state.loading).toBe(false);
  });
});
