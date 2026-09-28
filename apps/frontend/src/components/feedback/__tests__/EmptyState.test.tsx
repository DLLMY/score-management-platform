import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EmptyState, { SearchEmptyState, ErrorState } from '../EmptyState';

describe('EmptyState', () => {
  it('默认渲染：标题/描述/兜底 folder 图标（不抛错）', () => {
    const { getByText, container } = render(<EmptyState />);
    expect(getByText('暂无数据')).toBeInTheDocument();
    expect(getByText('这里还没有任何内容')).toBeInTheDocument();
    expect(container.firstChild).toBeTruthy();
  });

  it('自定义 icon / title / description', () => {
    const { getByText } = render(
      <EmptyState icon='users' title='还没有学生' description='请先导入学生名单' />
    );
    expect(getByText('还没有学生')).toBeInTheDocument();
    expect(getByText('请先导入学生名单')).toBeInTheDocument();
  });

  it('未知 icon → 回退到默认 FolderOpen（不抛错）', () => {
    const { container } = render(<EmptyState icon={'nope' as unknown as 'users'} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('actionLabel + onAction → 渲染主按钮，点击触发回调', () => {
    const onAction = vi.fn();
    const { getByRole } = render(<EmptyState actionLabel='新建' onAction={onAction} />);
    const btn = getByRole('button', { name: '新建' });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('仅有 actionLabel 无 onAction → 主按钮不渲染', () => {
    const { queryByRole } = render(<EmptyState actionLabel='新建' onAction={null} />);
    expect(queryByRole('button', { name: '新建' })).toBeNull();
  });

  it('仅有 onAction 无 actionLabel → 主按钮不渲染', () => {
    const { queryByRole } = render(<EmptyState actionLabel={null} onAction={vi.fn()} />);
    expect(queryByRole('button', { name: '新建' })).toBeNull();
  });

  it('secondActionLabel + onSecondAction → 渲染次按钮，点击触发回调', () => {
    const onSecond = vi.fn();
    const { getByRole } = render(<EmptyState secondActionLabel='导入' onSecondAction={onSecond} />);
    const btn = getByRole('button', { name: '导入' });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onSecond).toHaveBeenCalledTimes(1);
  });

  it('className 透传到根容器', () => {
    const { container } = render(<EmptyState className='my-empty' />);
    expect(container.firstElementChild?.className).toContain('my-empty');
  });
});

describe('SearchEmptyState', () => {
  it('默认渲染：未找到相关结果 + 空搜索词', () => {
    const { getByText } = render(<SearchEmptyState />);
    expect(getByText('未找到相关结果')).toBeInTheDocument();
    expect(
      getByText((_, el) => el?.textContent === '没有找到与 "" 相关的内容')
    ).toBeInTheDocument();
  });

  it('自定义 searchTerm → 显示在提示文案中', () => {
    const term = '张三';
    const { getByText } = render(<SearchEmptyState searchTerm={term} />);
    expect(getByText(term)).toBeInTheDocument();
    expect(
      getByText((_, el) => el?.textContent === `没有找到与 "${term}" 相关的内容`)
    ).toBeInTheDocument();
  });

  it('onClearSearch → 渲染“清除搜索”按钮，点击触发回调', () => {
    const onClear = vi.fn();
    const { getByRole } = render(<SearchEmptyState onClearSearch={onClear} />);
    const btn = getByRole('button', { name: '清除搜索' });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('无 onClearSearch → 不渲染“清除搜索”按钮', () => {
    const { queryByRole } = render(<SearchEmptyState onClearSearch={null} />);
    expect(queryByRole('button', { name: '清除搜索' })).toBeNull();
  });
});

describe('ErrorState', () => {
  it('默认渲染：加载失败 + 提示文案', () => {
    const { getByText } = render(<ErrorState />);
    expect(getByText('加载失败')).toBeInTheDocument();
    expect(getByText('请稍后重试，或联系管理员获取帮助')).toBeInTheDocument();
  });

  it('自定义 message', () => {
    const { getByText } = render(<ErrorState message='网络异常' />);
    expect(getByText('网络异常')).toBeInTheDocument();
  });

  it('onRetry → 渲染“重新加载”按钮，点击触发回调', () => {
    const onRetry = vi.fn();
    const { getByRole } = render(<ErrorState onRetry={onRetry} />);
    const btn = getByRole('button', { name: '重新加载' });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('无 onRetry → 不渲染“重新加载”按钮', () => {
    const { queryByRole } = render(<ErrorState onRetry={null} />);
    expect(queryByRole('button', { name: '重新加载' })).toBeNull();
  });
});
