import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEngagementLogic, type EngagementLogicDeps } from '../useEngagementLogic';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    algorithm: {
      getBatchAttribution: vi.fn(),
      exportExcel: vi.fn(),
      getEngagementRank: vi.fn(),
      getEngagementTrend: vi.fn(),
    },
  },
}));
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// __tests__ 比源文件深一级 → mock 路径须多一层 `..`（见 B16/B19 记录的踩坑）
vi.mock('../../../services/api', () => ({ default: mockApi }));
vi.mock('../../../utils/logger', () => ({ default: mockLogger }));

type ShowToast = EngagementLogicDeps['showToast'];
type SetLoadWarn = EngagementLogicDeps['setLoadWarn'];

describe('useEngagementLogic', () => {
  let showToast: ShowToast;
  let setLoadWarn: SetLoadWarn;

  beforeEach(() => {
    showToast = vi.fn() as unknown as ShowToast;
    setLoadWarn = vi.fn() as unknown as SetLoadWarn;
    mockLogger.error.mockClear();
    Object.values(mockApi.algorithm).forEach((fn) => fn.mockReset());
    mockApi.algorithm.getBatchAttribution.mockResolvedValue({ summary: 'attr' });
    mockApi.algorithm.exportExcel.mockResolvedValue({ ok: true });
    mockApi.algorithm.getEngagementRank.mockResolvedValue({ rank: [] });
    mockApi.algorithm.getEngagementTrend.mockResolvedValue({ trend: [] });
  });

  const setup = (initialProps: Partial<EngagementLogicDeps> = {}) =>
    renderHook(
      ({ selectedClass, activeTab }: EngagementLogicDeps) =>
        useEngagementLogic({
          showToast,
          selectedClass,
          activeTab,
          setLoadWarn,
        }),
      {
        initialProps: {
          selectedClass: '',
          activeTab: 'other',
          ...initialProps,
        } as EngagementLogicDeps,
      }
    );

  describe('初始状态', () => {
    it('默认天数/周数与各空态正确', () => {
      const { result } = setup();
      expect(result.current.batchAttributionDays).toBe(30);
      expect(result.current.engagementRankDays).toBe(30);
      expect(result.current.engagementTrendWeeks).toBe(8);
      expect(result.current.engagementTrendUserId).toBeNull();
      expect(result.current.batchAttribution).toBeNull();
      expect(result.current.engagementRank).toBeNull();
      expect(result.current.engagementTrend).toBeNull();
      expect(result.current.exporting).toBeNull();
      expect(result.current.batchAttributionError).toBeNull();
      expect(result.current.batchAttributionLoading).toBe(false);
      expect(result.current.engagementRankLoading).toBe(false);
      expect(result.current.engagementTrendLoading).toBe(false);
    });
  });

  describe('loadBatchAttribution', () => {
    it('未选班级时提示并直接返回，不请求', async () => {
      const { result } = setup({ selectedClass: '' });
      await act(async () => {
        await result.current.loadBatchAttribution();
      });
      expect(showToast).toHaveBeenCalledWith('warning', '请先选择班级');
      expect(mockApi.algorithm.getBatchAttribution).not.toHaveBeenCalled();
    });

    it('成功：写入归因数据并复位 loading', async () => {
      const data = { summary: 'ok' };
      mockApi.algorithm.getBatchAttribution.mockResolvedValue(data);
      const { result } = setup({ selectedClass: '3' });

      await act(async () => {
        await result.current.loadBatchAttribution();
      });

      expect(mockApi.algorithm.getBatchAttribution).toHaveBeenCalledWith('3', 30);
      expect(result.current.batchAttribution).toEqual(data);
      expect(result.current.batchAttributionLoading).toBe(false);
      expect(result.current.batchAttributionError).toBeNull();
    });

    it('失败（Error）：记录日志、写入 message 并提示', async () => {
      const err = new Error('backend down');
      mockApi.algorithm.getBatchAttribution.mockRejectedValue(err);
      const { result } = setup({ selectedClass: '3' });

      await act(async () => {
        await result.current.loadBatchAttribution();
      });

      expect(mockLogger.error).toHaveBeenCalledWith('批量归因失败:', err);
      expect(result.current.batchAttributionError).toBe('backend down');
      expect(showToast).toHaveBeenCalledWith('error', '批量归因失败');
      expect(result.current.batchAttributionLoading).toBe(false);
    });

    it('失败（非 Error）：错误文案走兜底', async () => {
      mockApi.algorithm.getBatchAttribution.mockRejectedValue('plain');
      const { result } = setup({ selectedClass: '3' });

      await act(async () => {
        await result.current.loadBatchAttribution();
      });

      expect(result.current.batchAttributionError).toBe('批量归因失败');
    });
  });

  describe('handleExport', () => {
    it('参与度/归因 Tab 未选班级时提示且不请求', async () => {
      const { result } = setup({ selectedClass: '' });
      await act(async () => {
        await result.current.handleExport('engagement', 30);
      });
      expect(showToast).toHaveBeenCalledWith('warning', '请先选择班级');
      expect(mockApi.algorithm.exportExcel).not.toHaveBeenCalled();
    });

    it('风险 Tab 未选班级时仍允许导出（班级传 undefined）', async () => {
      const { result } = setup({ selectedClass: '' });
      await act(async () => {
        await result.current.handleExport('risk', 7);
      });
      expect(showToast).not.toHaveBeenCalledWith('warning', '请先选择班级');
      expect(mockApi.algorithm.exportExcel).toHaveBeenCalledWith('risk', undefined, 7);
      expect(showToast).toHaveBeenCalledWith('success', '导出成功');
    });

    it('成功：透传 tab/班级/天数并提示成功', async () => {
      const { result } = setup({ selectedClass: '5' });
      await act(async () => {
        await result.current.handleExport('attribution', 60);
      });
      expect(mockApi.algorithm.exportExcel).toHaveBeenCalledWith('attribution', '5', 60);
      expect(showToast).toHaveBeenCalledWith('success', '导出成功');
      expect(result.current.exporting).toBeNull();
    });

    it('失败：提示后端 message 并复位 exporting', async () => {
      mockApi.algorithm.exportExcel.mockRejectedValue(new Error('导出配额耗尽'));
      const { result } = setup({ selectedClass: '5' });
      await act(async () => {
        await result.current.handleExport('engagement', 30);
      });
      expect(showToast).toHaveBeenCalledWith('error', '导出配额耗尽');
      expect(result.current.exporting).toBeNull();
    });

    it('失败（非 Error）：走兜底文案', async () => {
      mockApi.algorithm.exportExcel.mockRejectedValue(null);
      const { result } = setup({ selectedClass: '5' });
      await act(async () => {
        await result.current.handleExport('engagement', 30);
      });
      expect(showToast).toHaveBeenCalledWith('error', '导出失败');
    });

    it('执行期间 exporting 置为对应 tab', async () => {
      let release!: () => void;
      mockApi.algorithm.exportExcel.mockReturnValue(
        new Promise<void>((resolve) => {
          release = resolve;
        })
      );
      const { result } = setup({ selectedClass: '5' });

      act(() => {
        void result.current.handleExport('engagement', 30);
      });
      await waitFor(() => expect(result.current.exporting).toBe('engagement'));

      await act(async () => {
        release();
      });
      await waitFor(() => expect(result.current.exporting).toBeNull());
    });
  });

  describe('loadEngagementRank', () => {
    it('未选班级时提示并直接返回', async () => {
      const { result } = setup({ selectedClass: '' });
      await act(async () => {
        await result.current.loadEngagementRank();
      });
      expect(showToast).toHaveBeenCalledWith('warning', '请先选择班级');
      expect(mockApi.algorithm.getEngagementRank).not.toHaveBeenCalled();
    });

    it('成功：写入排名数据', async () => {
      const data = { rank: [{ id: 1 }] };
      mockApi.algorithm.getEngagementRank.mockResolvedValue(data);
      const { result } = setup({ selectedClass: '2' });

      await act(async () => {
        await result.current.loadEngagementRank();
      });

      expect(mockApi.algorithm.getEngagementRank).toHaveBeenCalledWith('2', 30);
      expect(result.current.engagementRank).toEqual(data);
      expect(result.current.engagementRankLoading).toBe(false);
    });

    it('失败（Error / 非 Error）分别写入 message 与兜底文案', async () => {
      mockApi.algorithm.getEngagementRank.mockRejectedValue(new Error('rank boom'));
      const first = setup({ selectedClass: '2' });
      await act(async () => {
        await first.result.current.loadEngagementRank();
      });
      expect(first.result.current.engagementRankError).toBe('rank boom');
      expect(mockLogger.error).toHaveBeenCalledWith('参与度排名失败:', expect.any(Error));

      mockApi.algorithm.getEngagementRank.mockRejectedValue(undefined);
      const second = setup({ selectedClass: '2' });
      await act(async () => {
        await second.result.current.loadEngagementRank();
      });
      expect(second.result.current.engagementRankError).toBe('参与度排名失败');
    });

    it('天数变更（setEngagementRankDays）后按新天数请求', async () => {
      const { result } = setup({ selectedClass: '2' });
      act(() => {
        result.current.setEngagementRankDays(7);
      });
      await act(async () => {
        await result.current.loadEngagementRank();
      });
      expect(mockApi.algorithm.getEngagementRank).toHaveBeenCalledWith('2', 7);
    });
  });

  describe('自动加载 effect', () => {
    it('进入 batchAttribution Tab 且已选班级 → 自动归因', async () => {
      setup({ selectedClass: '4', activeTab: 'batchAttribution' });
      await waitFor(() => expect(mockApi.algorithm.getBatchAttribution).toHaveBeenCalled());
    });

    it('非目标 Tab 或未选班级时不自动归因', async () => {
      setup({ selectedClass: '', activeTab: 'batchAttribution' });
      setup({ selectedClass: '4', activeTab: 'other' });
      await waitFor(() => expect(mockApi.algorithm.getBatchAttribution).not.toHaveBeenCalled());
    });

    it('进入 engagement Tab 且已选班级 → 自动加载排名', async () => {
      const { result } = setup({ selectedClass: '6', activeTab: 'engagement' });
      await waitFor(() =>
        expect(mockApi.algorithm.getEngagementRank).toHaveBeenCalledWith('6', 30)
      );
      await waitFor(() => expect(result.current.engagementRankLoading).toBe(false));
    });

    it('天数变化触发重新加载归因', async () => {
      const { result } = setup({ selectedClass: '4', activeTab: 'batchAttribution' });
      await waitFor(() => expect(mockApi.algorithm.getBatchAttribution).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setBatchAttributionDays(60);
      });
      await waitFor(() => expect(mockApi.algorithm.getBatchAttribution).toHaveBeenCalledTimes(2));
      expect(mockApi.algorithm.getBatchAttribution).toHaveBeenLastCalledWith('4', 60);
    });
  });

  describe('周趋势（经 setEngagementTrendUserId 触发）', () => {
    it('未选中学生时不请求趋势数据', async () => {
      setup({ selectedClass: '6', activeTab: 'engagement' });
      await waitFor(() => expect(mockApi.algorithm.getEngagementRank).toHaveBeenCalled());
      expect(mockApi.algorithm.getEngagementTrend).not.toHaveBeenCalled();
    });

    it('选中学生后加载趋势成功 → setLoadWarn(false)', async () => {
      const data = { trend: [{ week: 1 }] };
      mockApi.algorithm.getEngagementTrend.mockResolvedValue(data);
      const { result } = setup({ selectedClass: '6', activeTab: 'engagement' });
      await waitFor(() => expect(mockApi.algorithm.getEngagementRank).toHaveBeenCalled());

      act(() => {
        result.current.setEngagementTrendUserId(42);
      });
      await waitFor(() => expect(mockApi.algorithm.getEngagementTrend).toHaveBeenCalledWith(42, 8));
      await waitFor(() => expect(result.current.engagementTrend).toEqual(data));
      expect(setLoadWarn).toHaveBeenCalledWith(false);
      expect(result.current.engagementTrendLoading).toBe(false);
    });

    it('趋势加载失败 → 清空数据并 setLoadWarn(true)', async () => {
      mockApi.algorithm.getEngagementTrend.mockRejectedValue(new Error('trend boom'));
      const { result } = setup({ selectedClass: '6', activeTab: 'engagement' });
      await waitFor(() => expect(mockApi.algorithm.getEngagementRank).toHaveBeenCalled());

      act(() => {
        result.current.setEngagementTrendUserId(7);
      });
      await waitFor(() => expect(setLoadWarn).toHaveBeenCalledWith(true));
      expect(result.current.engagementTrend).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('参与度周趋势失败:', expect.any(Error));
      expect(result.current.engagementTrendLoading).toBe(false);
    });

    it('周数变化触发趋势重新加载', async () => {
      const { result } = setup({ selectedClass: '6', activeTab: 'engagement' });
      await waitFor(() => expect(mockApi.algorithm.getEngagementRank).toHaveBeenCalled());

      act(() => {
        result.current.setEngagementTrendUserId(9);
      });
      await waitFor(() => expect(mockApi.algorithm.getEngagementTrend).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.setEngagementTrendWeeks(12);
      });
      await waitFor(() => expect(mockApi.algorithm.getEngagementTrend).toHaveBeenCalledWith(9, 12));
    });

    it('setEngagementTrend 可直接覆盖趋势数据', () => {
      const { result } = setup({ selectedClass: '6', activeTab: 'other' });
      const manual = { trend: [{ week: 99 }] } as never;
      act(() => {
        result.current.setEngagementTrend(manual);
      });
      expect(result.current.engagementTrend).toEqual(manual);
    });
  });
});
