import React from 'react';
/**
 * 固件管理页视图层。
 *
 * 承接原 FirmwareManagement.tsx 的主渲染 JSX，全部数据经
 * FirmwareManagementViewProps 注入，不含任何数据获取逻辑。
 */

import { RefreshCw, Upload, CheckCircle, XCircle, Clock, Activity } from 'lucide-react';
import { Button, Modal, PermissionButton, DataTable, Pagination } from '../../components';
import { formatFileSize } from '../../utils/format';
import type { Firmware, FirmwareRecord } from '../../services/api';
import type { FirmwareManagementViewProps } from './types';

const FirmwareManagementView: React.FC<FirmwareManagementViewProps> = ({
  versions,
  versionsPage,
  versionsPerPage,
  setVersionsPage,
  otaStatus,
  upgradeRecords,
  versionColumns,
  recordColumns,
  handleRefresh,
  isRefreshing,
  uploadForm,
  setUploadForm,
  handleFileSelect,
  handleUpload,
  uploadFile,
  isUploading,
  showUploadModal,
  openUploadModal,
  closeUploadModal,
}) => {
  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold text-gray-900'>固件管理</h1>
        <div className='flex items-center gap-3'>
          <Button onClick={handleRefresh} variant='secondary' disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? '刷新中...' : '刷新'}
          </Button>
          {/* S1: 后端无 firmware 权限码，固件管理属系统级操作 → system.settings */}
          <PermissionButton permission='system.settings' onClick={() => openUploadModal()}>
            <Upload className='w-4 h-4 mr-2' />
            上传固件
          </PermissionButton>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div className='card'>
          <div className='flex items-center gap-3'>
            <div className='p-3 bg-blue-100 rounded-lg'>
              <Activity className='w-6 h-6 text-blue-600' />
            </div>
            <div>
              <p className='text-sm text-gray-500'>固件版本</p>
              <p className='text-2xl font-bold'>{versions.total}</p>
            </div>
          </div>
        </div>
        <div className='card'>
          <div className='flex items-center gap-3'>
            <div className='p-3 bg-green-100 rounded-lg'>
              <CheckCircle className='w-6 h-6 text-green-600' />
            </div>
            <div>
              <p className='text-sm text-gray-500'>升级成功</p>
              <p className='text-2xl font-bold'>
                {otaStatus ? otaStatus.summary?.completed_count || 0 : '--'}
              </p>
            </div>
          </div>
        </div>
        <div className='card'>
          <div className='flex items-center gap-3'>
            <div className='p-3 bg-yellow-100 rounded-lg'>
              <Clock className='w-6 h-6 text-yellow-600' />
            </div>
            <div>
              <p className='text-sm text-gray-500'>进行中</p>
              <p className='text-2xl font-bold'>
                {otaStatus ? otaStatus.summary?.in_progress_count || 0 : '--'}
              </p>
            </div>
          </div>
        </div>
        <div className='card'>
          <div className='flex items-center gap-3'>
            <div className='p-3 bg-red-100 rounded-lg'>
              <XCircle className='w-6 h-6 text-red-600' />
            </div>
            <div>
              <p className='text-sm text-gray-500'>升级失败</p>
              <p className='text-2xl font-bold'>
                {otaStatus ? otaStatus.summary?.failed_count || 0 : '--'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className='card'>
        <h2 className='text-lg font-semibold mb-4'>固件版本列表</h2>
        <DataTable<Firmware>
          columns={versionColumns}
          dataSource={versions.items}
          loading={versions.loading}
          rowKey='id'
          empty={{
            title: '暂无固件版本',
            description: '请上传固件',
          }}
          scroll={{ x: 1000 }}
        />
        {versions.total > 0 && (
          <Pagination
            currentPage={versionsPage}
            totalPages={Math.max(1, Math.ceil(versions.total / versionsPerPage))}
            onPageChange={setVersionsPage}
            totalItems={versions.total}
            itemsPerPage={versionsPerPage}
          />
        )}
      </div>

      <div className='card'>
        <h2 className='text-lg font-semibold mb-4'>升级记录</h2>
        <DataTable<FirmwareRecord>
          columns={recordColumns}
          dataSource={upgradeRecords}
          rowKey='id'
          empty={{
            title: '暂无升级记录',
          }}
          scroll={{ x: 1000 }}
        />
      </div>

      <Modal isOpen={showUploadModal} onClose={closeUploadModal} title='上传固件'>
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              固件版本 <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={uploadForm.version}
              onChange={(e) => setUploadForm({ version: e.target.value })}
              placeholder='例如: v1.0.0'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>版本描述</label>
            <textarea
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ description: e.target.value })}
              placeholder='描述此版本的功能和变化'
              rows={3}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>最低兼容版本</label>
            <input
              type='text'
              value={uploadForm.min_compatible_version}
              onChange={(e) => setUploadForm({ min_compatible_version: e.target.value })}
              placeholder='例如: v0.8.0'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div>
            <label className='flex items-center gap-2'>
              <input
                type='checkbox'
                checked={uploadForm.is_mandatory}
                onChange={(e) => setUploadForm({ is_mandatory: e.target.checked })}
                className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
              />
              <span className='text-sm font-medium text-gray-700'>强制更新</span>
            </label>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              固件文件 <span className='text-red-500'>*</span>
            </label>
            <input
              type='file'
              accept='.bin,.hex,.fw'
              onChange={handleFileSelect}
              className='w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
            />
            <p className='mt-1 text-xs text-gray-500'>支持 .bin, .hex, .fw 格式</p>
          </div>
          {uploadFile && (
            <div className='bg-gray-50 p-3 rounded-lg'>
              <p className='text-sm font-medium text-gray-700'>已选择文件:</p>
              <p className='text-sm text-gray-600'>{uploadFile.name}</p>
              <p className='text-xs text-gray-500'>{formatFileSize(uploadFile.size)}</p>
            </div>
          )}
          <div className='flex justify-end gap-3 pt-4'>
            <Button variant='secondary' onClick={closeUploadModal}>
              取消
            </Button>
            <Button onClick={handleUpload} disabled={isUploading}>
              {isUploading ? '上传中...' : '上传'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FirmwareManagementView;
