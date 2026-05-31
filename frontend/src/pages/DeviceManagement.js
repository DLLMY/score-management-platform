import { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import api from '../services/api';
import { Button, Modal, Badge, Select } from '../components';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';

// 工具函数
const formatUptime = (seconds) => {
  if (!seconds) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${minutes}分钟`;
  return `${minutes}分钟`;
};

const formatTime = (timestamp) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return date.toLocaleString('zh-CN');
};

const getSystemStateText = (state) => {
  const states = {
    0: '空闲',
    1: 'A箱解锁中',
    2: 'B箱解锁中',
    3: '错误',
    4: '显示卡号',
  };
  return states[state] || `未知(${state})`;
};

const getSignalStrength = (signal) => {
  if (!signal) return { text: '-', color: 'bg-gray-500', level: 'poor' };
  if (signal >= -50) return { text: '强', color: 'bg-green-500', level: 'excellent' };
  if (signal >= -70) return { text: '中', color: 'bg-yellow-500', level: 'good' };
  return { text: '弱', color: 'bg-red-500', level: 'fair' };
};

const getSeverityIcon = (severity) => {
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
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'monitor'

  // 设备列表相关状态
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState({});
  const [advancedStats, setAdvancedStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  // 弹窗相关状态
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [heartbeats, setHeartbeats] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBindModal, setShowBindModal] = useState(false);
  const [showControlModal, setShowControlModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // 表单相关状态
  const [newDevice, setNewDevice] = useState({ device_id: '', name: '' });
  const [bindForm, setBindForm] = useState({ class_id: '', admin_id: '' });
  const [controlAction, setControlAction] = useState('');
  const [deviceSettings, setDeviceSettings] = useState({
    alert_enabled: true,
    heartbeat_timeout: 30,
    name: '',
  });
  const [confirmDeleteDeviceId, setConfirmDeleteDeviceId] = useState(null);
  const [showOTAModal, setShowOTAModal] = useState(false);
  const [otaForm, setOtaForm] = useState({
    firmware_url: '',
    version: '',
    force: false,
  });
  const [showBulkOTAModal, setShowBulkOTAModal] = useState(false);
  const [bulkOtaForm, setBulkOtaForm] = useState({
    firmware_url: '',
    version: '',
    force: false,
  });
  const [showOTAProgressModal, setShowOTAProgressModal] = useState(false);
  const [otaProgressData, setOtaProgressData] = useState({
    in_progress: [],
    summary: { in_progress_count: 0, completed_count: 0, failed_count: 0 },
  });

  // 下拉选项
  const [classes, setClasses] = useState([]);
  const [admins, setAdmins] = useState([]);

  const loadDevices = useCallback(
    async (manualRefresh = false) => {
      if (manualRefresh) {
        setIsRefreshing(true);
      }
      try {
        const [devicesData, statsData, advancedStatsData, alertsData] = await Promise.all([
          api.devices.getAll(manualRefresh),
          api.devices.getStats(manualRefresh),
          api.devices.getAdvancedStats(),
          api.devices.getAlerts({ resolved: 'false' }),
        ]);
        setDevices(devicesData);
        setStats(statsData);
        setAdvancedStats(advancedStatsData);
        setAlerts(alertsData.alerts || []);
        setLastUpdateTime(new Date());
      } catch (error) {
        showToast('加载设备失败', 'error');
      } finally {
        if (manualRefresh) {
          setIsRefreshing(false);
        }
        setInitialLoading(false);
      }
    },
    [showToast]
  );

  const loadClassesAndAdmins = useCallback(async () => {
    try {
      const classesData = await api.classes.getAll();
      setClasses(classesData.classes || classesData || []);
    } catch (error) {
      // 忽略错误，保持静默
    }

    try {
      const adminsData = await api.admins.getAll();
      setAdmins(adminsData.admins || adminsData || []);
    } catch (error) {
      // 忽略错误，保持静默
    }
  }, []);

  const loadOTAStatus = useCallback(async () => {
    try {
      const data = await api.firmware.getOTAStatus();
      if (data.in_progress && data.in_progress.length > 0) {
        setOtaProgressData({
          in_progress: data.in_progress || [],
          summary: data.summary || { in_progress_count: 0, completed_count: 0, failed_count: 0 },
        });
        if (!showOTAProgressModal) {
          setShowOTAProgressModal(true);
        }
      } else if (showOTAProgressModal && data.in_progress?.length === 0) {
        setShowOTAProgressModal(false);
      }
    } catch (error) {
      console.error('获取OTA状态失败:', error);
    }
  }, [showOTAProgressModal]);

  useEffect(() => {
    loadDevices();
    loadClassesAndAdmins();
    loadOTAStatus();
    let interval = null;
    let otaInterval = null;
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

  // 设备管理操作
  const handleAddDevice = useCallback(async () => {
    if (!newDevice.device_id.trim()) {
      showToast('请输入设备ID', 'error');
      return;
    }
    try {
      const result = await api.devices.create(newDevice);
      const newDeviceData = { ...newDevice, ...result, is_online: false };
      setDevices((prev) => [...prev, newDeviceData]);
      setStats((prev) => ({
        ...prev,
        total_devices: (prev.total_devices || 0) + 1,
      }));
      setShowAddModal(false);
      setNewDevice({ device_id: '', name: '' });
      showToast('设备添加成功', 'success');
    } catch (error) {
      showToast('创建设备失败: ' + error.message, 'error');
    }
  }, [newDevice, showToast]);

  const handleDeleteDevice = useCallback(() => {
    if (!confirmDeleteDeviceId) return;
    const deviceId = confirmDeleteDeviceId;
    setConfirmDeleteDeviceId(null);
    try {
      api.devices.delete(deviceId);
      setDevices((prev) => prev.filter((d) => d.device_id !== deviceId));
      setStats((prev) => ({
        ...prev,
        total_devices: Math.max(0, (prev.total_devices || 0) - 1),
      }));
      showToast('设备删除成功', 'success');
    } catch (error) {
      showToast('删除设备失败: ' + error.message, 'error');
    }
  }, [confirmDeleteDeviceId, showToast]);

  const handleViewDetail = useCallback(async (device) => {
    setSelectedDevice(device);
    try {
      const data = await api.devices.getHeartbeats(device.device_id);
      setHeartbeats(data.data || []);
    } catch (error) {
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
      setShowBindModal(false);
      setBindForm({ class_id: '', admin_id: '' });
      showToast('设备绑定成功', 'success');
    } catch (error) {
      showToast('绑定失败: ' + error.message, 'error');
    }
  }, [selectedDevice, bindForm, showToast, loadDevices]);

  const handleOpenBindModal = useCallback((device) => {
    setSelectedDevice(device);
    setBindForm({
      class_id: device.class_info_id || '',
      admin_id: device.admin_id || '',
    });
    setShowBindModal(true);
  }, []);

  // 远程控制操作
  const handleRemoteControl = async () => {
    if (!selectedDevice || !controlAction) return;

    try {
      await api.devices.remoteControl(selectedDevice.id, controlAction);
      showToast(`远程指令已发送: ${controlAction}`, 'success');
      setShowControlModal(false);
      setSelectedDevice(null);
      setControlAction('');
    } catch (error) {
      showToast(`操作失败: ${error.message}`, 'error');
    }
  };

  // OTA升级操作
  const handleOTAUpgrade = async () => {
    if (!selectedDevice || !otaForm.firmware_url) return;

    try {
      await api.devices.otaUpgrade(selectedDevice.id, otaForm);
      showToast('OTA升级指令已发送，设备将自动下载并升级', 'success');
      setShowOTAModal(false);
      setSelectedDevice(null);
      setOtaForm({ firmware_url: '', version: '', force: false });
    } catch (error) {
      showToast(`OTA升级失败: ${error.message}`, 'error');
    }
  };

  // 批量OTA升级操作
  const handleBulkOTAUpgrade = async () => {
    if (!bulkOtaForm.firmware_url) return;

    try {
      await api.devices.bulkOTAUpgrade(bulkOtaForm);
      showToast('批量OTA升级指令已发送', 'success');
      setShowBulkOTAModal(false);
      setBulkOtaForm({ firmware_url: '', version: '', force: false });
    } catch (error) {
      showToast(`批量OTA升级失败: ${error.message}`, 'error');
    }
  };

  const handleResolveAlert = async (deviceId, alertId) => {
    try {
      await api.devices.resolveAlert(deviceId, alertId);
      showToast('告警已解决', 'success');
      loadDevices(true);
    } catch (error) {
      showToast(`操作失败: ${error.message}`, 'error');
    }
  };

  const handleUpdateSettings = async () => {
    if (!selectedDevice) return;

    try {
      await api.devices.updateSettings(selectedDevice.id, deviceSettings);
      showToast('设备设置已更新', 'success');
      setShowSettingsModal(false);
    } catch (error) {
      showToast(`操作失败: ${error.message}`, 'error');
    }
  };

  const openControlModal = (device) => {
    setSelectedDevice(device);
    setShowControlModal(true);
  };

  const openOTAModal = (device) => {
    setSelectedDevice(device);
    setShowOTAModal(true);
  };

  const openSettingsModal = (device) => {
    setSelectedDevice(device);
    setDeviceSettings({
      alert_enabled: device.alert_enabled !== false,
      heartbeat_timeout: device.heartbeat_timeout || 30,
      name: device.name || '',
    });
    setShowSettingsModal(true);
  };

  const handleNewDeviceChange = useCallback((field, value) => {
    setNewDevice((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleBindChange = useCallback((field, value) => {
    setBindForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // 记忆化数据
  const statsDisplay = useMemo(
    () => ({
      total: stats.total_devices || 0,
      online: stats.online_devices || 0,
      offline: stats.offline_devices || 0,
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

  const signalDistribution = useMemo(() => {
    const distribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
    devices.forEach((device) => {
      const info = getSignalStrength(device.wifi_signal);
      distribution[info.level]++;
    });
    return distribution;
  }, [devices]);

  return (
    <div className='space-y-6'>
      {/* 页面标题和操作栏 */}
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold text-gray-900'>设备管理</h1>
        <div className='flex items-center gap-3'>
          <div className='flex bg-gray-100 rounded-lg p-1'>
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              设备列表
            </button>
            <button
              onClick={() => setActiveTab('monitor')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'monitor'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              实时监控
            </button>
          </div>
          <Button onClick={() => loadDevices(true)} variant='secondary' disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? '刷新中...' : '刷新'}
          </Button>
          {activeTab === 'list' && (
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className='w-4 h-4 mr-2' />
              添加设备
            </Button>
          )}
          {activeTab === 'list' && (
            <Button onClick={() => setShowBulkOTAModal(true)} variant='primary'>
              <Activity className='w-4 h-4 mr-2' />
              批量OTA升级
            </Button>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <div className='card-gradient p-6'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-blue-100 text-sm'>设备总数</p>
              <p className='text-3xl font-bold mt-1'>{statsDisplay.total}</p>
            </div>
            <Server className='w-10 h-10 text-white/50' />
          </div>
          {advancedStats && (
            <div className='mt-2 flex items-center gap-2 text-sm text-blue-200'>
              <span>在线率: {advancedStats.online_rate}%</span>
            </div>
          )}
        </div>

        <div className='card-gradient-green p-6'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-green-100 text-sm'>在线设备</p>
              <p className='text-3xl font-bold mt-1'>{statsDisplay.online}</p>
            </div>
            <Wifi className='w-10 h-10 text-white/50' />
          </div>
          {advancedStats && (
            <div className='mt-2 flex items-center gap-2 text-sm text-green-200'>
              <Activity className='w-4 h-4' />
              <span>平均信号: {advancedStats.avg_signal_strength} dBm</span>
            </div>
          )}
        </div>

        <div className='card-gradient-red p-6'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-red-100 text-sm'>离线设备</p>
              <p className='text-3xl font-bold mt-1'>{statsDisplay.offline}</p>
            </div>
            <WifiOff className='w-10 h-10 text-white/50' />
          </div>
          {advancedStats && (
            <div className='mt-2 flex items-center gap-2 text-sm text-red-200'>
              <span>故障: {advancedStats.error_devices}</span>
            </div>
          )}
        </div>

        <div className={`p-6 ${(alerts.length || 0) > 0 ? 'card-gradient-yellow' : 'bg-gray-600'}`}>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-yellow-100 text-sm'>未处理告警</p>
              <p className='text-3xl font-bold mt-1'>{alerts.length}</p>
            </div>
            <AlertTriangle className='w-10 h-10 text-white/50' />
          </div>
          {advancedStats && (
            <div className='mt-2 flex items-center gap-2 text-sm text-yellow-200'>
              <span>严重: {advancedStats.critical_alerts}</span>
            </div>
          )}
        </div>
      </div>

      {/* 设备列表页签 */}
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
            ) : (
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='bg-gray-50'>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>
                        设备ID
                      </th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>
                        设备名称
                      </th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>
                        状态
                      </th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>
                        所属班级
                      </th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>
                        绑定班主任
                      </th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>
                        信号强度
                      </th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>
                        运行时长
                      </th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>A箱</th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>B箱</th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>
                        系统状态
                      </th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>
                        最后心跳
                      </th>
                      <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {devicesWithSignal.map((device) => (
                      <tr key={device.device_id} className='border-b hover:bg-gray-50'>
                        <td className='px-4 py-3 text-sm font-medium text-blue-600'>
                          {device.device_id}
                        </td>
                        <td className='px-4 py-3 text-sm'>{device.name}</td>
                        <td className='px-4 py-3'>
                          <Badge
                            variant={device.is_online ? 'success' : 'danger'}
                            className='flex items-center'
                          >
                            {device.is_online ? (
                              <Wifi className='w-3 h-3 mr-1' />
                            ) : (
                              <WifiOff className='w-3 h-3 mr-1' />
                            )}
                            {device.is_online ? '在线' : '离线'}
                          </Badge>
                        </td>
                        <td className='px-4 py-3'>
                          <div className='flex items-center gap-1'>
                            <Building2 className='w-3 h-3 text-gray-400' />
                            <span className='text-sm'>
                              {device.class_name || <span className='text-gray-400'>未绑定</span>}
                            </span>
                          </div>
                        </td>
                        <td className='px-4 py-3'>
                          <div className='flex items-center gap-1'>
                            <Users className='w-3 h-3 text-gray-400' />
                            <span className='text-sm'>
                              {device.admin_name || <span className='text-gray-400'>未绑定</span>}
                            </span>
                          </div>
                        </td>
                        <td className='px-4 py-3'>
                          <div className='flex items-center gap-2'>
                            <div className={`w-6 h-2 rounded-full ${device.signalInfo.color}`} />
                            <span className='text-sm'>{device.signalInfo.text}</span>
                            {device.wifi_signal && (
                              <span className='text-xs text-gray-400'>
                                ({device.wifi_signal} dBm)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className='px-4 py-3 text-sm'>{formatUptime(device.uptime)}</td>
                        <td className='px-4 py-3'>
                          <Badge variant={device.box_a_status === 'opened' ? 'warning' : 'success'}>
                            {device.box_a_status === 'opened' ? '打开' : '关闭'}
                          </Badge>
                        </td>
                        <td className='px-4 py-3'>
                          <Badge variant={device.box_b_status === 'opened' ? 'warning' : 'success'}>
                            {device.box_b_status === 'opened' ? '打开' : '关闭'}
                          </Badge>
                        </td>
                        <td className='px-4 py-3 text-sm'>
                          {getSystemStateText(device.system_state)}
                        </td>
                        <td className='px-4 py-3'>
                          <div className='flex items-center gap-1 text-sm'>
                            <Clock className='w-3 h-3 text-gray-400' />
                            {device.last_heartbeat
                              ? new Date(device.last_heartbeat).toLocaleTimeString('zh-CN')
                              : '-'}
                          </div>
                        </td>
                        <td className='px-4 py-3'>
                          <div className='flex gap-2'>
                            <Button
                              variant='secondary'
                              size='small'
                              onClick={() => handleViewDetail(device)}
                            >
                              <Eye className='w-4 h-4' />
                            </Button>
                            <Button
                              variant='primary'
                              size='small'
                              onClick={() => handleOpenBindModal(device)}
                            >
                              <Link className='w-4 h-4' />
                            </Button>
                            <Button
                              variant='secondary'
                              size='small'
                              onClick={() => openSettingsModal(device)}
                            >
                              <Edit2 className='w-4 h-4' />
                            </Button>
                            <Button
                              variant='danger'
                              size='small'
                              onClick={() => setConfirmDeleteDeviceId(device.device_id)}
                            >
                              <Trash2 className='w-4 h-4' />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {devices.length === 0 && !initialLoading && (
                  <EmptyState
                    icon='wifi'
                    title='暂无设备'
                    description='添加设备开始监控系统'
                    actionLabel='添加设备'
                    onAction={() => setShowAddModal(true)}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 实时监控页签 */}
      {activeTab === 'monitor' && (
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          {/* 信号强度分布 */}
          <div className='card'>
            <div className='card-header'>
              <h3 className='text-lg font-semibold'>信号强度分布</h3>
            </div>
            <div className='card-body'>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                <div className='text-center p-4 bg-green-50 rounded-lg'>
                  <p className='text-2xl font-bold text-green-600'>
                    {signalDistribution.excellent}
                  </p>
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

          {/* 实时设备状态 */}
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
                        device.is_online
                          ? 'border-green-200 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                          <div
                            className={`w-3 h-3 rounded-full ${
                              device.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                            }`}
                          />
                          <div>
                            <p className='font-medium text-gray-900'>
                              {device.name || device.device_id}
                            </p>
                            <p className='text-sm text-gray-500'>{device.device_id}</p>
                          </div>
                        </div>
                        <div className='flex items-center gap-2'>
                          <Badge variant={device.is_online ? 'success' : 'default'}>
                            {device.is_online ? '在线' : '离线'}
                          </Badge>
                          {device.is_online && (
                            <span className='text-sm text-gray-500'>{device.wifi_signal}dBm</span>
                          )}
                        </div>
                      </div>
                      <div className='mt-3 flex items-center justify-between text-sm'>
                        <div className='flex items-center gap-4 text-gray-500'>
                          <span>A箱: {device.box_a_status === 'opened' ? '打开' : '关闭'}</span>
                          <span>B箱: {device.box_b_status === 'opened' ? '打开' : '关闭'}</span>
                        </div>
                        <div className='flex items-center gap-2'>
                          <Button
                            variant='secondary'
                            size='small'
                            onClick={() => openControlModal(device)}
                            disabled={!device.is_online}
                          >
                            <Settings className='w-3 h-3' />
                          </Button>
                          <Button
                            variant='secondary'
                            size='small'
                            onClick={() => openSettingsModal(device)}
                          >
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

          {/* 设备告警 */}
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
                            <p className='font-medium text-gray-900'>
                              {alert.device_name || alert.device_id}
                            </p>
                            <p className='text-sm text-gray-600'>{alert.message}</p>
                            <p className='text-xs text-gray-400 mt-1'>
                              {formatTime(alert.created_at)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant='success'
                          size='small'
                          onClick={() => handleResolveAlert(alert.device_id, alert.id)}
                        >
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

      {/* 添加设备弹窗 */}
      <Modal
        title='添加设备'
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewDevice({ device_id: '', name: '' });
        }}
        footer={
          <>
            <Button variant='secondary' onClick={() => setShowAddModal(false)}>
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

      {/* 设备详情弹窗 */}
      <Modal
        title={`设备详情 - ${selectedDevice?.name || selectedDevice?.device_id}`}
        visible={showDetailModal}
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
                <p className='font-medium'>
                  {selectedDevice.wifi_signal ? `${selectedDevice.wifi_signal} dBm` : '-'}
                </p>
              </div>
              <div>
                <p className='text-sm text-gray-500'>运行时长</p>
                <p className='font-medium'>{formatUptime(selectedDevice.uptime)}</p>
              </div>
              <div>
                <p className='text-sm text-gray-500'>最后心跳</p>
                <p className='font-medium'>
                  {selectedDevice.last_heartbeat
                    ? new Date(selectedDevice.last_heartbeat).toLocaleString('zh-CN')
                    : '-'}
                </p>
              </div>
              <div>
                <p className='text-sm text-gray-500'>A箱状态</p>
                <Badge variant={selectedDevice.box_a_status === 'opened' ? 'warning' : 'success'}>
                  {selectedDevice.box_a_status === 'opened' ? '打开' : '关闭'}
                </Badge>
              </div>
              <div>
                <p className='text-sm text-gray-500'>B箱状态</p>
                <Badge variant={selectedDevice.box_b_status === 'opened' ? 'warning' : 'success'}>
                  {selectedDevice.box_b_status === 'opened' ? '打开' : '关闭'}
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
                    <div
                      key={h.id}
                      className='flex items-center justify-between text-sm p-2 bg-gray-50 rounded'
                    >
                      <span>{new Date(h.timestamp).toLocaleString('zh-CN')}</span>
                      <Badge variant={h.status === 'online' ? 'success' : 'danger'} size='small'>
                        {h.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 绑定弹窗 */}
      <Modal
        title={`绑定设置 - ${selectedDevice?.name || selectedDevice?.device_id}`}
        visible={showBindModal}
        onClose={() => {
          setShowBindModal(false);
          setSelectedDevice(null);
          setBindForm({ class_id: '', admin_id: '' });
        }}
        footer={
          <>
            <Button variant='secondary' onClick={() => setShowBindModal(false)}>
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
              placeholder='选择班级'
            >
              <option value=''>不绑定班级</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
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
              placeholder='选择班主任'
            >
              <option value=''>不绑定班主任</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.real_name} ({admin.username})
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>

      {/* 远程控制弹窗 */}
      <Modal
        title={`远程控制 - ${selectedDevice?.name || selectedDevice?.device_id}`}
        isOpen={showControlModal}
        onClose={() => {
          setShowControlModal(false);
          setSelectedDevice(null);
          setControlAction('');
        }}
        footer={
          <>
            <Button variant='secondary' onClick={() => setShowControlModal(false)}>
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
                controlAction === 'restart'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <RefreshCw className='w-6 h-6 mx-auto mb-2 text-blue-600' />
              <p className='font-medium'>重启设备</p>
              <p className='text-xs text-gray-500'>远程重启ESP32</p>
            </button>
            <button
              onClick={() => setControlAction('unlock_a')}
              className={`p-4 rounded-lg border-2 transition-all ${
                controlAction === 'unlock_a'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Unlock className='w-6 h-6 mx-auto mb-2 text-green-600' />
              <p className='font-medium'>开A箱</p>
              <p className='text-xs text-gray-500'>远程打开A箱门</p>
            </button>
            <button
              onClick={() => setControlAction('unlock_b')}
              className={`p-4 rounded-lg border-2 transition-all ${
                controlAction === 'unlock_b'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Unlock className='w-6 h-6 mx-auto mb-2 text-green-600' />
              <p className='font-medium'>开B箱</p>
              <p className='text-xs text-gray-500'>远程打开B箱门</p>
            </button>
            <button
              onClick={() => setControlAction('status')}
              className={`p-4 rounded-lg border-2 transition-all ${
                controlAction === 'status'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Monitor className='w-6 h-6 mx-auto mb-2 text-blue-600' />
              <p className='font-medium'>状态查询</p>
              <p className='text-xs text-gray-500'>获取设备状态</p>
            </button>
          </div>
        </div>
      </Modal>

      {/* 设备设置弹窗 */}
      <Modal
        title={`设备设置 - ${selectedDevice?.name || selectedDevice?.device_id}`}
        isOpen={showSettingsModal}
        onClose={() => {
          setShowSettingsModal(false);
          setSelectedDevice(null);
        }}
        footer={
          <>
            <Button variant='secondary' onClick={() => setShowSettingsModal(false)}>
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
              onChange={(e) => setDeviceSettings({ ...deviceSettings, name: e.target.value })}
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
                onChange={(e) =>
                  setDeviceSettings({ ...deviceSettings, alert_enabled: e.target.checked })
                }
                className='w-4 h-4 text-blue-600 rounded'
              />
              <span className='text-sm text-gray-600'>
                {deviceSettings.alert_enabled ? '已启用' : '已禁用'}
              </span>
            </label>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              心跳超时时间（秒）
            </label>
            <input
              type='number'
              value={deviceSettings.heartbeat_timeout}
              onChange={(e) =>
                setDeviceSettings({
                  ...deviceSettings,
                  heartbeat_timeout: parseInt(e.target.value) || 30,
                })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              min='10'
              max='300'
            />
          </div>
        </div>
      </Modal>

      {/* 确认删除设备 Modal */}
      <Modal
        title='确认删除'
        show={!!confirmDeleteDeviceId}
        onClose={() => setConfirmDeleteDeviceId(null)}
        footer={
          <>
            <Button variant='secondary' onClick={() => setConfirmDeleteDeviceId(null)}>
              取消
            </Button>
            <Button variant='danger' onClick={handleDeleteDevice}>
              确认删除
            </Button>
          </>
        }
      >
        <p className='text-gray-600'>确定要删除这个设备吗？此操作无法撤销。</p>
      </Modal>

      {/* 单个设备OTA升级 Modal */}
      <Modal
        title={`OTA固件升级 - ${selectedDevice?.name || selectedDevice?.device_id}`}
        isOpen={showOTAModal}
        onClose={() => {
          setShowOTAModal(false);
          setSelectedDevice(null);
          setOtaForm({ firmware_url: '', version: '', force: false });
        }}
        footer={
          <>
            <Button variant='secondary' onClick={() => setShowOTAModal(false)}>
              取消
            </Button>
            <Button onClick={handleOTAUpgrade} disabled={!otaForm.firmware_url}>
              开始升级
            </Button>
          </>
        }
      >
        <div className='space-y-4'>
          <p className='text-sm text-gray-600'>
            设备必须在线才能执行OTA升级。升级过程中设备将自动下载固件并重启。
          </p>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>固件下载URL *</label>
            <input
              type='text'
              value={otaForm.firmware_url}
              onChange={(e) => setOtaForm({ ...otaForm, firmware_url: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='输入固件下载地址'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>目标版本</label>
            <input
              type='text'
              value={otaForm.version}
              onChange={(e) => setOtaForm({ ...otaForm, version: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='如: v1.2.0（可选）'
            />
          </div>
          <div>
            <label className='flex items-center gap-3 cursor-pointer'>
              <input
                type='checkbox'
                checked={otaForm.force}
                onChange={(e) => setOtaForm({ ...otaForm, force: e.target.checked })}
                className='w-4 h-4 text-blue-600 rounded'
              />
              <span className='text-sm text-gray-600'>强制升级（忽略版本检查）</span>
            </label>
          </div>
        </div>
      </Modal>

      {/* 批量OTA升级 Modal */}
      <Modal
        title='批量OTA固件升级'
        isOpen={showBulkOTAModal}
        onClose={() => {
          setShowBulkOTAModal(false);
          setBulkOtaForm({ firmware_url: '', version: '', force: false });
        }}
        footer={
          <>
            <Button variant='secondary' onClick={() => setShowBulkOTAModal(false)}>
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
            <span className='font-medium text-green-600'>{stats.online_devices || 0}</span>
          </p>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>固件下载URL *</label>
            <input
              type='text'
              value={bulkOtaForm.firmware_url}
              onChange={(e) => setBulkOtaForm({ ...bulkOtaForm, firmware_url: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='输入固件下载地址'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>目标版本</label>
            <input
              type='text'
              value={bulkOtaForm.version}
              onChange={(e) => setBulkOtaForm({ ...bulkOtaForm, version: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='如: v1.2.0（可选）'
            />
          </div>
          <div>
            <label className='flex items-center gap-3 cursor-pointer'>
              <input
                type='checkbox'
                checked={bulkOtaForm.force}
                onChange={(e) => setBulkOtaForm({ ...bulkOtaForm, force: e.target.checked })}
                className='w-4 h-4 text-blue-600 rounded'
              />
              <span className='text-sm text-gray-600'>强制升级（忽略版本检查）</span>
            </label>
          </div>
        </div>
      </Modal>

      {/* OTA升级进度 Modal */}
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
              <p className='text-2xl font-bold text-yellow-600'>
                {otaProgressData.summary.in_progress_count}
              </p>
              <p className='text-sm text-yellow-600'>进行中</p>
            </div>
            <div className='bg-green-50 p-3 rounded-lg text-center'>
              <p className='text-2xl font-bold text-green-600'>
                {otaProgressData.summary.completed_count}
              </p>
              <p className='text-sm text-green-600'>已完成</p>
            </div>
            <div className='bg-red-50 p-3 rounded-lg text-center'>
              <p className='text-2xl font-bold text-red-600'>
                {otaProgressData.summary.failed_count}
              </p>
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
                      <p className='font-medium text-gray-900'>
                        {item.device_name || item.device_id}
                      </p>
                      <p className='text-sm text-gray-500 font-mono'>{item.device_id}</p>
                    </div>
                    <div className='text-right'>
                      <Badge variant='warning'>升级中</Badge>
                    </div>
                  </div>
                  <div className='flex items-center gap-4 text-sm text-gray-600'>
                    <span>
                      {item.from_version || '未知'} → {item.to_version}
                    </span>
                    <span>开始时间: {formatTime(item.started_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default DeviceManagement;
