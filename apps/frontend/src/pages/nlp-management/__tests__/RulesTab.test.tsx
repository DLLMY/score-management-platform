import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RulesTab } from '../RulesTab';
import { buildRuleColumns } from '../columns';
import type { NLPDeps, Rule } from '../types';

// 测试环境下 usePermissions 默认返回 loading/无权限 → PermissionButton 渲染 disabled 按钮，
// fireEvent.click 不触发 onClick。注入 isSuperAdmin:true 使按钮真实可点击。
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

const addRule: Rule = {
  id: 1,
  behavior_keyword: '积极',
  behavior_description: '积极回答问题',
  score_value: 3,
  score_type: 'add',
  behavior_tags: ['active', 'good'],
  match_pattern: '',
  priority: 1,
  is_active: true,
  usage_count: 10,
  accuracy_rate: 0.85,
  created_at: '',
  updated_at: '',
};

const deductRule: Rule = {
  id: 2,
  behavior_keyword: '睡觉',
  behavior_description: '上课睡觉',
  score_value: 5,
  score_type: 'deduct',
  behavior_tags: [],
  match_pattern: '',
  priority: 2,
  is_active: true,
  usage_count: 4,
  accuracy_rate: null as unknown as number,
  created_at: '',
  updated_at: '',
};

const baseDeps: {
  setShowBatchImportModal: typeof noop;
  setEditingRule: typeof noop;
  setNewRule: typeof noop;
  setShowRuleForm: typeof noop;
  keywordFilter: string;
  setKeywordFilter: typeof noop;
  scoreTypeFilter: string;
  setScoreTypeFilter: typeof noop;
  ruleColumns: ReturnType<typeof buildRuleColumns>;
  rules: Rule[];
  rulesLoading: boolean;
  rulePage: number;
  setRulePage: typeof noop;
  ruleTotal: number;
  openEditModal: typeof noop;
  handleDeleteRule: typeof noop;
} = {
  setShowBatchImportModal: noop,
  setEditingRule: noop,
  setNewRule: noop,
  setShowRuleForm: noop,
  keywordFilter: '',
  setKeywordFilter: noop,
  scoreTypeFilter: '',
  setScoreTypeFilter: noop,
  ruleColumns: buildRuleColumns(),
  rules: [],
  rulesLoading: false,
  rulePage: 1,
  setRulePage: noop,
  ruleTotal: 0,
  openEditModal: noop,
  handleDeleteRule: noop,
};

function renderWith(overrides: Partial<typeof baseDeps> = {}) {
  const deps = { ...baseDeps, ...overrides } as unknown as NLPDeps;
  return render(<RulesTab deps={deps} />);
}

function getRowActionButtons(container: HTMLElement, rowIndex = 0): HTMLButtonElement[] {
  const rows = container.querySelectorAll('tbody tr');
  const lastTd = rows[rowIndex].querySelector('td:last-child');
  return Array.from(lastTd?.querySelectorAll('button') ?? []) as HTMLButtonElement[];
}

describe('RulesTab', () => {
  it('rules 为空且 ruleTotal=0：显示空态「暂无规则」', () => {
    renderWith({ rules: [], ruleTotal: 0 });
    expect(screen.getByText('暂无规则')).toBeInTheDocument();
  });

  it('rulesLoading=true：进入骨架态（不渲染空态）', () => {
    renderWith({ rules: [], rulesLoading: true });
    expect(screen.queryByText('暂无规则')).toBeNull();
  });

  it('rules 含 add/deduct 规则：渲染列 + 加分绿/扣分红 + 标签 + 准确率', () => {
    const { container } = renderWith({ rules: [addRule, deductRule] });
    expect(screen.getByText('积极回答问题')).toBeInTheDocument();
    // 加分：绿色 + 带 + 号
    expect(container.querySelector('.text-green-600')).toBeTruthy();
    expect(screen.getByText(/\+3/)).toBeInTheDocument();
    // 扣分：红色（无 + 号）
    expect(container.querySelector('.text-red-600')).toBeTruthy();
    expect(screen.getByText('5')).toBeInTheDocument();
    // 标签渲染
    expect(screen.getByText('active')).toBeInTheDocument();
    // 准确率：85.0% 与 null → --
    expect(container.textContent).toContain('85.0%');
    expect(container.textContent).toContain('--');
  });

  it('关键词输入框 onChange：触发 setKeywordFilter + setRulePage(1)', () => {
    const setKw = vi.fn();
    const setPage = vi.fn();
    renderWith({ setKeywordFilter: setKw, setRulePage: setPage });
    const input = screen.getByPlaceholderText('搜索关键词') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '睡觉' } });
    expect(setKw).toHaveBeenCalledWith('睡觉');
    expect(setPage).toHaveBeenCalledWith(1);
  });

  it('类型下拉 onChange：触发 setScoreTypeFilter + setRulePage(1)', () => {
    const setType = vi.fn();
    const setPage = vi.fn();
    renderWith({ setScoreTypeFilter: setType, setRulePage: setPage });
    const select = screen.getByDisplayValue('全部类型') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'deduct' } });
    expect(setType).toHaveBeenCalledWith('deduct');
    expect(setPage).toHaveBeenCalledWith(1);
  });

  it('「批量导入」按钮点击：setShowBatchImportModal(true)', () => {
    const setModal = vi.fn();
    renderWith({ setShowBatchImportModal: setModal });
    fireEvent.click(screen.getByText('批量导入'));
    expect(setModal).toHaveBeenCalledWith(true);
  });

  it('「添加规则」按钮点击：setEditingRule(null) + setNewRule(默认) + setShowRuleForm(true)', () => {
    const setEdit = vi.fn();
    const setNew = vi.fn();
    const setForm = vi.fn();
    renderWith({ setEditingRule: setEdit, setNewRule: setNew, setShowRuleForm: setForm });
    fireEvent.click(screen.getByText('添加规则'));
    expect(setEdit).toHaveBeenCalledWith(null);
    expect(setNew).toHaveBeenCalledWith({
      behavior_keyword: '',
      behavior_description: '',
      score_value: 5,
      score_type: 'add',
      behavior_tags: '',
      match_pattern: '',
      priority: 0,
    });
    expect(setForm).toHaveBeenCalledWith(true);
  });

  it('行「编辑」操作：openEditModal(rule)', () => {
    const open = vi.fn();
    const { container } = renderWith({ rules: [addRule], openEditModal: open });
    const [editBtn] = getRowActionButtons(container);
    fireEvent.click(editBtn);
    expect(open).toHaveBeenCalledWith(addRule);
  });

  it('行「删除」操作：handleDeleteRule(rule.id)', () => {
    const del = vi.fn();
    const { container } = renderWith({ rules: [deductRule], handleDeleteRule: del });
    const buttons = getRowActionButtons(container);
    const deleteBtn = buttons[buttons.length - 1];
    fireEvent.click(deleteBtn);
    expect(del).toHaveBeenCalledWith(deductRule.id);
  });

  it('多规则渲染：每行均生成行操作按钮', () => {
    const { container } = renderWith({ rules: [addRule, deductRule] });
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    rows.forEach((row) => {
      expect(row.querySelector('td:last-child button')).toBeTruthy();
    });
  });

  it('accuracy_rate=0 的规则：准确率显示 0.0%', () => {
    const zeroRule: Rule = { ...addRule, accuracy_rate: 0 };
    const { container } = renderWith({ rules: [zeroRule] });
    expect(container.textContent).toContain('0.0%');
  });
});
