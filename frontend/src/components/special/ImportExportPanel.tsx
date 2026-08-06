import { useState, useRef, ChangeEventHandler, useCallback } from 'react';
import {
  Upload,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  X,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
} from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { PermissionButton } from '../PermissionGuard';
import { useToast } from '../../context/ToastContext';
import { getAuthHeaders } from '../../services/api';

type DataType = 'user' | 'rule' | 'category' | 'class' | 'subject' | 'exam' | 'score' | 'approval' | 'device' | 'all';

interface ImportMessage {
  action: string;
  message: string;
  row_data?: Record<string, unknown>;
  error_fields?: string[];
  row_number?: number;
}

interface ImportResult {
  success: boolean;
  message: string;
  errors?: string[];
  total?: number;
  success_count?: number;
  failed_count?: number;
  messages?: ImportMessage[];
  failed_data?: ImportMessage[];
}

interface ImportExportPanelProps {
  type?: DataType;
  onImportComplete?: (result: ImportResult) => void;
  importing?: boolean;
  sampleData?: Record<string, string>;
  showExport?: boolean;
  showTemplate?: boolean;
  showImport?: boolean;
  permissions?: {
    import?: string;
    export?: string;
    template?: string;
  };
  onDataExport?: (format: 'excel' | 'csv') => Promise<Blob>;
  onDataImport?: (file: File) => Promise<ImportResult>;
  exportUrl?: string;
  importUrl?: string;
  templateUrl?: string;
  acceptFormats?: string;
}

const TYPE_LABELS: Record<DataType, string> = {
  user: '用户',
  rule: '规则',
  category: '分类',
  class: '班级',
  subject: '科目',
  exam: '考试',
  score: '成绩',
  approval: '审批',
  device: '设备',
  all: '全部',
};

