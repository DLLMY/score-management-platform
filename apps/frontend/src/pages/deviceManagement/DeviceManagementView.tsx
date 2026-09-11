import { type ChangeEvent } from 'react';
import { RefreshCw, FileSpreadsheet, FileDown, Plus, Activity } from 'lucide-react';
import { Button, PermissionButton, type ColumnType } from '../../components';
import type { Alert, Heartbeat } from '../../services/api';
import type { Device } from '../../types';
import type {
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
import type { DeviceRow } from './DeviceColumns';
import { StatisticsCards } from './StatisticsCards';
import { DeviceListView } from './DeviceListView';
import { DeviceMonitorView } from './DeviceMonitorView';
import { AddDeviceModal } from './AddDeviceModal';
import { DeviceDetailModal } from './DeviceDetailModal';
import { BindDeviceModal } from './BindDeviceModal';
import { ControlDeviceModal } from './ControlDeviceModal';
import { DeviceSettingsModal } from './DeviceSettingsModal';
import { OTAModal } from './OTAModal';
import { BulkOTAModal } from './BulkOTAModal';
import { OTAProgressModal } from './OTAProgressModal';
import { ImportModal } from './ImportModal';

interface DeviceManagementViewProps {
  // tab / header
  activeTab: 'list' | 'monitor';
  setActiveTab: (tab: 'list' | 'monitor') => void;
  isRefreshing: boolean;
  throttledRefresh: () => void;
  handleExport: (format: 'excel' | 'pdf') => void;
  openImportModal: () => void;
  openAddModal: () => void;
  closeAddModal: () => void;
  openBulkOTAModal: () => void;
  // statistics
  statsDisplay: { total: number; online: number; offline: number; todayHeartbeats: number };
  statsError: boolean;
  initialLoading: boolean;
  advancedStats: AdvancedStats | null;
  alerts: Alert[];
  // list view
  lastUpdateTime: Date | null;
  searchInput: string;
  setSearchInput: (value: string) => void;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  filteredDevices: DeviceRow[];
  deviceColumns: ColumnType<DeviceRow>[];
  // monitor view
  devices: Device[];
  signalDistribution: { excellent: number; good: number; fair: number; poor: number };
  openControlModal: (device: Device) => void;
  openSettingsModal: (device: Device) => void;
  handleResolveAlert: (deviceId: string, alertId: number) => void;
  // modals: open flags
  showAddModal: boolean;
  showDetailModal: boolean;
  showBindModal: boolean;
  showControlModal: boolean;
  showSettingsModal: boolean;
  showOTAModal: boolean;
  showBulkOTAModal: boolean;
  showOTAProgressModal: boolean;
  showImportModal: boolean;
  // modals: form / state
  selectedDevice: Device | null;
  heartbeats: Heartbeat[];
  newDevice: NewDeviceForm;
  newDeviceErrors: Record<string, string>;
  bindForm: BindForm;
  deviceSettings: DeviceSettings;
  otaForm: OTAForm;
  bulkOtaForm: OTAForm;
  classes: ClassItem[];
  admins: AdminItem[];
  importFile: File | null;
  importResult: DeviceImportResult | null;
  isImporting: boolean;
  controlAction: string;
  otaProgressData: OTAProgressData;
  // modals: actions
  submitting: boolean;
  handleNewDeviceChange: (field: 'device_id' | 'name', value: string) => void;
  submitAddDevice: () => void;
  closeDetailModal: () => void;
  handleBindChange: (field: 'class_id' | 'admin_id', value: string) => void;
  submitBindDevice: () => void;
  closeBindModal: () => void;
  setControlAction: (value: string) => void;
  submitRemoteControl: () => void;
  closeControlModal: () => void;
  handleDeviceSettingsChange: (field: keyof DeviceSettings, value: unknown) => void;
  submitUpdateSettings: () => void;
  closeSettingsModal: () => void;
  handleOtaFormChange: (field: keyof OTAForm, value: unknown) => void;
  submitOTAUpgrade: () => void;
  closeOTAModal: () => void;
  handleBulkOtaFormChange: (field: keyof OTAForm, value: unknown) => void;
  submitBulkOTAUpgrade: () => void;
  closeBulkOTAModal: () => void;
  setShowOTAProgressModal: (value: boolean) => void;
  loadOTAStatus: () => void;
  closeImportModal: () => void;
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleImport: () => void;
  handleExportErrors: () => void;
}

export function DeviceManagementView(props: DeviceManagementViewProps) {
  const {
    activeTab,
    setActiveTab,
    isRefreshing,
    throttledRefresh,
    handleExport,
    openImportModal,
    openAddModal,
    closeAddModal,
    openBulkOTAModal,
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
    showAddModal,
    showDetailModal,
    showBindModal,
    showControlModal,
    showSettingsModal,
    showOTAModal,
    showBulkOTAModal,
    showOTAProgressModal,
    showImportModal,
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
    handleNewDeviceChange,
    submitAddDevice,
    closeDetailModal,
    handleBindChange,
    submitBindDevice,
    closeBindModal,
    setControlAction,
    submitRemoteControl,
    closeControlModal,
    handleDeviceSettingsChange,
    submitUpdateSettings,
    closeSettingsModal,
    handleOtaFormChange,
    submitOTAUpgrade,
    closeOTAModal,
    handleBulkOtaFormChange,
    submitBulkOTAUpgrade,
    closeBulkOTAModal,
    setShowOTAProgressModal,
    loadOTAStatus,
    closeImportModal,
    handleFileChange,
    handleImport,
    handleExportErrors,
  } = props;

  const deviceLabel = selectedDevice?.name || selectedDevice?.device_id || '';

  return (
    <div className='space-y-6'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <h1 className='text-2xl font-bold text-gray-900'>设备管理</h1>
        <div className='flex flex-wrap items-center gap-3'>
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
            <PermissionButton permission='device.edit' onClick={openAddModal}>
              <Plus className='w-4 h-4 mr-2' />
              添加设备
            </PermissionButton>
          )}
          {activeTab === 'list' && (
            <PermissionButton permission='device.edit' onClick={openBulkOTAModal} variant='primary'>
              <Activity className='w-4 h-4 mr-2' />
              批量OTA升级
            </PermissionButton>
          )}
        </div>
      </div>

      <StatisticsCards
        statsDisplay={statsDisplay}
        statsError={statsError}
        initialLoading={initialLoading}
        advancedStats={advancedStats}
        alertsCount={alerts.length}
      />

      {activeTab === 'list' && (
        <DeviceListView
          filteredDevices={filteredDevices}
          loading={initialLoading}
          lastUpdateTime={lastUpdateTime}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          autoRefresh={autoRefresh}
          onAutoRefreshChange={setAutoRefresh}
          columns={deviceColumns}
          onAddDevice={openAddModal}
        />
      )}

      {activeTab === 'monitor' && (
        <DeviceMonitorView
          devices={devices}
          signalDistribution={signalDistribution}
          alerts={alerts}
          onControl={openControlModal}
          onSettings={openSettingsModal}
          onResolveAlert={handleResolveAlert}
        />
      )}

      <AddDeviceModal
        isOpen={showAddModal}
        onClose={closeAddModal}
        device_id={newDevice.device_id}
        name={newDevice.name}
        errors={newDeviceErrors}
        onChange={handleNewDeviceChange}
        submitting={submitting}
        onSubmit={submitAddDevice}
      />

      <DeviceDetailModal
        isOpen={showDetailModal}
        onClose={closeDetailModal}
        device={selectedDevice}
        heartbeats={heartbeats}
      />

      <BindDeviceModal
        isOpen={showBindModal}
        onClose={closeBindModal}
        deviceLabel={deviceLabel}
        bindForm={bindForm}
        onChange={handleBindChange}
        classes={classes}
        admins={admins}
        submitting={submitting}
        onSubmit={submitBindDevice}
      />

      <ControlDeviceModal
        isOpen={showControlModal}
        onClose={closeControlModal}
        deviceLabel={deviceLabel}
        controlAction={controlAction}
        setControlAction={setControlAction}
        submitting={submitting}
        onSubmit={submitRemoteControl}
      />

      <DeviceSettingsModal
        isOpen={showSettingsModal}
        onClose={closeSettingsModal}
        deviceLabel={deviceLabel}
        deviceSettings={deviceSettings}
        onChange={handleDeviceSettingsChange}
        submitting={submitting}
        onSubmit={submitUpdateSettings}
      />

      <OTAModal
        isOpen={showOTAModal}
        onClose={closeOTAModal}
        deviceLabel={deviceLabel}
        otaForm={otaForm}
        onChange={handleOtaFormChange}
        submitting={submitting}
        onSubmit={submitOTAUpgrade}
      />

      <BulkOTAModal
        isOpen={showBulkOTAModal}
        onClose={closeBulkOTAModal}
        otaForm={bulkOtaForm}
        onChange={handleBulkOtaFormChange}
        onlineCount={statsDisplay.online}
        submitting={submitting}
        onSubmit={submitBulkOTAUpgrade}
      />

      <OTAProgressModal
        isOpen={showOTAProgressModal}
        onClose={() => setShowOTAProgressModal(false)}
        otaProgressData={otaProgressData}
        isRefreshing={isRefreshing}
        onRefresh={loadOTAStatus}
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={closeImportModal}
        importFile={importFile}
        onFileChange={handleFileChange}
        importResult={importResult}
        isImporting={isImporting}
        onSubmit={handleImport}
        onExportErrors={handleExportErrors}
      />
    </div>
  );
}
