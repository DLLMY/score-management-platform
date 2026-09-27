import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useNLPParse } from '../useNLPParse';
import type { ParseResult } from '../../types';

// 显式 cleanup：整文件批量跑时，前序用例挂载的 hook 实例若未及时卸载，会干扰后续用例的
// act 时序（useCallback 闭包偶发陈旧）。每条用例后卸载，保证 result.current 快照一致。
afterEach(cleanup);

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    nlp: {
      parse: vi.fn(),
      execute: vi.fn(),
      recordFeedback: vi.fn(),
    },
  },
}));

vi.mock('../../../../services/api', () => ({
  default: mockApi,
  getAuthHeaders: vi.fn(() => ({})),
}));

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    showToast: vi.fn(),
    fetchRules: vi.fn(),
    ...overrides,
  };
}

const PARSE_RESULT: ParseResult = {
  success: true,
  input_text: 't',
  intent: 'add',
  confidence: 0.9,
  extracted_name: '张三',
  behavior: '迟到',
  user_id: null,
  matched_rules: [
    {
      rule_id: 1,
      behavior_keyword: '迟到',
      behavior_description: 'd',
      score_type: 'add',
      score_value: 5,
      behavior_tags: [],
      match_pattern: '',
      priority: 1,
      usage_count: 0,
      accuracy_rate: 0,
    },
  ],
  suggestions: [
    { rule_id: 2, description: '相似', score_value: 3, intent: 'add', similarity: 0.8 },
  ],
};

