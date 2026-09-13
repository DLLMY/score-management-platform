// T12-6 拆分（2026-09-12）：自 RuleSections.tsx 原样搬出，行为逐字节等价。
import { Upload, X, Info, Download } from 'lucide-react';
import { Button } from '../../../components';
import type { RuleViewProps } from '../types';

export function ImportModal({
  showImportModal,
  closeImportModal,
  handleImport,
  importing,
  handleDownloadTemplate,
}: RuleViewProps) {
  return (
    <>
      {showImportModal && (
        <div className='modal-overlay' onClick={closeImportModal}>
          <div className='modal-content max-w-2xl' onClick={(e) => e.stopPropagation()}>
            <div className='modal-header'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center'>
                  <Upload className='w-5 h-5 text-white' />
                </div>
                <div>
                  <h3 className='text-lg font-semibold text-gray-800'>导入规则</h3>
                  <p className='text-xs text-gray-500'>从Excel文件导入积分规则</p>
                </div>
              </div>
              <button
                onClick={closeImportModal}
                className='p-2.5 hover:bg-gray-100 rounded-xl transition-all'
              >
                <X className='w-5 h-5 text-gray-500' />
              </button>
            </div>
            <div className='modal-body'>
              <div className='bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6'>
                <div className='flex items-start gap-3'>
                  <Info className='w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5' />
                  <div>
                    <h4 className='font-medium text-blue-800'>导入说明</h4>
                    <ul className='text-sm text-blue-700 mt-2 space-y-1'>
                      <li>• 支持 Excel 格式文件（.xlsx, .xls）</li>
                      <li>
                        •
                        第一行必须为表头（规则名称、描述、分类名称、分数、是否启用、每日上限、最小间隔(秒)）
                      </li>
                      <li>• 如果分类名称不存在，将自动创建</li>
                      <li>• 如果规则名称已存在，将更新该规则</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-3'>选择导入文件</label>
                <div className='border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary-500 transition-colors'>
                  <input
                    type='file'
                    accept='.xlsx,.xls'
                    onChange={handleImport}
                    className='hidden'
                    id='ruleImportFile'
                    disabled={importing}
                  />
                  <label htmlFor='ruleImportFile' className='cursor-pointer'>
                    <Upload className='w-12 h-12 text-gray-400 mx-auto mb-3' />
                    <p className='text-gray-600 font-medium'>
                      {importing ? '正在导入...' : '点击选择文件或拖拽到此处'}
                    </p>
                    <p className='text-sm text-gray-500 mt-1'>支持 .xlsx, .xls 格式</p>
                  </label>
                </div>
              </div>

              <div className='flex items-center justify-between pt-6 border-t border-gray-100'>
                <Button variant='ghost' onClick={handleDownloadTemplate}>
                  <Download className='w-4 h-4' />
                  下载导入模板
                </Button>
                <Button variant='outline' onClick={closeImportModal}>
                  关闭
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
