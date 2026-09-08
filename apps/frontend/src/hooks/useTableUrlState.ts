import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type SortOrder = 'ascend' | 'descend' | null;

export interface UseTableUrlStateResult {
  page: number;
  pageSize: number;
  sortField: string;
  sortOrder: SortOrder;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSort: (field: string, order: SortOrder) => void;
  reset: () => void;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

function pname(key: string | undefined, name: string): string {
  return key ? `${key}_${name}` : name;
}

/**
 * 将表格的分页 / 排序状态持久化到 URL query（报告要求：排序态、分页态持久化到 URL query）。
 * 通过 `key` 命名空间，避免同页多个表格互相干扰。
 */
export function useTableUrlState(key?: string): UseTableUrlStateResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const getNumber = useCallback(
    (name: string, def: number): number => {
      const raw = searchParams.get(pname(key, name));
      if (raw == null) return def;
      const n = Number(raw);
      return Number.isFinite(n) ? n : def;
    },
    [searchParams, key]
  );

  const page = getNumber('page', 1);
  const pageSizeRaw = getNumber('pageSize', DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw));
  const sortField = searchParams.get(pname(key, 'sortField')) ?? '';
  const sortOrderRaw = searchParams.get(pname(key, 'sortOrder'));
  const sortOrder: SortOrder =
    sortOrderRaw === 'ascend' || sortOrderRaw === 'descend' ? sortOrderRaw : null;

  const update = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutate(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const setPage = useCallback(
    (p: number) => {
      update((np) => {
        np.set(pname(key, 'page'), String(Math.max(1, p)));
      });
    },
    [update, key]
  );

  const setPageSize = useCallback(
    (size: number) => {
      const clamped = Math.min(MAX_PAGE_SIZE, Math.max(1, size));
      update((np) => {
        np.set(pname(key, 'pageSize'), String(clamped));
        np.set(pname(key, 'page'), '1');
      });
    },
    [update, key]
  );

  const setSort = useCallback(
    (field: string, order: SortOrder) => {
      update((np) => {
        if (order == null || field === '') {
          np.delete(pname(key, 'sortField'));
          np.delete(pname(key, 'sortOrder'));
        } else {
          np.set(pname(key, 'sortField'), field);
          np.set(pname(key, 'sortOrder'), order);
        }
        np.set(pname(key, 'page'), '1');
      });
    },
    [update, key]
  );

  const reset = useCallback(() => {
    update((np) => {
      np.delete(pname(key, 'page'));
      np.delete(pname(key, 'pageSize'));
      np.delete(pname(key, 'sortField'));
      np.delete(pname(key, 'sortOrder'));
    });
  }, [update, key]);

  return useMemo(
    () => ({ page, pageSize, sortField, sortOrder, setPage, setPageSize, setSort, reset }),
    [page, pageSize, sortField, sortOrder, setPage, setPageSize, setSort, reset]
  );
}

export default useTableUrlState;
