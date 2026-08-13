import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  Activity,
  Edit2,
  Trash2,
  Eye,
  Link,
  Users,
  Building2,
  Monitor,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  Server,
  Unlock,
  Bell,
  Plus,
  FileSpreadsheet,
  FileDown,
  Download,
} from 'lucide-react';
import api, { Alert, Heartbeat, ClassInfo } from '../services/api';
import { Device } from '../types';
import { Button, Modal, Badge, Select, EmptyState, SearchFilter, PermissionButton } from '../components';
import { useStableToast } from '../hooks/useStableToast';
import { useWebSocketStore } from '../stores';
import { useDebouncedValue, useThrottledCallback, useForm, useModal, useConfirmDialog } from '../hooks';

interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  today_heartbeats?: number;
}

interface AdvancedStats {
  total: number;
  online: number;
  offline: number;
  by_firmware: Record<string, number>;
  online_rate?: number;
  avg_signal_strength?: number;
  error_devices?: number;
  critical_alerts?: number;
}

interface NewDeviceForm {
  device_id: string;
  name: string;
  [key: string]: unknown;
}

interface BindForm {
  class_id: string;
  admin_id: string;
  [key: string]: unknown;
}

interface DeviceSettings {
  alert_enabled: boolean;
  heartbeat_timeout: number;
  name: string;
  [key: string]: unknown;
}

interface OTAForm {
  firmware_url: string;
  version: string;
  force: boolean;
  [key: string]: unknown;
}

interface OTAProgressData {
  in_progress: Array<{
    id: string;
    device_id: string;
    device_name: string | null;
    from_version: string | null;
    to_version: string;
    started_at: string;
  }>;
  summary: {
    in_progress_count: number;
    completed_count: number;
    failed_count: number;
  };
}

interface ClassItem {
  id: number;
  name: string;
}

interface AdminItem {
  id: number;
  real_name: string;
  username: string;
}