function ImportExportPanel({
  type = 'user',
  onImportComplete,
  importing = false,
  sampleData,
  showExport = true,
  showTemplate = true,
  showImport = true,
  permissions,
  onDataExport,
  onDataImport,
  exportUrl,
  importUrl,
  templateUrl,
  acceptFormats = '.xlsx,.xls',
}: ImportExportPanelProps) {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [reImportData, setReImportData] = useState<ImportMessage[] | null>(null);
  const [isReImporting, setIsReImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const typeLabel = TYPE_LABELS[type] || '数据';

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const validExtensions = acceptFormats.split(',').map(f => f.trim().toLowerCase());
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      const isValidExtension = validExtensions.includes(extension);
      const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                      file.type === 'application/vnd.ms-excel';
      const isJson = file.type === 'application/json';

      if (!isValidExtension && !isExcel && !(isJson && validExtensions.includes('.json'))) {
        showToast('error', `仅支持 ${acceptFormats} 格式的文件`);
        e.target.value = '';
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        showToast('error', '文件大小不能超过 50MB');
        e.target.value = '';
        return;
      }

      setImportFile(file);
    }
  };

  const handleImport = useCallback(async () => {
    if (!importFile) {
      showToast('warning', '请先选择要导入的文件');
      return;
    }

    setImportResult(null);
    setImportProgress(0);
    setCurrentStep('正在解析文件...');
    setShowErrorDetails(false);

    try {
      setImportProgress(20);
      setCurrentStep('正在上传文件到服务器...');

      let result: ImportResult;

      if (onDataImport) {
        result = await onDataImport(importFile);
      } else {
        const formData = new FormData();
        formData.append('file', importFile);

        const apiUrl = importUrl || `/api/import_export/import/${type}s`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
          body: formData,
        });

        setImportProgress(60);
        setCurrentStep('正在验证数据格式...');

        result = await response.json();
      }

      setImportProgress(80);
      setCurrentStep('正在处理数据...');

      setImportProgress(100);
      setCurrentStep(result.success ? '导入完成' : '导入完成（存在错误）');
      setImportResult(result);

      if (result.success) {
        showToast('success', result.message || `导入成功：${result.success_count} 条`);
        onImportComplete?.(result);
      } else {
        const msg = result.failed_count
          ? `导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 条`
          : result.message || '导入失败';
        showToast(result.failed_count ? 'warning' : 'error', msg);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      showToast('error', '导入失败: ' + errorMessage);
      setImportResult({ success: false, message: '导入失败: ' + errorMessage });
      setImportProgress(0);
      setCurrentStep('');
    }
  }, [importFile, type, showToast, onImportComplete, onDataImport, importUrl]);

  const handleExport = async (format: 'excel' | 'csv' = 'excel') => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      if (onDataExport) {
        setExportProgress(30);
        const blob = await onDataExport(format);
        setExportProgress(80);
        downloadBlob(blob, `${type}_${format}_${Date.now()}.${format === 'excel' ? 'xlsx' : 'csv'}`);
        setExportProgress(100);
        showToast('success', '导出成功');
      } else {
        setExportProgress(20);
        const apiUrl = exportUrl || `/api/import_export/export/${type}s?format=${format}`;
        const response = await fetch(apiUrl, {
          method: 'GET',
          credentials: 'include',
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || '导出失败');
        }

        setExportProgress(70);
        const blob = await response.blob();

        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `${type}_data_${Date.now()}.${format === 'excel' ? 'xlsx' : 'csv'}`;
        if (contentDisposition) {
          const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
          if (utf8Match) {
            filename = decodeURIComponent(utf8Match[1]);
          } else {
            const asciiMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (asciiMatch) {
              filename = asciiMatch[1];
            }
          }
        }

        downloadBlob(blob, filename);
        setExportProgress(100);
        showToast('success', '导出成功');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      showToast('error', '导出失败: ' + errorMessage);
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 500);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = async () => {
    try {
      showToast('info', '正在下载模板...');
      const apiUrl = templateUrl || `/api/import_export/template/${type}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('下载模板失败');
      }

      const blob = await response.blob();
      downloadBlob(blob, `${typeLabel}_导入模板.xlsx`);
      showToast('success', '模板下载成功');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      showToast('error', '下载模板失败: ' + errorMessage);
    }
  };

  const handleExportErrors = async () => {
    if (!importResult?.messages) return;

    const errors = importResult.messages
      .filter(msg => msg.action === '失败' || msg.action === 'failed')
      .map(msg => ({
        row: msg.row_number || 0,
        field: msg.error_fields?.join(', ') || '',
        message: msg.message,
        value: msg.row_data ? JSON.stringify(msg.row_data).substring(0, 100) : '',
      }));

    if (errors.length === 0) {
      showToast('info', '没有可导出的错误数据');
      return;
    }

    try {
      const response = await fetch('/api/export/errors', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ errors, module: type }),
      });

      if (!response.ok) throw new Error('导出错误数据失败');

      const blob = await response.blob();
      downloadBlob(blob, `导入错误数据_${type}_${Date.now()}.xlsx`);
      showToast('success', '错误数据导出成功');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      showToast('error', '导出错误数据失败: ' + errorMessage);
    }
  };

  const handlePrepareReImport = () => {
    if (!importResult?.messages) return;
    const failedMessages = importResult.messages.filter(
      msg => msg.action === '失败' || msg.action === 'failed'
    );
    if (failedMessages.length > 0) {
      setReImportData(failedMessages);
    }
  };

  const handleReImport = async () => {
    if (!reImportData || reImportData.length === 0) return;

    setIsReImporting(true);
    try {
      const validRows = reImportData
        .filter(msg => msg.row_data)
        .map(msg => msg.row_data!);

      if (validRows.length === 0) {
        showToast('warning', '没有可修正重新导入的数据');
        setReImportData(null);
        setIsReImporting(false);
        return;
      }

      const response = await fetch(`/api/import_export/import/${type}s`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ data: validRows, is_re_import: true }),
      });

      if (!response.ok) throw new Error('重新导入失败');

      const result = await response.json();
      if (result.success) {
        showToast('success', `重新导入成功：${result.success_count || 0} 条`);
        onImportComplete?.(result);
        setReImportData(null);
      } else {
        showToast('error', result.message || '重新导入失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      showToast('error', '重新导入失败: ' + errorMessage);
    } finally {
      setIsReImporting(false);
    }
  };

  const handleRemoveFile = () => {
    setImportFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetImportState = () => {
    setIsImportModalOpen(false);
    setImportFile(null);
    setImportResult(null);
    setImportProgress(0);
    setCurrentStep('');
    setShowErrorDetails(false);
    setReImportData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {showImport && (
        permissions?.import ? (
          <PermissionButton
            permission={permissions.import}
            onClick={() => setIsImportModalOpen(true)}
            variant="outline"
            className="w-full justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            导入{typeLabel}数据
          </PermissionButton>
        ) : (
          <Button
            onClick={() => setIsImportModalOpen(true)}
            variant="outline"
            className="w-full justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            导入{typeLabel}数据
          </Button>
        )
      )}

      {showExport && (
        permissions?.export ? (
          <PermissionButton
            permission={permissions.export}
            onClick={() => handleExport('excel')}
            variant="outline"
            className="w-full justify-center gap-2"
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            {isExporting ? `导出中 ${exportProgress}%` : `导出${typeLabel}数据 (Excel)`}
          </PermissionButton>
        ) : (
          <Button
            onClick={() => handleExport('excel')}
            variant="outline"
            className="w-full justify-center gap-2"
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            {isExporting ? `导出中 ${exportProgress}%` : `导出${typeLabel}数据 (Excel)`}
          </Button>
        )
      )}

      {showTemplate && (
        permissions?.template ? (
          <PermissionButton
            permission={permissions.template}
            onClick={handleDownloadTemplate}
            variant="ghost"
            className="w-full justify-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <Download className="w-4 h-4" />
            下载导入模板
          </PermissionButton>
        ) : (
          <Button
            onClick={handleDownloadTemplate}
            variant="ghost"
            className="w-full justify-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <Download className="w-4 h-4" />
            下载导入模板
          </Button>
        )
      )}

      <Modal
        isOpen={isImportModalOpen}
        onClose={resetImportState}
        title={`导入${typeLabel}数据`}
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-700 mb-1">
              <strong>操作指引：</strong>
            </p>
            <ul className="text-xs text-blue-600 space-y-0.5 list-disc list-inside">
              <li>先下载标准导入模板（包含表头、示例数据和填写说明）</li>
              <li>在模板中填写数据，注意各字段的格式要求</li>
              <li>选择填写好的 Excel 文件（支持 .xlsx 和 .xls 格式）</li>
              <li>提交后系统将自动验证数据格式并返回导入结果</li>
            </ul>
          </div>

          {sampleData && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">模板字段：</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(sampleData).map(([key, value]) => (
                  <span key={key} className="px-2 py-0.5 bg-white rounded text-xs text-gray-600 border">
                    {key}
                    {value && <span className="text-gray-400"> ({value})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-primary-400 hover:bg-primary-50/30 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptFormats}
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 mb-1 text-sm">点击或拖拽文件到此处</p>
            <p className="text-xs text-gray-400">仅支持 {acceptFormats} 格式，最大 50MB</p>
          </div>

          {importFile && (
            <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary-500" />
                <div>
                  <span className="text-sm font-medium">{importFile.name}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    ({(importFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              </div>
              <button onClick={handleRemoveFile} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {(importing || importProgress > 0) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 flex items-center gap-1">
                  {importProgress < 100 && <Loader2 className="w-3 h-3 animate-spin" />}
                  {currentStep}
                </span>
                <span className="text-gray-500">{importProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ease-out ${
                    importProgress === 100 ? 'bg-green-500' : 'bg-primary-500'
                  }`}
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          {importResult && (
            <div className={`rounded-lg p-4 ${
              importResult.success
                ? 'bg-green-50 border border-green-200'
                : importResult.failed_count
                  ? 'bg-amber-50 border border-amber-200'
                  : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {importResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className={`w-5 h-5 ${importResult.failed_count ? 'text-amber-500' : 'text-red-500'}`} />
                  )}
                  <span className={`font-medium ${
                    importResult.success ? 'text-green-700' : importResult.failed_count ? 'text-amber-700' : 'text-red-700'
                  }`}>
                    {importResult.message}
                  </span>
                </div>
              </div>

              {(importResult.total !== undefined || importResult.success_count !== undefined || importResult.failed_count !== undefined) && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white rounded-lg p-2 text-center border">
                    <p className="text-lg font-bold text-gray-700">{importResult.total || 0}</p>
                    <p className="text-xs text-gray-500">总计</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center border border-green-200">
                    <p className="text-lg font-bold text-green-600">{importResult.success_count || 0}</p>
                    <p className="text-xs text-green-600">成功</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center border border-red-200">
                    <p className="text-lg font-bold text-red-600">{importResult.failed_count || 0}</p>
                    <p className="text-xs text-red-600">失败</p>
                  </div>
                </div>
              )}

              {importResult.messages && importResult.messages.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowErrorDetails(!showErrorDetails)}
                    className="flex items-center justify-between w-full p-2 bg-white rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-gray-700">
                        导入详情 ({importResult.messages.length} 条)
                      </span>
                    </div>
                    {showErrorDetails ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {showErrorDetails && (
                    <div className="mt-2 max-h-60 overflow-y-auto space-y-1 border rounded-lg bg-white">
                      {importResult.messages.slice(0, 50).map((msg, index) => (
                        <div
                          key={index}
                          className={`p-2 text-sm border-b last:border-b-0 ${
                            msg.action === '成功' || msg.action === 'created' || msg.action === 'success'
                              ? 'bg-green-50/50'
                              : 'bg-red-50/50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                              msg.action === '成功' || msg.action === 'created' || msg.action === 'success'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {msg.action}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={
                                msg.action === '失败' || msg.action === 'failed'
                                  ? 'text-red-600'
                                  : 'text-green-600'
                              }>
                                {msg.message}
                              </p>
                              {msg.error_fields && msg.error_fields.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {msg.error_fields.map((field, fidx) => (
                                    <span key={fidx} className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-xs">
                                      {field}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {importResult.messages.length > 50 && (
                        <div className="p-2 text-xs text-gray-500 text-center bg-gray-50">
                          仅显示前50条，完整错误信息请导出查看
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {importResult.failed_count && importResult.failed_count > 0 && (
                <div className="mt-3 flex gap-2">
                  <Button
                    onClick={handleExportErrors}
                    variant="outline"
                    size="sm"
                    className="gap-1 flex-1 justify-center"
                  >
                    <Download className="w-4 h-4" />
                    导出错误数据
                  </Button>
                  <Button
                    onClick={handlePrepareReImport}
                    variant="outline"
                    size="sm"
                    className="gap-1 flex-1 justify-center"
                  >
                    <RefreshCw className="w-4 h-4" />
                    准备重新导入
                  </Button>
                </div>
              )}
            </div>
          )}

          {reImportData && reImportData.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-amber-500" />
                  <span className="font-medium text-amber-700">批量修正重新导入</span>
                </div>
                <span className="text-sm text-amber-600">共 {reImportData.length} 条错误数据</span>
              </div>
              <p className="text-xs text-amber-600 mb-3">
                以下是导入失败的数据，您可以修改后重新导入
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
                {reImportData.slice(0, 20).map((msg, idx) => (
                  <div key={idx} className="text-xs p-2 bg-white rounded border border-amber-100">
                    <span className="text-red-500 font-medium">
                      行{msg.row_number || idx + 1}:
                    </span>
                    <span className="text-gray-600 ml-1">{msg.message}</span>
                    {msg.row_data && (
                      <div className="mt-1 text-gray-400 truncate">
                        {Object.entries(msg.row_data).map(([k, v]) => `${k}:${v}`).join(' | ')}
                      </div>
                    )}
                  </div>
                ))}
                {reImportData.length > 20 && (
                  <div className="text-xs text-amber-500 text-center">
                    ... 还有 {reImportData.length - 20} 条
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setReImportData(null)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={handleReImport}
                  size="sm"
                  className="flex-1"
                  disabled={isReImporting}
                >
                  {isReImporting ? (
                    <><Loader2 className="w-3 h-3 animate-spin mr-1" />重新导入中</>
                  ) : (
                    '修正后重新导入'
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={resetImportState}
              variant="outline"
              className="flex-1"
            >
              {importResult ? '关闭' : '取消'}
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importFile || importing || (importProgress > 0 && importProgress < 100)}
              className="flex-1"
            >
              {importing || (importProgress > 0 && importProgress < 100) ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  导入中...
                </>
              ) : (
                '开始导入'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ImportExportPanel;
