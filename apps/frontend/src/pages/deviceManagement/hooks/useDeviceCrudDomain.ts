/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback } from 'react';
import api from '../../../services/api';
import { Device } from '../../../types';
import type { DeviceManagementSharedDeps } from './shared';

export function useDeviceCrudDomain(deps: DeviceManagementSharedDeps) {
  const {
    showToast,
    confirmRef,
    newDevice,
    closeAddModal,
    loadDevices,
    selectedDevice,
    setSelectedDevice,
    bindForm,
    closeBindModal,
    handleBindChange,
    openBindModal,
    setDevices,
    setStats,
  } = deps;

  const handleAddDevice = useCallback(async () => {
    if (!newDevice.device_id.trim()) {
      showToast('error', '请输入设备ID');
      return;
    }
    try {
      await api.devices.create(newDevice);
      await loadDevices(true);
      closeAddModal();
      showToast('success', '设备添加成功');
    } catch (error) {
      showToast('error', '创建设备失败: ' + (error as Error).message);
    }
  }, [newDevice, showToast, closeAddModal, loadDevices]);

  const handleDeleteDevice = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        title: '删除设备',
        message: '确定要删除这个设备吗？此操作不可恢复。',
        confirmText: '删除',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;

      try {
        await api.devices.delete(id);
        setDevices((prev) => prev.filter((d) => d.id !== id));
        setStats((prev) => ({
          ...prev,
          total: Math.max(0, (prev.total || 0) - 1),
        }));
        showToast('success', '设备删除成功');
      } catch (error) {
        showToast('error', '删除设备失败: ' + (error as Error).message);
      }
    },
    [showToast]
  );

  const handleBindDevice = useCallback(async () => {
    if (!selectedDevice) return;

    try {
      if (bindForm.class_id !== undefined) {
        await api.devices.bindClass(selectedDevice.id, { class_id: bindForm.class_id || null });
      }
      if (bindForm.admin_id !== undefined) {
        await api.devices.bindAdmin(selectedDevice.id, { admin_id: bindForm.admin_id || null });
      }

      loadDevices(true);
      closeBindModal();
      showToast('success', '设备绑定成功');
    } catch (error) {
      showToast('error', '绑定失败: ' + (error as Error).message);
    }
  }, [selectedDevice, bindForm, showToast, loadDevices, closeBindModal]);

  const handleOpenBindModal = useCallback(
    (device: Device) => {
      setSelectedDevice(device);
      handleBindChange('class_id', (device.class_info_id || '').toString());
      handleBindChange('admin_id', (device.admin_id || '').toString());
      openBindModal(device);
    },
    [handleBindChange, openBindModal]
  );

  return {
    handleAddDevice,
    handleDeleteDevice,
    handleBindDevice,
    handleOpenBindModal,
  };
}
