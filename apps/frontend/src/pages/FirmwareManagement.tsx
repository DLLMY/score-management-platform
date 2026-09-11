import logger from '../utils/logger';
import { downloadBlob } from '../utils/download';
/* eslint-disable react-hooks/exhaustive-deps */
/**
 * 固件管理页面（逻辑层）。
 *
 * 视图渲染已拆到 ./firmwareManagement/FirmwareManagementView，
 * 本文件只保留数据获取、列定义与交互 handler。
 */

import { useState, useEffect, useCallback, useMemo, useRef, ChangeEvent } from 'react';
import { RefreshCw, Download, Trash2, XCircle, CheckCircle } from 'lucide-react';
import api, { Firmware, FirmwareRecord, OTAStatus, getAuthHeaders } from '../services/api';
import { Badge, PermissionButton, useConfirm, type ColumnType } from '../components';
import FirmwareManagementView from './firmwareManagement/FirmwareManagementView';
import type { UploadFormData } from './firmwareManagement/types';
import { formatDateTime, formatFileSize } from '../utils/format';
import { useForm, useListFetch, useModal, useStableToast } from '../hooks';

function FirmwareManagement() {
  const { showToast } = useStableToast();

  const [versionsPage, setVersionsPage] = useState(1);
  const [versionsPerPage] = useState(20);
  // A 轨：固件版本列表迁 useListFetch（分页独立于 loadData 的 status/records）
  const versions = useListFetch<Firmware>({
    params: { page: versionsPage, pageSize: versionsPerPage },
    fetcher: async ({ page, pageSize }) => {
      const res = await api.firmware.getVersions({ page, per_page: pageSize });
      return { items: res.versions ?? [], total: res.total ?? 0 };
    },
  });
  const [otaStatus, setOtaStatus] = useState<OTAStatus | null>(null);
  const [upgradeRecords, setUpgradeRecords] = useState<FirmwareRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  // 使用 useForm 管理表单状态
  const {
    formData: uploadForm,
    setFormData: setUploadForm,
    resetForm: resetUploadForm,
  } = useForm<UploadFormData>(
    {
      version: '',
      description: '',
      min_compatible_version: '',
      is_mandatory: false,
    },
    {
      version: { required: true, minLength: 1 },
    }
  );

  // 使用 useModal 管理弹窗状态
  const {
    isOpen: showUploadModal,
    open: openUploadModal,
    close: closeUploadModal,
  } = useModal<null>({
    onClose: () => {
      resetUploadForm();
      setUploadFile(null);
    },
  });

  const loadData = useCallback(
    async (showRefreshToast = false): Promise<void> => {
      try {
        if (showRefreshToast) setIsRefreshing(true);

        const [statusRes, recordsRes] = await Promise.all([
          api.firmware.getOTAStatus(),
          api.firmware.getUpgradeRecords(),
        ]);

        setOtaStatus(statusRes);
        setUpgradeRecords(recordsRes.records || []);
      } catch (error: unknown) {
        logger.error('加载固件数据失败:', error);
        showToast('error', '加载固件数据失败');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showToast, versionsPage, versionsPerPage]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = (): void => {
    void loadData(true);
    void versions.refetch();
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      if (
        !file.name.endsWith('.bin') &&
        !file.name.endsWith('.hex') &&
        !file.name.endsWith('.fw')
      ) {
        showToast('error', '只支持 .bin, .hex, .fw 格式的文件');
        return;
      }
      setUploadFile(file);
    }
  };

  const handleUpload = async (): Promise<void> => {
    if (!uploadForm.version) {
      showToast('error', '请输入版本号');
      return;
    }
    if (!uploadFile) {
      showToast('error', '请选择固件文件');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('version', uploadForm.version);
      formData.append('description', uploadForm.description);
      formData.append('min_compatible_version', uploadForm.min_compatible_version);
      formData.append('is_mandatory', uploadForm.is_mandatory.toString());

      await api.firmware.upload(formData);
      showToast('success', '固件上传成功');
      closeUploadModal();
      void loadData(true);
      void versions.refetch();
    } catch (error: unknown) {
      logger.error('上传失败:', error);
      showToast('error', `上传失败: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteVersion = async (version: Firmware): Promise<void> => {
    const ok = await confirmRef.current({
      title: '删除固件',
      message: `确定要删除固件版本 ${version.version} 吗？`,
      confirmText: '删除',
      cancelText: '取消',
      type: 'danger',
    });
    if (!ok) return;

    try {
      await api.firmware.deleteVersion(version.id);
      showToast('success', '删除成功');
      void loadData(true);
      void versions.refetch();
    } catch (error: unknown) {
      logger.error('删除失败:', error);
      showToast('error', `删除失败: ${(error as Error).message}`);
    }
  };

  const handleToggleActive = async (version: Firmware): Promise<void> => {
    try {
      await api.firmware.updateVersion(version.id, {
        is_active: !version.is_active,
      });
      showToast('success', !version.is_active ? '已启用' : '已禁用');
      void loadData(true);
      void versions.refetch();
    } catch (error: unknown) {
      logger.error('更新失败:', error);
      showToast('error', `更新失败: ${(error as Error).message}`);
    }
  };

  // 下载：fetch + blob（带鉴权头）。此前 window.open 不带 token 会 401 打开错误页，且失败无反馈
  const handleDownload = async (version: Firmware): Promise<void> => {
    try {
      const response = await fetch(`/api/firmware/download/${version.id}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error(`下载失败(${response.status})`);
      const blob = await response.blob();
      downloadBlob(blob, `${version.version || 'firmware'}.bin`);
      showToast('success', '下载开始');
    } catch (err) {
      logger.error('固件下载失败:', err);
      showToast('error', '下载失败: ' + ((err as Error).message || ''));
    }
  };

  const versionColumns = useMemo<ColumnType<Firmware>[]>(
    () => [
      {
        title: '版本',
        key: 'version',
        dataIndex: 'version',
        render: (value) => <span className='font-medium text-blue-600'>{String(value)}</span>,
      },
      {
        title: '描述',
        key: 'description',
        dataIndex: 'description',
        render: (value) => <span className='text-gray-600 text-sm'>{String(value || '-')}</span>,
      },
      {
        title: '文件大小',
        key: 'file_size',
        dataIndex: 'file_size',
        render: (value) => (
          <span className='text-gray-600 text-sm'>{formatFileSize(value as number)}</span>
        ),
      },
      {
        title: 'MD5',
        key: 'md5',
        dataIndex: 'md5',
        render: (value) => (
          <span className='text-gray-600 text-xs font-mono'>
            {(value as string)?.substring(0, 12)}...
          </span>
        ),
      },
      {
        title: '强制更新',
        key: 'is_mandatory',
        dataIndex: 'is_mandatory',
        render: (value) =>
          value ? <Badge variant='danger'>是</Badge> : <Badge variant='default'>否</Badge>,
      },
      {
        title: '状态',
        key: 'is_active',
        dataIndex: 'is_active',
        render: (value) =>
          value ? <Badge variant='success'>已启用</Badge> : <Badge variant='warning'>已禁用</Badge>,
      },
      {
        title: '创建时间',
        key: 'created_at',
        dataIndex: 'created_at',
        render: (value) => (
          <span className='text-gray-600 text-sm'>{formatDateTime(value as string)}</span>
        ),
      },
      {
        title: '操作',
        key: 'actions',
        dataIndex: 'actions',
        render: (_v, v) => (
          <div className='flex items-center gap-2'>
            <PermissionButton
              /* S1: firmware.view 后端无此码 → system.settings */
              permission='system.settings'
              onClick={() => handleDownload(v)}
              disabled={!v.file_path}
              className='p-1 text-blue-600 hover:text-blue-800 disabled:text-gray-300 disabled:hover:text-gray-300'
              title={v.file_path ? '下载' : '该版本无固件文件，无法下载'}
            >
              <Download className='w-4 h-4' />
            </PermissionButton>
            <PermissionButton
              permission='system.settings'
              onClick={() => handleToggleActive(v)}
              className={`p-1 ${
                v.is_active
                  ? 'text-yellow-600 hover:text-yellow-800'
                  : 'text-green-600 hover:text-green-800'
              }`}
              title={v.is_active ? '禁用' : '启用'}
            >
              {v.is_active ? <XCircle className='w-4 h-4' /> : <CheckCircle className='w-4 h-4' />}
            </PermissionButton>
            <PermissionButton
              permission='system.settings'
              onClick={() => handleDeleteVersion(v)}
              className='p-1 text-red-600 hover:text-red-800'
              title='删除'
            >
              <Trash2 className='w-4 h-4' />
            </PermissionButton>
          </div>
        ),
      },
    ],
    [handleDownload, handleToggleActive, handleDeleteVersion]
  );

  const recordColumns = useMemo<ColumnType<FirmwareRecord>[]>(
    () => [
      {
        title: '设备ID',
        key: 'device_id',
        dataIndex: 'device_id',
        render: (value) => <span className='font-mono text-sm'>{String(value)}</span>,
      },
      {
        title: '设备名称',
        key: 'device_name',
        dataIndex: 'device_name',
        render: (value) => <span className='text-sm'>{String(value || '-')}</span>,
      },
      {
        title: '原版本',
        key: 'from_version',
        dataIndex: 'from_version',
        render: (value) => <span className='text-sm'>{String(value || '-')}</span>,
      },
      {
        title: '目标版本',
        key: 'to_version',
        dataIndex: 'to_version',
        render: (value) => <span className='font-medium text-blue-600'>{String(value)}</span>,
      },
      {
        title: '状态',
        key: 'status',
        dataIndex: 'status',
        render: (value) => {
          const status = value as FirmwareRecord['status'];
          return (
            <>
              {status === 'completed' && <Badge variant='success'>成功</Badge>}
              {status === 'in_progress' && <Badge variant='warning'>进行中</Badge>}
              {status === 'failed' && <Badge variant='danger'>失败</Badge>}
              {status === 'pending' && <Badge variant='default'>等待中</Badge>}
            </>
          );
        },
      },
      {
        title: '开始时间',
        key: 'started_at',
        dataIndex: 'started_at',
        render: (value) => (
          <span className='text-gray-600 text-sm'>{formatDateTime(value as string)}</span>
        ),
      },
      {
        title: '完成时间',
        key: 'completed_at',
        dataIndex: 'completed_at',
        render: (value) => (
          <span className='text-gray-600 text-sm'>{formatDateTime(value as string)}</span>
        ),
      },
      {
        title: '错误信息',
        key: 'error_message',
        dataIndex: 'error_message',
        render: (value) => <span className='text-red-600 text-sm'>{String(value || '-')}</span>,
      },
    ],
    []
  );

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <RefreshCw className='w-8 h-8 animate-spin text-blue-600' />
      </div>
    );
  }

  return (
    <FirmwareManagementView
      versions={versions}
      versionsPage={versionsPage}
      versionsPerPage={versionsPerPage}
      setVersionsPage={setVersionsPage}
      otaStatus={otaStatus}
      upgradeRecords={upgradeRecords}
      versionColumns={versionColumns}
      recordColumns={recordColumns}
      handleRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      uploadForm={uploadForm}
      setUploadForm={setUploadForm}
      handleFileSelect={handleFileSelect}
      handleUpload={handleUpload}
      uploadFile={uploadFile}
      isUploading={isUploading}
      showUploadModal={showUploadModal}
      openUploadModal={openUploadModal}
      closeUploadModal={closeUploadModal}
    />
  );
}

export default FirmwareManagement;