const formatUptime = (seconds: number | null): string => {
  if (!seconds) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${minutes}分钟`;
  return `${minutes}分钟`;
};

const formatTime = (timestamp: string | null): string => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return date.toLocaleString('zh-CN');
};

const getSystemStateText = (state: number | undefined): string => {
  const states: Record<number, string> = {
    0: '空闲',
    1: 'A箱解锁中',
    2: 'B箱解锁中',
    3: '错误',
    4: '显示卡号',
  };
  return states[state || 0] || `未知(${state})`;
};

const getSignalStrength = (signal: number | null): { text: string; color: string; level: string } => {
  if (!signal) return { text: '-', color: 'bg-gray-500', level: 'poor' };
  if (signal >= -50) return { text: '强', color: 'bg-green-500', level: 'excellent' };
  if (signal >= -70) return { text: '中', color: 'bg-yellow-500', level: 'good' };
  return { text: '弱', color: 'bg-red-500', level: 'fair' };
};

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'critical':
      return <XCircle className='w-4 h-4 text-purple-600' />;
    case 'error':
      return <AlertTriangle className='w-4 h-4 text-red-600' />;
    case 'warning':
      return <AlertTriangle className='w-4 h-4 text-yellow-600' />;
    default:
      return <CheckCircle className='w-4 h-4 text-blue-600' />;
  }
};

function DeviceManagement() {
  const { showToast } = useStableToast();
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

  const { show: showConfirm } = useConfirmDialog();

  const {
    formData: newDevice,
    errors: newDeviceErrors,
    handleChange: handleNewDeviceChange,
    resetForm: resetNewDeviceForm,
  } = useForm<NewDeviceForm>({ device_id: '', name: '' }, {
    device_id: { required: true, minLength: 1 },
  });

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

  const { isOpen: showAddModal, open: openAddModal, close: closeAddModal } = useModal<null>({
    onClose: () => resetNewDeviceForm(),
  });

  const { isOpen: showBindModal, open: openBindModal, close: closeBindModal } = useModal<Device | null>({
    onClose: () => {
      setSelectedDevice(null);
      resetBindForm();
    },
  });

  const { isOpen: showControlModal, open: openControlModalInternal, close: closeControlModal } = useModal<Device | null>({
    onClose: () => {
      setSelectedDevice(null);
      setControlAction('');
    },
  });

  const { isOpen: showSettingsModal, open: openSettingsModalInternal, close: closeSettingsModal } = useModal<Device | null>({
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

  const { isOpen: showBulkOTAModal, open: openBulkOTAModal, close: closeBulkOTAModal } = useModal<null>({
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
  const [importResult, setImportResult] = useState<{
    success: boolean;
    total?: number;
    success_count?: number;
    failed_count?: number;
    messages?: Array<{ action: string; message: string; row_data?: Record<string, unknown>; error_fields?: string[] }>;
  } | null>(null);
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
        const rawStats = statsData as { total_devices?: number; online_devices?: number; offline_devices?: number; today_heartbeats?: number };
        setStats({
          total: rawStats.total_devices || 0,
          online: rawStats.online_devices || 0,
          offline: rawStats.offline_devices || 0,
          today_heartbeats: rawStats.today_heartbeats || 0,
        });
        const rawAdvanced = advancedStatsData as { total_devices?: number; online_devices?: number; offline_devices?: number; error_devices?: number; online_rate?: number; avg_signal_strength?: number; critical_alerts?: number };
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

  const handleExport = useCallback(async (format: 'excel' | 'pdf') => {
    try {
      const apiUrl = format === 'pdf'
        ? '/api/export/devices?format=pdf'
        : '/api/export/devices?format=excel';

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

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast('success', '导出成功');
    } catch (err) {
      showToast('error', '导出失败: ' + (err as Error).message);
    }
  }, [showToast]);

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
        showToast('success', `导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 条`);
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
      .filter(msg => msg.action === '失败')
      .map(msg => ({
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
      setClasses(Array.isArray(classesData) ? classesData : ((classesData as { classes?: ClassInfo[] })?.classes || []));
    } catch {
      // 忽略错误
    }

    try {
      const adminsData = await api.admins.getAll();
      setAdmins(adminsData.map((admin) => ({
        id: Number(admin.id),
        real_name: admin.real_name || admin.username,
        username: admin.username,
      })));
    } catch {
      // 忽略错误
    }
  }, []);

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
      console.warn('获取OTA状态失败:', error);
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

  const handleDeleteDevice = useCallback(async (id: number) => {
    if (!window.confirm(`确定要删除这个设备吗？此操作无法撤销。`)) return;

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
  }, [showConfirm, showToast]);

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

  const handleOpenBindModal = useCallback((device: Device) => {
    setSelectedDevice(device);
    handleBindChange('class_id', (device.class_info_id || '').toString());
    handleBindChange('admin_id', (device.admin_id || '').toString());
    openBindModal(device);
  }, [handleBindChange, openBindModal]);

  const handleRemoteControl = useCallback(async () => {
    if (!selectedDevice || !controlAction) return;

    try {
      await api.devices.remoteControl(selectedDevice.id, controlAction);
      showToast('success', `远程指令已发送: ${controlAction}`);
      closeControlModal();
      setControlAction('');
    } catch (error) {
      showToast('error', `操作失败: ${(error as Error).message}`);
    }
  }, [selectedDevice, controlAction, showToast, closeControlModal]);

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

  const handleResolveAlert = useCallback(async (deviceId: string, alertId: number) => {
    try {
      await api.devices.resolveAlert(deviceId, alertId);
      showToast('success', '告警已解决');
      loadDevices(true);
    } catch (error) {
      showToast('error', `操作失败: ${(error as Error).message}`);
    }
  }, [showToast, loadDevices]);

  const handleUpdateSettings = useCallback(async () => {
    if (!selectedDevice) return;

    try {
      await api.devices.updateSettings(selectedDevice.id, deviceSettings as unknown as Record<string, unknown>);
      showToast('success', '设备设置已更新');
      closeSettingsModal();
    } catch (error) {
      showToast('error', `操作失败: ${(error as Error).message}`);
    }
  }, [selectedDevice, deviceSettings, showToast, closeSettingsModal]);

  const openControlModal = useCallback((device: Device) => {
    setSelectedDevice(device);
    openControlModalInternal(device);
  }, [openControlModalInternal]);

  const openSettingsModal = useCallback((device: Device) => {
    setSelectedDevice(device);
    handleDeviceSettingsChange('alert_enabled', device.alert_enabled !== false);
    handleDeviceSettingsChange('heartbeat_timeout', device.heartbeat_timeout || 30);
    handleDeviceSettingsChange('name', device.name || '');
    openSettingsModalInternal(device);
  }, [handleDeviceSettingsChange, openSettingsModalInternal]);

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
      return deviceId.includes(searchLower) || deviceName.includes(searchLower) || className.includes(searchLower);
    });
  }, [devicesWithSignal, debouncedSearchTerm]);

  const signalDistribution = useMemo(() => {
    const distribution: Record<string, number> = { excellent: 0, good: 0, fair: 0, poor: 0 };
    devices.forEach((device) => {
      const info = getSignalStrength(device.wifi_signal);
      distribution[info.level]++;
    });
    return distribution;
  }, [devices]);

  return (
    <div className='space-y-6'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <h1 className='text-2xl font-bold text-gray-900'>设备管理</h1>
        <div className='flex flex-wrap items-center gap-3'>
          <div className='flex bg-gray-100 rounded-lg p-1'>
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              设备列表
            </button>
            <button
              onClick={() => setActiveTab('monitor')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'monitor' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              实时监控
            </button>
          </div>
          <Button onClick={throttledRefresh} variant='secondary' disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? '刷新中...' : '刷新'}
          </Button>
          {activeTab === 'list' && (
            <Button variant='outline' onClick={() => handleExport('excel')}>
              <FileSpreadsheet className='w-4 h-4 mr-2' />
              导出Excel
            </Button>
          )}
          {activeTab === 'list' && (
            <Button variant='outline' onClick={() => handleExport('pdf')}>
              <FileDown className='w-4 h-4 mr-2' />
              导出PDF
            </Button>
          )}
          {activeTab === 'list' && (
            <PermissionButton permission='device.edit' onClick={openImportModal}>
              <FileSpreadsheet className='w-4 h-4 mr-2' />
              导入设备
            </PermissionButton>
          )}
          {activeTab === 'list' && (
            <PermissionButton permission='device.edit' onClick={() => openAddModal()}>
              <Plus className='w-4 h-4 mr-2' />
              添加设备
            </PermissionButton>
          )}
          {activeTab === 'list' && (
            <PermissionButton permission='device.edit' onClick={() => openBulkOTAModal()} variant='primary'>
              <Activity className='w-4 h-4 mr-2' />
              批量OTA升级
            </PermissionButton>
          )}
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <div className='card-gradient p-6'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-blue-100 text-sm'>设备总数</p>
              <p className='text-3xl font-bold mt-1'>{initialLoading || statsError ? '--' : statsDisplay.total}</p>
            </div>
            <Server className='w-10 h-10 text-white/50' />
          </div>
          {advancedStats && (
            <div className='mt-2 flex items-center gap-2 text-sm text-blue-200'>
              <span>在线率: {advancedStats.online_rate != null ? `${advancedStats.online_rate}%` : '--'}</span>
            </div>
          )}
        </div>

        <div className='card-gradient-green p-6'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-green-100 text-sm'>在线设备</p>
              <p className='text-3xl font-bold mt-1'>{initialLoading || statsError ? '--' : statsDisplay.online}</p>
            </div>
            <Wifi className='w-10 h-10 text-white/50' />
          </div>
          {advancedStats && (
            <div className='mt-2 flex items-center gap-2 text-sm text-green-200'>
              <Activity className='w-4 h-4' />
              <span>平均信号: {advancedStats.avg_signal_strength != null ? `${advancedStats.avg_signal_strength} dBm` : '--'}</span>
            </div>
          )}
        </div>

        <div className='card-gradient-red p-6'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-red-100 text-sm'>离线设备</p>
              <p className='text-3xl font-bold mt-1'>{initialLoading || statsError ? '--' : statsDisplay.offline}</p>
            </div>
            <WifiOff className='w-10 h-10 text-white/50' />
          </div>
          {advancedStats && (
            <div className='mt-2 flex items-center gap-2 text-sm text-red-200'>
              <span>故障: {advancedStats.error_devices != null ? advancedStats.error_devices : '--'}</span>
            </div>
          )}
        </div>

        <div className={`p-6 ${(alerts.length || 0) > 0 ? 'card-gradient-yellow' : 'bg-gray-600'}`}>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-yellow-100 text-sm'>未处理告警</p>
              <p className='text-3xl font-bold mt-1'>{initialLoading || statsError ? '--' : alerts.length}</p>
            </div>
            <AlertTriangle className='w-10 h-10 text-white/50' />
          </div>
          {advancedStats && (
            <div className='mt-2 flex items-center gap-2 text-sm text-yellow-200'>
              <span>严重: {advancedStats.critical_alerts != null ? advancedStats.critical_alerts : '--'}</span>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'list' && (
        <div className='card'>
          <div className='card-header flex items-center justify-between'>
            <div className='flex items-center gap-4'>
              <h2 className='text-lg font-semibold text-gray-900'>设备列表</h2>
              {lastUpdateTime && (
                <span className='text-sm text-gray-500 flex items-center'>
                  <Clock className='w-4 h-4 mr-1' />
                  最后更新: {lastUpdateTime.toLocaleTimeString('zh-CN')}
                </span>
              )}
            </div>
            <div className='flex items-center gap-3'>
              <SearchFilter
                searchTerm={searchInput}
                onSearchChange={setSearchInput}
                placeholder='搜索设备ID或名称...'
              />
              <label className='flex items-center gap-2 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className='w-4 h-4 text-blue-600 rounded'
                />
                <span className='text-sm text-gray-600'>自动刷新</span>
              </label>
            </div>
          </div>

          <div className='card-body'>
            {initialLoading ? (
              <div className='text-center py-12'>
                <RefreshCw className='w-8 h-8 text-blue-500 animate-spin mx-auto mb-4' />
                <p>加载中...</p>
              </div>
            ) : devices.length === 0 ? (
              <EmptyState
                icon='wifi'
                title='暂无设备'
                description='添加设备开始监控系统'
                actionLabel='添加设备'
                onAction={() => openAddModal()}
              />
            ) : (
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='bg-gray-50'>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>设备ID</th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>设备名称</th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>状态</th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>所属班级</th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>绑定班主任</th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>信号强度</th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>运行时长</th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>A箱</th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>B箱</th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>系统状态</th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>最后心跳</th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.length === 0 ? (
                      <tr>
                        <td colSpan={12} className='px-4 py-12 text-center text-gray-400'>
                          暂无设备数据
                        </td>
                      </tr>
                    ) : (
                      filteredDevices.map((device) => (
                        <tr key={device.device_id} className='border-b hover:bg-gray-50'>
                          <td className='px-4 py-3 text-sm font-medium text-blue-600'>{device.device_id}</td>
                          <td className='px-4 py-3 text-sm'>{device.name}</td>
                          <td className='px-4 py-3'>
                            <Badge variant={device.is_online ? 'success' : 'danger'} className='flex items-center'>
                              {device.is_online ? <Wifi className='w-3 h-3 mr-1' /> : <WifiOff className='w-3 h-3 mr-1' />}
                              {device.is_online ? '在线' : '离线'}
                            </Badge>
                          </td>
                          <td className='px-4 py-3'>
                            <div className='flex items-center gap-1'>
                              <Building2 className='w-3 h-3 text-gray-400' />
                              <span className='text-sm'>{device.class_name || <span className='text-gray-400'>未绑定</span>}</span>
                            </div>
                          </td>
                          <td className='px-4 py-3'>
                            <div className='flex items-center gap-1'>
                              <Users className='w-3 h-3 text-gray-400' />
                              <span className='text-sm'>{device.admin_name || <span className='text-gray-400'>未绑定</span>}</span>
                            </div>
                          </td>
                          <td className='px-4 py-3'>
                            <div className='flex items-center gap-2'>
                              <div className={`w-6 h-2 rounded-full ${device.signalInfo?.color}`} />
                              <span className='text-sm'>{device.signalInfo?.text}</span>
                              {device.wifi_signal && (
                                <span className='text-xs text-gray-400'>
                                  ({device.wifi_signal} dBm)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className='px-4 py-3 text-sm'>{formatUptime(device.uptime)}</td>
                          <td className='px-4 py-3'>
                            <Badge variant={device.box_a_status === 'opened' ? 'warning' : device.box_a_status === 'closed' ? 'success' : 'default'}>
                              {device.box_a_status === 'opened' ? '打开' : device.box_a_status === 'closed' ? '关闭' : '未知'}
                            </Badge>
                          </td>
                          <td className='px-4 py-3'>
                            <Badge variant={device.box_b_status === 'opened' ? 'warning' : device.box_b_status === 'closed' ? 'success' : 'default'}>
                              {device.box_b_status === 'opened' ? '打开' : device.box_b_status === 'closed' ? '关闭' : '未知'}
                            </Badge>
                          </td>
                          <td className='px-4 py-3 text-sm'>{getSystemStateText(device.system_state)}</td>
                          <td className='px-4 py-3'>
                            <div className='flex items-center gap-1 text-sm'>
                              <Clock className='w-3 h-3 text-gray-400' />
                              {device.last_heartbeat ? new Date(device.last_heartbeat).toLocaleTimeString('zh-CN') : '-'}
                            </div>
                          </td>
                          <td className='px-4 py-3'>
                            <div className='flex gap-2'>
                              <Button variant='secondary' size='sm' onClick={() => handleViewDetail(device)}>
                                <Eye className='w-4 h-4' />
                              </Button>
                              <PermissionButton permission='device.edit' variant='primary' size='sm' onClick={() => handleOpenBindModal(device)}>
                                <Link className='w-4 h-4' />
                              </PermissionButton>
                              <PermissionButton permission='device.edit' variant='secondary' size='sm' onClick={() => openSettingsModal(device)}>
                                <Edit2 className='w-4 h-4' />
                              </PermissionButton>
                              <PermissionButton permission='device.edit' variant='danger' size='sm' onClick={() => handleDeleteDevice(device.id)}>
                                <Trash2 className='w-4 h-4' />
                              </PermissionButton>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'monitor' && (
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          <div className='card'>
            <div className='card-header'>
              <h3 className='text-lg font-semibold'>信号强度分布</h3>
            </div>
            <div className='card-body'>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                <div className='text-center p-4 bg-green-50 rounded-lg'>
                  <p className='text-2xl font-bold text-green-600'>{signalDistribution.excellent}</p>
                  <p className='text-sm text-gray-600'>优秀 (-50dBm以上)</p>
                </div>
                <div className='text-center p-4 bg-blue-50 rounded-lg'>
                  <p className='text-2xl font-bold text-blue-600'>{signalDistribution.good}</p>
                  <p className='text-sm text-gray-600'>良好 (-50~-70dBm)</p>
                </div>
                <div className='text-center p-4 bg-yellow-50 rounded-lg'>
                  <p className='text-2xl font-bold text-yellow-600'>{signalDistribution.fair}</p>
                  <p className='text-sm text-gray-600'>一般 (-70~-80dBm)</p>
                </div>
                <div className='text-center p-4 bg-red-50 rounded-lg'>
                  <p className='text-2xl font-bold text-red-600'>{signalDistribution.poor}</p>
                  <p className='text-sm text-gray-600'>较差 (-80dBm以下)</p>
                </div>
              </div>
            </div>
          </div>

          <div className='card'>
            <div className='card-header flex items-center justify-between'>
              <h3 className='text-lg font-semibold'>实时设备状态</h3>
              <Badge variant='primary'>
                <Activity className='w-3 h-3 mr-1' />
                实时监控
              </Badge>
            </div>
            <div className='card-body'>
              {devices.length === 0 ? (
                <p className='text-center text-gray-500 py-8'>暂无设备数据</p>
              ) : (
                <div className='space-y-3'>
                  {devices.map((device) => (
                    <div
                      key={device.device_id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        device.is_online ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                          <div className={`w-3 h-3 rounded-full ${device.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                          <div>
                            <p className='font-medium text-gray-900'>{device.name || device.device_id}</p>
                            <p className='text-sm text-gray-500'>{device.device_id}</p>
                          </div>
                        </div>
                        <div className='flex items-center gap-2'>
                          <Badge variant={device.is_online ? 'success' : 'default'}>
                            {device.is_online ? '在线' : '离线'}
                          </Badge>
                          {device.is_online && device.wifi_signal !== null && (
                            <span className='text-sm text-gray-500'>{device.wifi_signal}dBm</span>
                          )}
                        </div>
                      </div>
                      <div className='mt-3 flex items-center justify-between text-sm'>
                        <div className='flex items-center gap-4 text-gray-500'>
                          <span>A箱: {device.box_a_status === 'opened' ? '打开' : device.box_a_status === 'closed' ? '关闭' : '未知'}</span>
                          <span>B箱: {device.box_b_status === 'opened' ? '打开' : device.box_b_status === 'closed' ? '关闭' : '未知'}</span>
                        </div>
                        <div className='flex items-center gap-2'>
                          <Button variant='secondary' size='sm' onClick={() => openControlModal(device)} disabled={!device.is_online}>
                            <Settings className='w-3 h-3' />
                          </Button>
                          <Button variant='secondary' size='sm' onClick={() => openSettingsModal(device)}>
                            <Bell className='w-3 h-3' />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className='card lg:col-span-2'>
            <div className='card-header flex items-center justify-between'>
              <h3 className='text-lg font-semibold'>设备告警</h3>
              <Badge variant='danger'>{alerts.length} 条未处理</Badge>
            </div>
            <div className='card-body'>
              {alerts.length === 0 ? (
                <div className='text-center py-8'>
                  <CheckCircle className='w-12 h-12 text-green-500 mx-auto mb-3' />
                  <p className='text-gray-600'>暂无告警</p>
                  <p className='text-sm text-gray-400'>所有设备运行正常</p>
                </div>
              ) : (
                <div className='space-y-3'>
                  {alerts.slice(0, 10).map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-lg border-l-4 ${
                        alert.severity === 'critical'
                          ? 'border-purple-500 bg-purple-50'
                          : alert.severity === 'error'
                          ? 'border-red-500 bg-red-50'
                          : alert.severity === 'warning'
                          ? 'border-yellow-500 bg-yellow-50'
                          : 'border-blue-500 bg-blue-50'
                      }`}
                    >
                      <div className='flex items-start justify-between'>
                        <div className='flex items-start gap-3'>
                          {getSeverityIcon(alert.severity)}
                          <div>
                            <p className='font-medium text-gray-900'>{alert.device_name || alert.device_id}</p>
                            <p className='text-sm text-gray-600'>{alert.message}</p>
                            <p className='text-xs text-gray-400 mt-1'>{formatTime(alert.created_at)}</p>
                          </div>
                        </div>
                        <Button variant='success' size='sm' onClick={() => handleResolveAlert(alert.device_id, alert.id)}>
                          <CheckCircle className='w-3 h-3' />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal
        title='添加设备'
        isOpen={showAddModal}
        onClose={closeAddModal}
        footer={
          <>
            <Button variant='secondary' onClick={closeAddModal}>
              取消
            </Button>
            <Button onClick={handleAddDevice}>确认添加</Button>
          </>
        }
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>设备ID *</label>
            <input
              type='text'
              value={newDevice.device_id}
              onChange={(e) => handleNewDeviceChange('device_id', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='输入设备ID'
            />
            {newDeviceErrors.device_id && <p className='text-sm text-red-500 mt-1'>{newDeviceErrors.device_id}</p>}
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>设备名称</label>
            <input
              type='text'
              value={newDevice.name}
              onChange={(e) => handleNewDeviceChange('name', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='输入设备名称'
            />
          </div>
        </div>
      </Modal>

      <Modal
        title={`设备详情 - ${selectedDevice?.name || selectedDevice?.device_id}`}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedDevice(null);
        }}
      >
        {selectedDevice && (
          <div className='space-y-6'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-sm text-gray-500'>设备ID</p>
                <p className='font-medium'>{selectedDevice.device_id}</p>
              </div>
              <div>
                <p className='text-sm text-gray-500'>设备名称</p>
                <p className='font-medium'>{selectedDevice.name || '-'}</p>
              </div>
              <div>
                <p className='text-sm text-gray-500'>状态</p>
                <Badge variant={selectedDevice.is_online ? 'success' : 'danger'}>
                  {selectedDevice.is_online ? '在线' : '离线'}
                </Badge>
              </div>
              <div>
                <p className='text-sm text-gray-500'>信号强度</p>
                <p className='font-medium'>{selectedDevice.wifi_signal ? `${selectedDevice.wifi_signal} dBm` : '-'}</p>
              </div>
              <div>
                <p className='text-sm text-gray-500'>运行时长</p>
                <p className='font-medium'>{formatUptime(selectedDevice.uptime)}</p>
              </div>
              <div>
                <p className='text-sm text-gray-500'>最后心跳</p>
                <p className='font-medium'>
                  {selectedDevice.last_heartbeat ? new Date(selectedDevice.last_heartbeat).toLocaleString('zh-CN') : '-'}
                </p>
              </div>
              <div>
                <p className='text-sm text-gray-500'>A箱状态</p>
                <Badge variant={selectedDevice.box_a_status === 'opened' ? 'warning' : selectedDevice.box_a_status === 'closed' ? 'success' : 'default'}>
                  {selectedDevice.box_a_status === 'opened' ? '打开' : selectedDevice.box_a_status === 'closed' ? '关闭' : '未知'}
                </Badge>
              </div>
              <div>
                <p className='text-sm text-gray-500'>B箱状态</p>
                <Badge variant={selectedDevice.box_b_status === 'opened' ? 'warning' : selectedDevice.box_b_status === 'closed' ? 'success' : 'default'}>
                  {selectedDevice.box_b_status === 'opened' ? '打开' : selectedDevice.box_b_status === 'closed' ? '关闭' : '未知'}
                </Badge>
              </div>
            </div>

            <div>
              <h4 className='text-sm font-medium text-gray-700 mb-3'>最近心跳记录</h4>
              <div className='space-y-2 max-h-48 overflow-y-auto'>
                {heartbeats.length === 0 ? (
                  <p className='text-sm text-gray-500 text-center py-4'>暂无心跳记录</p>
                ) : (
                  heartbeats.map((h) => (
                    <div key={h.id} className='flex items-center justify-between text-sm p-2 bg-gray-50 rounded'>
                      <span>{new Date(h.timestamp).toLocaleString('zh-CN')}</span>
                      <Badge variant={h.status === 'online' ? 'success' : h.status === 'offline' ? 'danger' : 'default'}>
                        {h.status === 'online' ? '在线' : h.status === 'offline' ? '离线' : (h.status || '未知')}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={`绑定设置 - ${selectedDevice?.name || selectedDevice?.device_id}`}
        isOpen={showBindModal}
        onClose={closeBindModal}
        footer={
          <>
            <Button variant='secondary' onClick={closeBindModal}>
              取消
            </Button>
            <Button onClick={handleBindDevice}>确认绑定</Button>
          </>
        }
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>所属班级</label>
            <Select
              value={bindForm.class_id}
              onChange={(value) => handleBindChange('class_id', value)}
            >
              <option value=''>选择班级</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id.toString()}>
                  {cls.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>绑定班主任</label>
            <Select
              value={bindForm.admin_id}
              onChange={(value) => handleBindChange('admin_id', value)}
            >
              <option value=''>选择班主任</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id.toString()}>
                  {admin.real_name} ({admin.username})
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>

      <Modal
        title={`远程控制 - ${selectedDevice?.name || selectedDevice?.device_id}`}
        isOpen={showControlModal}
        onClose={closeControlModal}
        footer={
          <>
            <Button variant='secondary' onClick={closeControlModal}>
              取消
            </Button>
            <Button onClick={handleRemoteControl} disabled={!controlAction}>
              发送指令
            </Button>
          </>
        }
      >
        <div className='space-y-4'>
          <p className='text-sm text-gray-600'>选择要执行的远程操作（设备必须在线才能执行操作）</p>
          <div className='grid grid-cols-2 gap-3'>
            <button
              onClick={() => setControlAction('restart')}
              className={`p-4 rounded-lg border-2 transition-all ${
                controlAction === 'restart' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <RefreshCw className='w-6 h-6 mx-auto mb-2 text-blue-600' />
              <p className='font-medium'>重启设备</p>
              <p className='text-xs text-gray-500'>远程重启ESP32</p>
            </button>
            <button
              onClick={() => setControlAction('unlock_a')}
              className={`p-4 rounded-lg border-2 transition-all ${
                controlAction === 'unlock_a' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Unlock className='w-6 h-6 mx-auto mb-2 text-green-600' />
              <p className='font-medium'>开A箱</p>
              <p className='text-xs text-gray-500'>远程打开A箱门</p>
            </button>
            <button
              onClick={() => setControlAction('unlock_b')}
              className={`p-4 rounded-lg border-2 transition-all ${
                controlAction === 'unlock_b' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Unlock className='w-6 h-6 mx-auto mb-2 text-green-600' />
              <p className='font-medium'>开B箱</p>
              <p className='text-xs text-gray-500'>远程打开B箱门</p>
            </button>
            <button
              onClick={() => setControlAction('status')}
              className={`p-4 rounded-lg border-2 transition-all ${
                controlAction === 'status' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Monitor className='w-6 h-6 mx-auto mb-2 text-blue-600' />
              <p className='font-medium'>状态查询</p>
              <p className='text-xs text-gray-500'>获取设备状态</p>
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        title={`设备设置 - ${selectedDevice?.name || selectedDevice?.device_id}`}
        isOpen={showSettingsModal}
        onClose={closeSettingsModal}
        footer={
          <>
            <Button variant='secondary' onClick={closeSettingsModal}>
              取消
            </Button>
            <Button onClick={handleUpdateSettings}>保存设置</Button>
          </>
        }
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>设备名称</label>
            <input
              type='text'
              value={deviceSettings.name}
              onChange={(e) => handleDeviceSettingsChange('name', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='输入设备名称'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>启用告警通知</label>
            <label className='flex items-center gap-3 cursor-pointer'>
              <input
                type='checkbox'
                checked={deviceSettings.alert_enabled}
                onChange={(e) => handleDeviceSettingsChange('alert_enabled', e.target.checked)}
                className='w-4 h-4 text-blue-600 rounded'
              />
              <span className='text-sm text-gray-600'>{deviceSettings.alert_enabled ? '已启用' : '已禁用'}</span>
            </label>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>心跳超时时间（秒）</label>
            <input
              type='number'
              value={deviceSettings.heartbeat_timeout}
              onChange={(e) => handleDeviceSettingsChange('heartbeat_timeout', parseInt(e.target.value) || 30)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              min='10'
              max='300'
            />
          </div>
        </div>
      </Modal>

      <Modal
        title={`OTA固件升级 - ${selectedDevice?.name || selectedDevice?.device_id}`}
        isOpen={showOTAModal}
        onClose={closeOTAModal}
        footer={
          <>
            <Button variant='secondary' onClick={closeOTAModal}>
              取消
            </Button>
            <Button onClick={handleOTAUpgrade} disabled={!otaForm.firmware_url}>
              开始升级
            </Button>
          </>
        }
      >
        <div className='space-y-4'>
          <p className='text-sm text-gray-600'>设备必须在线才能执行OTA升级。升级过程中设备将自动下载固件并重启。</p>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>固件下载URL *</label>
            <input
              type='text'
              value={otaForm.firmware_url}
              onChange={(e) => handleOtaFormChange('firmware_url', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='输入固件下载地址'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>目标版本</label>
            <input
              type='text'
              value={otaForm.version}
              onChange={(e) => handleOtaFormChange('version', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='如: v1.2.0（可选）'
            />
          </div>
          <div>
            <label className='flex items-center gap-3 cursor-pointer'>
              <input
                type='checkbox'
                checked={otaForm.force}
                onChange={(e) => handleOtaFormChange('force', e.target.checked)}
                className='w-4 h-4 text-blue-600 rounded'
              />
              <span className='text-sm text-gray-600'>强制升级（忽略版本检查）</span>
            </label>
          </div>
        </div>
      </Modal>

      <Modal
        title='批量OTA固件升级'
        isOpen={showBulkOTAModal}
        onClose={closeBulkOTAModal}
        footer={
          <>
            <Button variant='secondary' onClick={closeBulkOTAModal}>
              取消
            </Button>
            <Button onClick={handleBulkOTAUpgrade} disabled={!bulkOtaForm.firmware_url}>
              开始批量升级
            </Button>
          </>
        }
      >
        <div className='space-y-4'>
          <p className='text-sm text-gray-600'>
            将向所有在线设备发送OTA升级指令。升级过程中设备将自动下载固件并重启。当前在线设备数：
            <span className='font-medium text-green-600'>{stats.online || 0}</span>
          </p>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>固件下载URL *</label>
            <input
              type='text'
              value={bulkOtaForm.firmware_url}
              onChange={(e) => handleBulkOtaFormChange('firmware_url', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='输入固件下载地址'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>目标版本</label>
            <input
              type='text'
              value={bulkOtaForm.version}
              onChange={(e) => handleBulkOtaFormChange('version', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='如: v1.2.0（可选）'
            />
          </div>
          <div>
            <label className='flex items-center gap-3 cursor-pointer'>
              <input
                type='checkbox'
                checked={bulkOtaForm.force}
                onChange={(e) => handleBulkOtaFormChange('force', e.target.checked)}
                className='w-4 h-4 text-blue-600 rounded'
              />
              <span className='text-sm text-gray-600'>强制升级（忽略版本检查）</span>
            </label>
          </div>
        </div>
      </Modal>

      <Modal
        title='OTA升级进度'
        isOpen={showOTAProgressModal}
        onClose={() => setShowOTAProgressModal(false)}
        size='lg'
        footer={
          <>
            <Button variant='secondary' onClick={() => setShowOTAProgressModal(false)}>
              关闭
            </Button>
            <Button onClick={loadOTAStatus} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </>
        }
      >
        <div className='space-y-4'>
          <div className='grid grid-cols-3 gap-4 mb-4'>
            <div className='bg-yellow-50 p-3 rounded-lg text-center'>
              <p className='text-2xl font-bold text-yellow-600'>{otaProgressData.summary.in_progress_count}</p>
              <p className='text-sm text-yellow-600'>进行中</p>
            </div>
            <div className='bg-green-50 p-3 rounded-lg text-center'>
              <p className='text-2xl font-bold text-green-600'>{otaProgressData.summary.completed_count}</p>
              <p className='text-sm text-green-600'>已完成</p>
            </div>
            <div className='bg-red-50 p-3 rounded-lg text-center'>
              <p className='text-2xl font-bold text-red-600'>{otaProgressData.summary.failed_count}</p>
              <p className='text-sm text-red-600'>失败</p>
            </div>
          </div>
          {otaProgressData.in_progress.length === 0 ? (
            <p className='text-center text-gray-500 py-4'>暂无正在进行的升级</p>
          ) : (
            <div className='space-y-3'>
              {otaProgressData.in_progress.map((item) => (
                <div key={item.id} className='border border-gray-200 rounded-lg p-4'>
                  <div className='flex items-center justify-between mb-2'>
                    <div>
                      <p className='font-medium text-gray-900'>{item.device_name || item.device_id}</p>
                      <p className='text-sm text-gray-500 font-mono'>{item.device_id}</p>
                    </div>
                    <div className='text-right'>
                      <Badge variant='warning'>升级中</Badge>
                    </div>
                  </div>
                  <div className='flex items-center gap-4 text-sm text-gray-600'>
                    <span>{item.from_version || '未知'} → {item.to_version}</span>
                    <span>开始时间: {formatTime(item.started_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        title='导入设备数据'
        isOpen={showImportModal}
        onClose={closeImportModal}
        footer={
          <>
            <Button variant='secondary' onClick={closeImportModal}>取消</Button>
            <Button onClick={handleImport} disabled={!importFile || isImporting}>
              {isImporting ? '导入中...' : '开始导入'}
            </Button>
          </>
        }
      >
        <div className='space-y-4'>
          <div className='border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer' onClick={() => document.getElementById('device-import-file')?.click()}>
            <input
              id='device-import-file'
              type='file'
              accept='.xlsx,.xls'
              onChange={handleFileChange}
              className='hidden'
            />
            <FileSpreadsheet className='w-12 h-12 mx-auto text-gray-400 mb-3' />
            <p className='text-gray-600'>点击或拖拽文件到此处上传</p>
            <p className='text-sm text-gray-400 mt-1'>支持 .xlsx, .xls 格式</p>
            {importFile && (
              <p className='text-sm text-green-600 mt-2'>已选择: {importFile.name}</p>
            )}
          </div>

          <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
            <h4 className='font-medium text-blue-800 mb-2'>导入模板说明</h4>
            <ul className='text-sm text-blue-600 space-y-1'>
              <li>• 设备标识(device_id)：必填，唯一标识</li>
              <li>• 设备名称(name)：选填，设备显示名称</li>
              <li>• 班级名称(class_name)：选填，关联班级名称</li>
              <li>• 管理员姓名(admin_name)：选填，关联管理员姓名</li>
            </ul>
          </div>

          {importResult && (
            <div className='mt-4 p-4 rounded-lg border'>
              {importResult.success ? (
                <div className='bg-green-50 border-green-200'>
                  <div className='flex items-center gap-2 mb-3'>
                    <CheckCircle className='w-5 h-5 text-green-600' />
                    <span className='font-medium text-green-800'>导入成功</span>
                  </div>
                  <div className='grid grid-cols-3 gap-4 mb-3'>
                    <div className='text-center'>
                      <div className='text-xl font-bold text-gray-900'>{importResult.total}</div>
                      <div className='text-sm text-gray-500'>总数</div>
                    </div>
                    <div className='text-center'>
                      <div className='text-xl font-bold text-green-600'>{importResult.success_count}</div>
                      <div className='text-sm text-gray-500'>成功</div>
                    </div>
                    <div className='text-center'>
                      <div className='text-xl font-bold text-red-600'>{importResult.failed_count}</div>
                      <div className='text-sm text-gray-500'>失败</div>
                    </div>
                  </div>
                  {importResult.messages && importResult.messages.length > 0 && (
                    <div className='max-h-40 overflow-y-auto'>
                      <div className='flex items-center justify-between mb-2'>
                        <p className='text-sm font-medium text-gray-700'>详细信息：</p>
                        {importResult.failed_count && importResult.failed_count > 0 && (
                          <Button size='sm' variant='secondary' onClick={handleExportErrors} className='ml-2'>
                            <Download className='w-3 h-3 mr-1' />
                            导出错误数据
                          </Button>
                        )}
                      </div>
                      {importResult.messages.map((msg, idx) => (
                        <p key={idx} className={`text-xs ${msg.action === '成功' ? 'text-green-600' : msg.action === '警告' ? 'text-yellow-600' : 'text-red-600'}`}>
                          [{msg.action}] {msg.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className='bg-red-50 border-red-200'>
                  <div className='flex items-center gap-2'>
                    <XCircle className='w-5 h-5 text-red-600' />
                    <span className='font-medium text-red-800'>导入失败</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default DeviceManagement;