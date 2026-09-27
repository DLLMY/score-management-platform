import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ParseTab } from '../ParseTab';
import type { NLPDeps, ParseResult, MatchedRule, Suggestion, Rule } from '../types';

// 测试环境下 usePermissions 默认返回 loading/无权限 → PermissionButton 渲染 disabled 按钮，
// fireEvent.click 不触发 onClick。此处注入 isSuperAdmin:true 使按钮真实可点击。
vi.mock('../../../hooks', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    usePermissions: () => ({
      permissions: [],
      roles: [],
      isLoading: false,
      error: null,
      adminInfo: null,
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
      isSuperAdmin: true,
      isAdmin: false,
      reload: () => {},
    }),
  };
});

const noop = vi.fn();

const baseDeps: {
  inputText: string;
  setInputText: typeof noop;
  parseText: typeof noop;
  isParsing: boolean;
  parseResult: ParseResult | null;
  selectedRuleId: number | null;
  setSelectedRuleId: typeof noop;
  executeScoring: typeof noop;
  applySuggestionAsRule: typeof noop;
  suggestedRules: Rule[];
  setManualCorrection: typeof noop;
  setShowCorrectionModal: typeof noop;
  showCorrectionList: boolean;
  setShowCorrectionList: typeof noop;
  setCorrectionsPage: typeof noop;
  fetchCorrections: typeof noop;
} = {
  inputText: '',
  setInputText: noop,
  parseText: noop,
  isParsing: false,
  parseResult: null,
  selectedRuleId: null,
  setSelectedRuleId: noop,
  executeScoring: noop,
  applySuggestionAsRule: noop,
  suggestedRules: [],
  setManualCorrection: noop,
  setShowCorrectionModal: noop,
  showCorrectionList: false,
  setShowCorrectionList: noop,
  setCorrectionsPage: noop,
  fetchCorrections: noop,
};

function renderWith(overrides: Partial<typeof baseDeps> = {}) {
  const deps = { ...baseDeps, ...overrides } as unknown as NLPDeps;
  return render(<ParseTab deps={deps} />);
}

const addRule: MatchedRule = {
  rule_id: 1,
  behavior_keyword: '积极',
  behavior_description: '积极回答问题',
  score_value: 3,
  score_type: 'add',
  behavior_tags: ['active'],
  match_pattern: '',
  priority: 1,
  usage_count: 10,
  accuracy_rate: 0.85,
};

const deductRule: MatchedRule = {
  rule_id: 2,
  behavior_keyword: '睡觉',
  behavior_description: '上课睡觉',
  score_value: 5,
  score_type: 'deduct',
  behavior_tags: ['bad'],
  match_pattern: '',
  priority: 2,
  usage_count: 4,
  accuracy_rate: 0.6,
};

const similarSuggestion: Suggestion = {
  intent: 'add',
  score_value: 2,
  description: '类似规则 A',
  rule_id: 9,
  similarity: 0.78,
};

const genericSuggestion: Suggestion = {
  intent: 'deduct',
  score_value: 1,
  description: '建议扣分事项',
};

const parseAdd: ParseResult = {
  success: true,
  input_text: '张三上课积极回答问题',
  extracted_name: '张三',
  user_id: 1,
  behavior: '积极回答问题',
  intent: 'add',
  confidence: 0.92,
  matched_rules: [addRule],
  suggestions: [genericSuggestion, similarSuggestion],
};

const libRule: Rule = {
  id: 7,
  behavior_keyword: '礼貌',
  behavior_description: '主动问好',
  score_value: 1,
  score_type: 'add',
  behavior_tags: ['polite'],
  match_pattern: '',
  priority: 1,
  is_active: true,
  usage_count: 2,
  accuracy_rate: 0.9,
  created_at: '',
  updated_at: '',
};

