import logger from '../utils/logger';
import { useState, useRef, useCallback } from 'react';
import api from '../services/api';
import type { WOLDevice } from '../services/api';
import { useClassNowStatus, useListFetch } from '../hooks';
import { useConfirm } from '../components';
import WakeOnLanView from './wakeOnLan/WakeOnLanView';

/**
 * 远程开机（Wake-on-LAN）逻辑层：设备列表加载、新增/删除/唤醒、上课时段拦截。
 * 视图见 ./wakeOnLan/WakeOnLanView。
 */
export default function WakeOnLan() {
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  // 共享 busy：唤醒/批量唤醒/增删设备（列表 loading 走 useListFetch 输出）
  const [isLoading, setIsLoading] = useState(false);
  // 设备列表加载失败标记（诚实显示，不再 fallback 假设备）
  // P0(M9): 服务端分页状态
  const [wolPage, setWolPage] = useState(1);
  const [wolPageSize] = useState(200);
  const [wakeResult, setWakeResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', mac_address: '' });
  // 强制发送开关（受 notification.force_send 权限门控，仅超管可见复选框）
  const [forceSend, setForceSend] = useState(false);
  // 远程开机属于全局下发，按全局上课时段拦截
  const wolClassNow = useClassNowStatus(undefined, { scope: 'global' });

  // A 轨：设备列表迁 useListFetch（P0(M9) 服务端分页，默认拉满上限覆盖常规设备量）
  // 诚实显示：加载失败不伪造默认设备（catch 后 rethrow，items 为空 + list.error 可见）
  const list = useListFetch<WOLDevice>({
    params: { page: wolPage, pageSize: wolPageSize },
    fetcher: async ({ page, pageSize }) => {
      try {
        const result = await api.wakeOnLan.getDevices({ page, per_page: pageSize });
        return { items: result?.devices ?? [], total: result?.total ?? 0 };
      } catch (error) {
        logger.error('Failed to load devices:', error);
        throw error;
      }
    },
  });
  // 既有刷新按钮仍以 loadDevices 命名调用（语义 = 重新拉取当前页）
  const loadDevices = useCallback(async (): Promise<void> => {
    await list.refetch();
  }, [list]);

  // 声明式分页：页码变化由 hook 自动重新拉取
  const handleWolPageChange = (page: number) => {
    setWolPage(page);
  };

  // Wake up selected device
  const handleWake = async (mac: string) => {
    setIsLoading(true);
    setWakeResult(null);

    try {
      const result = await api.wakeOnLan.wake({
        mac_address: mac,
        broadcast_ip: '255.255.255.255',
        port: 9,
        force_send: forceSend,
      });

      setWakeResult({
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      setWakeResult({
        success: false,
        message: 'Failed to send wake packet',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Wake up all devices
  const handleWakeAll = async () => {
    const validMacs = list.items.filter((d) => d.mac_address).map((d) => d.mac_address!);

    if (validMacs.length === 0) {
      setWakeResult({
        success: false,
        message: 'No valid MAC addresses found',
      });
      return;
    }

    // M1: 批量唤醒为群发操作，先确认
    const ok = await confirmRef.current({
      message: `确定要向 ${validMacs.length} 台设备发送唤醒指令吗？`,
      confirmText: '确定',
      cancelText: '取消',
      type: 'warning',
    });
    if (!ok) return;

    setIsLoading(true);
    setWakeResult(null);

    try {
      const result = await api.wakeOnLan.wakeBatch({
        mac_addresses: validMacs,
        force_send: forceSend,
      });

      const message = `Sent wake packets to ${result.success_count}/${result.total} devices`;
      setWakeResult({
        success: result.success_count > 0,
        message,
      });
    } catch (error) {
      setWakeResult({
        success: false,
        message: 'Failed to send wake packets',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add new device
  const handleAddDevice = async () => {
    if (!newDevice.name || !newDevice.mac_address) {
      setWakeResult({
        success: false,
        message: 'Please fill in both device name and MAC address',
      });
      return;
    }

    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(newDevice.mac_address)) {
      setWakeResult({
        success: false,
        message: 'Invalid MAC address format',
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.wakeOnLan.addDevice({
        name: newDevice.name,
        mac_address: newDevice.mac_address.toUpperCase().replace('-', ':'),
        broadcast_ip: '255.255.255.255',
        port: 9,
      });

      list.mutate({ items: [...list.items, result], total: list.total + 1 });
      setNewDevice({ name: '', mac_address: '' });
      setShowAddForm(false);
      setWakeResult({
        success: true,
        message: 'Device added successfully',
      });
    } catch (error: unknown) {
      setWakeResult({
        success: false,
        message:
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          'Failed to add device',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete device
  const handleDeleteDevice = async (id: number) => {
    // M1: 删除设备不可恢复，先确认
    const ok = await confirmRef.current({
      message: '确定要删除该设备吗？此操作不可恢复。',
      confirmText: '确定',
      cancelText: '取消',
      type: 'danger',
    });
    if (!ok) return;
    setIsLoading(true);
    try {
      await api.wakeOnLan.deleteDevice(id);
      list.mutate({
        items: list.items.filter((d) => d.id !== id),
        total: Math.max(0, list.total - 1),
      });
      if (selectedDevice === id) {
        setSelectedDevice(null);
      }
      setWakeResult({
        success: true,
        message: 'Device deleted successfully',
      });
    } catch (error) {
      setWakeResult({
        success: false,
        message: 'Failed to delete device',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <WakeOnLanView
      isLoading={isLoading}
      handleWakeAll={handleWakeAll}
      list={list}
      handleAddDevice={handleAddDevice}
      showAddForm={showAddForm}
      setShowAddForm={setShowAddForm}
      newDevice={newDevice}
      setNewDevice={setNewDevice}
      forceSend={forceSend}
      setForceSend={setForceSend}
      wolClassNow={wolClassNow}
      wakeResult={wakeResult}
      handleDeleteDevice={handleDeleteDevice}
      handleWake={handleWake}
      wolPage={wolPage}
      wolPageSize={wolPageSize}
      handleWolPageChange={handleWolPageChange}
      loadDevices={loadDevices}
      selectedDevice={selectedDevice}
      setSelectedDevice={setSelectedDevice}
    />
  );
}