describe('useNLPParse · NLP 智能解析', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.nlp.parse.mockResolvedValue({
      input_text: '',
      intent: '',
      confidence: 0,
      extracted_name: '',
      behavior: '',
      matched_rules: [],
      suggestions: [],
    });
    mockApi.nlp.execute.mockResolvedValue({ results: [{ success: true }] });
    mockApi.nlp.recordFeedback.mockResolvedValue({});
  });

  it('parseText：空输入 → 警告并返回（不调用 api）', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    await act(async () => {
      await result.current.parseText();
    });
    expect(params.showToast).toHaveBeenCalledWith('warning', '请输入文本');
    expect(mockApi.nlp.parse).not.toHaveBeenCalled();
  });

  it('parseText：命中精确规则 → 拉取成功、suggestions 映射、不弹 toast', async () => {
    mockApi.nlp.parse.mockResolvedValueOnce({
      input_text: 't',
      intent: 'add',
      confidence: 0.9,
      extracted_name: '张三',
      behavior: '迟到',
      matched_rules: [
        {
          rule_id: 1,
          score_type: 'add',
          score_value: 5,
          behavior_tags: [],
          behavior_description: 'd',
        },
      ],
      suggestions: [
        { rule_id: 2, description: '相似', score_value: 3, intent: 'add', similarity: 0.8 },
      ],
    });
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    await act(async () => {
      await result.current.parseText();
    });
    expect(mockApi.nlp.parse).toHaveBeenCalledWith('hello');
    expect(result.current.parseResult).not.toBeNull();
    expect(result.current.suggestedRules).toHaveLength(1);
    expect(result.current.suggestedRules[0].id).toBe(2);
    expect(params.showToast).not.toHaveBeenCalled();
  });

  it('parseText：识别但未匹配规则 → info toast', async () => {
    mockApi.nlp.parse.mockResolvedValueOnce({
      input_text: 't',
      intent: 'add',
      confidence: 0.9,
      extracted_name: '张三',
      behavior: '',
      matched_rules: [],
      suggestions: [],
    });
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    await act(async () => {
      await result.current.parseText();
    });
    expect(params.showToast).toHaveBeenCalledWith('info', expect.stringContaining('已识别姓名'));
  });

  it('parseText：完全未识别 → 另一分支 info toast', async () => {
    mockApi.nlp.parse.mockResolvedValueOnce({
      input_text: 't',
      intent: '',
      confidence: 0,
      extracted_name: '',
      behavior: '',
      matched_rules: [],
      suggestions: [],
    });
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    await act(async () => {
      await result.current.parseText();
    });
    expect(params.showToast).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('未识别到明确评分规则')
    );
  });

  it('parseText：接口抛错 → error toast', async () => {
    mockApi.nlp.parse.mockRejectedValue(new Error('parse failed'));
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    await act(async () => {
      await result.current.parseText();
    });
    expect(params.showToast).toHaveBeenCalledWith('error', expect.stringContaining('解析失败'));
  });

  it('executeScoring：无 parseResult → 直接返回', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    await act(async () => {
      await result.current.executeScoring();
    });
    expect(mockApi.nlp.execute).not.toHaveBeenCalled();
  });

  it('executeScoring：有结果 → 评分成功、清空状态、刷新规则', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    act(() => result.current.setParseResult(PARSE_RESULT));
    await waitFor(() => expect(result.current.parseResult).not.toBeNull());
    await act(async () => {
      await result.current.executeScoring();
    });
    expect(mockApi.nlp.execute).toHaveBeenCalled();
    expect(params.showToast).toHaveBeenCalledWith('success', '成功评分 1 条指令');
    expect(result.current.parseResult).toBeNull();
    expect(result.current.inputText).toBe('');
    expect(result.current.selectedRuleId).toBeNull();
    expect(params.fetchRules).toHaveBeenCalled();
  });

  it('executeScoring：execute 返回空 → error toast', async () => {
    mockApi.nlp.execute.mockResolvedValueOnce(null);
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    act(() => result.current.setParseResult(PARSE_RESULT));
    await waitFor(() => expect(result.current.parseResult).not.toBeNull());
    await act(async () => {
      await result.current.executeScoring();
    });
    expect(params.showToast).toHaveBeenCalledWith('error', '操作失败');
  });

  it('applySuggestionAsRule：一键应用相似规则', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    await act(async () => {
      await result.current.applySuggestionAsRule({
        rule_id: 2,
        intent: 'add',
        score_value: 3,
        description: '相似',
      });
    });
    expect(mockApi.nlp.execute).toHaveBeenCalled();
    expect(params.showToast).toHaveBeenCalledWith(
      'success',
      expect.stringContaining('相似规则 #2')
    );
    expect(result.current.parseResult).toBeNull();
    expect(result.current.suggestedRules).toHaveLength(0);
    expect(params.fetchRules).toHaveBeenCalled();
  });

  it('handleManualExecute：手动修正评分', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    act(() => result.current.setParseResult(PARSE_RESULT));
    await waitFor(() => expect(result.current.parseResult).not.toBeNull());
    await act(async () => {
      await result.current.handleManualExecute();
    });
    expect(mockApi.nlp.execute).toHaveBeenCalledWith(
      expect.objectContaining({ manual_correction: expect.objectContaining({ created_by: 1 }) })
    );
    expect(params.showToast).toHaveBeenCalledWith('success', '成功评分 1 条指令');
    expect(result.current.showCorrectionModal).toBe(false);
    expect(params.fetchRules).toHaveBeenCalled();
  });

  it('handleRecordFeedback：无 parseResult → 直接返回', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    await act(async () => {
      await result.current.handleRecordFeedback();
    });
    expect(mockApi.nlp.recordFeedback).not.toHaveBeenCalled();
  });

  it('handleRecordFeedback：记录反馈成功', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    act(() => result.current.setParseResult(PARSE_RESULT));
    await waitFor(() => expect(result.current.parseResult).not.toBeNull());
    await act(async () => {
      await result.current.handleRecordFeedback();
    });
    expect(mockApi.nlp.recordFeedback).toHaveBeenCalled();
    expect(params.showToast).toHaveBeenCalledWith('success', '反馈已记录，系统将自动学习优化');
  });

  it('handleRecordFeedback：接口抛错 → 仅提示', async () => {
    mockApi.nlp.recordFeedback.mockRejectedValue(new Error('fb failed'));
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    act(() => result.current.setParseResult(PARSE_RESULT));
    await waitFor(() => expect(result.current.parseResult).not.toBeNull());
    await act(async () => {
      await result.current.handleRecordFeedback();
    });
    expect(params.showToast).toHaveBeenCalledWith('error', '记录反馈失败');
  });
});

