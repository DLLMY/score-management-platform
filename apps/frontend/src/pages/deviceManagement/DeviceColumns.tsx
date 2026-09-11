import { Wifi, WifiOff, Building2, Users, Clock, Eye, Link, Edit2, Trash2 } from 'lucide-react';
import { Badge, PermissionButton, Button, type ColumnType } from '../../components';
import { formatUptime } from '../../utils/format';
import { getSystemStateText } from './helpers';
import type { Device } from '../../types';

export type DeviceRow = Device & { signalInfo?: { text: string; color: string; level: string } };

export interface DeviceColumnHandlers {
  handleViewDetail: (device: Device) => void;
  handleOpenBindModal: (device: Device) => void;
  openSettingsModal: (device: Device) => void;
  handleDeleteDevice: (id: number) => void;
  handleQuickUnlock: (device: Device, box: 'A' | 'B') => void;
}

export const createDeviceColumns = (h: DeviceColumnHandlers): ColumnType<DeviceRow>[] => [
  {
    title: '设备ID',
    key: 'device_id',
    dataIndex: 'device_id',
    width: 140,
    render: (_v, record) => (
      <span className='text-sm font-medium text-blue-600'>{record.device_id}</span>
    ),
  },
  {
    title: '设备名称',
    key: 'name',
    dataIndex: 'name',
    width: 160,
    render: (_v, record) => <span className='text-sm'>{record.name}</span>,
  },
  {
    title: '状态',
    key: 'is_online',
    dataIndex: 'is_online',
    width: 110,
    sorter: (a, b) => Number(a.is_online) - Number(b.is_online),
    render: (_v, record) => (
      <Badge variant={record.is_online ? 'success' : 'danger'} className='flex items-center'>
        {record.is_online ? (
          <Wifi className='w-3 h-3 mr-1' />
        ) : (
          <WifiOff className='w-3 h-3 mr-1' />
        )}
        {record.is_online ? '在线' : '离线'}
      </Badge>
    ),
  },
  {
    title: '所属班级',
    key: 'class_name',
    dataIndex: 'class_name',
    width: 140,
    render: (_v, record) => (
      <div className='flex items-center gap-1'>
        <Building2 className='w-3 h-3 text-gray-400' />
        <span className='text-sm'>
          {record.class_name || <span className='text-gray-400'>未绑定</span>}
        </span>
      </div>
    ),
  },
  {
    title: '绑定班主任',
    key: 'admin_name',
    dataIndex: 'admin_name',
    width: 140,
    render: (_v, record) => (
      <div className='flex items-center gap-1'>
        <Users className='w-3 h-3 text-gray-400' />
        <span className='text-sm'>
          {record.admin_name || <span className='text-gray-400'>未绑定</span>}
        </span>
      </div>
    ),
  },
  {
    title: '信号强度',
    key: 'wifi_signal',
    dataIndex: 'wifi_signal',
    width: 160,
    sorter: (a, b) => (a.wifi_signal ?? -999) - (b.wifi_signal ?? -999),
    render: (_v, record) => (
      <div className='flex items-center gap-2'>
        <div className={`w-6 h-2 rounded-full ${record.signalInfo?.color}`} />
        <span className='text-sm'>{record.signalInfo?.text}</span>
        {record.wifi_signal && (
          <span className='text-xs text-gray-400'>({record.wifi_signal} dBm)</span>
        )}
      </div>
    ),
  },
  {
    title: '运行时长',
    key: 'uptime',
    dataIndex: 'uptime',
    width: 120,
    sorter: (a, b) => (a.uptime ?? 0) - (b.uptime ?? 0),
    render: (_v, record) => <span className='text-sm'>{formatUptime(record.uptime)}</span>,
  },
  {
    title: 'A箱',
    key: 'box_a_status',
    dataIndex: 'box_a_status',
    width: 90,
    render: (_v, record) => (
      <Badge
        variant={
          record.box_a_status === 'opened'
            ? 'warning'
            : record.box_a_status === 'closed'
            ? 'success'
            : 'default'
        }
      >
        {record.box_a_status === 'opened'
          ? '打开'
          : record.box_a_status === 'closed'
          ? '关闭'
          : '未知'}
      </Badge>
    ),
  },
  {
    title: 'B箱',
    key: 'box_b_status',
    dataIndex: 'box_b_status',
    width: 90,
    render: (_v, record) => (
      <Badge
        variant={
          record.box_b_status === 'opened'
            ? 'warning'
            : record.box_b_status === 'closed'
            ? 'success'
            : 'default'
        }
      >
        {record.box_b_status === 'opened'
          ? '打开'
          : record.box_b_status === 'closed'
          ? '关闭'
          : '未知'}
      </Badge>
    ),
  },
  {
    title: '系统状态',
    key: 'system_state',
    dataIndex: 'system_state',
    width: 120,
    render: (_v, record) => (
      <span className='text-sm'>{getSystemStateText(record.system_state)}</span>
    ),
  },
  {
    title: '最后心跳',
    key: 'last_heartbeat',
    dataIndex: 'last_heartbeat',
    width: 140,
    sorter: (a, b) =>
      new Date(a.last_heartbeat || 0).getTime() - new Date(b.last_heartbeat || 0).getTime(),
    render: (_v, record) => (
      <div className='flex items-center gap-1 text-sm'>
        <Clock className='w-3 h-3 text-gray-400' />
        {record.last_heartbeat ? new Date(record.last_heartbeat).toLocaleTimeString('zh-CN') : '-'}
      </div>
    ),
  },
  {
    title: '操作',
    key: 'actions',
    dataIndex: 'actions',
    width: 260,
    render: (_v, record) => (
      <div className='flex gap-2'>
        <PermissionButton
          permission='device.edit'
          variant='success'
          size='sm'
          onClick={() => h.handleQuickUnlock(record, 'A')}
        >
          开A箱
        </PermissionButton>
        <PermissionButton
          permission='device.edit'
          variant='danger'
          size='sm'
          onClick={() => h.handleQuickUnlock(record, 'B')}
        >
          开B箱
        </PermissionButton>
        <Button variant='secondary' size='sm' onClick={() => h.handleViewDetail(record)}>
          <Eye className='w-4 h-4' />
        </Button>
        <PermissionButton
          permission='device.edit'
          variant='primary'
          size='sm'
          onClick={() => h.handleOpenBindModal(record)}
        >
          <Link className='w-4 h-4' />
        </PermissionButton>
        <PermissionButton
          permission='device.edit'
          variant='secondary'
          size='sm'
          onClick={() => h.openSettingsModal(record)}
        >
          <Edit2 className='w-4 h-4' />
        </PermissionButton>
        <PermissionButton
          permission='device.edit'
          variant='danger'
          size='sm'
          onClick={() => h.handleDeleteDevice(Number(record.id))}
        >
          <Trash2 className='w-4 h-4' />
        </PermissionButton>
      </div>
    ),
  },
];
