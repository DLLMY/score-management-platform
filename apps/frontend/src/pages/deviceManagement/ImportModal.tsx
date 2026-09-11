import { FileSpreadsheet, CheckCircle, XCircle, Download } from 'lucide-react';
import { Button, Modal } from '../../components';
import type { DeviceImportResult } from './types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  importFile: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importResult: DeviceImportResult | null;
  isImporting: boolean;
  onSubmit: () => void;
  onExportErrors: () => void;
}

export function ImportModal({
  isOpen,
  onClose,
  importFile,
  onFileChange,
  importResult,
  isImporting,
  onSubmit,
  onExportErrors,
}: ImportModalProps) {
  return (
    <Modal
      title='导入设备数据'
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={!importFile || isImporting}>
            {isImporting ? '导入中...' : '开始导入'}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div
          className='border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer'
          onClick={() => document.getElementById('device-import-file')?.click()}
        >
          <input
            id='device-import-file'
            type='file'
            accept='.xlsx,.xls'
            onChange={onFileChange}
            className='hidden'
          />
          <FileSpreadsheet className='w-12 h-12 mx-auto text-gray-400 mb-3' />
          <p className='text-gray-600'>点击或拖拽文件到此处上传</p>
          <p className='text-sm text-gray-400 mt-1'>支持 .xlsx, .xls 格式</p>
          {importFile && <p className='text-sm text-green-600 mt-2'>已选择: {importFile.name}</p>}
        </div>

        <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
          <h4 className='font-medium text-blue-800 mb-2'>导入模板说明</h4>
          <ul className='text-sm text-blue-600 space-y-1'>
            <li>• 设备标识(device_id)：必填，唯一标识</li>
            <li>• 设备名称(name)：选填，设备显示名称</li>
            <li>• 班级名称(class_name)：选填，关联班级名称</li>
            <li>• 管理员姓名(admin_name)：选填，关联管理员姓名</li>
          </ul>
        </div>

        {importResult && (
          <div className='mt-4 p-4 rounded-lg border'>
            {importResult.success ? (
              <div className='bg-green-50 border-green-200'>
                <div className='flex items-center gap-2 mb-3'>
                  <CheckCircle className='w-5 h-5 text-green-600' />
                  <span className='font-medium text-green-800'>导入成功</span>
                </div>
                <div className='grid grid-cols-3 gap-4 mb-3'>
                  <div className='text-center'>
                    <div className='text-xl font-bold text-gray-900'>{importResult.total}</div>
                    <div className='text-sm text-gray-500'>总数</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-xl font-bold text-green-600'>
                      {importResult.success_count}
                    </div>
                    <div className='text-sm text-gray-500'>成功</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-xl font-bold text-red-600'>
                      {importResult.failed_count}
                    </div>
                    <div className='text-sm text-gray-500'>失败</div>
                  </div>
                </div>
                {importResult.messages && importResult.messages.length > 0 && (
                  <div className='max-h-40 overflow-y-auto'>
                    <div className='flex items-center justify-between mb-2'>
                      <p className='text-sm font-medium text-gray-700'>详细信息：</p>
                      {importResult.failed_count && importResult.failed_count > 0 && (
                        <Button
                          size='sm'
                          variant='secondary'
                          onClick={onExportErrors}
                          className='ml-2'
                        >
                          <Download className='w-3 h-3 mr-1' />
                          导出错误数据
                        </Button>
                      )}
                    </div>
                    {importResult.messages.map((msg, idx) => (
                      <p
                        key={idx}
                        className={`text-xs ${
                          msg.action === '成功'
                            ? 'text-green-600'
                            : msg.action === '警告'
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        [{msg.action}] {msg.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className='bg-red-50 border-red-200'>
                <div className='flex items-center gap-2'>
                  <XCircle className='w-5 h-5 text-red-600' />
                  <span className='font-medium text-red-800'>导入失败</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
