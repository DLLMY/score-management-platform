import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import {
  RefreshCw,
  Upload,
  Trash2,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
} from 'lucide-react';
import api, { Firmware, FirmwareRecord, OTAStatus } from '../services/api';
import { useForm, useModal, useConfirmDialog } from '../hooks';
import { Button, Modal, Badge, PermissionButton } from '../components';
import { useStableToast } from '../hooks/useStableToast';

interface UploadFormData {
  version: string;
  description: string;
  min_compatible_version: string;
  is_mandatory: boolean;
  [key: string]: unknown;
}

const formatFileSize = (bytes: number | undefined): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTime = (timestamp: string | undefined): string => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN');
};

function FirmwareManagement() {
  const { showToast } = useStableToast();

  const [versions, setVersions] = useState<Firmware[]>([]);
  const [otaStatus, setOtaStatus] = useState<OTAStatus | null>(null);
  const [upgradeRecords, setUpgradeRecords] = useState<FirmwareRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // 使用 useConfirmDialog 管理确认对话框
  const { show: showConfirm } = useConfirmDialog();

  // 使用 useForm 管理表单状态
  const {
    formData: uploadForm,
    setFormData: setUploadForm,
    resetForm: resetUploadForm,
  } = useForm<UploadFormData>({
    version: '',
    description: '',
    min_compatible_version: '',
    is_mandatory: false,
  }, {
    version: { required: true, minLength: 1 },
  });

  // 使用 useModal 管理弹窗状态
  const { isOpen: showUploadModal, open: openUploadModal, close: closeUploadModal } = useModal<null>({
    onClose: () => {
      resetUploadForm();
      setUploadFile(null);
    },
  });

  const loadData = useCallback(
    async (showRefreshToast = false): Promise<void> => {
      try {
        if (showRefreshToast) setIsRefreshing(true);

        const [versionsRes, statusRes, recordsRes] = await Promise.all([
          api.firmware.getVersions(),
          api.firmware.getOTAStatus(),
          api.firmware.getUpgradeRecords(),
        ]);

        setVersions(versionsRes.versions || []);
        setOtaStatus(statusRes);
        setUpgradeRecords(recordsRes.records || []);
      } catch (error: unknown) {
        console.error('加载固件数据失败:', error);
        showToast('error', '加载固件数据失败');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = (): void => {
    loadData(true);
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
      loadData(true);
    } catch (error: unknown) {
      console.error('上传失败:', error);
      showToast('error', `上传失败: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteVersion = async (version: Firmware): Promise<void> => {
    if (!window.confirm(`确定要删除固件版本 ${version.version} 吗？`)) return;

    try {
      await api.firmware.deleteVersion(version.id);
      showToast('success', '删除成功');
      loadData(true);
    } catch (error: unknown) {
      console.error('删除失败:', error);
      showToast('error', `删除失败: ${(error as Error).message}`);
    }
  };

  const handleToggleActive = async (version: Firmware): Promise<void> => {
    try {
      await api.firmware.updateVersion(version.id, {
        is_active: !version.is_active,
      });
      showToast('success', version.is_active ? '已禁用' : '已启用');
      loadData(true);
    } catch (error: unknown) {
      console.error('更新失败:', error);
      showToast('error', `更新失败: ${(error as Error).message}`);
    }
  };

  const handleDownload = (version: Firmware): void => {
    window.open(`/api/firmware/download/${version.id}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <RefreshCw className='w-8 h-8 animate-spin text-blue-600' />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold text-gray-900'>固件管理</h1>
        <div className='flex items-center gap-3'>
          <Button onClick={handleRefresh} variant='secondary' disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? '刷新中...' : '刷新'}
          </Button>
          <PermissionButton permission='firmware.manage' onClick={() => openUploadModal()}>
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
              <p className='text-2xl font-bold'>{versions.length}</p>
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
              <p className='text-2xl font-bold'>{otaStatus?.summary?.completed_count || 0}</p>
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
              <p className='text-2xl font-bold'>{otaStatus?.summary?.in_progress_count || 0}</p>
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
              <p className='text-2xl font-bold'>{otaStatus?.summary?.failed_count || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className='card'>
        <h2 className='text-lg font-semibold mb-4'>固件版本列表</h2>
        {versions.length === 0 ? (
          <div className='text-center py-8 text-gray-500'>暂无固件版本，请上传固件</div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-gray-200'>
              <thead className='bg-gray-50'>
                <tr>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    版本
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    描述
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    文件大小
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    MD5
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    强制更新
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    状态
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    创建时间
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200'>
                {versions.map((v) => (
                  <tr key={v.id} className='hover:bg-gray-50'>
                    <td className='px-4 py-3 font-medium text-blue-600'>{v.version}</td>
                    <td className='px-4 py-3 text-gray-600 text-sm'>{v.description || '-'}</td>
                    <td className='px-4 py-3 text-gray-600 text-sm'>
                      {formatFileSize(v.file_size)}
                    </td>
                    <td className='px-4 py-3 text-gray-600 text-xs font-mono'>
                      {v.md5?.substring(0, 12)}...
                    </td>
                    <td className='px-4 py-3'>
                      {v.is_mandatory ? (
                        <Badge variant='danger'>是</Badge>
                      ) : (
                        <Badge variant='default'>否</Badge>
                      )}
                    </td>
                    <td className='px-4 py-3'>
                      {v.is_active ? (
                        <Badge variant='success'>已启用</Badge>
                      ) : (
                        <Badge variant='warning'>已禁用</Badge>
                      )}
                    </td>
                    <td className='px-4 py-3 text-gray-600 text-sm'>{formatTime(v.created_at)}</td>
                    <td className='px-4 py-3'>
                      <div className='flex items-center gap-2'>
                        <PermissionButton
                          permission='firmware.view'
                          onClick={() => handleDownload(v)}
                          className='p-1 text-blue-600 hover:text-blue-800'
                          title='下载'
                        >
                          <Download className='w-4 h-4' />
                        </PermissionButton>
                        <PermissionButton
                          permission='firmware.manage'
                          onClick={() => handleToggleActive(v)}
                          className={`p-1 ${v.is_active ? 'text-yellow-600 hover:text-yellow-800' : 'text-green-600 hover:text-green-800'}`}
                          title={v.is_active ? '禁用' : '启用'}
                        >
                          {v.is_active ? (
                            <XCircle className='w-4 h-4' />
                          ) : (
                            <CheckCircle className='w-4 h-4' />
                          )}
                        </PermissionButton>
                        <PermissionButton
                          permission='firmware.manage'
                          onClick={() => handleDeleteVersion(v)}
                          className='p-1 text-red-600 hover:text-red-800'
                          title='删除'
                        >
                          <Trash2 className='w-4 h-4' />
                        </PermissionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className='card'>
        <h2 className='text-lg font-semibold mb-4'>升级记录</h2>
        {upgradeRecords.length === 0 ? (
          <div className='text-center py-8 text-gray-500'>暂无升级记录</div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-gray-200'>
              <thead className='bg-gray-50'>
                <tr>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    设备ID
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    设备名称
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    原版本
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    目标版本
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    状态
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    开始时间
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    完成时间
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    错误信息
                  </th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200'>
                {upgradeRecords.map((r) => (
                  <tr key={r.id} className='hover:bg-gray-50'>
                    <td className='px-4 py-3 font-mono text-sm'>{r.device_id}</td>
                    <td className='px-4 py-3 text-sm'>{r.device_name || '-'}</td>
                    <td className='px-4 py-3 text-sm'>{r.from_version || '-'}</td>
                    <td className='px-4 py-3 font-medium text-blue-600'>{r.to_version}</td>
                    <td className='px-4 py-3'>
                      {r.status === 'completed' && <Badge variant='success'>成功</Badge>}
                      {r.status === 'in_progress' && <Badge variant='warning'>进行中</Badge>}
                      {r.status === 'failed' && <Badge variant='danger'>失败</Badge>}
                      {r.status === 'pending' && <Badge variant='default'>等待中</Badge>}
                    </td>
                    <td className='px-4 py-3 text-gray-600 text-sm'>{formatTime(r.started_at)}</td>
                    <td className='px-4 py-3 text-gray-600 text-sm'>
                      {formatTime(r.completed_at)}
                    </td>
                    <td className='px-4 py-3 text-red-600 text-sm'>{r.error_message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
              onChange={(e) =>
                setUploadForm({ min_compatible_version: e.target.value })
              }
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
}

export default FirmwareManagement;
