import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNLPRules } from '../useNLPRules';

const { mockApi, mockConfirm, mockDownloadTextAsFile } = vi.hoisted(() => ({
  mockApi: {
    nlp: {
      getRules: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      batchImportRules: vi.fn(),
    },
  },
  mockConfirm: vi.fn(),
  mockDownloadTextAsFile: vi.fn(),
}));

vi.mock('../../../../services/api', () => ({
  default: mockApi,
  getAuthHeaders: vi.fn(() => ({})),
}));
vi.mock('../../../../components', () => ({ useConfirm: () => mockConfirm }));
vi.mock('../../../../utils/download', () => ({ downloadTextAsFile: mockDownloadTextAsFile }));
vi.mock('../../columns', () => ({ buildRuleColumns: vi.fn(() => []) }));

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    showToast: vi.fn(),
    confirmRef: { current: mockConfirm },
    ...overrides,
  } as never;
}

const SAMPLE_RULE = {
  id: 1,
  behavior_keyword: '迟到',
  behavior_description: '上课迟到',
  score_value: 5,
  score_type: 'add' as const,
  behavior_tags: ['纪律'],
  match_pattern: 'late',
  priority: 1,
};

describe('useNLPRules · NLP 规则管理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.nlp.getRules.mockResolvedValue({ items: [SAMPLE_RULE], total: 1 });
    mockApi.nlp.createRule.mockResolvedValue({ id: 2 });
    mockApi.nlp.updateRule.mockResolvedValue({ id: 1 });
    mockApi.nlp.deleteRule.mockResolvedValue({});
    mockApi.nlp.batchImportRules.mockResolvedValue({ imported_count: 1, skipped_count: 0 });
    mockConfirm.mockResolvedValue(true);
  });

  it('挂载即拉取规则并暴露 rules / rulesLoading / ruleTotal', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    // 等待规则列表异步拉取落库到 rules（避免时序竞态），再断言派生字段
    await waitFor(() => expect(result.current.rules).toHaveLength(1));
    expect(result.current.rulesLoading).toBe(false);
    expect(result.current.ruleTotal).toBe(1);
    expect(mockApi.nlp.getRules).toHaveBeenCalledTimes(1);
  });

  it('handleCreateRule：空关键词/描述 → 警告并返回', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await waitFor(() => expect(mockApi.nlp.getRules).toHaveBeenCalled());

    // keyword 空
    act(() => result.current.setNewRule({ ...result.current.newRule, behavior_keyword: '  ' }));
    await act(async () => {
      await result.current.handleCreateRule();
    });
    expect(params.showToast).toHaveBeenCalledWith('warning', '行为关键词不能为空');

    // description 空
    act(() =>
      result.current.setNewRule({
        behavior_keyword: 'x',
        behavior_description: '  ',
        score_value: 5,
        score_type: 'add',
        behavior_tags: '',
        match_pattern: '',
        priority: 0,
      })
    );
    await act(async () => {
      await result.current.handleCreateRule();
    });
    expect(params.showToast).toHaveBeenCalledWith('warning', '行为描述不能为空');
    expect(mockApi.nlp.createRule).not.toHaveBeenCalled();
  });

  it('handleCreateRule：分值非法 → 警告', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await waitFor(() => expect(mockApi.nlp.getRules).toHaveBeenCalled());

    act(() =>
      result.current.setNewRule({
        behavior_keyword: 'x',
        behavior_description: 'y',
        score_value: 999 as never,
        score_type: 'add',
        behavior_tags: '',
        match_pattern: '',
        priority: 0,
      })
    );
    await act(async () => {
      await result.current.handleCreateRule();
    });
    expect(params.showToast).toHaveBeenCalledWith(
      'warning',
      '分值需为 1-100 之间的数值（扣分为负）'
    );
    expect(mockApi.nlp.createRule).not.toHaveBeenCalled();
  });

  it('handleCreateRule：合法 → 创建并刷新列表（tags 按逗号拆分）', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await waitFor(() => expect(mockApi.nlp.getRules).toHaveBeenCalled());

    act(() =>
      result.current.setNewRule({
        behavior_keyword: '早退',
        behavior_description: '提前离开',
        score_value: 5,
        score_type: 'add',
        behavior_tags: '纪律, 考勤',
        match_pattern: '',
        priority: 0,
      })
    );
    await act(async () => {
      await result.current.handleCreateRule();
    });
    expect(mockApi.nlp.createRule).toHaveBeenCalledWith(
      expect.objectContaining({ behavior_tags: ['纪律', '考勤'] })
    );
    expect(params.showToast).toHaveBeenCalledWith('success', '规则创建成功');
    expect(result.current.showRuleForm).toBe(false);
  });

  it('handleCreateRule：接口抛错 → 提示错误', async () => {
    mockApi.nlp.createRule.mockRejectedValue(new Error('create failed'));
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await waitFor(() => expect(mockApi.nlp.getRules).toHaveBeenCalled());

    act(() =>
      result.current.setNewRule({
        behavior_keyword: 'x',
        behavior_description: 'y',
        score_value: 5,
        score_type: 'add',
        behavior_tags: '',
        match_pattern: '',
        priority: 0,
      })
    );
    await act(async () => {
      await result.current.handleCreateRule();
    });
    expect(params.showToast).toHaveBeenCalledWith('error', expect.stringContaining('创建规则失败'));
  });

  it('handleEditRule：无 editingRule → 直接返回', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await waitFor(() => expect(mockApi.nlp.getRules).toHaveBeenCalled());
    act(() => result.current.setEditingRule(null));
    await act(async () => {
      await result.current.handleEditRule();
    });
    expect(mockApi.nlp.updateRule).not.toHaveBeenCalled();
  });

  it('handleEditRule：有 editingRule → 更新并刷新', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await waitFor(() => expect(mockApi.nlp.getRules).toHaveBeenCalled());
    act(() => result.current.setEditingRule(SAMPLE_RULE));
    await act(async () => {
      await result.current.handleEditRule();
    });
    expect(mockApi.nlp.updateRule).toHaveBeenCalledWith(1, expect.any(Object));
    expect(params.showToast).toHaveBeenCalledWith('success', '规则更新成功');
  });

  it('handleDeleteRule：confirm 取消 → 不删除', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await waitFor(() => expect(mockApi.nlp.getRules).toHaveBeenCalled());
    await act(async () => {
      await result.current.handleDeleteRule(1);
    });
    expect(mockApi.nlp.deleteRule).not.toHaveBeenCalled();
  });

  it('handleDeleteRule：confirm 通过 → 删除并刷新', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await waitFor(() => expect(mockApi.nlp.getRules).toHaveBeenCalled());
    await act(async () => {
      await result.current.handleDeleteRule(1);
    });
    expect(mockApi.nlp.deleteRule).toHaveBeenCalledWith(1);
    expect(params.showToast).toHaveBeenCalledWith('success', '规则删除成功');
  });

  it('handleDeleteRule：接口抛错 → 提示', async () => {
    mockApi.nlp.deleteRule.mockRejectedValue(new Error('del failed'));
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await waitFor(() => expect(mockApi.nlp.getRules).toHaveBeenCalled());
    await act(async () => {
      await result.current.handleDeleteRule(1);
    });
    expect(params.showToast).toHaveBeenCalledWith('error', expect.stringContaining('删除规则失败'));
  });

  it('handleBatchImport：无文件无文本 → 警告', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await waitFor(() => expect(mockApi.nlp.getRules).toHaveBeenCalled());
    act(() => {
      result.current.setImportFile(null);
      result.current.setImportJsonText('   ');
    });
    await act(async () => {
      await result.current.handleBatchImport();
    });
    expect(params.showToast).toHaveBeenCalledWith('warning', '请选择文件或输入JSON数据');
    expect(mockApi.nlp.batchImportRules).not.toHaveBeenCalled();
  });

  it('handleBatchImport：文件解析失败 → 提示', async () => {
    const badFile = new File(['not json'], 'x.json');
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await waitFor(() => expect(mockApi.nlp.getRules).toHaveBeenCalled());
    act(() => result.current.setImportFile(badFile));
    await act(async () => {
      await result.current.handleBatchImport();
    });
    expect(params.showToast).toHaveBeenCalledWith('error', '文件解析失败，请确保是有效的JSON文件');
  });

  it('handleBatchImport：JSON 文本非空数组 → 批量导入', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await waitFor(() => expect(mockApi.nlp.getRules).toHaveBeenCalled());
    act(() => result.current.setImportJsonText(JSON.stringify([SAMPLE_RULE])));
    await act(async () => {
      await result.current.handleBatchImport();
    });
    expect(mockApi.nlp.batchImportRules).toHaveBeenCalledWith([SAMPLE_RULE]);
    expect(params.showToast).toHaveBeenCalledWith(
      'success',
      expect.stringContaining('成功导入 1 条规则')
    );
    expect(result.current.showBatchImportModal).toBe(false);
  });

  it('handleBatchImport：非数组 → 提示格式错误', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await waitFor(() => expect(mockApi.nlp.getRules).toHaveBeenCalled());
    act(() => result.current.setImportJsonText(JSON.stringify({ a: 1 })));
    await act(async () => {
      await result.current.handleBatchImport();
    });
    expect(params.showToast).toHaveBeenCalledWith('error', '数据格式错误，应为数组格式');
  });

  it('handleDownloadTemplate：生成 JSON 模板并下载', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await act(async () => {
      result.current.handleDownloadTemplate();
      // 冲刷 useListFetch 的 300ms 防抖拉取，避免后台 setState 触发 act 警告
      await new Promise((r) => setTimeout(r, 350));
    });
    expect(mockDownloadTextAsFile).toHaveBeenCalledWith(
      expect.stringContaining('behavior_keyword'),
      'nlp_rules_template.json',
      'application/json'
    );
  });

  it('openEditModal：回填 newRule 并打开表单', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await act(async () => {
      result.current.openEditModal(SAMPLE_RULE);
      await new Promise((r) => setTimeout(r, 350));
    });
    expect(result.current.editingRule).toBe(SAMPLE_RULE);
    expect(result.current.showRuleForm).toBe(true);
    expect(result.current.newRule.behavior_tags).toBe('纪律');
  });

  it('fetchRules：手动刷新触发 refetch', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPRules(params));
    await waitFor(() => expect(mockApi.nlp.getRules).toHaveBeenCalledTimes(1));
    mockApi.nlp.getRules.mockClear();
    await act(async () => {
      await result.current.fetchRules();
    });
    expect(mockApi.nlp.getRules).toHaveBeenCalledTimes(1);
  });
});
