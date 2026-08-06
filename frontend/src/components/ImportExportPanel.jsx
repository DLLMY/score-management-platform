import { useState, useRef } from 'react';
import {
  Upload,
  Download,
  Database,
  RefreshCw,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  FileText,
  X,
} from 'lucide-react';
import Button from './Button';
import Modal from './Modal';
import { useToast } from '../context/ToastContext';
import { getAuthHeaders } from '../services/api';

function ImportExportPanel({ type }) {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [backups, setBackups] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const fileInputRef = useRef(null);
  const { showToast } = useToast();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (validExtensions.includes(extension)) {
        setImportFile(file);
      } else {
        showToast('error', '请选择Excel或CSV格式的文件');
        e.target.value = '';
      }
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      showToast('warning', '请先选择要导入的文件');
      return;
    }

    setImportLoading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', importFile);

      const response = await fetch(`/api/import_export/import/${type}s`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: formData,
      });

      const result = await response.json();
      setImportResult(result);

      if (result.success) {
        showToast('success', result.message);
      } else {
        showToast('error', result.message);
      }
    } catch (error) {
      showToast('error', '导入失败: ' + error.message);
      setImportResult({ success: false, message: '导入失败: ' + error.message });
    } finally {
      setImportLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const response = await fetch(`/api/import_export/export/${type}s?format=${format}`, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('导出失败');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${type}s.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) {
          filename = match[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast('success', '导出成功');
    } catch (error) {
      showToast('error', '导出失败: ' + error.message);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`/api/import_export/template/${type}`, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('下载模板失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_import_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast('success', '模板下载成功');
    } catch (error) {
      showToast('error', '下载模板失败: ' + error.message);
    }
  };

  const loadBackups = async () => {
    setBackupLoading(true);
    try {
      const response = await fetch('/api/import_export/backup/list', {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const result = await response.json();
      if (result.success) {
        setBackups(result.data);
      }
    } catch (error) {
      showToast('error', '获取备份列表失败');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      const response = await fetch('/api/import_export/backup/create', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const result = await response.json();
      if (result.success) {
        showToast('success', '备份成功');
        loadBackups();
      } else {
        showToast('error', result.message);
      }
    } catch (error) {
      showToast('error', '备份失败: ' + error.message);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;

    setRestoreConfirm(false);
    try {
      const response = await fetch(`/api/import_export/backup/restore/${selectedBackup.filename}`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const result = await response.json();
      if (result.success) {
        showToast('success', '恢复成功，系统将重新加载');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showToast('error', result.message);
      }
    } catch (error) {
      showToast('error', '恢复失败: ' + error.message);
    }
  };

  const handleDeleteBackup = async (filename) => {
    if (!window.confirm('确定要删除此备份文件吗？')) return;

    try {
      const response = await fetch(`/api/import_export/backup/delete/${filename}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const result = await response.json();
      if (result.success) {
        showToast('success', '删除成功');
        loadBackups();
      } else {
        showToast('error', result.message);
      }
    } catch (error) {
      showToast('error', '删除失败: ' + error.message);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  };

  return (
    <div className='space-y-3'>
      {/* 导入按钮 */}
      <Button
        onClick={() => setIsImportModalOpen(true)}
        variant='outline'
        className='w-full justify-center gap-2'
      >
        <Upload className='w-4 h-4' />
        导入{type === 'user' ? '用户' : type === 'rule' ? '规则' : '分类'}数据
      </Button>

      {/* 导出按钮 */}
      <div className='flex gap-2'>
        <Button
          onClick={() => handleExport('excel')}
          variant='outline'
          className='flex-1 justify-center gap-2'
        >
          <FileSpreadsheet className='w-4 h-4' />
          导出Excel
        </Button>
        <Button
          onClick={() => handleExport('csv')}
          variant='outline'
          className='flex-1 justify-center gap-2'
        >
          <FileText className='w-4 h-4' />
          导出CSV
        </Button>
      </div>

      {/* 下载模板 */}
      <Button
        onClick={handleDownloadTemplate}
        variant='ghost'
        className='w-full justify-center gap-2 text-gray-600 hover:text-gray-800'
      >
        <Download className='w-4 h-4' />
        下载导入模板
      </Button>

      {/* 备份按钮 */}
      <Button
        onClick={() => {
          setIsBackupModalOpen(true);
          loadBackups();
        }}
        variant='outline'
        className='w-full justify-center gap-2'
      >
        <Database className='w-4 h-4' />
        数据备份管理
      </Button>

      {/* 导入模态框 */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportFile(null);
          setImportResult(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
        title={`导入${type === 'user' ? '用户' : type === 'rule' ? '规则' : '分类'}数据`}
      >
        <div className='space-y-4'>
          <div className='p-4 bg-blue-50 rounded-lg'>
            <p className='text-sm text-blue-700'>
              请先下载并填写导入模板，然后选择填写好的文件进行导入。
            </p>
          </div>

          <div className='border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary-400 transition-colors'>
            <input
              ref={fileInputRef}
              type='file'
              accept='.xlsx,.xls,.csv'
              onChange={handleFileChange}
              className='hidden'
              id='import-file-input'
            />
            <label htmlFor='import-file-input' className='cursor-pointer block'>
              <Upload className='w-12 h-12 text-gray-400 mx-auto mb-3' />
              <p className='text-gray-600 mb-1'>点击或拖拽文件到此处</p>
              <p className='text-sm text-gray-400'>支持 .xlsx .xls .csv 格式</p>
            </label>
          </div>

          {importFile && (
            <div className='flex items-center justify-between p-3 bg-gray-100 rounded-lg'>
              <div className='flex items-center gap-2'>
                <FileSpreadsheet className='w-5 h-5 text-primary-500' />
                <span className='text-sm font-medium'>{importFile.name}</span>
              </div>
              <button
                onClick={() => {
                  setImportFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className='text-gray-400 hover:text-gray-600'
              >
                <X className='w-5 h-5' />
              </button>
            </div>
          )}

          {importResult && (
            <div className={`p-4 rounded-lg ${importResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className='flex items-center gap-2 mb-2'>
                {importResult.success ? (
                  <CheckCircle className='w-5 h-5 text-green-500' />
                ) : (
                  <AlertCircle className='w-5 h-5 text-red-500' />
                )}
                <span
                  className={`font-medium ${importResult.success ? 'text-green-700' : 'text-red-700'}`}
                >
                  {importResult.message}
                </span>
              </div>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className='mt-2 max-h-40 overflow-y-auto'>
                  {importResult.errors.map((error, index) => (
                    <p key={index} className='text-sm text-gray-600'>
                      {error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className='flex gap-2 pt-2'>
            <Button
              onClick={() => setIsImportModalOpen(false)}
              variant='outline'
              className='flex-1'
            >
              取消
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importFile || importLoading}
              className='flex-1'
            >
              {importLoading ? <RefreshCw className='w-4 h-4 animate-spin' /> : '开始导入'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 备份管理模态框 */}
      <Modal
        isOpen={isBackupModalOpen}
        onClose={() => {
          setIsBackupModalOpen(false);
          setSelectedBackup(null);
          setRestoreConfirm(false);
        }}
        title='数据备份管理'
        size='large'
      >
        <div className='space-y-4'>
          {/* 操作栏 */}
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2 text-sm text-gray-600'>
              <Clock className='w-4 h-4' />
              <span>自动备份：每天凌晨2:00</span>
            </div>
            <Button onClick={handleCreateBackup} className='gap-2'>
              <Database className='w-4 h-4' />
              手动备份
            </Button>
          </div>

          {/* 备份列表 */}
          {backupLoading ? (
            <div className='flex items-center justify-center py-12'>
              <RefreshCw className='w-6 h-6 text-primary-500 animate-spin' />
            </div>
          ) : backups.length === 0 ? (
            <div className='text-center py-12'>
              <Database className='w-12 h-12 text-gray-300 mx-auto mb-3' />
              <p className='text-gray-500'>暂无备份文件</p>
            </div>
          ) : (
            <div className='space-y-2 max-h-80 overflow-y-auto'>
              {backups.map((backup) => (
                <div
                  key={backup.filename}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedBackup?.filename === backup.filename
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedBackup(backup)}
                >
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <FileText className='w-4 h-4 text-gray-400 flex-shrink-0' />
                      <span className='font-medium truncate'>{backup.filename}</span>
                    </div>
                    <div className='flex items-center gap-4 mt-1 text-xs text-gray-500'>
                      <span>{formatDate(backup.created_at)}</span>
                      <span>{formatFileSize(backup.size)}</span>
                      <span className='px-2 py-0.5 bg-gray-100 rounded text-gray-600'>
                        {backup.type}
                      </span>
                    </div>
                  </div>
                  <div className='flex items-center gap-2 ml-4'>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBackup(backup);
                        setRestoreConfirm(true);
                      }}
                      className='p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors'
                      title='恢复备份'
                    >
                      <RefreshCw className='w-4 h-4' />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBackup(backup.filename);
                      }}
                      className='p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors'
                      title='删除备份'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 恢复确认弹窗 */}
          {restoreConfirm && selectedBackup && (
            <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
              <div className='bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl'>
                <div className='flex items-center gap-3 mb-4'>
                  <AlertCircle className='w-8 h-8 text-amber-500' />
                  <h3 className='text-lg font-semibold text-gray-800'>确认恢复</h3>
                </div>
                <p className='text-gray-600 mb-4'>
                  确定要从备份文件 <span className='font-medium'>{selectedBackup.filename}</span>{' '}
                  恢复数据吗？ 此操作将覆盖当前数据库中的所有数据，且不可撤销。
                </p>
                <div className='flex gap-2'>
                  <Button
                    onClick={() => setRestoreConfirm(false)}
                    variant='outline'
                    className='flex-1'
                  >
                    取消
                  </Button>
                  <Button onClick={handleRestoreBackup} variant='danger' className='flex-1'>
                    确认恢复
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default ImportExportPanel;
