import React from 'react';
import { X, Upload, Download, RefreshCw } from 'lucide-react';
import type { NLPDeps } from './types';

export function BatchImportModal({ deps }: { deps: NLPDeps }): React.ReactElement {
  const {
    setShowBatchImportModal,
    setImportFile,
    setImportJsonText,
    importFile,
    importJsonText,
    handleDownloadTemplate,
    handleBatchImport,
    isImporting,
  } = deps;

  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-xl p-6 w-full max-w-lg mx-4'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold text-gray-800'>批量导入规则</h3>
          <button
            onClick={() => {
              setShowBatchImportModal(false);
              setImportFile(null);
              setImportJsonText('');
            }}
            className='text-gray-400 hover:text-gray-600'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='space-y-4'>
          <div className='p-4 bg-blue-50 rounded-lg'>
            <p className='text-sm text-blue-700'>
              可以通过上传JSON文件或直接输入JSON数据来批量导入规则。
            </p>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>上传JSON文件</label>
            <div className='border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-blue-400 cursor-pointer'>
              <input
                type='file'
                accept='.json'
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] || null);
                  setImportJsonText('');
                }}
                className='hidden'
                id='import-file'
              />
              <label htmlFor='import-file' className='cursor-pointer'>
                <Upload className='w-8 h-8 text-gray-400 mx-auto mb-2' />
                <p className='text-sm text-gray-600'>点击或拖拽上传文件</p>
                {importFile && <p className='text-sm text-blue-600 mt-1'>{importFile.name}</p>}
              </label>
            </div>
          </div>

          <div className='flex items-center justify-center py-2'>
            <span className='text-gray-400 text-sm'>或</span>
          </div>

          <div>
            <div className='flex items-center justify-between mb-2'>
              <label className='block text-sm font-medium text-gray-700'>
                直接输入JSON数据
              </label>
              <button
                onClick={handleDownloadTemplate}
                className='text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1'
              >
                <Download className='w-4 h-4' />
                下载模板
              </button>
            </div>
            <textarea
              value={importJsonText}
              onChange={(e) => {
                setImportJsonText(e.target.value);
                setImportFile(null);
              }}
              placeholder='[{"behavior_keyword": "关键词", "behavior_description": "描述", "score_value": 5, "score_type": "add", "behavior_tags": ["标签"], "match_pattern": "", "priority": 1}]'
              rows={8}
              className='w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm'
            />
          </div>
        </div>

        <div className='flex gap-3 mt-6'>
          <button
            onClick={() => {
              setShowBatchImportModal(false);
              setImportFile(null);
              setImportJsonText('');
            }}
            className='flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50'
          >
            取消
          </button>
          <button
            onClick={handleBatchImport}
            disabled={isImporting}
            className='flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center gap-2 disabled:opacity-50'
          >
            {isImporting ? (
              <>
                <RefreshCw className='w-4 h-4 animate-spin' />
                导入中...
              </>
            ) : (
              <>
                <Upload className='w-4 h-4' />
                开始导入
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
