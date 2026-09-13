/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback } from 'react';
import api from '../../../services/api';
import type { DeviceManagementSharedDeps } from './shared';

export function useDeviceOTADomain(deps: DeviceManagementSharedDeps) {
  const { showToast, selectedDevice, otaForm, closeOTAModal, bulkOtaForm, closeBulkOTAModal } =
    deps;

  const handleOTAUpgrade = useCallback(async () => {
    if (!selectedDevice || !otaForm.firmware_url) return;

    try {
      await api.devices.otaUpgrade(selectedDevice.id, otaForm);
      showToast('success', 'OTA升级指令已发送，设备将自动下载并升级');
      closeOTAModal();
    } catch (error) {
      showToast('error', `OTA升级失败: ${(error as Error).message}`);
    }
  }, [selectedDevice, otaForm, showToast, closeOTAModal]);

  const handleBulkOTAUpgrade = useCallback(async () => {
    if (!bulkOtaForm.firmware_url) return;

    try {
      await api.devices.bulkOTAUpgrade(bulkOtaForm);
      showToast('success', '批量OTA升级指令已发送');
      closeBulkOTAModal();
    } catch (error) {
      showToast('error', `批量OTA升级失败: ${(error as Error).message}`);
    }
  }, [bulkOtaForm, showToast, closeBulkOTAModal]);

  return {
    handleOTAUpgrade,
    handleBulkOTAUpgrade,
  };
}
