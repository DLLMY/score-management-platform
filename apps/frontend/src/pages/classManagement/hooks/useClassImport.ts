// T12-3 拆分（2026-09-12）：自 pages/ClassManagement.tsx「导入」域原样搬出，行为逐字节等价。
// 共享原语（showToast / classList / setPage）由组合根注入。
import { useCallback, useRef, useState } from 'react';
import logger from '../../../utils/logger';
import api, { getAuthHeaders } from '../../../services/api';
import type { ClassInfo } from '../../../services/api';
import type { UseListFetchResult } from '../../../hooks';
import type { ImportResult } from '../types';

type ShowToast = (
  type: 'success' | 'error' | 'info' | 'warning',
  message: string,
  options?: {
    undoAction?: () => void;
    undoLabel?: string;
    details?: string;
    errorFields?: string[];
  }
) => void;

interface UseClassImportParams {
  showToast: ShowToast;
  classList: UseListFetchResult<ClassInfo>;
  setPage: (value: number) => void;
}

/** 班级导入模态（JSON/Excel 上传 + 失败行导出） */
export function useClassImport({ showToast, classList, setPage }: UseClassImportParams) {
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importConfigs, setImportConfigs] = useState<Array<{ id: number; config_name: string }>>(
    []
  );
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openImportModal = useCallback(() => {
    setShowImportModal(true);
    setImportFile(null);
    setImportResult(null);
    setSelectedConfigId(null);
    api.importConfig
      .list({ module_name: 'classes' })
      .then((res) => {
        if (res) {
          setImportConfigs(res.map((c) => ({ id: c.id, config_name: c.config_name })));
        }
      })
      .catch((e) => {
        logger.error(e); // 主功能不受影响，仅记录日志
        showToast('error', '导入配置列表加载失败'); // M5: 加载失败提示
      }); // 配置列表加载失败静默（主功能不受影响），仅记录日志
  }, [showToast]);

  const closeImportModal = useCallback(() => {
    setShowImportModal(false);
    setImportFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

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
        let url = '/api/classes/import';
        if (selectedConfigId) {
          url += `?config_id=${selectedConfigId}`;
        }
        const result = await api.classes.import(formData, url);
        setImportResult(result);

        if (result.success) {
          showToast(
            'success',
            `导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 条`
          );
          setPage(1);
          await classList.refetch({ skipCache: true, params: { page: 1 } });
        } else {
          showToast('error', '导入失败');
        }
      } else {
        const fileContent = await importFile.text();
        const importData = JSON.parse(fileContent);
        let url = '/api/classes/import';
        if (selectedConfigId) {
          url += `?config_id=${selectedConfigId}`;
        }
        const result = await fetch(url, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(importData),
        });
        const resultData = await result.json();
        setImportResult(resultData);

        if (resultData.success) {
          showToast(
            'success',
            `导入完成：成功 ${resultData.success_count} 条，失败 ${resultData.failed_count} 条`
          );
          classList.refetch({ skipCache: true, params: { page: 1 } });
          setPage(1);
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
  }, [importFile, selectedConfigId, showToast, classList, setPage]);

  const handleExportErrors = useCallback((): void => {
    if (!importResult?.messages) return;
    const errors = importResult.messages
      .filter((msg) => msg.action === 'failed')
      .map((msg) => ({
        ...msg,
        error_fields: msg.error_fields || [],
      }));
    if (errors.length > 0) {
      api.export.errors(errors, 'classes');
    }
  }, [importResult]);

  return {
    showImportModal,
    importConfigs,
    selectedConfigId,
    setSelectedConfigId,
    importFile,
    setImportFile,
    fileInputRef,
    handleFileChange,
    importResult,
    handleExportErrors,
    isImporting,
    handleImport,
    openImportModal,
    closeImportModal,
  };
}
