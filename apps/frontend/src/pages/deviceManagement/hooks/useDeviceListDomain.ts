/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import api, { ClassInfo, Heartbeat } from '../../../services/api';
import { Device } from '../../../types';
import type { OTAProgressData } from '../types';
import logger from '../../../utils/logger';
import { downloadBlob } from '../../../utils/download';
import { getSignalStrength } from '../helpers';
import type { DeviceManagementSharedDeps } from './shared';

export function useDeviceListDomain(deps: DeviceManagementSharedDeps) {
  const {
    showToast,
    devices,
    stats,
    setHeartbeats,
    setShowDetailModal,
    setSelectedDevice,
    setClasses,
    setAdmins,
    setOtaProgressData,
    setShowOTAProgressModal,
    showOTAProgressModal,
    setShowImportModal,
    setImportFile,
    setImportResult,
    setIsImporting,
    importFile,
    importResult,
    loadDevices,
    debouncedSearchTerm,
  } = deps;

  const handleExport = useCallback(
    async (format: 'excel' | 'pdf') => {
      try {
        const apiUrl =
          format === 'pdf' ? '/api/export/devices?format=pdf' : '/api/export/devices?format=excel';

        const response = await fetch(apiUrl, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('导出失败');
        }

        const blob = await response.blob();
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `devices.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^"]+)"?/);
          if (match) {
            filename = match[1];
          }
        }

        downloadBlob(blob, filename);

        showToast('success', '导出成功');
      } catch (err) {
        showToast('error', '导出失败: ' + (err as Error).message);
      }
    },
    [showToast]
  );

  const openImportModal = useCallback((): void => {
    setShowImportModal(true);
    setImportFile(null);
    setImportResult(null);
  }, []);

  const closeImportModal = useCallback((): void => {
    setShowImportModal(false);
    setImportFile(null);
    setImportResult(null);
  }, []);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  }, []);

  const handleImport = useCallback(async (): Promise<void> => {
    if (!importFile) return;

    setIsImporting(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const result = await api.devices.import(formData);
      setImportResult(result);
      if (result.success) {
        showToast(
          'success',
          `导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 条`
        );
        loadDevices(true);
      } else {
        showToast('error', '导入失败');
      }
    } catch (err) {
      showToast('error', '导入失败: ' + (err as Error).message);
    } finally {
      setIsImporting(false);
    }
  }, [importFile, showToast, loadDevices]);

  const handleExportErrors = useCallback((): void => {
    if (!importResult?.messages) return;
    const errors = importResult.messages
      .filter((msg) => msg.action === '失败')
      .map((msg) => ({
        ...msg,
        error_fields: msg.error_fields || [],
      }));
    if (errors.length > 0) {
      api.export.errors(errors, 'devices');
    }
  }, [importResult]);

  const loadClassesAndAdmins = useCallback(async () => {
    try {
      const classesData = await api.classes.getAll();
      // API返回格式是 { classes: [...] }，需要提取数组
      setClasses(
        Array.isArray(classesData)
          ? classesData
          : (classesData as { classes?: ClassInfo[] })?.classes || []
      );
    } catch {
      // M5: 加载失败给用户提示，不静默
      showToast('error', '加载班级列表失败');
    }

    try {
      const adminsData = await api.admins.getAll();
      // M7: 数组赋值防护
      const adminList = Array.isArray(adminsData) ? adminsData : [];
      setAdmins(
        adminList.map((admin) => ({
          id: Number(admin.id),
          real_name: admin.real_name || admin.username,
          username: admin.username,
        }))
      );
    } catch {
      showToast('error', '加载管理员列表失败');
    }
  }, [showToast]);

  const loadOTAStatus = useCallback(async () => {
    try {
      const data = await api.firmware.getOTAStatus();
      const otaData = data as OTAProgressData;
      if (otaData.in_progress && otaData.in_progress.length > 0) {
        setOtaProgressData({
          in_progress: otaData.in_progress || [],
          summary: otaData.summary || { in_progress_count: 0, completed_count: 0, failed_count: 0 },
        });
        if (!showOTAProgressModal) {
          setShowOTAProgressModal(true);
        }
      } else if (showOTAProgressModal && otaData.in_progress?.length === 0) {
        setShowOTAProgressModal(false);
      }
    } catch (error) {
      // OTA 状态是 5s 轮询，失败属预期内（后端瞬时不可达），warn 记录避免刷屏
      logger.warn('获取OTA状态失败:', error);
    }
  }, [showOTAProgressModal]);

  const handleViewDetail = useCallback(async (device: Device) => {
    setSelectedDevice(device);
    try {
      const data = await api.devices.getHeartbeats(device.device_id);
      // 剥信封后键是 heartbeats（后端 success(data={heartbeats:[...], total, ...})）
      setHeartbeats((data as { heartbeats: Heartbeat[] }).heartbeats || []);
    } catch {
      setHeartbeats([]);
    }
    setShowDetailModal(true);
  }, []);

  const closeDetailModal = useCallback(() => {
    setShowDetailModal(false);
    setSelectedDevice(null);
  }, []);

  const handleResolveAlert = useCallback(
    async (deviceId: string, alertId: number) => {
      try {
        await api.devices.resolveAlert(deviceId, alertId);
        showToast('success', '告警已解决');
        loadDevices(true);
      } catch (error) {
        showToast('error', `操作失败: ${(error as Error).message}`);
      }
    },
    [showToast, loadDevices]
  );

  const statsDisplay = useMemo(
    () => ({
      total: stats.total || 0,
      online: stats.online || 0,
      offline: stats.offline || 0,
      todayHeartbeats: stats.today_heartbeats || 0,
    }),
    [stats]
  );

  const devicesWithSignal = useMemo(() => {
    return devices.map((device) => ({
      ...device,
      signalInfo: getSignalStrength(device.wifi_signal),
    }));
  }, [devices]);

  const filteredDevices = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      return devicesWithSignal;
    }
    const searchLower = debouncedSearchTerm.toLowerCase();
    return devicesWithSignal.filter((device) => {
      const deviceId = (device.device_id || '').toLowerCase();
      const deviceName = (device.name || '').toLowerCase();
      const className = (device.class_name || '').toLowerCase();
      return (
        deviceId.includes(searchLower) ||
        deviceName.includes(searchLower) ||
        className.includes(searchLower)
      );
    });
  }, [devicesWithSignal, debouncedSearchTerm]);

  const signalDistribution = useMemo(() => {
    const distribution: { excellent: number; good: number; fair: number; poor: number } = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
    };
    devices.forEach((device) => {
      const info = getSignalStrength(device.wifi_signal);
      distribution[info.level]++;
    });
    return distribution;
  }, [devices]);

  return {
    handleExport,
    openImportModal,
    closeImportModal,
    handleFileChange,
    handleImport,
    handleExportErrors,
    loadClassesAndAdmins,
    loadOTAStatus,
    handleViewDetail,
    closeDetailModal,
    handleResolveAlert,
    statsDisplay,
    devicesWithSignal,
    filteredDevices,
    signalDistribution,
  };
}
