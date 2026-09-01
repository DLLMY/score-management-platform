import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { TableSkeleton } from '../ui/Skeleton';
import EmptyState, { ErrorState } from '../feedback/EmptyState';
import Pagination from '../ui/Pagination';
import VirtualList from './VirtualList';

export type SortOrder = 'ascend' | 'descend' | null;

export interface ColumnType<T> {
  title: ReactNode;
  key: string;
  dataIndex?: keyof T | string;
  render?: (value: unknown, record: T, index: number) => ReactNode;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  sorter?: boolean | ((a: T, b: T) => number);
  className?: string;
  ellipsis?: boolean;
}

export interface DataTableEmptyProps {
  icon?: 'users' | 'data' | 'search' | 'file' | 'folder' | 'wifi' | 'bell' | 'settings' | 'alert';
  title?: string;
  description?: string;
  actionLabel?: string | null;
  onAction?: (() => void) | null;
}

export interface DataTableProps<T> {
  columns: ColumnType<T>[];
  dataSource: T[];
  loading?: boolean;
  rowKey: string | ((record: T, index: number) => string | number);
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  pageSizeOptions?: number[];
  sortField?: string;
  sortOrder?: SortOrder;
  onSortChange?: (field: string, order: SortOrder) => void;
  selectable?: boolean;
  selectedRowKeys?: Array<string | number>;
  onSelectChange?: (keys: Array<string | number>, rows: T[]) => void;
  rowActions?: (record: T, index: number) => ReactNode;
  error?: { message?: string; onRetry?: () => void } | null;
  empty?: DataTableEmptyProps;
  scroll?: { x?: number | string };
  title?: ReactNode;
  rowHeight?: number;
  virtualThreshold?: number;
  className?: string;
  rowClassName?: (record: T, index: number) => string;
  onRowClick?: (record: T, index: number) => void;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;
const DEFAULT_ROW_HEIGHT = 52;

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'zh-CN');
}

function colWidthStyle(col: { width?: number | string }): React.CSSProperties {
  if (col.width == null) return {};
  return { width: col.width, minWidth: col.width, maxWidth: col.width };
}

function pxWidth(col: { width?: number | string }): number {
  const w = col.width;
  if (typeof w === 'number') return w;
  if (typeof w === 'string') {
    const m = w.match(/^(\d+(?:\.\d+)?)(px)?$/);
    if (m) return parseFloat(m[1]);
  }
  return 160;
}

function Checkbox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type='checkbox'
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className='h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500'
    />
  );
}

