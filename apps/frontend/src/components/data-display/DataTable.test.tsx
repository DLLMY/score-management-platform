import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DataTable from './DataTable';
import type { ColumnType } from './DataTable';

interface Row {
  id: number;
  name: string;
  score?: number;
  note?: string;
}

const baseColumns: ColumnType<Row>[] = [
  { title: 'ID', key: 'id', dataIndex: 'id' },
  { title: '名称', key: 'name', dataIndex: 'name', sorter: true },
  {
    title: '备注',
    key: 'note',
    dataIndex: 'note',
    render: (v) => (v == null ? <span>无</span> : <span>{String(v)}</span>),
  },
];

const makeData = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Item ${String.fromCharCode(65 + (i % 26))}${i}`,
    score: (i * 7) % 100,
  }));

const getNames = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('tbody tr')).map(
    (tr) => tr.querySelectorAll('td')[1]?.textContent ?? ''
  );

describe('DataTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loading 态渲染骨架屏且不渲染数据', () => {
    const { container } = render(
      <DataTable columns={baseColumns} dataSource={makeData(5)} loading rowKey='id' />
    );
    expect(screen.queryByText('Item A0')).toBeNull();
    expect(container.querySelectorAll('thead th').length).toBe(0);
  });

  it('空数据态渲染 EmptyState', () => {
    render(<DataTable columns={baseColumns} dataSource={[]} rowKey='id' />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('自定义 empty 文案与 action', () => {
    const onAction = vi.fn();
    render(
      <DataTable
        columns={baseColumns}
        dataSource={[]}
        rowKey='id'
        empty={{ title: '查无结果', description: '换个条件', actionLabel: '刷新', onAction }}
      />
    );
    expect(screen.getByText('查无结果')).toBeInTheDocument();
    fireEvent.click(screen.getByText('刷新'));
    expect(onAction).toHaveBeenCalled();
  });

  it('error 态显示错误文案与重试', () => {
    const onRetry = vi.fn();
    render(
      <DataTable
        columns={baseColumns}
        dataSource={makeData(3)}
        rowKey='id'
        error={{ message: '加载失败啦', onRetry }}
      />
    );
    expect(screen.getByText('加载失败啦')).toBeInTheDocument();
    fireEvent.click(screen.getByText('重新加载'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('render 列：note 为 null 渲染「无」，有值渲染原值', () => {
    const data: Row[] = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b', note: '迟到' },
    ];
    render(<DataTable columns={baseColumns} dataSource={data} rowKey='id' />);
    expect(screen.getAllByText('无')).toHaveLength(1);
    expect(screen.getByText('迟到')).toBeInTheDocument();
  });

  it('普通列值 value==null 渲染空字符串', () => {
    const cols: ColumnType<Row>[] = [
      { title: '名称', key: 'name', dataIndex: 'name' },
      { title: '备注', key: 'note', dataIndex: 'note' },
    ];
    render(<DataTable columns={cols} dataSource={[{ id: 1, name: 'a' }]} rowKey='id' />);
    const td = screen.getByText('a').closest('tr')!.querySelectorAll('td')[1];
    expect(td.textContent).toBe('');
  });

  it('非受控分页：默认 20 条/页，可切到下一页', () => {
    const data = makeData(25);
    const { container } = render(<DataTable columns={baseColumns} dataSource={data} rowKey='id' />);
    expect(screen.getByText(/显示 1 - 20 条，共 25 条记录/)).toBeInTheDocument();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(20);
    fireEvent.click(screen.getByText('下一页'));
    expect(screen.getByText(/显示 21 - 25 条，共 25 条记录/)).toBeInTheDocument();
  });

  it('受控分页：onPageChange 被调用且由父级提供数据', () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={baseColumns}
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

  it('每页条数选择触发 handleSizeChange 并 clamp 上下限', () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={baseColumns}
        dataSource={makeData(25)}
        rowKey='id'
        pageSize={10}
        total={100}
        pageSizeOptions={[10, 50, 100, 500]}
        onPageChange={onPageChange}
      />
    );
    const select = screen.getByDisplayValue('10') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '500' } });
    expect(onPageChange).toHaveBeenCalledWith(1, 200); // MAX_PAGE_SIZE
  });

  it('内置排序：点击可排序列后升序排列', () => {
    const data: Row[] = [
      { id: 1, name: 'B' },
      { id: 2, name: 'A' },
      { id: 3, name: 'C' },
    ];
    const { container } = render(<DataTable columns={baseColumns} dataSource={data} rowKey='id' />);
    fireEvent.click(screen.getByText('名称'));
    expect(getNames(container)).toEqual(['A', 'B', 'C']);
  });

  it('非受控排序循环 ascend→descend→null', () => {
    const data: Row[] = [
      { id: 1, name: 'b', score: 30 },
      { id: 2, name: 'a', score: 10 },
      { id: 3, name: 'c', score: 20 },
    ];
    const { container } = render(<DataTable columns={baseColumns} dataSource={data} rowKey='id' />);
    const header = screen.getByText('名称');
    fireEvent.click(header);
    expect(getNames(container)).toEqual(['a', 'b', 'c']); // 升序：a<b<c
    fireEvent.click(header);
    expect(getNames(container)).toEqual(['c', 'b', 'a']); // 降序
    fireEvent.click(header);
    // 第三次：sortOrder=null 但 sortFieldEff 仍 name，源逻辑视为升序，回到 a,b,c
    expect(getNames(container)).toEqual(['a', 'b', 'c']);
  });

  it('受控排序：点击表头触发 onSortChange', () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={baseColumns}
        dataSource={makeData(3)}
        rowKey='id'
        sortField=''
        sortOrder={null}
        onSortChange={onSortChange}
      />
    );
    fireEvent.click(screen.getByText('名称'));
    expect(onSortChange).toHaveBeenCalledWith('name', 'ascend');
  });

  it('aria-sort 随排序状态变化', () => {
    render(<DataTable columns={baseColumns} dataSource={makeData(3)} rowKey='id' />);
    const th = screen.getByText('名称').closest('th') as HTMLElement;
    expect(th.getAttribute('aria-sort')).toBe('none');
    fireEvent.click(screen.getByText('名称'));
    expect(th.getAttribute('aria-sort')).toBe('ascending');
  });

  it('大数据量自动切换虚拟滚动（无 <table>、显示脚注）', () => {
    const { container } = render(
      <DataTable columns={baseColumns} dataSource={makeData(250)} rowKey='id' />
    );
    expect(container.querySelector('table')).toBeNull();
    expect(screen.getByText(/共 250 条记录（虚拟滚动）/)).toBeInTheDocument();
  });

  it('virtualThreshold=1 小数据也走虚拟滚动分支', () => {
    render(
      <DataTable columns={baseColumns} dataSource={makeData(5)} rowKey='id' virtualThreshold={1} />
    );
    expect(screen.getByText(/共 5 条记录（虚拟滚动）/)).toBeInTheDocument();
  });

  it('rowActions 渲染操作列', () => {
    render(
      <DataTable
        columns={baseColumns}
        dataSource={makeData(3)}
        rowKey='id'
        rowActions={() => <button>编辑</button>}
      />
    );
    expect(screen.getAllByText('编辑')).toHaveLength(3);
    expect(screen.getByText('操作')).toBeInTheDocument();
  });

  it('onRowClick 触发', () => {
    const onRowClick = vi.fn();
    const { container } = render(
      <DataTable
        columns={baseColumns}
        dataSource={makeData(2)}
        rowKey='id'
        onRowClick={onRowClick}
      />
    );
    fireEvent.click(container.querySelector('tbody tr')!);
    expect(onRowClick).toHaveBeenCalled();
  });

  it('selectable 受控：点击行复选框触发 onSelectChange', () => {
    const onSelectChange = vi.fn();
    render(
      <DataTable
        columns={baseColumns}
        dataSource={makeData(3)}
        rowKey='id'
        selectable
        selectedRowKeys={[]}
        onSelectChange={onSelectChange}
      />
    );
    const first = screen.getAllByRole('checkbox')[1] as HTMLInputElement;
    fireEvent.click(first);
    expect(onSelectChange).toHaveBeenCalled();
    const [keys] = onSelectChange.mock.calls[0];
    expect(keys).toContain(1);
  });

  it('selectable 非受控：全选 / 取消全选', () => {
    const { container } = render(
      <DataTable columns={baseColumns} dataSource={makeData(3)} rowKey='id' selectable />
    );
    const selectAll = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
    fireEvent.click(selectAll);
    expect(
      Array.from(container.querySelectorAll('tbody input[type=checkbox]')).filter(
        (c) => (c as HTMLInputElement).checked
      )
    ).toHaveLength(3);
    fireEvent.click(selectAll);
    expect(
      Array.from(container.querySelectorAll('tbody input[type=checkbox]')).filter(
        (c) => (c as HTMLInputElement).checked
      )
    ).toHaveLength(0);
  });

  it('align 右/中/左 与 ellipsis / className 透传', () => {
    const cols: ColumnType<Row>[] = [
      { title: 'R', key: 'r', dataIndex: 'name', align: 'right', ellipsis: true, className: 'c-r' },
      { title: 'C', key: 'c', dataIndex: 'name', align: 'center' },
    ];
    const { container } = render(<DataTable columns={cols} dataSource={makeData(1)} rowKey='id' />);
    const rCell = container.querySelector('td.c-r') as HTMLElement;
    expect(rCell.className).toContain('text-right');
    expect(rCell.className).toContain('truncate');
    const cCell = container.querySelector('tbody td:nth-child(2)') as HTMLElement;
    expect(cCell.className).toContain('text-center');
  });

  it('scroll.x 设置表格 minWidth', () => {
    const { container } = render(
      <DataTable columns={baseColumns} dataSource={makeData(2)} rowKey='id' scroll={{ x: 800 }} />
    );
    expect((container.querySelector('table') as HTMLElement).style.minWidth).toBe('800px');
  });

  it('number / string / 缺省 width 经 colWidthStyle 与 pxWidth', () => {
    const cols: ColumnType<Row>[] = [
      { title: 'N', key: 'n', dataIndex: 'name', width: 100 },
      { title: 'S', key: 's', dataIndex: 'name', width: '50px' },
      { title: 'D', key: 'd', dataIndex: 'name' },
    ];
    const { container } = render(<DataTable columns={cols} dataSource={makeData(1)} rowKey='id' />);
    const ths = container.querySelectorAll('thead th');
    expect((ths[0] as HTMLElement).style.width).toBe('100px');
    expect((ths[1] as HTMLElement).style.width).toBe('50px');
    expect((ths[2] as HTMLElement).style.width).toBe('');
  });

  it('title 渲染于表格顶部', () => {
    render(<DataTable columns={baseColumns} dataSource={makeData(2)} rowKey='id' title='成绩表' />);
    expect(screen.getByText('成绩表')).toBeInTheDocument();
  });

  it('rowClassName 透传到行', () => {
    const { container } = render(
      <DataTable
        columns={baseColumns}
        dataSource={makeData(1)}
        rowKey='id'
        rowClassName={() => 'highlight-row'}
      />
    );
    expect(container.querySelector('tbody tr')!.className).toContain('highlight-row');
  });

  it('dataSource 缩小后 innerPage 被钳制（effect）', () => {
    const { rerender, container } = render(
      <DataTable columns={baseColumns} dataSource={makeData(25)} rowKey='id' />
    );
    fireEvent.click(screen.getByText('下一页'));
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5); // 第 2 页（21-25）
    // 数据缩小到 10 条（≤ 每页 20，maxPage 变为 1），innerPage 从 2 被钳制回 1
    rerender(<DataTable columns={baseColumns} dataSource={makeData(10)} rowKey='id' />);
    // 钳制后第 1 页展示全部 10 行，不会卡在第 2 页显示空态
    expect(container.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(screen.queryByText('暂无数据')).toBeNull();
  });
});
