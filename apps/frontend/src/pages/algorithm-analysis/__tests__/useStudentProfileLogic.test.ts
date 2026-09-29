/* eslint-disable react-hooks/exhaustive-deps */
/**
 * useStudentProfileLogic 补测（B32）。
 * deps 注入式纯逻辑 hook：依赖 api（可 mock）与注入的 showToast/setLoadWarn，
 * 不依赖任何 context provider，低风险覆盖 loadClasses/loadStudents/loadStudentProfile
 * 的 try-catch 与三元/短路分支 + 进入 studentProfile Tab 自动加载 effect。
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudentProfileLogic } from '../useStudentProfileLogic';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    classes: { getAll: vi.fn() },
    users: { getAll: vi.fn() },
    algorithm: {
      getPrediction: vi.fn(),
      getScorePredict: vi.fn(),
      getRiskPredict: vi.fn(),
      getUserAnomaly: vi.fn(),
      getSuddenChange: vi.fn(),
      getTrendAnomaly: vi.fn(),
      getGroupAnomaly: vi.fn(),
      getScoreAttribution: vi.fn(),
      getEngagement: vi.fn(),
    },
  },
}));

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../services/api', () => ({ default: mockApi }));
vi.mock('../../../utils/logger', () => ({ default: mockLogger }));
vi.mock('../../../hooks', () => ({ useStableToast: vi.fn() }));

const showToast = vi.fn();
const setLoadWarn = vi.fn();

const baseDeps = () => ({
  showToast,
  predictionDays: 7,
  recommendDays: 14,
  anomalyDays: 30,
  activeTab: 'overview',
  setLoadWarn,
});

beforeEach(() => {
  Object.values(mockApi).forEach((g: any) => Object.values(g).forEach((fn: any) => fn.mockReset()));
  mockLogger.error.mockClear();
  showToast.mockClear();
  setLoadWarn.mockClear();
});

describe('useStudentProfileLogic · loadClasses', () => {
  it('数组形态返回 → 写入 classes 并清除 warn', async () => {
    mockApi.classes.getAll.mockResolvedValue([{ id: 1, name: 'C1' }]);
    const { result } = renderHook(() => useStudentProfileLogic(baseDeps()));
    await act(async () => {
      await result.current.loadClasses();
    });
    expect(result.current.classes).toHaveLength(1);
    expect(setLoadWarn).toHaveBeenCalledWith(false);
  });

  it('{classes:[...]} 包裹形态 → 正确解包', async () => {
    mockApi.classes.getAll.mockResolvedValue({ classes: [{ id: 2, name: 'C2' }] });
    const { result } = renderHook(() => useStudentProfileLogic(baseDeps()));
    await act(async () => {
      await result.current.loadClasses();
    });
    expect(result.current.classes).toHaveLength(1);
    expect(result.current.classes[0].id).toBe(2);
  });

  it('抛错 → classes 置空且 setLoadWarn(true)', async () => {
    mockApi.classes.getAll.mockRejectedValue(new Error('net'));
    const { result } = renderHook(() => useStudentProfileLogic(baseDeps()));
    await act(async () => {
      await result.current.loadClasses();
    });
    expect(result.current.classes).toEqual([]);
    expect(setLoadWarn).toHaveBeenCalledWith(true);
    expect(mockLogger.error).toHaveBeenCalledWith('加载班级列表失败:', expect.any(Error));
  });
});

describe('useStudentProfileLogic · loadStudents', () => {
  it('{users:[...]} 包裹形态 → 解析 id 与 class_name', async () => {
    mockApi.users.getAll.mockResolvedValue({
      users: [
        { id: '9', name: '张三', class_name: 'C9' },
        { id: 10, name: '李四' },
      ],
    });
    const { result } = renderHook(() => useStudentProfileLogic(baseDeps()));
    await act(async () => {
      await result.current.loadStudents();
    });
    expect(result.current.students).toHaveLength(2);
    expect(result.current.students[0]).toEqual({ id: 9, name: '张三', class_name: 'C9' });
    expect(result.current.students[1].class_name).toBe('');
  });

  it('已加载过（students.length>0）→ 直接 early-return 不重复请求', async () => {
    mockApi.users.getAll.mockResolvedValue({ users: [{ id: 1, name: 'A', class_name: 'C' }] });
    const { result } = renderHook(() => useStudentProfileLogic(baseDeps()));
    await act(async () => {
      await result.current.loadStudents();
    });
    expect(mockApi.users.getAll).toHaveBeenCalledTimes(1);
    // 第二次调用触发 students.length>0 早返分支
    await act(async () => {
      await result.current.loadStudents();
    });
    expect(mockApi.users.getAll).toHaveBeenCalledTimes(1);
  });

  it('抛错 → showToast 错误提示', async () => {
    mockApi.users.getAll.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useStudentProfileLogic(baseDeps()));
    await act(async () => {
      await result.current.loadStudents();
    });
    expect(result.current.students).toEqual([]);
    expect(showToast).toHaveBeenCalledWith('error', '加载学生列表失败');
  });
});

describe('useStudentProfileLogic · loadStudentProfile', () => {
  const profilePayload = {
    prediction: { a: 1 },
    scorePredict: { b: 2 },
    riskPredict: { c: 3 },
    anomaly: { d: 4 },
    sudden: { e: 5 },
    trend: { f: 6 },
    group: { g: 7 },
    attribution: { h: 8 },
    engagement: { i: 9 },
  };

  it('成功 → 并行聚合全部单用户算法接口并写入 studentProfile', async () => {
    Object.values(mockApi.algorithm).forEach((fn: any) => fn.mockResolvedValue({}));
    mockApi.algorithm.getPrediction.mockResolvedValue(profilePayload.prediction);
    mockApi.algorithm.getScorePredict.mockResolvedValue(profilePayload.scorePredict);
    mockApi.algorithm.getRiskPredict.mockResolvedValue(profilePayload.riskPredict);
    mockApi.algorithm.getUserAnomaly.mockResolvedValue(profilePayload.anomaly);
    mockApi.algorithm.getSuddenChange.mockResolvedValue(profilePayload.sudden);
    mockApi.algorithm.getTrendAnomaly.mockResolvedValue(profilePayload.trend);
    mockApi.algorithm.getGroupAnomaly.mockResolvedValue(profilePayload.group);
    mockApi.algorithm.getScoreAttribution.mockResolvedValue(profilePayload.attribution);
    mockApi.algorithm.getEngagement.mockResolvedValue(profilePayload.engagement);

    const { result } = renderHook(() => useStudentProfileLogic(baseDeps()));
    await act(async () => {
      await result.current.loadStudentProfile(42);
    });
    await waitFor(() => expect(result.current.profileLoading).toBe(false));
    expect(result.current.profileError).toBeNull();
    expect(result.current.studentProfile).toMatchObject({
      prediction: profilePayload.prediction,
      engagement: profilePayload.engagement,
    });
  });

  it('Error 实例失败 → profileError=err.message 且 showToast', async () => {
    Object.values(mockApi.algorithm).forEach((fn: any) =>
      fn.mockRejectedValue(new Error('预测服务不可用'))
    );
    const { result } = renderHook(() => useStudentProfileLogic(baseDeps()));
    await act(async () => {
      await result.current.loadStudentProfile(1);
    });
    await waitFor(() => expect(result.current.profileLoading).toBe(false));
    expect(result.current.profileError).toBe('预测服务不可用');
    expect(showToast).toHaveBeenCalledWith('error', '加载学生画像失败');
  });

  it('非 Error 失败 → profileError 兜底默认文案', async () => {
    Object.values(mockApi.algorithm).forEach((fn: any) => fn.mockRejectedValue('string-error'));
    const { result } = renderHook(() => useStudentProfileLogic(baseDeps()));
    await act(async () => {
      await result.current.loadStudentProfile(1);
    });
    await waitFor(() => expect(result.current.profileLoading).toBe(false));
    expect(result.current.profileError).toBe('加载学生画像失败');
  });
});

describe('useStudentProfileLogic · activeTab effect', () => {
  it('activeTab=studentProfile → 挂载即自动 loadStudents', async () => {
    mockApi.users.getAll.mockResolvedValue({ users: [{ id: 1, name: 'A', class_name: 'C' }] });
    const { result } = renderHook(() =>
      useStudentProfileLogic({ ...baseDeps(), activeTab: 'studentProfile' })
    );
    await waitFor(() => expect(mockApi.users.getAll).toHaveBeenCalled(), { timeout: 5000 });
    await waitFor(() => expect(result.current.students).toHaveLength(1), { timeout: 5000 });
  });
});
