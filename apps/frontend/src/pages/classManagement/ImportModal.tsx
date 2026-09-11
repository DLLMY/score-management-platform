import type { ReactElement, ChangeEvent, RefObject } from 'react';
import { Upload, X, FileJson, Download, AlertTriangle, Check } from 'lucide-react';
import api from '../../services/api';
import { downloadBlob } from '../../utils/download';
import logger from '../../utils/logger';
import { PermissionButton } from '../../components';
import type { ImportResult } from './types';

interface ImportModalProps {
  isOpen: boolean;
  importConfigs: Array<{ id: number; config_name: string }>;
  selectedConfigId: number | null;
  setSelectedConfigId: (id: number | null) => void;
  importFile: File | null;
  setImportFile: (file: File | null) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  importResult: ImportResult | null;
  handleExportErrors: () => void;
  isImporting: boolean;
  handleImport: () => Promise<void>;
  closeImportModal: () => void;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

export default function ImportModal({
  isOpen,
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
  closeImportModal,
  showToast,
}: ImportModalProps): ReactElement {
  if (!isOpen) return <></>;
  return (
    <div
      className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4'
      onClick={closeImportModal}
    >
      <div
        className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800'>
          <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500' />
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center'>
                <Upload className='w-5 h-5 text-white' />
              </div>
              <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>导入班级数据</h3>
            </div>
            <button
              onClick={closeImportModal}
              className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
            >
              <X className='w-5 h-5' />
            </button>
          </div>
        </div>

        <div className='px-6 py-5 space-y-5'>
          <div className='p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400'>
                <FileJson className='w-4 h-4' />
                <span>支持 JSON 和 Excel 格式的班级数据文件</span>
              </div>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(api.importConfig.downloadTemplate('classes'));
                    if (!response.ok) throw new Error('下载失败');
                    const blob = await response.blob();
                    downloadBlob(blob, '班级导入模板.xlsx');
                  } catch (error) {
                    logger.error('下载模板失败:', error);
                    showToast('error', '下载模板失败');
                  }
                }}
                className='flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors'
              >
                <Download className='w-4 h-4' />
                下载模板
              </button>
            </div>
          </div>

          <div className='p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800'>
            <div className='flex items-center gap-2 mb-3'>
              <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400' />
              <span className='text-sm font-medium text-amber-800 dark:text-amber-300'>
                必填字段说明
              </span>
            </div>
            <ul className='space-y-1.5 text-sm text-amber-700 dark:text-amber-400'>
              <li>
                <span className='font-medium'>班级名称</span>：唯一标识，不能为空
              </li>
            </ul>
            <p className='mt-2 text-xs text-amber-600 dark:text-amber-500'>
              提示：下载模板后，请参考"填写说明"工作表了解详细的字段填写规则
            </p>
          </div>

          {importConfigs.length > 0 && (
            <div className='p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl'>
              <label className='block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2'>
                选择导入配置
              </label>
              <select
                value={selectedConfigId || ''}
                onChange={(e) =>
                  setSelectedConfigId(e.target.value ? parseInt(e.target.value) : null)
                }
                className='w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500'
              >
                <option value=''>使用默认配置</option>
                {importConfigs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.config_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!importResult ? (
            <>
              <div
                className='border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-8 text-center hover:border-amber-400 dark:hover:border-amber-500 transition-colors cursor-pointer'
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='.json,.xlsx,.xls'
                  onChange={handleFileChange}
                  className='hidden'
                />
                <div className='w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center'>
                  <Upload className='w-8 h-8 text-amber-600 dark:text-amber-400' />
                </div>
                <p className='text-lg font-semibold text-slate-700 dark:text-slate-200'>
                  点击或拖拽文件到此处
                </p>
                <p className='text-sm text-slate-500 dark:text-slate-400 mt-1'>
                  支持 .json、.xlsx、.xls 格式文件
                </p>
              </div>

              {importFile && (
                <div className='flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center'>
                      <FileJson className='w-5 h-5 text-white' />
                    </div>
                    <div>
                      <p className='font-medium text-slate-900 dark:text-slate-100'>
                        {importFile.name}
                      </p>
                      <p className='text-sm text-slate-500 dark:text-slate-400'>
                        {(importFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setImportFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className='p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors'
                  >
                    <X className='w-5 h-5' />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className='space-y-4'>
              <div
                className='flex items-center justify-center gap-4 p-4 rounded-xl'
                style={{
                  backgroundColor: importResult.success
                    ? 'rgba(16, 185, 129, 0.1)'
                    : 'rgba(239, 68, 68, 0.1)',
                }}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    importResult.success ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                >
                  {importResult.success ? (
                    <Check className='w-6 h-6 text-white' />
                  ) : (
                    <X className='w-6 h-6 text-white' />
                  )}
                </div>
                <div className='text-center'>
                  <p className='text-lg font-bold text-slate-800 dark:text-slate-100'>导入完成</p>
                  <p className='text-sm text-slate-500 dark:text-slate-400'>
                    总计 {importResult.total} 条 | 成功 {importResult.success_count} 条 | 失败{' '}
                    {importResult.failed_count} 条
                  </p>
                </div>
              </div>

              {importResult.messages.length > 0 && (
                <div className='max-h-[300px] overflow-y-auto space-y-2'>
                  <div className='flex items-center justify-between mb-2'>
                    <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>
                      导入详情：
                    </p>
                    {importResult.failed_count > 0 && (
                      <button
                        onClick={handleExportErrors}
                        className='flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors'
                      >
                        <Download className='w-4 h-4' />
                        导出错误数据
                      </button>
                    )}
                  </div>
                  {importResult.messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg text-sm ${
                        msg.action === 'failed'
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                          : msg.action === 'created'
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {msg.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
          <button
            onClick={closeImportModal}
            className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
          >
            关闭
          </button>
          {!importResult && (
            <PermissionButton
              permission='class.manage'
              onClick={handleImport}
              disabled={!importFile || isImporting}
              className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 font-medium disabled:opacity-50'
            >
              {isImporting ? (
                <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
              ) : (
                <Upload className='w-5 h-5' />
              )}
              开始导入
            </PermissionButton>
          )}
        </div>
      </div>
    </div>
  );
}
