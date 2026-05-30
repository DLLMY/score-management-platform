import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  Wifi,
  WifiOff,
  Box,
  Clock,
  Activity,
  Edit2,
  Trash2,
  Eye,
  Link,
  Unlink,
  Users,
  Building2,
} from 'lucide-react';
import api from '../services/api';
import { Card, Button, Modal, Badge, Select } from '../components';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';

// 工具函数 - 纯函数，不依赖组件状态
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
  return new Date(timestamp).toLocaleString('zh-CN');
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
  if (!signal) return { text: '-', color: 'bg-gray-500' };
  if (signal >= -50) return { text: '强', color: 'bg-green-500' };
  if (signal >= -70) return { text: '中', color: 'bg-yellow-500' };
  return { text: '弱', color: 'bg-red-500' };
};

function DeviceList() {
  const { showToast } = useToast();
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [heartbeats, setHeartbeats] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBindModal, setShowBindModal] = useState(false);
  const [newDevice, setNewDevice] = useState({ device_id: '', name: '' });
  const [bindForm, setBindForm] = useState({ class_id: '', admin_id: '' });
  const [classes, setClasses] = useState([]);
  const [admins, setAdmins] = useState([]);

  const loadDevices = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) {
      setIsRefreshing(true);
    }
    try {
      const [devicesData, statsData] = await Promise.all([
        api.devices.getAll(manualRefresh),
        api.devices.getStats(manualRefresh),
      ]);
      setDevices(devicesData);
      setStats(statsData);
      setLastUpdateTime(new Date());
    } catch (error) {
      console.error('加载设备失败:', error);
    } finally {
      if (manualRefresh) {
        setIsRefreshing(false);
      }
      setInitialLoading(false);
    }
  }, []);

  const loadClassesAndAdmins = useCallback(async () => {
    try {
      const classesData = await api.classes.getAll();
      setClasses(classesData.classes || classesData || []);
    } catch (error) {
      console.error('加载班级数据失败:', error);
    }

    try {
      const adminsData = await api.admins.getAll();
      setAdmins(adminsData.admins || adminsData || []);
    } catch (error) {
      console.error('加载管理员数据失败:', error);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    loadClassesAndAdmins();
    let interval = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadDevices();
      }, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, loadDevices, loadClassesAndAdmins]);

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

  const handleDeleteDevice = useCallback(
    async (deviceId) => {
      // eslint-disable-next-line no-restricted-globals
      if (!confirm('确定要删除这个设备吗？')) return;
      try {
        await api.devices.delete(deviceId);
        setDevices((prev) => prev.filter((d) => d.device_id !== deviceId));
        setStats((prev) => ({
          ...prev,
          total_devices: Math.max(0, (prev.total_devices || 0) - 1),
        }));
        showToast('设备删除成功', 'success');
      } catch (error) {
        showToast('删除设备失败: ' + error.message, 'error');
      }
    },
    [showToast]
  );

  const handleViewDetail = useCallback(async (device) => {
    setSelectedDevice(device);
    try {
      const data = await api.devices.getHeartbeats(device.device_id);
      setHeartbeats(data.data || []);
    } catch (error) {
      console.error('加载心跳记录失败:', error);
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

  const handleNewDeviceChange = useCallback((field, value) => {
    setNewDevice((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleBindChange = useCallback((field, value) => {
    setBindForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // 记忆化设备统计数据
  const statsDisplay = useMemo(
    () => ({
      total: stats.total_devices || 0,
      online: stats.online_devices || 0,
      offline: stats.offline_devices || 0,
      todayHeartbeats: stats.today_heartbeats || 0,
    }),
    [stats]
  );

  // 记忆化设备列表渲染数据
  const devicesWithSignal = useMemo(() => {
    return devices.map((device) => ({
      ...device,
      signalInfo: getSignalStrength(device.wifi_signal),
    }));
  }, [devices]);

  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <Card className='bg-gradient-to-br from-blue-500 to-blue-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-blue-100 text-sm'>设备总数</p>
              <p className='text-3xl font-bold mt-1'>{statsDisplay.total}</p>
            </div>
            <div className='w-12 h-12 bg-white/20 rounded-full flex items-center justify-center'>
              <Box className='w-6 h-6' />
            </div>
          </div>
        </Card>
        <Card className='bg-gradient-to-br from-green-500 to-green-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-green-100 text-sm'>在线设备</p>
              <p className='text-3xl font-bold mt-1'>{statsDisplay.online}</p>
            </div>
            <div className='w-12 h-12 bg-white/20 rounded-full flex items-center justify-center'>
              <Wifi className='w-6 h-6' />
            </div>
          </div>
        </Card>
        <Card className='bg-gradient-to-br from-red-500 to-red-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-red-100 text-sm'>离线设备</p>
              <p className='text-3xl font-bold mt-1'>{statsDisplay.offline}</p>
            </div>
            <div className='w-12 h-12 bg-white/20 rounded-full flex items-center justify-center'>
              <WifiOff className='w-6 h-6' />
            </div>
          </div>
        </Card>
        <Card className='bg-gradient-to-br from-purple-500 to-purple-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-purple-100 text-sm'>今日心跳</p>
              <p className='text-3xl font-bold mt-1'>{statsDisplay.todayHeartbeats}</p>
            </div>
            <div className='w-12 h-12 bg-white/20 rounded-full flex items-center justify-center'>
              <Activity className='w-6 h-6' />
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-4'>
            <h2 className='text-lg font-semibold'>设备列表</h2>
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
            <Button onClick={() => loadDevices(true)} variant='secondary' disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? '刷新中...' : '刷新'}
            </Button>
            <Button onClick={() => setShowAddModal(true)}>添加设备</Button>
          </div>
        </div>

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
                  <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>设备ID</th>
                  <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>
                    设备名称
                  </th>
                  <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>状态</th>
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
                  <th className='px-4 py-3 text-left text-sm font-medium text-gray-600'>操作</th>
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
                          <span className='text-xs text-gray-400'>({device.wifi_signal} dBm)</span>
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
                    <td className='px-4 py-3 text-sm'>{getSystemStateText(device.system_state)}</td>
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
                          variant='warning'
                          size='small'
                          onClick={() => setShowAddModal(true)}
                        >
                          <Edit2 className='w-4 h-4' />
                        </Button>
                        <Button
                          variant='danger'
                          size='small'
                          onClick={() => handleDeleteDevice(device.device_id)}
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
      </Card>

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
              placeholder='如: phonebox_001'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>设备名称</label>
            <input
              type='text'
              value={newDevice.name}
              onChange={(e) => handleNewDeviceChange('name', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder="可选，默认为 '设备 + 设备ID'"
            />
          </div>
        </div>
      </Modal>

      <Modal
        title={`设备绑定 - ${selectedDevice?.device_id}`}
        isOpen={showBindModal}
        onClose={() => {
          setShowBindModal(false);
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
        <div className='space-y-6'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2'>
              <Building2 className='w-4 h-4' />
              绑定班级
            </label>
            <Select
              value={bindForm.class_id}
              onChange={(value) => handleBindChange('class_id', value === 'unbind' ? '' : value)}
              className='w-full'
            >
              <option value='unbind'>取消绑定</option>
              <option value=''>选择班级...</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2'>
              <Users className='w-4 h-4' />
              绑定班主任
            </label>
            <Select
              value={bindForm.admin_id}
              onChange={(value) => handleBindChange('admin_id', value === 'unbind' ? '' : value)}
              className='w-full'
            >
              <option value='unbind'>取消绑定</option>
              <option value=''>选择班主任...</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.real_name || admin.username}
                </option>
              ))}
            </Select>
          </div>
          <div className='p-4 bg-blue-50 rounded-lg'>
            <p className='text-sm text-blue-700 flex items-start gap-2'>
              <Unlink className='w-4 h-4 mt-0.5 flex-shrink-0' />
              选择"取消绑定"可解除当前设备与班级/班主任的关联
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        title={`设备详情 - ${selectedDevice?.device_id}`}
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        size='large'
      >
        {selectedDevice && (
          <div className='space-y-6'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='p-4 bg-gray-50 rounded-lg'>
                <p className='text-sm text-gray-500'>设备名称</p>
                <p className='text-lg font-medium'>{selectedDevice.name}</p>
              </div>
              <div className='p-4 bg-gray-50 rounded-lg'>
                <p className='text-sm text-gray-500'>在线状态</p>
                <p
                  className={`text-lg font-medium ${selectedDevice.is_online ? 'text-green-600' : 'text-red-600'}`}
                >
                  {selectedDevice.is_online ? '在线' : '离线'}
                </p>
              </div>
              <div className='p-4 bg-gray-50 rounded-lg'>
                <p className='text-sm text-gray-500'>所属班级</p>
                <p className='text-lg font-medium'>{selectedDevice.class_name || '未绑定'}</p>
              </div>
              <div className='p-4 bg-gray-50 rounded-lg'>
                <p className='text-sm text-gray-500'>绑定班主任</p>
                <p className='text-lg font-medium'>{selectedDevice.admin_name || '未绑定'}</p>
              </div>
              <div className='p-4 bg-gray-50 rounded-lg'>
                <p className='text-sm text-gray-500'>WiFi信号</p>
                <p className='text-lg font-medium'>{selectedDevice.wifi_signal} dBm</p>
              </div>
              <div className='p-4 bg-gray-50 rounded-lg'>
                <p className='text-sm text-gray-500'>运行时长</p>
                <p className='text-lg font-medium'>{formatUptime(selectedDevice.uptime)}</p>
              </div>
              <div className='p-4 bg-gray-50 rounded-lg'>
                <p className='text-sm text-gray-500'>A箱状态</p>
                <p
                  className={`text-lg font-medium ${selectedDevice.box_a_status === 'opened' ? 'text-yellow-600' : 'text-green-600'}`}
                >
                  {selectedDevice.box_a_status === 'opened' ? '打开' : '关闭'}
                </p>
              </div>
              <div className='p-4 bg-gray-50 rounded-lg'>
                <p className='text-sm text-gray-500'>B箱状态</p>
                <p
                  className={`text-lg font-medium ${selectedDevice.box_b_status === 'opened' ? 'text-yellow-600' : 'text-green-600'}`}
                >
                  {selectedDevice.box_b_status === 'opened' ? '打开' : '关闭'}
                </p>
              </div>
            </div>

            <div>
              <h3 className='text-sm font-medium text-gray-700 mb-3'>最新心跳记录</h3>
              <div className='max-h-64 overflow-y-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='bg-gray-50'>
                      <th className='px-3 py-2 text-left'>时间</th>
                      <th className='px-3 py-2 text-left'>状态</th>
                      <th className='px-3 py-2 text-left'>信号</th>
                      <th className='px-3 py-2 text-left'>A箱</th>
                      <th className='px-3 py-2 text-left'>B箱</th>
                      <th className='px-3 py-2 text-left'>系统状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heartbeats.map((h) => (
                      <tr key={h.id} className='border-b'>
                        <td className='px-3 py-2'>{formatTime(h.received_at)}</td>
                        <td className='px-3 py-2'>{h.status}</td>
                        <td className='px-3 py-2'>{h.wifi_signal} dBm</td>
                        <td className='px-3 py-2'>{h.box_a_status}</td>
                        <td className='px-3 py-2'>{h.box_b_status}</td>
                        <td className='px-3 py-2'>{getSystemStateText(h.system_state)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {heartbeats.length === 0 && (
                  <p className='text-center py-4 text-gray-400'>暂无心跳记录</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default DeviceList;