function DataTable<T>(props: DataTableProps<T>) {
  const {
    columns,
    dataSource,
    loading = false,
    rowKey,
    total,
    page,
    pageSize,
    onPageChange,
    pageSizeOptions = [20, 50, 100, 200],
    sortField,
    sortOrder,
    onSortChange,
    selectable = false,
    selectedRowKeys,
    onSelectChange,
    rowActions,
    error = null,
    empty,
    scroll,
    title,
    rowHeight = DEFAULT_ROW_HEIGHT,
    virtualThreshold = 200,
    className = '',
    rowClassName,
    onRowClick,
  } = props;

  const isControlled = !!onPageChange;

  const [innerPage, setInnerPage] = useState(1);
  const [size, setSize] = useState(pageSize ?? DEFAULT_PAGE_SIZE);
  const [innerSortField, setInnerSortField] = useState('');
  const [innerSortOrder, setInnerSortOrder] = useState<SortOrder>(null);
  const [innerSelected, setInnerSelected] = useState<Array<string | number>>([]);

  const sortFieldEff = onSortChange ? sortField ?? '' : innerSortField;
  const sortOrderEff = onSortChange ? sortOrder ?? null : innerSortOrder;
  const selectedKeys = useMemo(
    () => (selectable ? (selectedRowKeys ?? innerSelected) : []),
    [selectable, selectedRowKeys, innerSelected]
  );

  // F3: 非受控分页收敛。dataSource 缩小（删除/筛选）后 innerPage 可能越界，
  // 停留旧页切片越界会显示"暂无数据"。按当前数据量计算最大页并钳制有效页，
  // 同时用 effect 把 innerPage 拉回合法区间，避免分页控件与数据错位。
  useEffect(() => {
    if (isControlled) return;
    const maxPage = Math.max(1, Math.ceil(dataSource.length / size));
    if (innerPage > maxPage) {
      setInnerPage(maxPage);
    }
  }, [dataSource, size, innerPage, isControlled]);

  const getKey = useCallback(
    (record: T, index: number): string | number =>
      typeof rowKey === 'function'
        ? rowKey(record, index)
        : (record as Record<string, unknown>)[rowKey as string] as string | number,
    [rowKey]
  );

  const getValue = useCallback((record: T, col: ColumnType<T>): unknown => {
    if (col.dataIndex == null) return undefined;
    return (record as Record<string, unknown>)[String(col.dataIndex)];
  }, []);

  // 受控（服务端分页）：dataSource 即当前页；非受控：本地排序 + 切片
  const sortedSource = useMemo(() => {
    if (onSortChange) return dataSource;
    if (!sortFieldEff) return dataSource;
    const col = columns.find((c) => c.key === sortFieldEff);
    if (!col || !col.sorter) return dataSource;
    const arr = [...dataSource];
    if (typeof col.sorter === 'function') {
      arr.sort(col.sorter);
    } else {
      arr.sort((a, b) => compareValues(getValue(a, col), getValue(b, col)));
    }
    if (sortOrderEff === 'descend') arr.reverse();
    return arr;
  }, [dataSource, columns, sortFieldEff, sortOrderEff, onSortChange, getValue]);

  const useVirtual = virtualThreshold > 0 && !isControlled && dataSource.length >= virtualThreshold;

  const maxLocalPage = Math.max(1, Math.ceil(dataSource.length / size));
  const effectivePage = isControlled ? (page ?? 1) : Math.min(innerPage, maxLocalPage);

  const pagedData = useMemo(() => {
    if (isControlled || useVirtual) return sortedSource;
    const start = (effectivePage - 1) * size;
    return sortedSource.slice(start, start + size);
  }, [sortedSource, isControlled, useVirtual, effectivePage, size]);

  const currentPage = isControlled ? page ?? 1 : effectivePage;
  const totalCount = total ?? dataSource.length;
  const pageRows = useVirtual ? sortedSource : pagedData;

  const emitSelection = useCallback(
    (keys: Array<string | number>) => {
      if (selectedRowKeys == null) setInnerSelected(keys);
      const rows = dataSource.filter((r, i) => keys.includes(getKey(r, i)));
      onSelectChange?.(keys, rows);
    },
    [selectedRowKeys, dataSource, getKey, onSelectChange]
  );

  const toggleRow = useCallback(
    (record: T, i: number) => {
      const k = getKey(record, i);
      const next = selectedKeys.includes(k)
        ? selectedKeys.filter((x) => x !== k)
        : [...selectedKeys, k];
      emitSelection(next);
    },
    [selectedKeys, getKey, emitSelection]
  );

  const allChecked = pageRows.length > 0 && pageRows.every((r, i) => selectedKeys.includes(getKey(r, i)));

  const toggleAll = useCallback(() => {
    let next: Array<string | number>;
    if (allChecked) {
      next = selectedKeys.filter((k) => !pageRows.some((r, i) => getKey(r, i) === k));
    } else {
      const set = new Set(selectedKeys);
      pageRows.forEach((r, i) => set.add(getKey(r, i)));
      next = Array.from(set);
    }
    emitSelection(next);
  }, [allChecked, selectedKeys, pageRows, getKey, emitSelection]);

  const handleSort = useCallback(
    (col: ColumnType<T>) => {
      if (!col.sorter) return;
      const field = col.key;
      let nextOrder: SortOrder;
      if (sortFieldEff !== field) nextOrder = 'ascend';
      else if (sortOrderEff === 'ascend') nextOrder = 'descend';
      else if (sortOrderEff === 'descend') nextOrder = null;
      else nextOrder = 'ascend';
      if (onSortChange) onSortChange(field, nextOrder);
      else {
        setInnerSortField(field);
        setInnerSortOrder(nextOrder);
      }
    },
    [sortFieldEff, sortOrderEff, onSortChange]
  );

  const handlePageChange = useCallback(
    (p: number) => {
      if (isControlled) onPageChange?.(p, size);
      else setInnerPage(p);
    },
    [isControlled, onPageChange, size]
  );

  const handleSizeChange = useCallback(
    (newSize: number) => {
      const clamped = Math.min(MAX_PAGE_SIZE, Math.max(1, newSize));
      setSize(clamped);
      if (isControlled) onPageChange?.(1, clamped);
      else setInnerPage(1);
    },
    [isControlled, onPageChange]
  );

  const wrapperCls = `rounded-xl border border-gray-200 bg-white overflow-hidden ${className}`;

  const renderCell = (col: ColumnType<T>, record: T, i: number): ReactNode => {
    const value = getValue(record, col);
    if (col.render) return col.render(value, record, i);
    if (value == null) return '';
    return String(value);
  };

  // ---- 加载态 ----
  if (loading) {
    const colCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);
    return (
      <div className={wrapperCls}>
        <div className='p-4'>
          <TableSkeleton rows={Math.min(size, 10)} columns={colCount} showHeader />
        </div>
      </div>
    );
  }

  // ---- 错误态 ----
  if (error) {
    return (
      <div className={wrapperCls}>
        <ErrorState message={error.message ?? '加载失败'} onRetry={error.onRetry} />
      </div>
    );
  }

  // ---- 空态 ----
  if (pageRows.length === 0) {
    return (
      <div className={wrapperCls}>
        <EmptyState
          icon={empty?.icon ?? 'data'}
          title={empty?.title ?? '暂无数据'}
          description={empty?.description ?? '这里还没有任何内容'}
          actionLabel={empty?.actionLabel ?? null}
          onAction={empty?.onAction ?? null}
        />
      </div>
    );
  }

  const headerCellCls = (sortable: boolean) =>
    `px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider ${
      sortable ? 'cursor-pointer select-none hover:text-slate-700' : ''
    }`;
  const bodyCellCls = (col: ColumnType<T>) =>
    `px-3 py-3 text-sm text-slate-600 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${
      col.ellipsis ? 'truncate' : ''
    } ${col.className ?? ''}`;

  const tableMinWidth = scroll?.x != null ? (typeof scroll.x === 'number' ? `${scroll.x}px` : scroll.x) : undefined;

  const headerRow = (
    <tr>
      {selectable && (
        <th className='w-11 px-3 py-3'>
          <Checkbox
            checked={allChecked}
            onChange={toggleAll}
            disabled={pageRows.length === 0}
          />
        </th>
      )}
      {columns.map((col) => {
        const sortable = !!col.sorter;
        const active = sortFieldEff === col.key;
        const sortIcon = !sortable ? null : active ? (
          sortOrderEff === 'ascend' ? (
            <ArrowUp className='h-3.5 w-3.5' />
          ) : (
            <ArrowDown className='h-3.5 w-3.5' />
          )
        ) : (
          <ChevronsUpDown className='h-3.5 w-3.5 opacity-40' />
        );
        return (
          <th
            key={col.key}
            style={colWidthStyle(col)}
            className={headerCellCls(sortable)}
            onClick={sortable ? () => handleSort(col) : undefined}
          >
            <span className='inline-flex items-center gap-1'>
              {col.title}
              {sortIcon}
            </span>
          </th>
        );
      })}
      {rowActions && <th className='px-3 py-3 text-xs font-medium text-slate-500'>操作</th>}
    </tr>
  );

  const bodyRows = pageRows.map((record, i) => (
    <tr
      key={String(getKey(record, i))}
      className={`border-b border-gray-100 transition-colors hover:bg-slate-50 ${
        rowClassName ? rowClassName(record, i) : ''
      }`}
      onClick={onRowClick ? () => onRowClick(record, i) : undefined}
    >
      {selectable && (
        <td className='w-11 px-3 py-3' onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selectedKeys.includes(getKey(record, i))} onChange={() => toggleRow(record, i)} />
        </td>
      )}
      {columns.map((col) => (
        <td key={col.key} style={colWidthStyle(col)} className={bodyCellCls(col)}>
          {renderCell(col, record, i)}
        </td>
      ))}
      {rowActions && <td className='px-3 py-3 text-sm'>{rowActions(record, i)}</td>}
    </tr>
  ));

  // ---- 虚拟滚动态（数据量大时自动切换）----
  if (useVirtual) {
    const virtualMinWidth =
      (selectable ? 44 : 0) + columns.reduce((s, c) => s + pxWidth(c), 0) + (rowActions ? 120 : 0);
    return (
      <div className={wrapperCls}>
        {title && <div className='px-4 py-3 border-b border-gray-200 font-medium text-slate-700'>{title}</div>}
        <div className='overflow-x-auto'>
          <div style={{ minWidth: virtualMinWidth }}>
            <div className='flex border-b border-gray-200 bg-gray-50'>
              {selectable && (
                <div style={{ width: 44, flexShrink: 0 }} className='flex items-center px-3 py-3'>
                  <Checkbox checked={allChecked} onChange={toggleAll} disabled={pageRows.length === 0} />
                </div>
              )}
              {columns.map((col) => (
                <div
                  key={col.key}
                  style={{ width: pxWidth(col), flexShrink: 0 }}
                  className={headerCellCls(!!col.sorter)}
                  onClick={col.sorter ? () => handleSort(col) : undefined}
                >
                  <span className='inline-flex items-center gap-1'>
                    {col.title}
                    {col.sorter &&
                      (sortFieldEff === col.key ? (
                        sortOrderEff === 'ascend' ? (
                          <ArrowUp className='h-3.5 w-3.5' />
                        ) : (
                          <ArrowDown className='h-3.5 w-3.5' />
                        )
                      ) : (
                        <ChevronsUpDown className='h-3.5 w-3.5 opacity-40' />
                      ))}
                  </span>
                </div>
              ))}
              {rowActions && (
                <div style={{ width: 120, flexShrink: 0 }} className='px-3 py-3 text-xs font-medium text-slate-500'>
                  操作
                </div>
              )}
            </div>
            <VirtualList
              items={sortedSource}
              itemHeight={rowHeight}
              overscan={6}
              renderItem={(record, index) => (
                <div
                  className={`flex border-b border-gray-100 transition-colors hover:bg-slate-50 ${
                    rowClassName ? rowClassName(record, index) : ''
                  }`}
                  style={{ height: rowHeight }}
                  onClick={onRowClick ? () => onRowClick(record, index) : undefined}
                >
                  {selectable && (
                    <div style={{ width: 44, flexShrink: 0 }} className='flex items-center px-3'>
                      <Checkbox
                        checked={selectedKeys.includes(getKey(record, index))}
                        onChange={() => toggleRow(record, index)}
                      />
                    </div>
                  )}
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      style={{ width: pxWidth(col), flexShrink: 0 }}
                      className={`flex items-center px-3 text-sm text-slate-600 ${
                        col.align === 'right'
                          ? 'justify-end'
                          : col.align === 'center'
                            ? 'justify-center'
                            : 'justify-start'
                      } ${col.className ?? ''}`}
                    >
                      {renderCell(col, record, index)}
                    </div>
                  ))}
                  {rowActions && (
                    <div style={{ width: 120, flexShrink: 0 }} className='flex items-center px-3 text-sm'>
                      {rowActions(record, index)}
                    </div>
                  )}
                </div>
              )}
            />
          </div>
        </div>
        <div className='px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-slate-600'>
          共 {totalCount} 条记录（虚拟滚动）
        </div>
      </div>
    );
  }

  // ---- 普通表格态 ----
  return (
    <div className={wrapperCls}>
      {title && <div className='px-4 py-3 border-b border-gray-200 font-medium text-slate-700'>{title}</div>}
      <div className='overflow-x-auto'>
        <table className='w-full' style={tableMinWidth ? { minWidth: tableMinWidth } : undefined}>
          <thead className='bg-gray-50'>{headerRow}</thead>
          <tbody>{bodyRows}</tbody>
        </table>
      </div>
      {totalCount > 0 && (
        <div className='flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-t border-gray-200'>
          <div className='flex items-center gap-2 text-sm text-slate-600'>
            <span>每页</span>
            <select
              value={size}
              onChange={(e) => handleSizeChange(Number(e.target.value))}
              className='border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500'
            >
              {pageSizeOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <span>条</span>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={Math.max(1, Math.ceil(totalCount / size))}
            onPageChange={handlePageChange}
            totalItems={totalCount}
            itemsPerPage={size}
          />
        </div>
      )}
    </div>
  );
}

export default DataTable;
