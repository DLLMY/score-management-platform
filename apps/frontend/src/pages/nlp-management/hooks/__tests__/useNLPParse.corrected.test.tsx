import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useNLPParse } from '../useNLPParse';
import type { ParseResult } from '../../types';

// 独立文件：仅覆盖 handleRecordFeedback 的 corrected_* 分支（B29）。
// 该用例需断言闭包捕获的 parseResult/manualCorrection，对 RTL 的 result.current 快照一致性敏感；
// 置于独立模块可避免与同文件其他用例共享 act 环境带来的 useCallback 闭包陈旧（整文件批量跑时偶发）。
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

afterEach(cleanup);

describe('useNLPParse · handleRecordFeedback corrected_* 分支（B29）', () => {
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

  it('parseResult.intent 与默认 manualCorrection.intent 不一致 → 触发 corrected_* 分支', async () => {
    const pr: ParseResult = {
      ...PARSE_RESULT,
      intent: 'subtract', // 与默认 manualCorrection.intent('add') 不一致 → corrected_* 分支命中
      extracted_name: '张三',
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
    };
    mockApi.nlp.recordFeedback.mockResolvedValueOnce({});
    const params = makeParams();
    const { result } = renderHook(() => useNLPParse(params));
    act(() => result.current.setInputText('hello'));
    act(() => result.current.setParseResult(pr));
    await waitFor(() => expect(result.current.parseResult?.intent).toBe('subtract'));
    await act(async () => {
      await result.current.handleRecordFeedback();
    });
    const payload = mockApi.nlp.recordFeedback.mock.calls[0][0] as Record<string, unknown>;
    // corrected_intent/name 来自 manualCorrection（默认 intent='add'、behavior_description=''、score_value=5）
    expect(payload.corrected_intent).toBe('add');
    expect(payload.corrected_name).toBe('');
    expect(payload.corrected_score).toBe(5);
    // original_* 来自 parseResult
    expect(payload.original_name).toBe('张三');
    expect(payload.original_score).toBe(5);
    expect(params.showToast).toHaveBeenCalledWith('success', '反馈已记录，系统将自动学习优化');
  });
});
