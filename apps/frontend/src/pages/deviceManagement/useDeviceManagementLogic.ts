/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api, { Alert, Heartbeat, ClassInfo } from '../../services/api';
import { Device } from '../../types';
import {
  useStableToast,
  useSubmitGuard,
  useDebouncedValue,
  useThrottledCallback,
  useForm,
  useModal,
} from '../../hooks';
import { useConfirm } from '../../components';
import { useWebSocketStore } from '../../stores';
import { downloadBlob } from '../../utils/download';
import logger from '../../utils/logger';
import { createDeviceColumns } from './DeviceColumns';
import { getSignalStrength } from './helpers';
import type {
  DeviceStats,
  AdvancedStats,
  NewDeviceForm,
  BindForm,
  DeviceSettings,
  OTAForm,
  OTAProgressData,
  ClassItem,
  AdminItem,
  DeviceImportResult,
} from './types';

/**
 * 设备管理页的逻辑层 hook。
 *
 * 承接原 DeviceManagement.tsx 中全部 state / effect / handler / useMemo，
 * 主文件退化为「hook → DeviceManagementView」的薄装配。
 */
export function useDeviceManagementLogic() {
  const { showToast } = useStableToast();
  const { submitting, run: runSubmit } = useSubmitGuard();
  const [activeTab, setActiveTab] = useState<'list' | 'monitor'>('list');

  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<DeviceStats>({
    total: 0,
    online: 0,
    offline: 0,
    today_heartbeats: 0,
  });
  // 首次加载失败标记：统计卡显示 '--' 而非假 0（区分"加载失败"与"确实无设备"）
  const [statsError, setStatsError] = useState<boolean>(false);
  const [advancedStats, setAdvancedStats] = useState<AdvancedStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);

  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [heartbeats, setHeartbeats] = useState<Heartbeat[]>([]);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [controlAction, setControlAction] = useState<string>('');

  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  const {
    formData: newDevice,
    errors: newDeviceErrors,
    handleChange: handleNewDeviceChange,
    resetForm: resetNewDeviceForm,
  } = useForm<NewDeviceForm>(
    { device_id: '', name: '' },
    {
      device_id: { required: true, minLength: 1 },
    }
  );

  const {
    formData: bindForm,
    handleChange: handleBindChange,
    resetForm: resetBindForm,
  } = useForm<BindForm>({ class_id: '', admin_id: '' });

  const {
    formData: deviceSettings,
    handleChange: handleDeviceSettingsChange,
    resetForm: resetDeviceSettings,
  } = useForm<DeviceSettings>({ alert_enabled: true, heartbeat_timeout: 30, name: '' });

  const {
    formData: otaForm,
    handleChange: handleOtaFormChange,
    resetForm: resetOtaForm,
  } = useForm<OTAForm>({ firmware_url: '', version: '', force: false });

  const {
    formData: bulkOtaForm,
    handleChange: handleBulkOtaFormChange,
    resetForm: resetBulkOtaForm,
  } = useForm<OTAForm>({ firmware_url: '', version: '', force: false });

  const {
    isOpen: showAddModal,
    open: openAddModal,
    close: closeAddModal,
  } = useModal<null>({
    onClose: () => resetNewDeviceForm(),
  });

  const {
    isOpen: showBindModal,
    open: openBindModal,
    close: closeBindModal,
  } = useModal<Device | null>({
    onClose: () => {
      setSelectedDevice(null);
      resetBindForm();
    },
  });

  const {
    isOpen: showControlModal,
    open: openControlModalInternal,
    close: closeControlModal,
  } = useModal<Device | null>({
    onClose: () => {
      setSelectedDevice(null);
      setControlAction('');
    },
  });

  const {
    isOpen: showSettingsModal,
    open: openSettingsModalInternal,
    close: closeSettingsModal,
  } = useModal<Device | null>({
    onClose: () => {
      setSelectedDevice(null);
      resetDeviceSettings();
    },
  });

  const { isOpen: showOTAModal, close: closeOTAModal } = useModal<Device | null>({
    onClose: () => {
      setSelectedDevice(null);
      resetOtaForm();
    },
  });

  const {
    isOpen: showBulkOTAModal,
    open: openBulkOTAModal,
    close: closeBulkOTAModal,
  } = useModal<null>({
    onClose: () => resetBulkOtaForm(),
  });

  const [showOTAProgressModal, setShowOTAProgressModal] = useState<boolean>(false);

  const { deviceStatuses } = useWebSocketStore();
  const [otaProgressData, setOtaProgressData] = useState<OTAProgressData>({
    in_progress: [],
    summary: { in_progress_count: 0, completed_count: 0, failed_count: 0 },
  });

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [admins, setAdmins] = useState<AdminItem[]>([]);

  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<DeviceImportResult | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // 防抖搜索 - 延迟 300ms 更新搜索词
  const [searchInput, setSearchInput] = useState<string>('');
  const debouncedSearchTerm = useDebouncedValue(searchInput, 300);

  // 节流刷新 - 限制刷新频率（最少间隔 1 秒）
  const loadDevicesRef = useRef<typeof loadDevices | null>(null);
  const throttledRefresh = useThrottledCallback(async () => {
    if (loadDevicesRef.current) {
      loadDevicesRef.current(true);
    }
  }, 1000);

  const loadDevices = useCallback(
    async (manualRefresh = false) => {
      if (manualRefresh) {
        setIsRefreshing(true);
      }
      try {
        const [devicesData, statsData, advancedStatsData, alertsData] = await Promise.all([
          api.devices.getAll(),
          api.devices.getStats(),
          api.devices.getAdvancedStats(),
          api.devices.getAlerts('false'),
        ]);
        setDevices(devicesData.devices || []);
        // 映射后端返回的字段到前端期望的字段
        const rawStats = statsData as {
          total_devices?: number;
          online_devices?: number;
          offline_devices?: number;
          today_heartbeats?: number;
        };
        setStats({
          total: rawStats.total_devices || 0,
          online: rawStats.online_devices || 0,
          offline: rawStats.offline_devices || 0,
          today_heartbeats: rawStats.today_heartbeats || 0,
        });
        const rawAdvanced = advancedStatsData as {
          total_devices?: number;
          online_devices?: number;
          offline_devices?: number;
          error_devices?: number;
          online_rate?: number;
          avg_signal_strength?: number;
          critical_alerts?: number;
        };
        setAdvancedStats({
          total: rawAdvanced.total_devices || 0,
          online: rawAdvanced.online_devices || 0,
          offline: rawAdvanced.offline_devices || 0,
          by_firmware: {},
          online_rate: rawAdvanced.online_rate,
          avg_signal_strength: rawAdvanced.avg_signal_strength,
          error_devices: rawAdvanced.error_devices,
          critical_alerts: rawAdvanced.critical_alerts,
        });
        setAlerts((alertsData as { alerts: Alert[] }).alerts || []);
        setLastUpdateTime(new Date());
        setStatsError(false);
      } catch (error) {
        // 轮询失败静默（保留旧数据，下轮自动重试）；仅用户手动刷新失败才提示，避免 10s 连弹 toast
        if (manualRefresh) {
          showToast('error', '加载设备失败');
        } else {
          // 首次/后台加载失败：标记统计卡为"加载失败"（显示 --），不显示假 0
          setStatsError(true);
        }
      } finally {
        if (manualRefresh) {
          setIsRefreshing(false);
        }
        setInitialLoading(false);
      }
    },
    [showToast]
  );

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

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
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

  useEffect(() => {
    loadDevices();
    loadClassesAndAdmins();
    loadOTAStatus();
    let interval: ReturnType<typeof setInterval> | null = null;
    let otaInterval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadDevices();
      }, 10000);
      otaInterval = setInterval(() => {
        loadOTAStatus();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
      if (otaInterval) clearInterval(otaInterval);
    };
  }, [autoRefresh, loadDevices, loadClassesAndAdmins, loadOTAStatus]);

  useEffect(() => {
    if (Object.keys(deviceStatuses).length > 0) {
      setDevices((prev) =>
        prev.map((device) => {
          const updatedStatus = deviceStatuses[device.device_id];
          if (updatedStatus) {
            return { ...device, status: updatedStatus };
          }
          return device;
        })
      );
    }
  }, [deviceStatuses]);

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
        message: '确定要删除这个设备吗？此操作无法撤销。',
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

  const openControlModal = useCallback(
    (device: Device) => {
      setSelectedDevice(device);
      openControlModalInternal(device);
    },
    [openControlModalInternal]
  );

  const openSettingsModal = useCallback(
    (device: Device) => {
      setSelectedDevice(device);
      handleDeviceSettingsChange('alert_enabled', device.alert_enabled !== false);
      handleDeviceSettingsChange('heartbeat_timeout', device.heartbeat_timeout || 30);
      handleDeviceSettingsChange('name', device.name || '');
      openSettingsModalInternal(device);
    },
    [handleDeviceSettingsChange, openSettingsModalInternal]
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

  const deviceColumns = useMemo(
    () =>
      createDeviceColumns({
        handleViewDetail,
        handleOpenBindModal,
        openSettingsModal,
        handleDeleteDevice,
        handleQuickUnlock,
      }),
    [
      handleViewDetail,
      handleOpenBindModal,
      openSettingsModal,
      handleDeleteDevice,
      handleQuickUnlock,
    ]
  );

  // ---- 视图层提交守卫 / 关闭回调（适配 useForm 泛型 handleChange -> (field, unknown) ----
  const closeDetailModal = useCallback(() => {
    setShowDetailModal(false);
    setSelectedDevice(null);
  }, []);

  const deviceSettingsChange = useCallback(
    (field: keyof DeviceSettings, value: unknown) =>
      handleDeviceSettingsChange(field, value as DeviceSettings[keyof DeviceSettings]),
    [handleDeviceSettingsChange]
  );

  const otaFormChange = useCallback(
    (field: keyof OTAForm, value: unknown) =>
      handleOtaFormChange(field, value as OTAForm[keyof OTAForm]),
    [handleOtaFormChange]
  );

  const bulkOtaFormChange = useCallback(
    (field: keyof OTAForm, value: unknown) =>
      handleBulkOtaFormChange(field, value as OTAForm[keyof OTAForm]),
    [handleBulkOtaFormChange]
  );

  const submitAddDevice = useCallback(
    () => runSubmit(handleAddDevice),
    [runSubmit, handleAddDevice]
  );
  const submitBindDevice = useCallback(
    () => runSubmit(handleBindDevice),
    [runSubmit, handleBindDevice]
  );
  const submitRemoteControl = useCallback(
    () => runSubmit(handleRemoteControl),
    [runSubmit, handleRemoteControl]
  );
  const submitUpdateSettings = useCallback(
    () => runSubmit(handleUpdateSettings),
    [runSubmit, handleUpdateSettings]
  );
  const submitOTAUpgrade = useCallback(
    () => runSubmit(handleOTAUpgrade),
    [runSubmit, handleOTAUpgrade]
  );
  const submitBulkOTAUpgrade = useCallback(
    () => runSubmit(handleBulkOTAUpgrade),
    [runSubmit, handleBulkOTAUpgrade]
  );

  return {
    // —— 壳层 / 顶部 ——
    activeTab,
    setActiveTab,
    isRefreshing,
    throttledRefresh,
    handleExport,
    openImportModal,
    openAddModal,
    closeAddModal,
    openBulkOTAModal,
    // —— 统计 / 监控 ——
    statsDisplay,
    statsError,
    initialLoading,
    advancedStats,
    alerts,
    lastUpdateTime,
    searchInput,
    setSearchInput,
    autoRefresh,
    setAutoRefresh,
    filteredDevices,
    deviceColumns,
    devices,
    signalDistribution,
    openControlModal,
    openSettingsModal,
    handleResolveAlert,
    // —— 弹窗开关 ——
    showAddModal,
    showDetailModal,
    showBindModal,
    showControlModal,
    showSettingsModal,
    showOTAModal,
    showBulkOTAModal,
    showOTAProgressModal,
    showImportModal,
    // —— 表单 / 数据 ——
    selectedDevice,
    heartbeats,
    newDevice,
    newDeviceErrors,
    bindForm,
    deviceSettings,
    otaForm,
    bulkOtaForm,
    classes,
    admins,
    importFile,
    importResult,
    isImporting,
    controlAction,
    otaProgressData,
    submitting,
    // —— handler ——
    handleNewDeviceChange,
    submitAddDevice,
    closeDetailModal,
    handleBindChange,
    submitBindDevice,
    closeBindModal,
    setControlAction,
    submitRemoteControl,
    closeControlModal,
    handleDeviceSettingsChange: deviceSettingsChange,
    submitUpdateSettings,
    closeSettingsModal,
    handleOtaFormChange: otaFormChange,
    submitOTAUpgrade,
    closeOTAModal,
    handleBulkOtaFormChange: bulkOtaFormChange,
    submitBulkOTAUpgrade,
    closeBulkOTAModal,
    setShowOTAProgressModal,
    loadOTAStatus,
    closeImportModal,
    handleFileChange,
    handleImport,
    handleExportErrors,
  };
}

export type DeviceManagementLogic = ReturnType<typeof useDeviceManagementLogic>;
