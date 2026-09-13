// T12-3 拆分（2026-09-12）：自 pages/ClassManagement.tsx 原样搬出的组合根（组合 hook）。
// 职责：持有列表/工具条域的 state，装配三个域子 hook（CRUD / 导入 / 班主任），
// 返回值即 ClassManagementViewProps——pages/ClassManagement.tsx 退化为装配薄壳。
// 行为逐字节等价；唯一刻意调整是子 hook 的 useCallback deps 增补 setPage（setState
// 恒等，运行时零变化，见 hooks/useClassHeadTeacher.ts 头注）。
import { useCallback, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import type { ClassInfo } from '../../services/api';
import { useListFetch, useStableToast } from '../../hooks';
import { useConfirm } from '../../components';
import type { ClassManagementViewProps } from './types';
import { classColumns } from './columns';
import { useClassCrud } from './hooks/useClassCrud';
import { useClassImport } from './hooks/useClassImport';
import { useClassHeadTeacher } from './hooks/useClassHeadTeacher';

export function useClassManagementLogic(): ClassManagementViewProps {
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const classList = useListFetch<ClassInfo>({
    fetcher: async (params) => {
      const data = await api.classes.getAll({
        page: params.page,
        per_page: params.pageSize,
        keyword: (params.keyword as string) || undefined,
        skipCache: params.skipCache,
      });
      return { items: data.classes || [], total: data.pagination?.total ?? 0 };
    },
    params: { page, pageSize, keyword: searchInput },
  });
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  const handlePageChange = useCallback(
    (newPage: number, newPageSize: number) => {
      const totalPages = Math.max(1, Math.ceil(classList.total / newPageSize));
      if (newPage >= 1 && newPage <= totalPages) {
        setPage(newPage);
        setPageSize(newPageSize);
      }
    },
    [classList.total]
  );

  // 工具条导出（json/excel）
  const [exportFormat, setExportFormat] = useState<'json' | 'excel'>('excel');
  const [exporting, setExporting] = useState(false);
  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await api.classes.export(searchInput || undefined, exportFormat);
      showToast('success', '班级数据导出成功');
    } catch (e) {
      showToast('error', '导出失败: ' + ((e as Error).message || '未知错误'));
    } finally {
      setExporting(false);
    }
  }, [searchInput, exportFormat, showToast, exporting]);

  const totalStudents = useMemo(() => {
    return classList.items.reduce((sum, cls) => sum + (cls.student_count || 0), 0); // 缺失字段按 0 计（列表已加载才统计）
  }, [classList.items]);

  const classesWithTeacher = useMemo(() => {
    return classList.items.filter((cls) => cls.head_teacher_id).length;
  }, [classList.items]);

  const crud = useClassCrud({ showToast, confirmRef, classList });
  const importer = useClassImport({ showToast, classList, setPage });
  const headTeacher = useClassHeadTeacher({ showToast, confirmRef, classList, setPage });

  return {
    // 搜索 / 导出 / 导入工具条
    searchInput,
    setSearchInput,
    handleExport,
    exportFormat,
    setExportFormat,
    ...importer,
    // 统计卡
    classTotal: classList.total,
    totalStudents,
    classesWithTeacher,
    // 表格
    columns: classColumns,
    classItems: classList.items,
    classLoading: classList.loading,
    page,
    pageSize,
    handlePageChange,
    ...crud,
    ...headTeacher,
    showToast,
  };
}
