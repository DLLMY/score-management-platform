import React, { memo, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Trash2, Edit2 } from 'lucide-react';
import { EmptyState, Skeleton } from '../index';

export interface ColumnDef<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  width?: string;
}

export interface OptimizedListProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onRowClick?: (item: T) => void;
  rowKey?: (item: T) => string | number;
  actions?: React.ReactNode;
  searchTerm?: string;
  selectedItems?: T[];
  onSelect?: (item: T) => void;
  checkboxColumn?: boolean;
  emptyMessage?: string;
  skeletonCount?: number;
}

const OptimizedList = memo(<T extends Record<string, unknown>>({
  data,
  columns,
  loading = false,
  total = 0,
  page = 1,
  pageSize = 10,
  onPageChange,
  onEdit,
  onDelete,
  onRowClick,
  rowKey = (item) => item.id as string | number,
  actions,
  selectedItems = [],
  onSelect,
  checkboxColumn = false,
  emptyMessage = '暂无数据',
  skeletonCount = 5,
}: OptimizedListProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevDataLengthRef = useRef(data.length);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const visibleColumns = useMemo(() => {
    return columns;
  }, [columns]);

  useEffect(() => {
    if (containerRef.current && prevDataLengthRef.current !== data.length) {
      containerRef.current.scrollTop = 0;
    }
    prevDataLengthRef.current = data.length;
  }, [data.length]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="grid grid-cols-12 gap-4">
              {visibleColumns.map((col) => (
                <div
                  key={col.key as string}
                  className={`${col.width || 'auto'} ${col.className || ''}`}
                >
                  <Skeleton />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-x-auto flex-1">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              {checkboxColumn && onSelect && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === data.length && data.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        data.forEach(onSelect);
                      } else {
                        selectedItems.forEach(onSelect);
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </th>
              )}
              {visibleColumns.map((col) => (
                <th
                  key={col.key as string}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.className || ''}`}
                  style={col.width ? { width: col.width } : {}}
                >
                  {col.label}
                  {col.sortable && (
                    <button className="ml-1 text-gray-400 hover:text-gray-600">
                      <span className="text-xs">↕</span>
                    </button>
                  )}
                </th>
              ))}
              {(onEdit || onDelete || actions) && (
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  操作
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {data.map((item) => (
              <tr
                key={rowKey(item)}
                onClick={() => onRowClick?.(item)}
                className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                  selectedItems.some((selected) => rowKey(selected) === rowKey(item))
                    ? 'bg-blue-50'
                    : ''
                }`}
              >
                {checkboxColumn && onSelect && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.some((selected) => rowKey(selected) === rowKey(item))}
                      onChange={() => onSelect(item)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </td>
                )}
                {visibleColumns.map((col) => {
                  const value = item[col.key];
                  return (
                    <td
                      key={col.key as string}
                      className={`px-4 py-3 text-sm ${col.className || 'text-gray-700'}`}
                    >
                      {col.render ? col.render(value, item) : String(value ?? '')}
                    </td>
                  );
                })}
                {(onEdit || onDelete || actions) && (
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {onEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(item);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="编辑"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {actions}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-100">
          <div className="text-sm text-gray-500">
            显示第 {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} 条，共 {total} 条
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page === 1}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const startPage = Math.max(1, page - 2);
              const currentPage = startPage + i;
              if (currentPage > pages) return null;
              return (
                <button
                  key={currentPage}
                  onClick={() => onPageChange?.(currentPage)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {currentPage}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page === pages}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

OptimizedList.displayName = 'OptimizedList';

export default OptimizedList;