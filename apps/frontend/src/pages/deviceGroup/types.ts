import type { Device } from '../../types';

export interface FormData {
  name: string;
  description: string;
  location: string;
  icon: string;
  color: string;
  sort_order: number;
  [key: string]: unknown;
}

export interface DeviceGroup {
  id: number;
  name: string;
  description: string;
  location: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  device_count: number;
  created_at: string;
  updated_at: string;
}

export interface DeviceInGroup {
  id: number;
  device_id: string;
  device: {
    id: number;
    device_id: string;
    name: string;
    status: string;
    is_online?: boolean;
  } | null;
  added_at: string;
}

export interface GroupStats {
  group_id: number;
  group_name: string;
  location: string;
  total_devices: number;
  online_devices: number;
  offline_devices: number;
}

export const ICON_OPTIONS = [
  { value: 'Layers', label: '分层' },
  { value: 'Monitor', label: '显示器' },
  { value: 'Building2', label: '建筑' },
  { value: 'School', label: '学校' },
  { value: 'Grid', label: '网格' },
  { value: 'Box', label: '箱子' },
];

export const COLOR_OPTIONS = [
  { value: '#3B82F6', label: '蓝色' },
  { value: '#10B981', label: '绿色' },
  { value: '#F59E0B', label: '橙色' },
  { value: '#EF4444', label: '红色' },
  { value: '#8B5CF6', label: '紫色' },
  { value: '#EC4899', label: '粉色' },
];

export interface DeviceGroupViewProps {
  loadError: boolean;
  groups: DeviceGroup[];
  stats: GroupStats[];
  isRefreshing: boolean;
  onLoadData: () => void;
  onOpenCreateModal: () => void;
  showCreateModal: boolean;
  closeCreateModal: () => void;
  showEditModal: boolean;
  closeEditModal: () => void;
  showDevicesModal: boolean;
  closeDevicesModal: () => void;
  showAddDevicesModal: boolean;
  closeAddDevicesModal: () => void;
  groupForm: FormData;
  setGroupForm: (data: Partial<FormData> | ((prev: FormData) => Partial<FormData>)) => void;
  submitting: boolean;
  onSubmitCreate: () => void;
  onSubmitUpdate: () => void;
  onSubmitAddDevices: () => void;
  onOpenEditModal: (group: DeviceGroup) => void;
  onOpenDevicesModal: (group: DeviceGroup) => void;
  onOpenAddDevicesModal: (group: DeviceGroup) => void;
  onDeleteGroup: (group: DeviceGroup) => void;
  onRemoveDevices: (deviceIds: string[]) => void;
  selectedGroup: DeviceGroup | null;
  groupDevices: DeviceInGroup[];
  devices: Device[];
  selectedDeviceIds: string[];
  setSelectedDeviceIds: (ids: string[] | ((prev: string[]) => string[])) => void;
}
