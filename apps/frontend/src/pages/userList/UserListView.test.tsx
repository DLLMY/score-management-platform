import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { User } from '../../types';
import type { ColumnType } from '../../components';
import type { UserListState } from './useUserListLogic';
import type { Rule } from './types';
import UserListView from './UserListView';

// 用轻量桩替换重型展示组件，隔离 UserListView 自身分支逻辑。
vi.mock(
  '../../components',
  () =>
    ({
      Modal: ({ isOpen, onClose, title, children }: any) =>
        isOpen ? (
          <div data-testid='modal' data-title={title as string}>
            {children}
            <button data-testid='modal-close' onClick={onClose} type='button'>
              close
            </button>
          </div>
        ) : null,
      SearchFilter: ({ value, onChange, placeholder }: any) => (
        <input
          data-testid='search-filter'
          value={value as string}
          placeholder={placeholder as string}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
      ImportExportPanel: ({ type, onImportComplete }: any) => (
        <div data-testid='import-export-panel' data-type={type as string}>
          <button data-testid='import-complete' onClick={() => onImportComplete?.()} type='button'>
            complete
          </button>
        </div>
      ),
      PermissionButton: ({ permission, onClick, children }: any) => (
        <button
          data-testid='permission-button'
          data-permission={permission as string}
          onClick={onClick}
        >
          {children}
        </button>
      ),
      BatchActionBar: ({ selectedItems, selectedIds, onClearSelection, actions }: any) => (
        <div
          data-testid='batch-action-bar'
          data-count={selectedItems?.length}
          data-ids={[...selectedIds].join(',')}
        >
          {actions?.map((a: any) => (
            <button key={a.id} data-testid={`batch-${a.id}`} onClick={a.handler} type='button'>
              {a.label}
            </button>
          ))}
          <button data-testid='batch-clear' onClick={onClearSelection} type='button'>
            clear
          </button>
        </div>
      ),
      AdvancedSearch: ({ fields, onSearch, onReset }: any) => (
        <div data-testid='advanced-search'>
          {fields?.map((f: any) => (
            <div key={f.id} data-field={f.id}>
              {f.label}
            </div>
          ))}
          <button data-testid='adv-search' onClick={onSearch} type='button'>
            search
          </button>
          <button data-testid='adv-reset' onClick={onReset} type='button'>
            reset
          </button>
        </div>
      ),
      DataTable: ({ dataSource, loading, error, empty }: any) => (
        <div data-testid='data-table' data-loading={loading ? '1' : '0'}>
          {error ? <div data-testid='table-error'>{error.message}</div> : null}
          {empty ? (
            <button data-testid='empty-action' onClick={empty.onAction} type='button'>
              {empty.actionLabel}
            </button>
          ) : null}
          {dataSource?.map((u: any) => (
            <div key={u.id} data-testid='table-row'>
              {u.name}
            </div>
          ))}
        </div>
      ),
      Button: ({ variant, onClick, disabled, children }: any) => (
        <button
          data-testid='button'
          data-variant={variant as string}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </button>
      ),
      ToggleSwitch: ({ checked, onChange }: any) => (
        <button
          data-testid='toggle-switch'
          data-checked={checked ? '1' : '0'}
          onClick={() => onChange?.(!checked)}
          type='button'
        >
          toggle
        </button>
      ),
    } as any)
);

const mockUser: User = {
  id: 1,
  name: '张三',
  card_id: 'C001',
  current_score: 80,
  is_blacklisted: false,
  daily_unlock_limit: 5,
  today_unlock_count: 0,
  is_active: true,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  class_name: '一班',
  gender: '男',
};

const mockRules: Rule[] = [
  { id: 1, name: '纪律好', score: 5, is_active: true, description: '加分' },
  { id: 2, name: '迟到', score: -3, is_active: true, description: '减分' },
];

function makeState(overrides: Partial<UserListState> = {}): UserListState {
  return {
    users: [],
    rules: [],
    rankRules: [],
    searchTerm: '',
    selectedClass: '',
    showModal: false,
    editingUser: null,
    isLoading: true,
    isFetching: false,
    error: null,
    selectedUsers: new Set<number>(),
    showBatchModal: false,
    batchScoreChange: 0,
    showImportModal: false,
    importing: false,
    showQuickScoreModal: false,
    quickScoreUser: null,
    scoreTab: 'add',
    pagination: { page: 1, per_page: 20, total: 0, pages: 1 },
    formData: {
      name: '',
      gender: '男',
      class_name: '',
      phone: '',
      parent_info: '',
      father_name: '',
      father_phone: '',
      mother_name: '',
      mother_phone: '',
      guardian_name: '',
      guardian_phone: '',
      guardian_relation: '',
      card_id: '',
      current_score: 60,
    },
    showAdvancedSearch: false,
    advancedConditions: {},
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeProps(state: UserListState, overrides: Record<string, any> = {}) {
  return {
    state,
    dispatch: vi.fn(),
    classes: ['一班', '二班'],
    classList: [{ id: 1, name: '一班' }],
    formErrors: {},
    selectedUsersArray: [] as number[],
    selectedUsersData: [] as User[],
    userColumns: [] as ColumnType<User>[],
    autoSaveHasUnsaved: false,
    handleSearch: vi.fn(),
    handleClassChange: vi.fn(),
    handleAdvancedSearch: vi.fn(),
    handlePageChange: vi.fn(),
    handleOpenModal: vi.fn(),
    handleCloseModal: vi.fn(),
    handleSubmit: vi.fn(),
    handleToggleActive: vi.fn(),
    handleQuickScore: vi.fn(),
    handleExport: vi.fn(),
    handleClearSelection: vi.fn(),
    handleSelectionChange: vi.fn(),
    handleBatchDelete: vi.fn(async () => {}),
    handleBatchScore: vi.fn(async () => {}),
    handleClearFilters: vi.fn(),
    handleRetry: vi.fn(),
    fetchUsers: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('UserListView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染标题与权限按钮', () => {
    render(<UserListView {...makeProps(makeState())} />);
    expect(screen.getByText('学生管理')).toBeTruthy();
    expect(screen.getByText('导入学生')).toBeTruthy();
    expect(screen.getByText('导出学生')).toBeTruthy();
    expect(screen.getByText('添加学生')).toBeTruthy();
  });

  it('展开高级筛选后渲染 AdvancedSearch 字段', () => {
    const dispatch = vi.fn();
    render(<UserListView {...makeProps(makeState({ showAdvancedSearch: true }), { dispatch })} />);
    expect(screen.getByTestId('advanced-search')).toBeTruthy();
    expect(screen.getByText('关键词')).toBeTruthy();
    expect(screen.getByText('最低积分')).toBeTruthy();
    // 已展开时点击 -> dispatch 切换为 false
    fireEvent.click(screen.getByText('高级筛选'));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_SHOW_ADVANCED_SEARCH',
      payload: false,
    });
  });

  it('点击高级筛选按钮派发 SET_SHOW_ADVANCED_SEARCH', () => {
    const dispatch = vi.fn();
    render(<UserListView {...makeProps(makeState(), { dispatch })} />);
    fireEvent.click(screen.getByText('高级筛选'));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_SHOW_ADVANCED_SEARCH',
      payload: true,
    });
  });

  it('班级筛选 select 变更调用 handleClassChange', () => {
    const handleClassChange = vi.fn();
    render(<UserListView {...makeProps(makeState(), { handleClassChange })} />);
    const select = screen.getByDisplayValue('全部班级');
    fireEvent.change(select, { target: { value: '1' } });
    expect(handleClassChange).toHaveBeenCalledWith('1');
  });

  it('搜索框变更调用 handleSearch', () => {
    const handleSearch = vi.fn();
    render(<UserListView {...makeProps(makeState(), { handleSearch })} />);
    const input = screen.getByTestId('search-filter');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(handleSearch).toHaveBeenCalledWith('abc');
  });

  it('AdvancedSearch onSearch/onReset 调用对应 handler', () => {
    const dispatch = vi.fn();
    const handleAdvancedSearch = vi.fn();
    render(
      <UserListView
        {...makeProps(makeState({ showAdvancedSearch: true }), { dispatch, handleAdvancedSearch })}
      />
    );
    fireEvent.click(screen.getByTestId('adv-search'));
    expect(handleAdvancedSearch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('adv-reset'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ADVANCED_CONDITIONS', payload: {} });
    expect(handleAdvancedSearch).toHaveBeenCalledTimes(2);
  });

  it('选中用户时渲染 BatchActionBar 且各动作调用对应 handler', () => {
    const dispatch = vi.fn();
    const handleBatchDelete = vi.fn(async () => {});
    const handleBatchScore = vi.fn(async () => {});
    const handleClearSelection = vi.fn();
    render(
      <UserListView
        {...makeProps(makeState(), {
          dispatch,
          selectedUsersArray: [1, 2],
          selectedUsersData: [mockUser],
          handleBatchDelete,
          handleBatchScore,
          handleClearSelection,
        })}
      />
    );
    expect(screen.getByTestId('batch-action-bar')).toBeTruthy();
    fireEvent.click(screen.getByTestId('batch-batch-delete'));
    expect(handleBatchDelete).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('batch-batch-add-score'));
    expect(handleBatchScore).toHaveBeenCalledWith(5);
    fireEvent.click(screen.getByTestId('batch-batch-subtract-score'));
    expect(handleBatchScore).toHaveBeenCalledWith(-5);
    fireEvent.click(screen.getByTestId('batch-clear'));
    expect(handleClearSelection).toHaveBeenCalledTimes(1);
  });

  it('DataTable 错误分支渲染错误信息', () => {
    render(<UserListView {...makeProps(makeState({ error: '加载失败' }))} />);
    expect(screen.getByTestId('table-error').textContent).toBe('加载失败');
  });

  it('empty onAction 调用 handleClearFilters', () => {
    const handleClearFilters = vi.fn();
    render(<UserListView {...makeProps(makeState(), { handleClearFilters })} />);
    fireEvent.click(screen.getByTestId('empty-action'));
    expect(handleClearFilters).toHaveBeenCalledTimes(1);
  });

  it('添加弹窗：渲染表单、提交、取消、formErrors、自动保存提示', () => {
    const dispatch = vi.fn();
    const handleSubmit = vi.fn();
    const handleCloseModal = vi.fn();
    const { container } = render(
      <UserListView
        {...makeProps(makeState({ showModal: true }), {
          dispatch,
          handleSubmit,
          handleCloseModal,
          autoSaveHasUnsaved: true,
          formErrors: { name: '姓名必填', class_name: '班级必填', card_id: '卡号必填' },
        })}
      />
    );
    const modal = screen.getByTestId('modal');
    expect(modal.getAttribute('data-title')).toBe('添加学生');
    expect(screen.getByText('有未保存的更改，自动保存中...')).toBeTruthy();
    expect(screen.getByText('姓名必填')).toBeTruthy();
    expect(screen.getByText('班级必填')).toBeTruthy();
    expect(screen.getByText('卡号必填')).toBeTruthy();
    // 表单输入变更 -> dispatch SET_FORM_DATA
    const nameInput = screen.getByPlaceholderText('请输入学生姓名');
    fireEvent.change(nameInput, { target: { value: '李四' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_FORM_DATA', payload: { name: '李四' } });
    // 提交
    fireEvent.submit(container.querySelector('form')!);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
    // 取消
    fireEvent.click(screen.getByText('取消'));
    expect(handleCloseModal).toHaveBeenCalledTimes(1);
  });

  it('编辑弹窗：标题/按钮文案切换、ToggleSwitch 分支、账号状态文案', () => {
    const dispatch = vi.fn();
    const handleToggleActive = vi.fn();
    const editing: User = { ...mockUser, is_active: true };
    render(
      <UserListView
        {...makeProps(makeState({ showModal: true, editingUser: editing }), {
          dispatch,
          handleToggleActive,
        })}
      />
    );
    expect(screen.getByTestId('modal').getAttribute('data-title')).toBe('编辑学生');
    expect(screen.getByText('更新')).toBeTruthy();
    expect(screen.getByText('当前已启用，可正常使用')).toBeTruthy();
    expect(screen.getByText('启用')).toBeTruthy();
    fireEvent.click(screen.getByTestId('toggle-switch'));
    expect(handleToggleActive).toHaveBeenCalledWith(editing);
  });

  it('编辑弹窗且账号禁用时渲染禁用文案', () => {
    const editing: User = { ...mockUser, is_active: false };
    render(<UserListView {...makeProps(makeState({ showModal: true, editingUser: editing }))} />);
    expect(screen.getByText('当前已禁用，无法使用开锁等功能')).toBeTruthy();
    expect(screen.getByText('禁用')).toBeTruthy();
  });

  it('导入弹窗：渲染 ImportExportPanel，完成回调调用 fetchUsers + dispatch', () => {
    const dispatch = vi.fn();
    const fetchUsers = vi.fn(async () => {});
    render(
      <UserListView
        {...makeProps(makeState({ showImportModal: true }), { dispatch, fetchUsers })}
      />
    );
    expect(screen.getByTestId('import-export-panel').getAttribute('data-type')).toBe('user');
    fireEvent.click(screen.getByTestId('import-complete'));
    expect(fetchUsers).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_SHOW_IMPORT_MODAL', payload: false });
  });

  it('导入权限按钮点击派发 SET_SHOW_IMPORT_MODAL', () => {
    const dispatch = vi.fn();
    render(<UserListView {...makeProps(makeState(), { dispatch })} />);
    const importBtn = screen
      .getAllByTestId('permission-button')
      .find(
        (b) => b.getAttribute('data-permission') === 'student.edit' && b.textContent === '导入学生'
      );
    fireEvent.click(importBtn!);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_SHOW_IMPORT_MODAL', payload: true });
  });

  it('导出/添加权限按钮调用对应 handler', () => {
    const handleExport = vi.fn();
    const handleOpenModal = vi.fn();
    render(<UserListView {...makeProps(makeState(), { handleExport, handleOpenModal })} />);
    const exportBtn = screen
      .getAllByTestId('permission-button')
      .find((b) => b.textContent === '导出学生');
    fireEvent.click(exportBtn!);
    expect(handleExport).toHaveBeenCalledTimes(1);
    const addBtn = screen
      .getAllByTestId('permission-button')
      .find((b) => b.textContent === '添加学生');
    fireEvent.click(addBtn!);
    expect(handleOpenModal).toHaveBeenCalledTimes(1);
  });

  it('快速评分弹窗：渲染规则按钮，点击调用 handleQuickScore', () => {
    const dispatch = vi.fn();
    const handleQuickScore = vi.fn();
    render(
      <UserListView
        {...makeProps(
          makeState({ showQuickScoreModal: true, quickScoreUser: mockUser, rules: mockRules }),
          { dispatch, handleQuickScore }
        )}
      />
    );
    expect(screen.getByText('纪律好')).toBeTruthy();
    expect(screen.getByText('迟到')).toBeTruthy();
    // 加分规则（+5）与减分规则（-3）两个分支
    const addRule = screen.getByText('纪律好').closest('button')!;
    const subRule = screen.getByText('迟到').closest('button')!;
    fireEvent.click(addRule);
    expect(handleQuickScore).toHaveBeenCalledWith(mockRules[0]);
    fireEvent.click(subRule);
    expect(handleQuickScore).toHaveBeenCalledWith(mockRules[1]);
    // 关闭弹窗派发两次 dispatch
    fireEvent.click(screen.getByTestId('modal-close'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_SHOW_QUICK_SCORE_MODAL', payload: false });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_QUICK_SCORE_USER', payload: null });
  });

  it('快速评分弹窗开启但无用户时不渲染规则块', () => {
    render(
      <UserListView
        {...makeProps(makeState({ showQuickScoreModal: true, quickScoreUser: null }))}
      />
    );
    expect(screen.queryByText('纪律好')).toBeNull();
  });
});
