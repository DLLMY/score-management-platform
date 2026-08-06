// -*- coding: utf-8 -*-
/**
 * 设备分组管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Monitor,
  CheckCircle,
  XCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import api from '../services/api';
import { useForm, useModal, useConfirmDialog } from '../hooks';
import { Button, Modal, Badge, EmptyState, PermissionButton } from '../components';
import { useStableToast } from '../hooks/useStableToast';
import { Device } from '../types';

// ========== Types ==========

interface FormData {
  name: string;
  description: string;
  location: string;
  icon: string;
  color: string;
  sort_order: number;
  [key: string]: unknown;
}

interface DeviceGroup {
  id: number;
  name: string;
  description: string;
  location: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  device_count: number;
  created_at: string;
  updated_at: string;
}

interface DeviceInGroup {
  id: number;
  device_id: number;
  device: {
    id: number;
    device_id: string;
    name: string;
    status: string;
  } | null;
  added_at: string;
}

interface GroupStats {
  group_id: number;
  group_name: string;
  location: string;
  total_devices: number;
  online_devices: number;
  offline_devices: number;
}

// ========== Constants ==========

const ICON_OPTIONS = [
  { value: 'Layers', label: '分层' },
  { value: 'Monitor', label: '显示器' },
  { value: 'Building2', label: '建筑' },
  { value: 'School', label: '学校' },
  { value: 'Grid', label: '网格' },
  { value: 'Box', label: '箱子' },
];

const COLOR_OPTIONS = [
  { value: '#3B82F6', label: '蓝色' },
  { value: '#10B981', label: '绿色' },
  { value: '#F59E0B', label: '橙色' },
  { value: '#EF4444', label: '红色' },
  { value: '#8B5CF6', label: '紫色' },
  { value: '#EC4899', label: '粉色' },
];

// ========== Component ==========

function DeviceGroupPage() {
  const { showToast } = useStableToast();
  
  // State
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [stats, setStats] = useState<GroupStats[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DeviceGroup | null>(null);
  const [groupDevices, setGroupDevices] = useState<DeviceInGroup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Selected devices for adding to group
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  
  // 使用 useConfirmDialog 管理确认对话框
  const { show: showConfirm } = useConfirmDialog();
  
  // 使用 useForm 管理表单状态
  const {
    formData: groupForm,
    setFormData: setGroupForm,
    resetForm: resetGroupForm,
  } = useForm<FormData>({
    name: '',
    description: '',
    location: '',
    icon: 'Layers',
    color: '#3B82F6',
    sort_order: 0,
  }, {
    name: { required: true, minLength: 1, maxLength: 50 },
  });
  
  // 使用 useModal 管理弹窗状态
  const { isOpen: showCreateModal, open: openCreateModal, close: closeCreateModal } = useModal<null>({
    onClose: () => resetGroupForm(),
  });
  
  const { isOpen: showEditModal, open: openEditModal, close: closeEditModal } = useModal<DeviceGroup | null>({
    onClose: () => resetGroupForm(),
  });
  
  const { isOpen: showDevicesModal, open: openDevicesModal, close: closeDevicesModal } = useModal<DeviceGroup | null>({});
  
  const { isOpen: showAddDevicesModal, open: openAddDevicesModal, close: closeAddDevicesModal } = useModal<DeviceGroup | null>({
    onClose: () => setSelectedDeviceIds([]),
  });
  
  // Fetch functions
  const fetchGroups = useCallback(async () => {
    try {
      const data = await api.deviceGroup.getAll();
      setGroups(data || []);
    } catch (error) {
      console.error('获取分组列表失败:', error);
    }
  }, []);
  
  const fetchStats = useCallback(async () => {
    try {
      const data = await api.deviceGroup.getStats();
      setStats(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取分组统计失败:', error);
    }
  }, []);
  
  const fetchGroupDevices = useCallback(async (groupId: number) => {
    try {
      const data = await api.deviceGroup.getById(groupId);
      setSelectedGroup(data);
      setGroupDevices(data.devices || []);
    } catch (error) {
      console.error('获取分组设备失败:', error);
    }
  }, []);
  
  const fetchAllDevices = useCallback(async () => {
    try {
      const data = await api.devices.getAll();
      setDevices(data.devices || []);
    } catch (error) {
      console.error('获取设备列表失败:', error);
    }
  }, []);
  
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchGroups(), fetchStats()]);
    setIsRefreshing(false);
  }, [fetchGroups, fetchStats]);
  
  // Initial load
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      await loadData();
      setIsLoading(false);
    };
    loadInitialData();
  }, [loadData]);
  
  // Handlers
  const handleCreateGroup = async () => {
    if (!groupForm.name.trim()) {
      showToast('error', '请输入分组名称');
      return;
    }
    
    try {
      await api.deviceGroup.create(groupForm);
      showToast('success', '分组创建成功');
      closeCreateModal();
      setGroupForm({
        name: '',
        description: '',
        location: '',
        icon: 'Layers',
        color: '#3B82F6',
        sort_order: 0,
      });
      await loadData();
    } catch (error: unknown) {
      showToast('error', (error as { response?: { data?: { message?: string } } }).response?.data?.message || '创建失败');
    }
  };
  
  const handleUpdateGroup = async () => {
    if (!selectedGroup) return;
    if (!groupForm.name.trim()) {
      showToast('error', '请输入分组名称');
      return;
    }
    
    try {
      await api.deviceGroup.update(selectedGroup.id, groupForm);
      showToast('success', '分组更新成功');
      closeEditModal();
      await loadData();
    } catch (error: unknown) {
      showToast('error', (error as { response?: { data?: { message?: string } } }).response?.data?.message || '更新失败');
    }
  };
  
  const handleDeleteGroup = async (group: DeviceGroup) => {
    if (!window.confirm(`确定要删除分组"${group.name}"吗？`)) return;
    
    try {
      await api.deviceGroup.delete(group.id);
      showToast('success', '分组删除成功');
      await loadData();
    } catch (error: unknown) {
      showToast('error', (error as { response?: { data?: { message?: string } } }).response?.data?.message || '删除失败');
    }
  };
  
  const handleOpenEditModal = (group: DeviceGroup) => {
    setSelectedGroup(group);
    setGroupForm({
      name: group.name,
      description: group.description || '',
      location: group.location || '',
      icon: group.icon || 'Layers',
      color: group.color || '#3B82F6',
      sort_order: group.sort_order || 0,
    });
    openEditModal(group);
  };
  
  const handleOpenDevicesModal = async (group: DeviceGroup) => {
    setSelectedGroup(group);
    await fetchGroupDevices(group.id);
    openDevicesModal(group);
  };
  
  const handleOpenAddDevicesModal = async (group: DeviceGroup) => {
    setSelectedGroup(group);
    await fetchGroupDevices(group.id);
    await fetchAllDevices();
    setSelectedDeviceIds([]);
    openAddDevicesModal(group);
  };
  
  const handleAddDevicesToGroup = async () => {
    if (!selectedGroup || selectedDeviceIds.length === 0) {
      showToast('error', '请选择要添加的设备');
      return;
    }
    
    try {
      const result = await api.deviceGroup.addDevices(selectedGroup.id, selectedDeviceIds);
      showToast('success', `成功添加 ${result.added_count} 个设备`);
      if (result.skipped && result.skipped.length > 0) {
        showToast('warning', `${result.skipped.length} 个设备因已存在或不存在被跳过`);
      }
      closeAddDevicesModal();
      await loadData();
    } catch (error: unknown) {
      showToast('error', (error as { response?: { data?: { message?: string } } }).response?.data?.message || '添加失败');
    }
  };
  
  const handleRemoveDevicesFromGroup = async (deviceIds: number[]) => {
    if (!selectedGroup || deviceIds.length === 0) return;
    
    try {
      await api.deviceGroup.removeDevices(selectedGroup.id, deviceIds);
      showToast('success', `成功移除 ${deviceIds.length} 个设备`);
      await fetchGroupDevices(selectedGroup.id);
      await loadData();
    } catch (error: unknown) {
      showToast('error', (error as { response?: { data?: { message?: string } } }).response?.data?.message || '移除失败');
    }
  };
  
  // Get group stats（防御：stats 在异步加载完前是 []，万一后端返回非数组也保底）
  const getGroupStats = (groupId: number): GroupStats | undefined => {
    if (!Array.isArray(stats)) return undefined;
    return stats.find((s) => s && s.group_id === groupId);
  };
  
  // Render
  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-full'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500'></div>
      </div>
    );
  }
  
  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-800'>设备分组管理</h1>
          <p className='text-gray-500 mt-1'>管理和组织您的设备分组</p>
        </div>
        <div className='flex flex-wrap gap-3'>
          <Button
            variant='outline'
            icon={RefreshCw}
            onClick={loadData}
            disabled={isRefreshing}
          >
            {isRefreshing ? '刷新中...' : '刷新'}
          </Button>
          <PermissionButton
            permission='device-group.manage'
            variant='primary'
            icon={Plus}
            onClick={() => openCreateModal()}
          >
            新建分组
          </PermissionButton>
        </div>
      </div>
      
      {/* Stats Overview */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-6'>
        <div className='bg-white rounded-lg shadow p-4'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-gray-500 text-sm'>总分组数</p>
              <p className='text-2xl font-bold text-gray-800'>{groups.length}</p>
            </div>
            <Layers className='w-8 h-8 text-blue-500' />
          </div>
        </div>
        <div className='bg-white rounded-lg shadow p-4'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-gray-500 text-sm'>总设备数</p>
              <p className='text-2xl font-bold text-gray-800'>
                {Array.isArray(stats) ? stats.reduce((sum, s) => sum + s.total_devices, 0) : 0}
              </p>
            </div>
            <Monitor className='w-8 h-8 text-green-500' />
          </div>
        </div>
        <div className='bg-white rounded-lg shadow p-4'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-gray-500 text-sm'>在线设备</p>
              <p className='text-2xl font-bold text-green-600'>
                {Array.isArray(stats) ? stats.reduce((sum, s) => sum + s.online_devices, 0) : 0}
              </p>
            </div>
            <CheckCircle className='w-8 h-8 text-green-500' />
          </div>
        </div>
        <div className='bg-white rounded-lg shadow p-4'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-gray-500 text-sm'>离线设备</p>
              <p className='text-2xl font-bold text-red-600'>
                {Array.isArray(stats) ? stats.reduce((sum, s) => sum + s.offline_devices, 0) : 0}
              </p>
            </div>
            <XCircle className='w-8 h-8 text-red-500' />
          </div>
        </div>
      </div>
      
      {/* Group List */}
      {!Array.isArray(groups) || groups.length === 0 ? (
        <EmptyState
          icon='folder'
          title='暂无设备分组'
          description='创建设备分组来更好地组织和管理您的设备'
          actionLabel='创建分组'
          onAction={() => openCreateModal()}
        />
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {groups.map(group => {
            const groupStat = getGroupStats(group.id);
            return (
              <div
                key={group.id}
                className='bg-white rounded-lg shadow hover:shadow-md transition-shadow'
              >
                <div className='p-4'>
                  <div className='flex items-start justify-between mb-3'>
                    <div className='flex items-center'>
                      <div
                        className='w-10 h-10 rounded-lg flex items-center justify-center mr-3'
                        style={{ backgroundColor: group.color + '20' }}
                      >
                        <Layers className='w-5 h-5' style={{ color: group.color }} />
                      </div>
                      <div>
                        <h3 className='font-semibold text-gray-800'>{group.name}</h3>
                        {group.location && (
                          <p className='text-sm text-gray-500'>{group.location}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={group.is_active ? 'success' : 'default'}>
                      {group.is_active ? '启用' : '禁用'}
                    </Badge>
                  </div>
                  
                  {group.description && (
                    <p className='text-sm text-gray-600 mb-3 line-clamp-2'>
                      {group.description}
                    </p>
                  )}
                  
                  <div className='flex items-center justify-between text-sm'>
                    <div className='flex items-center space-x-4'>
                      <span className='text-gray-500'>
                        设备: <span className='font-medium text-gray-700'>{groupStat?.total_devices || 0}</span>
                      </span>
                      <span className='text-green-600'>
                        在线: <span className='font-medium'>{groupStat?.online_devices || 0}</span>
                      </span>
                      <span className='text-red-600'>
                        离线: <span className='font-medium'>{groupStat?.offline_devices || 0}</span>
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className='border-t border-gray-100 px-4 py-3 flex justify-end space-x-2'>
                  <PermissionButton
                    permission='device-group.view'
                    variant='ghost'
                    size='sm'
                    icon={Monitor}
                    onClick={() => handleOpenDevicesModal(group)}
                  >
                    设备
                  </PermissionButton>
                  <PermissionButton
                    permission='device-group.manage'
                    variant='ghost'
                    size='sm'
                    icon={Plus}
                    onClick={() => handleOpenAddDevicesModal(group)}
                  >
                    添加
                  </PermissionButton>
                  <PermissionButton
                    permission='device-group.manage'
                    variant='ghost'
                    size='sm'
                    icon={Edit2}
                    onClick={() => handleOpenEditModal(group)}
                    ariaLabel='编辑'
                  >
                    {' '}
                  </PermissionButton>
                  <PermissionButton
                    permission='device-group.manage'
                    variant='ghost'
                    size='sm'
                    icon={Trash2}
                    onClick={() => handleDeleteGroup(group)}
                    ariaLabel='删除'
                  >
                    {' '}
                  </PermissionButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title='创建设备分组'
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              分组名称 *
            </label>
            <input
              type='text'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              value={groupForm.name}
              onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
              placeholder='请输入分组名称'
            />
          </div>
          
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              描述
            </label>
            <textarea
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              rows={3}
              value={groupForm.description}
              onChange={e => setGroupForm({ ...groupForm, description: e.target.value })}
              placeholder='请输入分组描述（可选）'
            />
          </div>
          
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              位置
            </label>
            <input
              type='text'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              value={groupForm.location}
              onChange={e => setGroupForm({ ...groupForm, location: e.target.value })}
              placeholder='如：一楼教室、实验室A'
            />
          </div>
          
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                图标
              </label>
              <select
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                value={groupForm.icon}
                onChange={e => setGroupForm({ ...groupForm, icon: e.target.value })}
              >
                {ICON_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                颜色
              </label>
              <select
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                value={groupForm.color}
                onChange={e => setGroupForm({ ...groupForm, color: e.target.value })}
              >
                {COLOR_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              排序
            </label>
            <input
              type='number'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              value={groupForm.sort_order}
              onChange={e => setGroupForm({ ...groupForm, sort_order: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
        
        <div className='flex justify-end space-x-3 mt-6'>
          <Button variant='outline' onClick={closeCreateModal}>
            取消
          </Button>
          <Button variant='primary' onClick={handleCreateGroup}>
            创建
          </Button>
        </div>
      </Modal>
      
      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={closeEditModal}
        title='编辑设备分组'
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              分组名称 *
            </label>
            <input
              type='text'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              value={groupForm.name}
              onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
            />
          </div>
          
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              描述
            </label>
            <textarea
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              rows={3}
              value={groupForm.description}
              onChange={e => setGroupForm({ ...groupForm, description: e.target.value })}
            />
          </div>
          
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              位置
            </label>
            <input
              type='text'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              value={groupForm.location}
              onChange={e => setGroupForm({ ...groupForm, location: e.target.value })}
            />
          </div>
          
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                图标
              </label>
              <select
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                value={groupForm.icon}
                onChange={e => setGroupForm({ ...groupForm, icon: e.target.value })}
              >
                {ICON_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                颜色
              </label>
              <select
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                value={groupForm.color}
                onChange={e => setGroupForm({ ...groupForm, color: e.target.value })}
              >
                {COLOR_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              排序
            </label>
            <input
              type='number'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              value={groupForm.sort_order}
              onChange={e => setGroupForm({ ...groupForm, sort_order: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
        
        <div className='flex justify-end space-x-3 mt-6'>
          <Button variant='outline' onClick={closeEditModal}>
            取消
          </Button>
          <Button variant='primary' onClick={handleUpdateGroup}>
            保存
          </Button>
        </div>
      </Modal>
      
      {/* Devices Modal */}
      <Modal
        isOpen={showDevicesModal}
        onClose={closeDevicesModal}
        title={`${selectedGroup?.name || ''} - 设备列表`}
        size='lg'
      >
        {groupDevices.length === 0 ? (
          <EmptyState
            icon='folder'
            title='暂无设备'
            description='该分组下还没有设备，请添加设备'
            actionLabel='添加设备'
            onAction={() => {
              closeDevicesModal();
              handleOpenAddDevicesModal(selectedGroup!);
            }}
          />
        ) : (
          <div className='space-y-2'>
            {groupDevices.map(mapping => (
              <div
                key={mapping.id}
                className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'
              >
                <div className='flex items-center'>
                  <div className={`w-2 h-2 rounded-full mr-3 ${
                    mapping.device?.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className='font-medium text-gray-800'>
                      {mapping.device?.name || '未知设备'}
                    </p>
                    <p className='text-sm text-gray-500'>
                      {mapping.device?.device_id}
                    </p>
                  </div>
                </div>
                <Button
                  variant='ghost'
                  size='sm'
                  icon={X}
                  onClick={() => handleRemoveDevicesFromGroup([mapping.device_id])}
                >
                  移除
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>
      
      {/* Add Devices Modal */}
      <Modal
        isOpen={showAddDevicesModal}
        onClose={closeAddDevicesModal}
        title={`添加设备到 ${selectedGroup?.name || ''}`}
        size='lg'
      >
        <div className='mb-4'>
          <p className='text-sm text-gray-600'>
            选择要添加到此分组的设备。未分组的设备将优先显示。
          </p>
        </div>
        
        <div className='max-h-96 overflow-y-auto space-y-2'>
          {devices.length === 0 ? (
            <p className='text-center text-gray-500 py-8'>暂无可添加的设备</p>
          ) : (
            devices.map(device => {
              // 检查设备是否已在分组中
              const isInGroup = groupDevices.some(gd => gd.device_id === device.id);
              const isSelected = selectedDeviceIds.includes(Number(device.id));
              
              return (
                <div
                  key={device.id}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${
                    isInGroup
                      ? 'bg-gray-100 opacity-50'
                      : isSelected
                        ? 'bg-blue-50 border border-blue-200'
                        : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    if (!isInGroup) {
                      setSelectedDeviceIds(prev =>
                        isSelected
                          ? prev.filter(id => id !== Number(device.id))
                          : [...prev, Number(device.id)]
                      );
                    }
                  }}
                >
                  <div className='flex items-center'>
                    <input
                      type='checkbox'
                      checked={isSelected || isInGroup}
                      onChange={() => {}}
                      disabled={isInGroup}
                      className='w-4 h-4 text-blue-600 rounded mr-3'
                    />
                    <div className={`w-2 h-2 rounded-full mr-3 ${
                      device.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className='font-medium text-gray-800'>{device.name}</p>
                      <p className='text-sm text-gray-500'>{device.device_id}</p>
                    </div>
                  </div>
                  {isInGroup && (
                    <Badge variant='default'>已在分组中</Badge>
                  )}
                </div>
              );
            })
          )}
        </div>
        
        <div className='flex justify-between items-center mt-4 pt-4 border-t'>
          <p className='text-sm text-gray-500'>
            已选择: {selectedDeviceIds.length} 个设备
          </p>
          <div className='flex space-x-3'>
            <Button variant='outline' onClick={closeAddDevicesModal}>
              取消
            </Button>
            <Button
              variant='primary'
              onClick={handleAddDevicesToGroup}
              disabled={selectedDeviceIds.length === 0}
            >
              添加选中设备
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DeviceGroupPage;
