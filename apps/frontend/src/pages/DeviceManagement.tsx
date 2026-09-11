/**
 * 设备管理页面组件（装配层）。
 *
 * 全部 state / effect / handler / useMemo 已抽到 ./deviceManagement/useDeviceManagementLogic；
 * 本文件仅做「hook → DeviceManagementView」的 props 装配。
 */

import { DeviceManagementView } from './deviceManagement/DeviceManagementView';
import { useDeviceManagementLogic } from './deviceManagement/useDeviceManagementLogic';

function DeviceManagement() {
  const logic = useDeviceManagementLogic();

  return (
    <DeviceManagementView
      activeTab={logic.activeTab}
      setActiveTab={logic.setActiveTab}
      isRefreshing={logic.isRefreshing}
      throttledRefresh={logic.throttledRefresh}
      handleExport={logic.handleExport}
      openImportModal={logic.openImportModal}
      openAddModal={logic.openAddModal}
      closeAddModal={logic.closeAddModal}
      openBulkOTAModal={logic.openBulkOTAModal}
      statsDisplay={logic.statsDisplay}
      statsError={logic.statsError}
      initialLoading={logic.initialLoading}
      advancedStats={logic.advancedStats}
      alerts={logic.alerts}
      lastUpdateTime={logic.lastUpdateTime}
      searchInput={logic.searchInput}
      setSearchInput={logic.setSearchInput}
      autoRefresh={logic.autoRefresh}
      setAutoRefresh={logic.setAutoRefresh}
      filteredDevices={logic.filteredDevices}
      deviceColumns={logic.deviceColumns}
      devices={logic.devices}
      signalDistribution={logic.signalDistribution}
      openControlModal={logic.openControlModal}
      openSettingsModal={logic.openSettingsModal}
      handleResolveAlert={logic.handleResolveAlert}
      showAddModal={logic.showAddModal}
      showDetailModal={logic.showDetailModal}
      showBindModal={logic.showBindModal}
      showControlModal={logic.showControlModal}
      showSettingsModal={logic.showSettingsModal}
      showOTAModal={logic.showOTAModal}
      showBulkOTAModal={logic.showBulkOTAModal}
      showOTAProgressModal={logic.showOTAProgressModal}
      showImportModal={logic.showImportModal}
      selectedDevice={logic.selectedDevice}
      heartbeats={logic.heartbeats}
      newDevice={logic.newDevice}
      newDeviceErrors={logic.newDeviceErrors}
      bindForm={logic.bindForm}
      deviceSettings={logic.deviceSettings}
      otaForm={logic.otaForm}
      bulkOtaForm={logic.bulkOtaForm}
      classes={logic.classes}
      admins={logic.admins}
      importFile={logic.importFile}
      importResult={logic.importResult}
      isImporting={logic.isImporting}
      controlAction={logic.controlAction}
      otaProgressData={logic.otaProgressData}
      submitting={logic.submitting}
      handleNewDeviceChange={logic.handleNewDeviceChange}
      submitAddDevice={logic.submitAddDevice}
      closeDetailModal={logic.closeDetailModal}
      handleBindChange={logic.handleBindChange}
      submitBindDevice={logic.submitBindDevice}
      closeBindModal={logic.closeBindModal}
      setControlAction={logic.setControlAction}
      submitRemoteControl={logic.submitRemoteControl}
      closeControlModal={logic.closeControlModal}
      handleDeviceSettingsChange={logic.handleDeviceSettingsChange}
      submitUpdateSettings={logic.submitUpdateSettings}
      closeSettingsModal={logic.closeSettingsModal}
      handleOtaFormChange={logic.handleOtaFormChange}
      submitOTAUpgrade={logic.submitOTAUpgrade}
      closeOTAModal={logic.closeOTAModal}
      handleBulkOtaFormChange={logic.handleBulkOtaFormChange}
      submitBulkOTAUpgrade={logic.submitBulkOTAUpgrade}
      closeBulkOTAModal={logic.closeBulkOTAModal}
      setShowOTAProgressModal={logic.setShowOTAProgressModal}
      loadOTAStatus={logic.loadOTAStatus}
      closeImportModal={logic.closeImportModal}
      handleFileChange={logic.handleFileChange}
      handleImport={logic.handleImport}
      handleExportErrors={logic.handleExportErrors}
    />
  );
}

export default DeviceManagement;
