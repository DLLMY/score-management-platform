import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdvancedSearchFilter from '../AdvancedSearchFilter';
import type { SearchCondition, SavedSearch } from '../AdvancedSearchFilter';

function baseProps(overrides: Record<string, unknown> = {}) {
  const savedSearches: SavedSearch[] = [
    { id: '1', name: 's1', conditions: {}, createdAt: '2024-01-01' },
  ];
  return {
    conditions: {} as SearchCondition,
    onChange: vi.fn(),
    onSearch: vi.fn(),
    savedSearches,
    onSaveSearch: vi.fn(),
    onDeleteSearch: vi.fn(),
    showDateRange: true,
    showStatus: true,
    statusOptions: [{ label: '活跃', value: 'active' }],
    showCategory: true,
    categoryOptions: [{ label: 'c', value: 'cv' }],
    showClass: true,
    classOptions: [{ label: 'cls', value: 'cl' }],
    showScoreRange: true,
    showSort: true,
    ...overrides,
  };
}

describe('AdvancedSearchFilter', () => {
  it('关键字输入 + 回车触发 onSearch（handleChange/handleSearch）', () => {
    const props = baseProps();
    const { container } = render(<AdvancedSearchFilter {...props} />);
    const input = screen.getByPlaceholderText('搜索...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'abc' }));
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onSearch).toHaveBeenCalled();
    expect(container).toBeTruthy();
  });

  it('展开后选择 状态/分类/班级/排序 并重置（getSortCondition/handleReset）', () => {
    const props = baseProps();
    render(<AdvancedSearchFilter {...props} />);
    fireEvent.click(screen.getByText('筛选'));

    const combos = screen.getAllByRole('combobox') as HTMLSelectElement[];
    expect(combos.length).toBe(4); // status, category, class, sort
    fireEvent.change(combos[0], { target: { value: 'active' } });
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
    fireEvent.change(combos[1], { target: { value: 'cv' } });
    fireEvent.change(combos[2], { target: { value: 'cl' } });
    fireEvent.change(combos[3], { target: { value: 'score_asc' } });
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'score', sortOrder: 'asc' })
    );

    // 积分范围输入（handleChange 分支）
    const numbers = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    fireEvent.change(numbers[0], { target: { value: '10' } });
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ minScore: 10 }));

    fireEvent.click(screen.getByText('重置条件'));
    expect(props.onChange).toHaveBeenCalledWith({});
    expect(props.onSearch).toHaveBeenCalled();
  });

  it('保存搜索流程（handleSave）', () => {
    const props = baseProps();
    const { container } = render(<AdvancedSearchFilter {...props} />);
    const topBar = container.querySelector('.flex.items-center.gap-2') as HTMLElement;
    const savedToggle = topBar.querySelectorAll('button')[2];
    fireEvent.click(savedToggle); // 打开已存下拉
    fireEvent.click(screen.getByText('保存当前筛选条件')); // 打开模态
    const nameInput = screen.getByPlaceholderText('输入搜索名称') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'mySearch' } });
    fireEvent.click(screen.getByText('保存')); // 模态内保存按钮（精确文本）
    expect(props.onSaveSearch).toHaveBeenCalledWith('mySearch', expect.anything());
  });

  it('加载/删除已存搜索（handleLoadSearch/handleDeleteSearch）', () => {
    const props = baseProps();
    const { container } = render(<AdvancedSearchFilter {...props} />);
    const topBar = container.querySelector('.flex.items-center.gap-2') as HTMLElement;
    const savedToggle = topBar.querySelectorAll('button')[2];
    fireEvent.click(savedToggle);
    fireEvent.click(screen.getByText('s1')); // 加载
    expect(props.onChange).toHaveBeenCalledWith({});
    expect(props.onSearch).toHaveBeenCalled();

    fireEvent.click(savedToggle); // 重新打开
    const nameDiv = screen.getByText('s1');
    const loadButton = nameDiv.closest('button') as HTMLElement; // 加载按钮（s1 文本在其内部 div）
    const itemContainer = loadButton.parentElement as HTMLElement; // 项容器 div
    const delBtn = itemContainer.querySelectorAll('button')[1]; // [0]=加载, [1]=删除
    fireEvent.click(delBtn);
    expect(props.onDeleteSearch).toHaveBeenCalledWith('1');
  });

  it('点击组件外部关闭已存下拉（handleClickOutside）', () => {
    const props = baseProps();
    const { container } = render(<AdvancedSearchFilter {...props} />);
    const topBar = container.querySelector('.flex.items-center.gap-2') as HTMLElement;
    const savedToggle = topBar.querySelectorAll('button')[2];
    fireEvent.click(savedToggle);
    expect(screen.getByText('s1')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('s1')).not.toBeInTheDocument();
  });
});
