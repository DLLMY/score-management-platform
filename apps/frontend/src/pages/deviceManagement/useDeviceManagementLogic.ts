/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api, { Alert, Heartbeat } from '../../services/api';
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
import { createDeviceColumns } from './DeviceColumns';
import {
  useDeviceListDomain,
  useDeviceCrudDomain,
  useDeviceControlDomain,
  useDeviceOTADomain,
  useDeviceSecretDomain,
} from './hooks';
import type { DeviceManagementSharedDeps } from './hooks/shared';
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
 * 设备管理页的逻辑层 hook（T12-9b 拆分，2026-09-12）。
 *
 * 原 830 行 god hook 按「组合根持有全部 state + 共享原语，子 hook 按域处理纯逻辑」重构：
 * - useDeviceListDomain   —— 列表/监控展示、导入导出、详情、班级管理员加载、派生计算
 * - useDeviceCrudDomain   —— 设备新增/删除/绑定
 * - useDeviceControlDomain —— 远程控制/设置
 * - useDeviceOTADomain     —— OTA 升级/批量
 * 组合根把 state 打包成 DeviceManagementSharedDeps 注入各子 hook，再 spread 装配，
 * 对外返回对象形状与原实现逐字段一致（DeviceManagementLogic 类型不变）。
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

  const shared: DeviceManagementSharedDeps = {
    showToast,
    runSubmit,
    submitting,
    confirmRef,
    deviceStatuses,
    activeTab,
    setActiveTab,
    devices,
    setDevices,
    stats,
    setStats,
    statsError,
    setStatsError,
    advancedStats,
    setAdvancedStats,
    alerts,
    setAlerts,
    isRefreshing,
    setIsRefreshing,
    lastUpdateTime,
    setLastUpdateTime,
    autoRefresh,
    setAutoRefresh,
    initialLoading,
    setInitialLoading,
    selectedDevice,
    setSelectedDevice,
    heartbeats,
    setHeartbeats,
    showDetailModal,
    setShowDetailModal,
    controlAction,
    setControlAction,
    otaProgressData,
    setOtaProgressData,
    showOTAProgressModal,
    setShowOTAProgressModal,
    classes,
    setClasses,
    admins,
    setAdmins,
    searchInput,
    setSearchInput,
    debouncedSearchTerm,
    showImportModal,
    setShowImportModal,
    importFile,
    setImportFile,
    importResult,
    setImportResult,
    isImporting,
    setIsImporting,
    newDevice,
    newDeviceErrors,
    handleNewDeviceChange,
    resetNewDeviceForm,
    bindForm,
    handleBindChange,
    resetBindForm,
    deviceSettings,
    handleDeviceSettingsChange,
    resetDeviceSettings,
    otaForm,
    handleOtaFormChange,
    resetOtaForm,
    bulkOtaForm,
    handleBulkOtaFormChange,
    resetBulkOtaForm,
    showAddModal,
    openAddModal,
    closeAddModal,
    showBindModal,
    openBindModal,
    closeBindModal,
    showControlModal,
    openControlModalInternal,
    closeControlModal,
    showSettingsModal,
    openSettingsModalInternal,
    closeSettingsModal,
    showOTAModal,
    closeOTAModal,
    showBulkOTAModal,
    openBulkOTAModal,
    closeBulkOTAModal,
    loadDevices,
    throttledRefresh,
  };

  const list = useDeviceListDomain(shared);
  const crud = useDeviceCrudDomain(shared);
  const control = useDeviceControlDomain(shared);
  const ota = useDeviceOTADomain(shared);
  const secret = useDeviceSecretDomain(shared);

  // ---- 视图层提交守卫 / 关闭回调（适配 useForm 泛型 handleChange -> (field, unknown) ----
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
    () => runSubmit(crud.handleAddDevice),
    [runSubmit, crud.handleAddDevice]
  );
  const submitBindDevice = useCallback(
    () => runSubmit(crud.handleBindDevice),
    [runSubmit, crud.handleBindDevice]
  );
  const submitRemoteControl = useCallback(
    () => runSubmit(control.handleRemoteControl),
    [runSubmit, control.handleRemoteControl]
  );
  const submitUpdateSettings = useCallback(
    () => runSubmit(control.handleUpdateSettings),
    [runSubmit, control.handleUpdateSettings]
  );
  const submitOTAUpgrade = useCallback(
    () => runSubmit(ota.handleOTAUpgrade),
    [runSubmit, ota.handleOTAUpgrade]
  );
  const submitBulkOTAUpgrade = useCallback(
    () => runSubmit(ota.handleBulkOTAUpgrade),
    [runSubmit, ota.handleBulkOTAUpgrade]
  );

  const deviceColumns = useMemo(
    () =>
      createDeviceColumns({
        handleViewDetail: list.handleViewDetail,
        handleOpenBindModal: crud.handleOpenBindModal,
        openSettingsModal,
        handleDeleteDevice: crud.handleDeleteDevice,
        handleQuickUnlock: control.handleQuickUnlock,
      }),
    [
      list.handleViewDetail,
      crud.handleOpenBindModal,
      openSettingsModal,
      crud.handleDeleteDevice,
      control.handleQuickUnlock,
    ]
  );

  useEffect(() => {
    loadDevices();
    list.loadClassesAndAdmins();
    list.loadOTAStatus();
    let interval: ReturnType<typeof setInterval> | null = null;
    let otaInterval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadDevices();
      }, 10000);
      otaInterval = setInterval(() => {
        list.loadOTAStatus();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
      if (otaInterval) clearInterval(otaInterval);
    };
  }, [autoRefresh, loadDevices, list.loadClassesAndAdmins, list.loadOTAStatus]);

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

  return {
    // —— 壳层 / 顶部 ——
    activeTab,
    setActiveTab,
    isRefreshing,
    throttledRefresh,
    handleExport: list.handleExport,
    openImportModal: list.openImportModal,
    openAddModal,
    closeAddModal,
    openBulkOTAModal,
    // —— 统计 / 监控 ——
    statsDisplay: list.statsDisplay,
    statsError,
    initialLoading,
    advancedStats,
    alerts,
    lastUpdateTime,
    searchInput,
    setSearchInput,
    autoRefresh,
    setAutoRefresh,
    filteredDevices: list.filteredDevices,
    deviceColumns,
    devices,
    signalDistribution: list.signalDistribution,
    openControlModal,
    openSettingsModal,
    handleResolveAlert: list.handleResolveAlert,
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
    // —— 设备密钥（差异 #4 阶段 3）——
    secretStatus: secret.secretStatus,
    secretStatusLoading: secret.secretStatusLoading,
    issuedSecret: secret.issuedSecret,
    submitIssueSecret: secret.submitIssueSecret,
    submitRevokeSecret: secret.submitRevokeSecret,
    // —— handler ——
    handleNewDeviceChange,
    submitAddDevice,
    closeDetailModal: list.closeDetailModal,
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
    loadOTAStatus: list.loadOTAStatus,
    closeImportModal: list.closeImportModal,
    handleFileChange: list.handleFileChange,
    handleImport: list.handleImport,
    handleExportErrors: list.handleExportErrors,
  };
}

export type DeviceManagementLogic = ReturnType<typeof useDeviceManagementLogic>;
