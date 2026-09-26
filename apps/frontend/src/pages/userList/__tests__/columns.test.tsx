import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '../../../types';
import { buildUserColumns } from '../columns';

// 用 vi.hoisted 创建 stub，避免 mock factory 内 JSX 在 hoist 期执行导致 TDZ/React 未就绪。
// 实现延迟到 beforeEach（此时模块 import 已完成，JSX 可用）。
const hoisted = vi.hoisted(() => ({
  StatusTag: vi.fn(),
  AnimatedScore: vi.fn(),
  PermissionButton: vi.fn(),
}));

vi.mock('../../../components', () => ({
  StatusTag: hoisted.StatusTag,
  AnimatedScore: hoisted.AnimatedScore,
  PermissionButton: hoisted.PermissionButton,
}));

beforeEach(() => {
  hoisted.StatusTag.mockImplementation(({ tone, label }: any) => (
    <span data-testid='status' data-tone={tone}>
      {label}
    </span>
  ));
  hoisted.AnimatedScore.mockImplementation(({ value }: any) => (
    <span data-testid='score'>{String(value ?? '--')}</span>
  ));
  hoisted.PermissionButton.mockImplementation(({ onClick, children, permission }: any) => (
    <button type='button' data-permission={permission} onClick={onClick}>
      {children}
    </button>
  ));
});

const makeUser = (over: Partial<User> = {}): User =>
  ({
    id: 1,
    name: '张三',
    card_id: 'C001',
    class_name: '一班',
    current_score: 80,
    is_active: true,
    is_blacklisted: false,
    ...over,
  } as unknown as User);

describe('buildUserColumns', () => {
  const deps = {
    handleOpenQuickScore: vi.fn(),
    handleOpenModal: vi.fn(),
    handleDelete: vi.fn(),
    handleToggleActive: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 5 columns with correct titles', () => {
    const cols = buildUserColumns(deps) as any;
    expect(cols).toHaveLength(5);
    expect(cols.map((c: any) => c.title)).toEqual(['学生信息', '班级', '状态', '当前积分', '操作']);
  });

  it('renders 学生信息 column (avatar initial + name + card_id)', () => {
    const cols = buildUserColumns(deps) as any;
    const { getByText } = render(cols[0].render!('', makeUser()) as any);
    expect(getByText('张三')).toBeInTheDocument();
    expect(getByText('C001')).toBeInTheDocument();
    // 头像首字母
    expect(getByText('张')).toBeInTheDocument();
  });

  it('renders 班级 column', () => {
    const cols = buildUserColumns(deps) as any;
    const { getByText } = render(cols[1].render!('', makeUser({ class_name: '二班' })) as any);
    expect(getByText('二班')).toBeInTheDocument();
  });

  it('renders 状态 column: 黑名单 (highest priority)', () => {
    const cols = buildUserColumns(deps) as any;
    const { getByTestId, getByText } = render(
      cols[2].render!('', makeUser({ is_blacklisted: true, is_active: true })) as any
    );
    expect(getByTestId('status')).toHaveAttribute('data-tone', 'danger');
    expect(getByText('黑名单')).toBeInTheDocument();
  });

  it('renders 状态 column: 启用 when active & not blacklisted', () => {
    const cols = buildUserColumns(deps) as any;
    const { getByTestId, getByText } = render(
      cols[2].render!('', makeUser({ is_blacklisted: false, is_active: true })) as any
    );
    expect(getByTestId('status')).toHaveAttribute('data-tone', 'success');
    expect(getByText('启用')).toBeInTheDocument();
  });

  it('renders 状态 column: 禁用 when inactive & not blacklisted', () => {
    const cols = buildUserColumns(deps) as any;
    const { getByTestId, getByText } = render(
      cols[2].render!('', makeUser({ is_blacklisted: false, is_active: false })) as any
    );
    expect(getByTestId('status')).toHaveAttribute('data-tone', 'neutral');
    expect(getByText('禁用')).toBeInTheDocument();
  });

  it('renders 当前积分 column with AnimatedScore value', () => {
    const cols = buildUserColumns(deps) as any;
    const { getByTestId } = render(cols[3].render!('', makeUser({ current_score: 95 })) as any);
    expect(getByTestId('score').textContent).toBe('95');
  });

  it('sorter sorts by current_score', () => {
    const cols = buildUserColumns(deps) as any;
    const sorter = cols[3].sorter!;
    expect(sorter(makeUser({ current_score: 100 }), makeUser({ current_score: 80 }))).toBe(20);
    expect(sorter(makeUser({ current_score: 80 }), makeUser({ current_score: 100 }))).toBe(-20);
    expect(sorter(makeUser({ current_score: 50 }), makeUser({ current_score: null as any }))).toBe(
      50
    );
  });

  it('renders 操作 column buttons and wires handlers', () => {
    const cols = buildUserColumns(deps) as any;
    const user = makeUser();
    const { getByRole } = render(cols[4].render!('', user) as any);

    fireEvent.click(getByRole('button', { name: '评分' }));
    expect(deps.handleOpenQuickScore).toHaveBeenCalledWith(user);

    fireEvent.click(getByRole('button', { name: '编辑' }));
    expect(deps.handleOpenModal).toHaveBeenCalledWith(user);

    fireEvent.click(getByRole('button', { name: '删除' }));
    expect(deps.handleDelete).toHaveBeenCalledWith(1);

    // 启用态 -> 显示「禁用」按钮，点击切换
    const disableBtn = getByRole('button', { name: '禁用' });
    fireEvent.click(disableBtn);
    expect(deps.handleToggleActive).toHaveBeenCalledWith(user);
  });

  it('操作 column shows 启用 when user is inactive', () => {
    const cols = buildUserColumns(deps) as any;
    const user = makeUser({ is_active: false });
    const { getByRole } = render(cols[4].render!('', user) as any);
    expect(getByRole('button', { name: '启用' })).toBeInTheDocument();
    fireEvent.click(getByRole('button', { name: '启用' }));
    expect(deps.handleToggleActive).toHaveBeenCalledWith(user);
  });
});