describe('useNLPParse · 补齐分支（B29）', () => {
  it('parseText：suggestions 无 rule_id → setSuggestedRules([])（filter 非 rule_id 分支）', async () => {
    mockApi.nlp.parse.mockResolvedValueOnce({
      input_text: 't',
      intent: '',
      confidence: 0,
      extracted_name: '',
      behavior: '',
      matched_rules: [],
      suggestions: [{ description: '相似', score_value: 3, intent: 'add', similarity: 0.8 }],
    });
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    await act(async () => {
      await result.current.parseText();
    });
    expect(result.current.suggestedRules).toHaveLength(0);
  });

  it('executeScoring：selectedRuleId 命中某规则 → 用该规则的 score_type（find 命中分支）', async () => {
    const pr: ParseResult = {
      ...PARSE_RESULT,
      matched_rules: [
        {
          rule_id: 5,
          behavior_keyword: '迟到',
          behavior_description: 'd',
          score_type: 'subtract',
          score_value: 2,
          behavior_tags: [],
          match_pattern: '',
          priority: 1,
          usage_count: 0,
          accuracy_rate: 0,
        },
        {
          rule_id: 1,
          behavior_keyword: '迟到',
          behavior_description: 'd',
          score_type: 'add',
          score_value: 5,
          behavior_tags: [],
          match_pattern: '',
          priority: 1,
          usage_count: 0,
          accuracy_rate: 0,
        },
      ],
    };
    mockApi.nlp.execute.mockResolvedValueOnce({ results: [{ success: true }] });
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => {
      result.current.setInputText('hello');
      result.current.setParseResult(pr);
      result.current.setSelectedRuleId(5);
    });
    await waitFor(() => expect(result.current.parseResult?.matched_rules?.[0]?.rule_id).toBe(5));
    await act(async () => {
      await result.current.executeScoring();
    });
    expect(mockApi.nlp.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        manual_correction: expect.objectContaining({ intent: 'subtract', score_value: 2 }),
      })
    );
  });

  it('executeScoring：返回 results 为空数组 → “评分成功” 分支', async () => {
    mockApi.nlp.execute.mockResolvedValueOnce({ results: [] });
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    act(() => result.current.setParseResult(PARSE_RESULT));
    await waitFor(() => expect(result.current.parseResult).not.toBeNull());
    await act(async () => {
      await result.current.executeScoring();
    });
    expect(params.showToast).toHaveBeenCalledWith('success', '评分成功');
  });

  it('executeScoring：execute 抛错 → error toast', async () => {
    mockApi.nlp.execute.mockRejectedValue(new Error('exec failed'));
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    act(() => result.current.setParseResult(PARSE_RESULT));
    await waitFor(() => expect(result.current.parseResult).not.toBeNull());
    await act(async () => {
      await result.current.executeScoring();
    });
    expect(params.showToast).toHaveBeenCalledWith('error', expect.stringContaining('评分失败'));
  });

  it('applySuggestionAsRule：返回 null → “应用失败”', async () => {
    mockApi.nlp.execute.mockResolvedValueOnce(null);
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    await act(async () => {
      await result.current.applySuggestionAsRule({
        rule_id: 2,
        intent: 'add',
        score_value: 3,
        description: '相似',
      });
    });
    expect(params.showToast).toHaveBeenCalledWith('error', '应用失败');
  });

  it('applySuggestionAsRule：execute 抛错 → error toast', async () => {
    mockApi.nlp.execute.mockRejectedValue(new Error('apply failed'));
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    await act(async () => {
      await result.current.applySuggestionAsRule({
        rule_id: 2,
        intent: 'add',
        score_value: 3,
        description: '相似',
      });
    });
    expect(params.showToast).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('应用相似规则失败')
    );
  });

  it('handleManualExecute：返回 null → “操作失败”', async () => {
    mockApi.nlp.execute.mockResolvedValueOnce(null);
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    act(() => result.current.setParseResult(PARSE_RESULT));
    await waitFor(() => expect(result.current.parseResult).not.toBeNull());
    await act(async () => {
      await result.current.handleManualExecute();
    });
    expect(params.showToast).toHaveBeenCalledWith('error', '操作失败');
  });

  it('handleManualExecute：execute 抛错 → error toast', async () => {
    mockApi.nlp.execute.mockRejectedValue(new Error('manual failed'));
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    act(() => result.current.setParseResult(PARSE_RESULT));
    await waitFor(() => expect(result.current.parseResult).not.toBeNull());
    await act(async () => {
      await result.current.handleManualExecute();
    });
    expect(params.showToast).toHaveBeenCalledWith('error', expect.stringContaining('评分失败'));
  });
});