describe('ParseTab', () => {
  it('parseResult=null：不渲染解析结果区', () => {
    renderWith();
    expect(screen.queryByText('解析结果')).toBeNull();
  });

  it('isParsing=true：按钮显示加载图标并禁用', () => {
    const { container } = renderWith({ isParsing: true });
    expect(container.querySelector('.animate-spin')).toBeTruthy();
    expect(screen.getByText('解析').closest('button')).toBeDisabled();
  });

  it('完整 add 解析：渲染全部正向分支', () => {
    const apply = vi.fn();
    const exec = vi.fn();
    const setManual = vi.fn();
    const setModal = vi.fn();
    const { container } = renderWith({
      parseResult: parseAdd,
      applySuggestionAsRule: apply,
      executeScoring: exec,
      setManualCorrection: setManual,
      setShowCorrectionModal: setModal,
    });
    // 解析结果基本字段
    expect(screen.getByText('解析结果')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    // 行为描述在「解析结果」与「匹配规则」各出现一次 → 用 getAllByText
    expect(screen.getAllByText('积极回答问题').length).toBeGreaterThanOrEqual(1);
    // 评分意图 add → 绿色「加分」
    expect(screen.getByText('加分')).toBeInTheDocument();
    expect(container.querySelector('.text-green-600')).toBeTruthy();
    // 置信度 92%
    expect(container.textContent).toContain('92%');
    // 匹配规则区（单条）
    expect(screen.getByText('匹配规则')).toBeInTheDocument();
    // 行为描述在「解析结果」与「匹配规则」各出现一次 → 两条
    expect(screen.getAllByText('积极回答问题').length).toBe(2);
    expect(screen.getByText('关键词: 积极')).toBeInTheDocument();
    // 准确率 0.85 → 85.0%
    expect(container.textContent).toContain('85.0%');
    // 使用次数 + 准确率行
    expect(screen.getByText('使用次数: 10')).toBeInTheDocument();
    // 建议（generic）
    expect(screen.getByText('建议')).toBeInTheDocument();
    expect(container.textContent).toContain('建议扣分: 1');
    // 相似规则推荐（similar，带相似度 badge）
    expect(screen.getByText('相似规则推荐')).toBeInTheDocument();
    expect(screen.getByText('类似规则 A')).toBeInTheDocument();
    expect(container.textContent).toContain('相似度 78%');
    // 确认评分按钮（success && matched>0）
    const confirm = screen.getByText('确认评分') as HTMLButtonElement;
    expect(confirm).toBeInTheDocument();
    fireEvent.click(confirm);
    expect(exec).toHaveBeenCalledTimes(1);
    // 一键应用
    const applyBtn = screen.getByText('一键应用');
    fireEvent.click(applyBtn);
    expect(apply).toHaveBeenCalledWith(similarSuggestion);
    // 手动修正 → setManualCorrection + setShowCorrectionModal(true)
    fireEvent.click(screen.getByText('手动修正'));
    expect(setManual).toHaveBeenCalledTimes(1);
    expect(setModal).toHaveBeenCalledWith(true);
  });

  it('手动修正时 intent=unknown → 兜底为 add', () => {
    const setManual = vi.fn();
    renderWith({
      parseResult: { ...parseAdd, intent: 'unknown', matched_rules: [] },
      setManualCorrection: setManual,
    });
    fireEvent.click(screen.getByText('手动修正'));
    const call = setManual.mock.calls[0][0] as any;
    expect(call.intent).toBe('add');
    expect(call.score_value).toBe(5); // matched_rules[0]?.score_value || 5
  });

  it('deduct 解析：评分意图红色「扣分」+ 规则 deduct 配色', () => {
    const { container } = renderWith({
      parseResult: { ...parseAdd, intent: 'deduct', matched_rules: [deductRule] },
    });
    expect(screen.getByText('扣分')).toBeInTheDocument();
    expect(container.querySelector('.text-red-600')).toBeTruthy();
    expect(screen.getByText('关键词: 睡觉')).toBeInTheDocument();
  });

  it('unknown intent：评分意图显示「未知」灰色', () => {
    const { container } = renderWith({
      parseResult: { ...parseAdd, intent: 'weird', matched_rules: [] },
    });
    expect(screen.getByText('未知')).toBeInTheDocument();
    expect(container.querySelector('.text-gray-500')).toBeTruthy();
  });

  it('extracted_name=null：显示「未识别」', () => {
    renderWith({
      parseResult: { ...parseAdd, extracted_name: null, matched_rules: [] },
    });
    expect(screen.getByText('未识别')).toBeInTheDocument();
  });

  it('matched_rules.length > 1：显示「(请选择一条)」提示', () => {
    renderWith({
      parseResult: { ...parseAdd, matched_rules: [addRule, deductRule] },
    });
    expect(screen.getByText(/请选择一条/)).toBeInTheDocument();
  });

  it('accuracy_rate=null：准确率显示 --', () => {
    const { container } = renderWith({
      parseResult: { ...parseAdd, matched_rules: [{ ...addRule, accuracy_rate: null as any }] },
    });
    expect(container.textContent).toContain('准确率: --');
  });

  it('selectedRuleId 显式指定：对应规则 radio 选中（rule_id 优先于 index）', () => {
    const setSel = vi.fn();
    renderWith({
      parseResult: { ...parseAdd, matched_rules: [addRule, deductRule] },
      selectedRuleId: 2,
      setSelectedRuleId: setSel,
    });
    // 点击第二条规则的 radio
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]);
    expect(setSel).toHaveBeenCalledWith(2);
  });

  it('suggestedRules 非空且 matched_rules 为空：渲染库内匹配区', () => {
    const setManual = vi.fn();
    const setModal = vi.fn();
    renderWith({
      parseResult: { ...parseAdd, matched_rules: [] },
      suggestedRules: [libRule],
      setManualCorrection: setManual,
      setShowCorrectionModal: setModal,
    });
    expect(screen.getByText('相似规则推荐（库内匹配）')).toBeInTheDocument();
    expect(screen.getByText('主动问好')).toBeInTheDocument();
    fireEvent.click(screen.getByText('主动问好'));
    expect(setManual).toHaveBeenCalledTimes(1);
    expect(setModal).toHaveBeenCalledWith(true);
  });

  it('showCorrectionList=true：纠正记录按钮为 purple-600', () => {
    const { container } = renderWith({
      parseResult: parseAdd,
      showCorrectionList: true,
    });
    expect(container.querySelector('.bg-purple-600')).toBeTruthy();
  });

  it('点击纠正记录（关闭态）：切换列表 + 翻页 + 拉取', () => {
    const setList = vi.fn();
    const setPage = vi.fn();
    const fetch = vi.fn();
    renderWith({
      parseResult: parseAdd,
      setShowCorrectionList: setList,
      setCorrectionsPage: setPage,
      fetchCorrections: fetch,
    });
    fireEvent.click(screen.getByText('纠正记录'));
    expect(setList).toHaveBeenCalledWith(true);
    expect(setPage).toHaveBeenCalledWith(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('输入框 onChange / Enter 触发对应回调', () => {
    const setText = vi.fn();
    const parse = vi.fn();
    renderWith({ setInputText: setText, parseText: parse });
    const input = screen.getByPlaceholderText(/输入自然语言文本/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '李四上课睡觉' } });
    expect(setText).toHaveBeenCalledWith('李四上课睡觉');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('无 suggestions / 无 matched_rules：不渲染建议区', () => {
    renderWith({
      parseResult: { ...parseAdd, matched_rules: [], suggestions: [] },
    });
    expect(screen.queryByText('建议')).toBeNull();
    expect(screen.queryByText('相似规则推荐')).toBeNull();
  });
});
