/* eslint-disable */
/**
 * T12-9b 拆分（2026-09-12）：设备管理逻辑层共享契约。
 * 组合根 useDeviceManagementLogic 持有全部 state / form / modal，并把它们打包成
 * DeviceManagementSharedDeps 注入各域子 hook；子 hook 解构所需字段后返回纯逻辑 handler，
 * 组合根再 spread 装配，保证对外返回对象形状与原实现逐字段一致（DeviceManagementLogic 类型不变）。
 */
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Device } from '../../../types';
import type { Alert, Heartbeat } from '../../../services/api';
import { useConfirm } from '../../../components';
import type {
  NewDeviceForm,
  BindForm,
  DeviceSettings,
  OTAForm,
  OTAProgressData,
  ClassItem,
  AdminItem,
  DeviceImportResult,
  DeviceStats,
  AdvancedStats,
} from '../types';

export type ShowToast = (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;

export type ConfirmFn = ReturnType<typeof useConfirm>;

export interface DeviceManagementSharedDeps {
  showToast: ShowToast;
  runSubmit: (fn: () => Promise<void>) => void;
  submitting: boolean;
  confirmRef: MutableRefObject<ConfirmFn>;
  deviceStatuses: Record<string, string>;

  activeTab: 'list' | 'monitor';
  setActiveTab: Dispatch<SetStateAction<'list' | 'monitor'>>;
  devices: Device[];
  setDevices: Dispatch<SetStateAction<Device[]>>;
  stats: DeviceStats;
  setStats: Dispatch<SetStateAction<DeviceStats>>;
  statsError: boolean;
  setStatsError: Dispatch<SetStateAction<boolean>>;
  advancedStats: AdvancedStats | null;
  setAdvancedStats: Dispatch<SetStateAction<AdvancedStats | null>>;
  alerts: Alert[];
  setAlerts: Dispatch<SetStateAction<Alert[]>>;
  isRefreshing: boolean;
  setIsRefreshing: Dispatch<SetStateAction<boolean>>;
  lastUpdateTime: Date | null;
  setLastUpdateTime: Dispatch<SetStateAction<Date | null>>;
  autoRefresh: boolean;
  setAutoRefresh: Dispatch<SetStateAction<boolean>>;
  initialLoading: boolean;
  setInitialLoading: Dispatch<SetStateAction<boolean>>;
  selectedDevice: Device | null;
  setSelectedDevice: Dispatch<SetStateAction<Device | null>>;
  heartbeats: Heartbeat[];
  setHeartbeats: Dispatch<SetStateAction<Heartbeat[]>>;
  showDetailModal: boolean;
  setShowDetailModal: Dispatch<SetStateAction<boolean>>;
  controlAction: string;
  setControlAction: Dispatch<SetStateAction<string>>;
  otaProgressData: OTAProgressData;
  setOtaProgressData: Dispatch<SetStateAction<OTAProgressData>>;
  showOTAProgressModal: boolean;
  setShowOTAProgressModal: Dispatch<SetStateAction<boolean>>;
  classes: ClassItem[];
  setClasses: Dispatch<SetStateAction<ClassItem[]>>;
  admins: AdminItem[];
  setAdmins: Dispatch<SetStateAction<AdminItem[]>>;
  searchInput: string;
  setSearchInput: Dispatch<SetStateAction<string>>;
  debouncedSearchTerm: string;

  showImportModal: boolean;
  setShowImportModal: Dispatch<SetStateAction<boolean>>;
  importFile: File | null;
  setImportFile: Dispatch<SetStateAction<File | null>>;
  importResult: DeviceImportResult | null;
  setImportResult: Dispatch<SetStateAction<DeviceImportResult | null>>;
  isImporting: boolean;
  setIsImporting: Dispatch<SetStateAction<boolean>>;

  newDevice: NewDeviceForm;
  newDeviceErrors: Partial<Record<string, string | undefined>>;
  handleNewDeviceChange: (field: keyof NewDeviceForm, value: unknown) => void;
  resetNewDeviceForm: () => void;
  bindForm: BindForm;
  handleBindChange: (field: keyof BindForm, value: unknown) => void;
  resetBindForm: () => void;
  deviceSettings: DeviceSettings;
  handleDeviceSettingsChange: (field: keyof DeviceSettings, value: unknown) => void;
  resetDeviceSettings: () => void;
  otaForm: OTAForm;
  handleOtaFormChange: (field: keyof OTAForm, value: unknown) => void;
  resetOtaForm: () => void;
  bulkOtaForm: OTAForm;
  handleBulkOtaFormChange: (field: keyof OTAForm, value: unknown) => void;
  resetBulkOtaForm: () => void;

  showAddModal: boolean;
  openAddModal: () => void;
  closeAddModal: () => void;
  showBindModal: boolean;
  openBindModal: (device: Device | null) => void;
  closeBindModal: () => void;
  showControlModal: boolean;
  openControlModalInternal: (device: Device | null) => void;
  closeControlModal: () => void;
  showSettingsModal: boolean;
  openSettingsModalInternal: (device: Device | null) => void;
  closeSettingsModal: () => void;
  showOTAModal: boolean;
  closeOTAModal: () => void;
  showBulkOTAModal: boolean;
  openBulkOTAModal: () => void;
  closeBulkOTAModal: () => void;

  loadDevices: (manualRefresh?: boolean) => Promise<void>;
  throttledRefresh: () => void;
}
