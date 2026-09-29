import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RuleFormModal } from './RuleFormModal';
import type { NLPDeps } from './types';

// 取 mock 函数「最后一次调用的第一个参数」（规避 .at(-1) 需 es2022 lib）
function lastArg<T = unknown>(fn: unknown): T {
  const calls = (fn as { mock: { calls: unknown[][] } }).mock.calls;
  return calls[calls.length - 1][0] as T;
}

function makeNewRule(overrides: Record<string, unknown> = {}) {
  return {
    behavior_keyword: '',
    behavior_description: '',
    score_value: 0,
    score_type: 'add',
    behavior_tags: '',
    match_pattern: '',
    priority: 0,
    ...overrides,
  };
}

function makeDeps(overrides: Record<string, unknown> = {}): NLPDeps {
  const base = {
    setShowRuleForm: vi.fn(),
    setEditingRule: vi.fn(),
    editingRule: null,
    newRule: makeNewRule(),
    setNewRule: vi.fn(),
    handleEditRule: vi.fn(),
    handleCreateRule: vi.fn(),
  };
  return { ...base, ...overrides } as unknown as NLPDeps;
}

describe('RuleFormModal 渲染与分支覆盖 B58冲刺', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('editingRule 为空 -> 标题「添加规则」', () => {
    render(<RuleFormModal deps={makeDeps()} />);
    expect(screen.getByText('添加规则')).toBeInTheDocument();
    expect(screen.getByText('创建规则')).toBeInTheDocument();
  });

  it('editingRule 存在 -> 标题「编辑规则」+ 保存按钮「保存修改」', () => {
    render(<RuleFormModal deps={makeDeps({ editingRule: { id: 1 } })} />);
    expect(screen.getByText('编辑规则')).toBeInTheDocument();
    expect(screen.getByText('保存修改')).toBeInTheDocument();
  });

  it('关闭(X) 与 取消 均触发 setShowRuleForm(false)+setEditingRule(null)', () => {
    const deps = makeDeps();
    render(<RuleFormModal deps={deps} />);
    // X 关闭按钮：仅含 svg、无文字，按空文本定位
    const closeBtn = screen
      .getAllByRole('button')
      .find((b) => (b.textContent || '').trim() === '') as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(deps.setShowRuleForm).toHaveBeenCalledWith(false);
    expect(deps.setEditingRule).toHaveBeenCalledWith(null);

    const cancel = screen.getByText('取消');
    fireEvent.click(cancel);
    expect(deps.setShowRuleForm).toHaveBeenCalledTimes(2);
    expect(deps.setEditingRule).toHaveBeenCalledTimes(2);
  });

  it('行为关键词 / 行为描述 onChange 派发 setNewRule', () => {
    const deps = makeDeps();
    render(<RuleFormModal deps={deps} />);
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '迟到' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'desc' } });
    expect(deps.setNewRule).toHaveBeenCalled();
  });

  it('分数值 number 输入按 parseFloat||0 防御 NaN', () => {
    const deps = makeDeps();
    render(<RuleFormModal deps={deps} />);
    const input = screen.getAllByRole('spinbutton')[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5' } });
    expect(lastArg<{ score_value: number }>(deps.setNewRule).score_value).toBe(5);
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(lastArg<{ score_value: number }>(deps.setNewRule).score_value).toBe(0);
  });

  it('评分类型 select 切换 add/deduct', () => {
    const deps = makeDeps();
    render(<RuleFormModal deps={deps} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'deduct' } });
    expect(lastArg<{ score_type: string }>(deps.setNewRule).score_type).toBe('deduct');
  });

  it('行为标签 / 匹配模式 onChange 派发 setNewRule', () => {
    const deps = makeDeps();
    render(<RuleFormModal deps={deps} />);
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'tag1' } });
    fireEvent.change(screen.getAllByRole('textbox')[3], { target: { value: 'pat' } });
    expect(deps.setNewRule).toHaveBeenCalled();
  });

  it('优先级 number 输入按 parseInt||0 防御 NaN', () => {
    const deps = makeDeps();
    render(<RuleFormModal deps={deps} />);
    const input = screen.getAllByRole('spinbutton')[1] as HTMLInputElement;
    fireEvent.change(input, { target: { value: '3' } });
    expect(lastArg<{ priority: number }>(deps.setNewRule).priority).toBe(3);
    fireEvent.change(input, { target: { value: 'xx' } });
    expect(lastArg<{ priority: number }>(deps.setNewRule).priority).toBe(0);
  });

  it('保存按钮：editingRule 空 -> handleCreateRule；有值 -> handleEditRule', () => {
    const create = makeDeps();
    const { unmount } = render(<RuleFormModal deps={create} />);
    fireEvent.click(screen.getByText('创建规则'));
    expect(create.handleCreateRule).toHaveBeenCalledTimes(1);
    unmount();

    const edit = makeDeps({ editingRule: { id: 2 } });
    render(<RuleFormModal deps={edit} />);
    fireEvent.click(screen.getByText('保存修改'));
    expect(edit.handleEditRule).toHaveBeenCalledTimes(1);
  });
});
