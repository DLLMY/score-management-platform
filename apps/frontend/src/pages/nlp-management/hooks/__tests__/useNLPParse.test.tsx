import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNLPParse } from '../useNLPParse';

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
  } as never;
}

const PARSE_RESULT = {
  input_text: 't',
  intent: 'add',
  confidence: 0.9,
  extracted_name: '张三',
  behavior: '迟到',
  matched_rules: [
    { rule_id: 1, score_type: 'add', score_value: 5, behavior_tags: [], behavior_description: 'd' },
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
        { rule_id: 1, score_type: 'add', score_value: 5, behavior_tags: [], behavior_description: 'd' },
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
    expect(params.showToast).toHaveBeenCalledWith('info', expect.stringContaining('未识别到明确评分规则'));
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
    act(() => result.current.setParseResult(PARSE_RESULT as never));
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
    act(() => result.current.setParseResult(PARSE_RESULT as never));
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
    act(() => result.current.setParseResult(PARSE_RESULT as never));
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
    act(() => result.current.setParseResult(PARSE_RESULT as never));
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
    act(() => result.current.setParseResult(PARSE_RESULT as never));
    await waitFor(() => expect(result.current.parseResult).not.toBeNull());
    await act(async () => {
      await result.current.handleRecordFeedback();
    });
    expect(params.showToast).toHaveBeenCalledWith('error', '记录反馈失败');
  });
});
