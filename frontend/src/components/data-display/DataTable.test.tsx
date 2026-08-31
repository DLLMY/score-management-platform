/// <reference types="jest" />
import { render, fireEvent, screen, within } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import DataTable from './DataTable';
import type { ColumnType } from './DataTable';

interface Row {
  id: number;
  name: string;
}

const columns: ColumnType<Row>[] = [
  { title: 'ID', key: 'id', dataIndex: 'id' },
  { title: '名称', key: 'name', dataIndex: 'name', sorter: true },
];

function makeData(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Item ${String.fromCharCode(65 + (i % 26))}${i}` }));
}

describe('DataTable', () => {
  test('loading 态渲染骨架屏且不渲染数据', () => {
    const { container } = render(<DataTable columns={columns} dataSource={makeData(5)} loading rowKey='id' />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    expect(screen.queryByText('Item A0')).toBeNull();
  });

  test('空数据态渲染 EmptyState', () => {
    render(<DataTable columns={columns} dataSource={[]} rowKey='id' />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  test('非受控分页：默认 20 条/页，可切到下一页', () => {
    const data = makeData(25);
    render(<DataTable columns={columns} dataSource={data} rowKey='id' />);
    expect(screen.getByText(/显示 1 - 20 条，共 25 条记录/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('下一页'));
    expect(screen.getByText(/显示 21 - 25 条，共 25 条记录/)).toBeInTheDocument();
  });

  test('内置排序：点击可排序列后升序排列', () => {
    const data: Row[] = [
      { id: 1, name: 'B' },
      { id: 2, name: 'A' },
      { id: 3, name: 'C' },
    ];
    const { container } = render(<DataTable columns={columns} dataSource={data} rowKey='id' />);
    fireEvent.click(screen.getByText('名称'));
    const firstRow = container.querySelectorAll('tbody tr')[0] as HTMLElement;
    expect(within(firstRow).getByText('A')).toBeInTheDocument();
  });

  test('受控分页：onPageChange 被调用且由父级提供数据', () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        dataSource={makeData(10)}
        rowKey='id'
        page={1}
        pageSize={10}
        total={100}
        onPageChange={onPageChange}
      />
    );
    fireEvent.click(screen.getByText('下一页'));
    expect(onPageChange).toHaveBeenCalledWith(2, 10);
  });

  test('大数据量自动切换虚拟滚动（无 <table>、显示虚拟滚动脚注）', () => {
    const { container } = render(<DataTable columns={columns} dataSource={makeData(250)} rowKey='id' />);
    expect(container.querySelector('table')).toBeNull();
    expect(screen.getByText(/共 250 条记录（虚拟滚动）/)).toBeInTheDocument();
  });

  test('rowActions 渲染操作列', () => {
    render(
      <DataTable
        columns={columns}
        dataSource={makeData(3)}
        rowKey='id'
        rowActions={() => <button>编辑</button>}
      />
    );
    expect(screen.getAllByText('编辑')).toHaveLength(3);
    expect(screen.getByText('操作')).toBeInTheDocument();
  });
});
