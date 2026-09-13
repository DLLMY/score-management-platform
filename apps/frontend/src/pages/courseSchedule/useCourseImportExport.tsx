import React, { useState, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useStableToast, useModal } from '../../hooks';
import logger from '../../utils/logger';

export interface ImportResult {
  success: boolean;
  total: number;
  success_count: number;
  failed_count: number;
  messages: Array<{
    class_name: string;
    subject_name: string;
    action: string;
    message: string;
    row_data?: Record<string, unknown>;
    error_fields?: string[];
  }>;
}

export interface CourseImportExportDeps {
  showToast: ReturnType<typeof useStableToast>['showToast'];
  selectedClass: number;
  /** 导入成功后刷新主数据（原 fetchData()） */
  fetchData: () => void;
  /** 导入成功后刷新课程表（原 fetchData()） */
  refreshSchedules: () => void;
}

export interface CourseImportExportResult {
  exportFormat: 'json' | 'excel';
  setExportFormat: React.Dispatch<React.SetStateAction<'json' | 'excel'>>;
  exportSchedule: () => Promise<void>;
  showImportModal: boolean;
  openImportModalWithData: () => void;
  closeImportModalWithReset: () => void;
  importConfigs: Array<{ id: number; config_name: string }>;
  selectedConfigId: number | null;
  setSelectedConfigId: React.Dispatch<React.SetStateAction<number | null>>;
  conflictStrategy: 'skip' | 'update' | 'error';
  setConflictStrategy: React.Dispatch<React.SetStateAction<'skip' | 'update' | 'error'>>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importFile: File | null;
  setImportFile: React.Dispatch<React.SetStateAction<File | null>>;
  importResult: ImportResult | null;
  isImporting: boolean;
  handleImport: () => Promise<void>;
}

/**
 * 课程表导入 / 导出逻辑子模块（状态 + 专用弹窗 + 处理器）。
 * 原样搬自 useCourseScheduleLogic.tsx，函数体逐字不变；
 * showToast / selectedClass / fetchData 经 deps 注入。
 */
export function useCourseImportExport(deps: CourseImportExportDeps): CourseImportExportResult {
  const { showToast, selectedClass, fetchData, refreshSchedules } = deps;

  // Import/Export states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importConfigs, setImportConfigs] = useState<Array<{ id: number; config_name: string }>>(
    []
  );
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<'skip' | 'update' | 'error'>('update');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isOpen: showImportModal,
    open: openImportModal,
    close: closeImportModal,
  } = useModal<null>({
    onClose: () => {
      setImportFile(null);
      setImportResult(null);
      setSelectedConfigId(null);
    },
  });

  const [exportFormat, setExportFormat] = useState<'json' | 'excel'>('excel');
  const [exporting, setExporting] = useState(false);
  const exportSchedule = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await api.courseSchedules.export(selectedClass > 0 ? selectedClass : undefined, exportFormat);
      showToast('success', '课程表导出成功');
    } catch (e) {
      showToast('error', '导出失败: ' + ((e as Error).message || '未知错误'));
    } finally {
      setExporting(false);
    }
  }, [selectedClass, exportFormat, showToast, exporting]);

  const openImportModalWithData = useCallback(() => {
    openImportModal();
    setImportFile(null);
    setImportResult(null);
    setSelectedConfigId(null);
    api.importConfig
      .list({ module_name: 'course_schedule' })
      .then((res) => {
        if (res) {
          setImportConfigs(res.map((c) => ({ id: c.id, config_name: c.config_name })));
        }
      })
      .catch((e) => logger.error(e)); // 导入配置列表加载失败静默：仅影响弹窗下拉选项，主功能不受影响
  }, [openImportModal]);

  const closeImportModalWithReset = useCallback(() => {
    closeImportModal();
    setImportFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [closeImportModal]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const fileName = file.name.toLowerCase();
        if (
          !fileName.endsWith('.json') &&
          !fileName.endsWith('.xlsx') &&
          !fileName.endsWith('.xls')
        ) {
          showToast('error', '请选择 JSON 或 Excel 格式的文件');
          return;
        }
        setImportFile(file);
        setImportResult(null);
      }
    },
    [showToast]
  );

  const handleImport = useCallback(async () => {
    if (!importFile) {
      showToast('error', '请先选择文件');
      return;
    }

    setIsImporting(true);
    try {
      const isExcel =
        importFile.name.toLowerCase().endsWith('.xlsx') ||
        importFile.name.toLowerCase().endsWith('.xls');

      if (isExcel) {
        const formData = new FormData();
        formData.append('file', importFile);
        let url = '/api/course-schedules/import';
        const params = new URLSearchParams();
        if (selectedConfigId) {
          params.append('config_id', selectedConfigId.toString());
        }
        params.append('conflict_strategy', conflictStrategy);
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        const result = await api.courseSchedules.import(formData, url);
        setImportResult(result);

        if (result.success) {
          showToast(
            'success',
            `导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 条`
          );
          fetchData();
        } else {
          showToast('error', '导入失败');
        }
      } else {
        const fileContent = await importFile.text();
        const importData = JSON.parse(fileContent);
        const formData = new FormData();
        formData.append('data', JSON.stringify(importData));
        let url = '/api/course-schedules/import';
        const params = new URLSearchParams();
        if (selectedConfigId) {
          params.append('config_id', selectedConfigId.toString());
        }
        params.append('conflict_strategy', conflictStrategy);
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        const result = await api.courseSchedules.import(formData, url);
        setImportResult(result);

        if (result.success) {
          showToast(
            'success',
            `导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 条`
          );
          fetchData();
        } else {
          showToast('error', '导入失败');
        }
      }
    } catch (error: unknown) {
      logger.error('导入失败:', error);
      showToast('error', '导入失败：' + (error as Error).message);
    } finally {
      setIsImporting(false);
    }
  }, [importFile, selectedConfigId, conflictStrategy, showToast, fetchData]);

  // refreshSchedules 保留参数位以对齐原 fetchData() 语义（原实现导入成功后调用 fetchData()）
  void refreshSchedules;

  return {
    exportFormat,
    setExportFormat,
    exportSchedule,
    showImportModal,
    openImportModalWithData,
    closeImportModalWithReset,
    importConfigs,
    selectedConfigId,
    setSelectedConfigId,
    conflictStrategy,
    setConflictStrategy,
    fileInputRef,
    handleFileChange,
    importFile,
    setImportFile,
    importResult,
    isImporting,
    handleImport,
  };
}
