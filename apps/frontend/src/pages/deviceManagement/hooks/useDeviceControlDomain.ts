/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback } from 'react';
import api from '../../../services/api';
import { Device } from '../../../types';
import type { DeviceManagementSharedDeps } from './shared';

export function useDeviceControlDomain(deps: DeviceManagementSharedDeps) {
  const {
    showToast,
    selectedDevice,
    controlAction,
    setControlAction,
    confirmRef,
    closeControlModal,
    deviceSettings,
    closeSettingsModal,
    loadDevices,
  } = deps;

  // M7：统一的远程控制能力（行内快捷开箱与 Modal「发送指令」共用）
  const performAction = useCallback(
    async (action: string, device: Device) => {
      try {
        await api.devices.remoteControl(device.id, action);
        showToast('success', `远程指令已发送: ${action}`);
        return true;
      } catch (error) {
        showToast('error', `操作失败: ${(error as Error).message}`);
        return false;
      }
    },
    [showToast]
  );

  const handleRemoteControl = useCallback(async () => {
    if (!selectedDevice || !controlAction) return;

    const ok = await performAction(controlAction, selectedDevice);
    if (ok) {
      closeControlModal();
      setControlAction('');
    }
  }, [selectedDevice, controlAction, performAction, closeControlModal]);

  // M7：行内一步到位开A箱/开B箱（保留二次确认，跳过中间弹窗）
  const handleQuickUnlock = useCallback(
    async (device: Device, box: 'A' | 'B') => {
      const action = box === 'A' ? 'unlock_a' : 'unlock_b';
      const ok = await confirmRef.current({
        title: '远程开箱',
        message: `确定要远程打开设备「${device.name || device.device_id}」的${box}箱门吗？`,
        confirmText: `开${box}箱`,
        cancelText: '取消',
        type: box === 'A' ? 'success' : 'danger',
      });
      if (!ok) return;

      await performAction(action, device);
    },
    [performAction]
  );

  const handleUpdateSettings = useCallback(async () => {
    if (!selectedDevice) return;

    try {
      await api.devices.updateSettings(
        selectedDevice.id,
        deviceSettings as unknown as Record<string, unknown>
      );
      showToast('success', '设备设置已更新');
      closeSettingsModal();
      loadDevices(true); // M3: 保存后立即刷新列表（含设备名/状态），避免等轮询
    } catch (error) {
      showToast('error', `操作失败: ${(error as Error).message}`);
    }
  }, [selectedDevice, deviceSettings, showToast, closeSettingsModal, loadDevices]);

  return {
    performAction,
    handleRemoteControl,
    handleQuickUnlock,
    handleUpdateSettings,
  };
}
