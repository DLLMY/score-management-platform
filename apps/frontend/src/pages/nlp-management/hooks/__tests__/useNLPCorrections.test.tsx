import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNLPCorrections } from '../useNLPCorrections';

const { mockApi, mockConfirm } = vi.hoisted(() => ({
  mockApi: {
    nlp: {
      getCorrections: vi.fn(),
      updateCorrection: vi.fn(),
      deleteCorrection: vi.fn(),
    },
  },
  mockConfirm: vi.fn(),
}));

vi.mock('../../../../services/api', () => ({
  default: mockApi,
  getAuthHeaders: vi.fn(() => ({})),
}));
vi.mock('../../../../components', () => ({ useConfirm: () => mockConfirm }));
vi.mock('../../columns', () => ({ buildCorrectionColumns: vi.fn(() => []) }));

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    showToast: vi.fn(),
    confirmRef: { current: mockConfirm },
    ...overrides,
  } as never;
}

const SAMPLE_LIST = { items: [{ id: 1, text: 'c' }], total: 1 };

describe('useNLPCorrections · NLP 纠正记录', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.nlp.getCorrections.mockResolvedValue(SAMPLE_LIST);
    mockApi.nlp.updateCorrection.mockResolvedValue({});
    mockApi.nlp.deleteCorrection.mockResolvedValue({});
    mockConfirm.mockResolvedValue(true);
  });

  it('初始状态：列表未加载、列定义就绪', () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPCorrections(params));
    expect(result.current.corrections).toEqual([]);
    expect(result.current.correctionsLoading).toBe(false);
    expect(result.current.correctionTotal).toBe(0);
    expect(result.current.correctionColumns).toEqual([]);
  });

  it('setShowCorrectionList(true) → 条件加载列表', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPCorrections(params));
    act(() => result.current.setShowCorrectionList(true));
    await waitFor(() => expect(result.current.corrections).toHaveLength(1), { timeout: 5000 });
    expect(result.current.correctionTotal).toBe(1);
    expect(mockApi.nlp.getCorrections).toHaveBeenCalled();
  });

  it('handleUpdateCorrection：成功 → 刷新列表', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPCorrections(params));
    await act(async () => {
      await result.current.handleUpdateCorrection(1, 'active');
    });
    expect(mockApi.nlp.updateCorrection).toHaveBeenCalledWith(1, { status: 'active' });
    expect(params.showToast).toHaveBeenCalledWith('success', '纠正状态已更新');
  });

  it('handleUpdateCorrection：接口抛错 → error toast', async () => {
    mockApi.nlp.updateCorrection.mockRejectedValue(new Error('upd failed'));
    const params = makeParams();
    const { result } = renderHook(() => useNLPCorrections(params));
    await act(async () => {
      await result.current.handleUpdateCorrection(1, 'active');
    });
    expect(params.showToast).toHaveBeenCalledWith('error', '更新失败');
  });

  it('handleDeleteCorrection：confirm 取消 → 不删除', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    const params = makeParams();
    const { result } = renderHook(() => useNLPCorrections(params));
    await act(async () => {
      await result.current.handleDeleteCorrection(1);
    });
    expect(mockApi.nlp.deleteCorrection).not.toHaveBeenCalled();
  });

  it('handleDeleteCorrection：confirm 通过 → 删除成功', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPCorrections(params));
    await act(async () => {
      await result.current.handleDeleteCorrection(1);
    });
    expect(mockApi.nlp.deleteCorrection).toHaveBeenCalledWith(1);
    expect(params.showToast).toHaveBeenCalledWith('success', '删除成功');
  });

  it('handleDeleteCorrection：接口抛错 → error toast', async () => {
    mockApi.nlp.deleteCorrection.mockRejectedValue(new Error('del failed'));
    const params = makeParams();
    const { result } = renderHook(() => useNLPCorrections(params));
    await act(async () => {
      await result.current.handleDeleteCorrection(1);
    });
    expect(params.showToast).toHaveBeenCalledWith('error', '删除失败');
  });

  it('状态 setter 可用', () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPCorrections(params));
    act(() => result.current.setCorrectionStatusFilter('pending'));
    act(() => result.current.setCorrectionsPage(2));
    expect(result.current.correctionStatusFilter).toBe('pending');
    expect(result.current.correctionsPage).toBe(2);
  });
});
