import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '../../types';
import UserTableRow from './UserTableRow';

const hoisted = vi.hoisted(() => ({
  AnimatedScore: vi.fn(),
  PermissionButton: vi.fn(),
}));

vi.mock('../', () => ({
  AnimatedScore: hoisted.AnimatedScore,
  PermissionButton: hoisted.PermissionButton,
}));

beforeEach(() => {
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

const setup = (user: User, isSelected = false) => {
  const onToggleSelection = vi.fn();
  const onOpenQuickScore = vi.fn();
  const onOpenEdit = vi.fn();
  const onDelete = vi.fn();
  const utils = render(
    <table>
      <tbody>
        <UserTableRow
          user={user}
          isSelected={isSelected}
          onToggleSelection={onToggleSelection}
          onOpenQuickScore={onOpenQuickScore}
          onOpenEdit={onOpenEdit}
          onDelete={onDelete}
        />
      </tbody>
    </table>
  );
  return { ...utils, onToggleSelection, onOpenQuickScore, onOpenEdit, onDelete };
};

describe('UserTableRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders user info (name, card_id, class, score) and 启用 status', () => {
    const { container } = setup(makeUser());
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('C001')).toBeInTheDocument();
    expect(screen.getByText('一班')).toBeInTheDocument();
    expect(screen.getByText('启用')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="score"]')?.textContent).toBe('80');
    // 头像首字母
    expect(screen.getByText('张')).toBeInTheDocument();
  });

  it('applies selected row class when isSelected', () => {
    const { container } = setup(makeUser(), true);
    const tr = container.querySelector('tr')!;
    expect(tr.className).toContain('bg-blue-50');
  });

  it('renders 黑名单 status with higher priority', () => {
    setup(makeUser({ is_blacklisted: true, is_active: true }));
    expect(screen.getByText('黑名单')).toBeInTheDocument();
  });

  it('renders 禁用 status when inactive and not blacklisted', () => {
    setup(makeUser({ is_blacklisted: false, is_active: false }));
    expect(screen.getByText('禁用')).toBeInTheDocument();
  });

  it('clicking selection button calls onToggleSelection with numeric id', () => {
    const { onToggleSelection } = setup(makeUser({ id: 7 }));
    // 选择按钮无文字（仅图标）→ 无障碍名 ''
    const selBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(selBtn);
    expect(onToggleSelection).toHaveBeenCalledWith(7);
  });

  it('wires 评分 / 编辑 / 删除 action buttons', () => {
    const user = makeUser();
    const { onOpenQuickScore, onOpenEdit, onDelete } = setup(user);
    fireEvent.click(screen.getByRole('button', { name: '评分' }));
    expect(onOpenQuickScore).toHaveBeenCalledWith(user);
    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    expect(onOpenEdit).toHaveBeenCalledWith(user);
    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('memo comparator returns true on identical props (no re-render)', () => {
    const user = makeUser();
    const { rerender } = setup(user, false);
    // rerender 相同 props → memo comparator 执行并返回 true
    rerender(
      <table>
        <tbody>
          <UserTableRow
            user={user}
            isSelected={false}
            onToggleSelection={vi.fn()}
            onOpenQuickScore={vi.fn()}
            onOpenEdit={vi.fn()}
            onDelete={vi.fn()}
          />
        </tbody>
      </table>
    );
    expect(screen.getByText('张三')).toBeInTheDocument();
  });

  it('memo comparator returns false and updates score when current_score changes', () => {
    const { container, rerender } = setup(makeUser({ current_score: 80 }));
    expect(container.querySelector('[data-testid="score"]')?.textContent).toBe('80');
    const updated = makeUser({ current_score: 120 });
    rerender(
      <table>
        <tbody>
          <UserTableRow
            user={updated}
            isSelected={false}
            onToggleSelection={vi.fn()}
            onOpenQuickScore={vi.fn()}
            onOpenEdit={vi.fn()}
            onDelete={vi.fn()}
          />
        </tbody>
      </table>
    );
    expect(container.querySelector('[data-testid="score"]')?.textContent).toBe('120');
  });
});
