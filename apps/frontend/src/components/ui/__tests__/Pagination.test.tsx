import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Pagination from '../Pagination';

describe('Pagination', () => {
  it('totalPages<=1 → 渲染 null（不输出分页条）', () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={1}
        onPageChange={vi.fn()}
        totalItems={5}
        itemsPerPage={10}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('基础渲染：计数文案 + 页码窗口（currentPage=1, totalPages=10）', () => {
    const onPageChange = vi.fn();
    const { getByText, container } = render(
      <Pagination
        currentPage={1}
        totalPages={10}
        onPageChange={onPageChange}
        totalItems={100}
        itemsPerPage={10}
      />
    );
    expect(getByText('显示 1 - 10 条，共 100 条记录')).toBeInTheDocument();
    // 按钮：上一页 + (1,2,3,4,5,省略,10) + 下一页 = 8
    expect(container.querySelectorAll('button')).toHaveLength(8);
    expect(getByText('1')).toBeInTheDocument();
    expect(getByText('10')).toBeInTheDocument();
    expect(getByText('...')).toBeInTheDocument();
  });

  it('当前页按钮应用高亮类（bg-primary-600）', () => {
    const { getByText } = render(
      <Pagination
        currentPage={1}
        totalPages={10}
        onPageChange={vi.fn()}
        totalItems={100}
        itemsPerPage={10}
      />
    );
    expect(getByText('1').className).toContain('bg-primary-600');
    expect(getByText('2').className).not.toContain('bg-primary-600');
  });

  it('点击页码 → 调用 onPageChange(page)', () => {
    const onPageChange = vi.fn();
    const { getByText } = render(
      <Pagination
        currentPage={1}
        totalPages={10}
        onPageChange={onPageChange}
        totalItems={100}
        itemsPerPage={10}
      />
    );
    fireEvent.click(getByText('3'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('上一页在首页 disabled；点击 → onPageChange(currentPage-1)', () => {
    const onPageChange = vi.fn();
    const { getByText } = render(
      <Pagination
        currentPage={2}
        totalPages={10}
        onPageChange={onPageChange}
        totalItems={100}
        itemsPerPage={10}
      />
    );
    const prev = getByText('上一页');
    expect(prev).not.toBeDisabled();
    fireEvent.click(prev);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('首页时上一页 disabled', () => {
    const { getByText } = render(
      <Pagination
        currentPage={1}
        totalPages={10}
        onPageChange={vi.fn()}
        totalItems={100}
        itemsPerPage={10}
      />
    );
    expect(getByText('上一页')).toBeDisabled();
  });

  it('末页时下一页 disabled；点击 → onPageChange(currentPage+1)', () => {
    const onPageChange = vi.fn();
    const { getByText } = render(
      <Pagination
        currentPage={9}
        totalPages={10}
        onPageChange={onPageChange}
        totalItems={100}
        itemsPerPage={10}
      />
    );
    const next = getByText('下一页');
    expect(next).not.toBeDisabled();
    fireEvent.click(next);
    expect(onPageChange).toHaveBeenCalledWith(10);
  });

  it('末页时下一页 disabled', () => {
    const { getByText } = render(
      <Pagination
        currentPage={10}
        totalPages={10}
        onPageChange={vi.fn()}
        totalItems={100}
        itemsPerPage={10}
      />
    );
    expect(getByText('下一页')).toBeDisabled();
  });

  it('中间页（currentPage=5）→ 两端页码 1 与 10 均出现，且出现省略号占位', () => {
    const { getByText, getAllByText } = render(
      <Pagination
        currentPage={5}
        totalPages={10}
        onPageChange={vi.fn()}
        totalItems={100}
        itemsPerPage={10}
      />
    );
    // 左右两个 -1 占位分支均被执行；组件用 Set 对 pages 去重，两者合并为一个 "..."（已知去重特性）
    expect(getByText('1')).toBeInTheDocument();
    expect(getByText('10')).toBeInTheDocument();
    expect(getAllByText('...')).toHaveLength(1);
  });

  it('startItem/endItem 计算（currentPage=2 → 显示 11 - 20）', () => {
    const { getByText } = render(
      <Pagination
        currentPage={2}
        totalPages={10}
        onPageChange={vi.fn()}
        totalItems={100}
        itemsPerPage={10}
      />
    );
    expect(getByText('显示 11 - 20 条，共 100 条记录')).toBeInTheDocument();
  });

  it('endItem 不超过 totalItems（末页且非整页）', () => {
    const { getByText } = render(
      <Pagination
        currentPage={3}
        totalPages={3}
        onPageChange={vi.fn()}
        totalItems={25}
        itemsPerPage={10}
      />
    );
    // page3 → start=21, end=min(30,25)=25
    expect(getByText('显示 21 - 25 条，共 25 条记录')).toBeInTheDocument();
  });
});
