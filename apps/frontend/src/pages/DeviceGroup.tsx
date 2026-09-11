import logger from '../utils/logger';
// -*- coding: utf-8 -*-
/**
 * 设备分组管理页面（逻辑层）
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useForm, useModal, useStableToast, useSubmitGuard } from '../hooks';
import { Device } from '../types';
import { useConfirm } from '../components';
import DeviceGroupView from './deviceGroup/DeviceGroupView';
import type { FormData, DeviceGroup, DeviceInGroup, GroupStats } from './deviceGroup/types';

function DeviceGroupPage() {
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const { submitting, run: runSubmit } = useSubmitGuard();

  // State
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [stats, setStats] = useState<GroupStats[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DeviceGroup | null>(null);
  const [groupDevices, setGroupDevices] = useState<DeviceInGroup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  // 数据加载失败标记（分组/统计/设备任一失败置位）
  const [loadError, setLoadError] = useState<boolean>(false);

  // Selected devices for adding to group (device.device_id 业务键)
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);

  // 使用 useForm 管理表单状态
  const {
    formData: groupForm,
    setFormData: setGroupForm,
    resetForm: resetGroupForm,
  } = useForm<FormData>(
    {
      name: '',
      description: '',
      location: '',
      icon: 'Layers',
      color: '#3B82F6',
      sort_order: 0,
    },
    {
      name: { required: true, minLength: 1, maxLength: 50 },
    }
  );

  // 使用 useModal 管理弹窗状态
  const {
    isOpen: showCreateModal,
    open: openCreateModal,
    close: closeCreateModal,
  } = useModal<null>({
    onClose: () => resetGroupForm(),
  });

  const {
    isOpen: showEditModal,
    open: openEditModal,
    close: closeEditModal,
  } = useModal<DeviceGroup | null>({
    onClose: () => resetGroupForm(),
  });

  const {
    isOpen: showDevicesModal,
    open: openDevicesModal,
    close: closeDevicesModal,
  } = useModal<DeviceGroup | null>({});

  const {
    isOpen: showAddDevicesModal,
    open: openAddDevicesModal,
    close: closeAddDevicesModal,
  } = useModal<DeviceGroup | null>({
    onClose: () => setSelectedDeviceIds([]),
  });

  // Fetch functions
  const fetchGroups = useCallback(async () => {
    try {
      const data = await api.deviceGroup.getAll();
      setGroups(data || []);
      setLoadError(false);
    } catch (error) {
      logger.error('获取分组列表失败:', error);
      setLoadError(true);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.deviceGroup.getStats();
      setStats(Array.isArray(data) ? data : []);
      setLoadError(false);
    } catch (error) {
      logger.error('获取分组统计失败:', error);
      setLoadError(true);
    }
  }, []);

  const fetchGroupDevices = useCallback(async (groupId: number) => {
    try {
      const data = await api.deviceGroup.getById(groupId);
      setSelectedGroup(data);
      setGroupDevices(data.devices || []);
      setLoadError(false);
    } catch (error) {
      logger.error('获取分组设备失败:', error);
      setLoadError(true);
    }
  }, []);

  const fetchAllDevices = useCallback(async () => {
    try {
      const data = await api.devices.getAll();
      setDevices(data.devices || []);
      setLoadError(false);
    } catch (error) {
      logger.error('获取设备列表失败:', error);
      setLoadError(true);
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
      showToast(
        'error',
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          '创建失败'
      );
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
      showToast(
        'error',
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          '更新失败'
      );
    }
  };

  const handleDeleteGroup = async (group: DeviceGroup) => {
    const ok = await confirmRef.current({
      message: `确定要删除分组"${group.name}"吗？`,
      confirmText: '确定',
      cancelText: '取消',
      type: 'danger',
    });
    if (!ok) return;

    try {
      await api.deviceGroup.delete(group.id);
      showToast('success', '分组删除成功');
      await loadData();
    } catch (error: unknown) {
      showToast(
        'error',
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          '删除失败'
      );
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
      showToast(
        'error',
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          '添加失败'
      );
    }
  };

  const handleRemoveDevicesFromGroup = async (deviceIds: string[]) => {
    if (!selectedGroup || deviceIds.length === 0) return;

    try {
      await api.deviceGroup.removeDevices(selectedGroup.id, deviceIds);
      showToast('success', `成功移除 ${deviceIds.length} 个设备`);
      await fetchGroupDevices(selectedGroup.id);
      await loadData();
    } catch (error: unknown) {
      showToast(
        'error',
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          '移除失败'
      );
    }
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
    <DeviceGroupView
      loadError={loadError}
      groups={groups}
      stats={stats}
      isRefreshing={isRefreshing}
      onLoadData={loadData}
      onOpenCreateModal={openCreateModal}
      showCreateModal={showCreateModal}
      closeCreateModal={closeCreateModal}
      showEditModal={showEditModal}
      closeEditModal={closeEditModal}
      showDevicesModal={showDevicesModal}
      closeDevicesModal={closeDevicesModal}
      showAddDevicesModal={showAddDevicesModal}
      closeAddDevicesModal={closeAddDevicesModal}
      groupForm={groupForm}
      setGroupForm={setGroupForm}
      submitting={submitting}
      onSubmitCreate={() => runSubmit(handleCreateGroup)}
      onSubmitUpdate={() => runSubmit(handleUpdateGroup)}
      onSubmitAddDevices={() => runSubmit(handleAddDevicesToGroup)}
      onOpenEditModal={handleOpenEditModal}
      onOpenDevicesModal={handleOpenDevicesModal}
      onOpenAddDevicesModal={handleOpenAddDevicesModal}
      onDeleteGroup={handleDeleteGroup}
      onRemoveDevices={handleRemoveDevicesFromGroup}
      selectedGroup={selectedGroup}
      groupDevices={groupDevices}
      devices={devices}
      selectedDeviceIds={selectedDeviceIds}
      setSelectedDeviceIds={setSelectedDeviceIds}
    />
  );
}

export default DeviceGroupPage;
