import { AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { Button, PermissionButton, EmptyState } from '../../components';
import StatisticsCards from './StatisticsCards';
import GroupCard from './GroupCard';
import GroupFormModal from './GroupFormModal';
import DevicesModal from './DevicesModal';
import AddDevicesModal from './AddDevicesModal';
import type { DeviceGroupViewProps, GroupStats } from './types';

export default function DeviceGroupView({
  loadError,
  groups,
  stats,
  isRefreshing,
  onLoadData,
  onOpenCreateModal,
  showCreateModal,
  closeCreateModal,
  showEditModal,
  closeEditModal,
  showDevicesModal,
  closeDevicesModal,
  showAddDevicesModal,
  closeAddDevicesModal,
  groupForm,
  setGroupForm,
  submitting,
  onSubmitCreate,
  onSubmitUpdate,
  onSubmitAddDevices,
  onOpenEditModal,
  onOpenDevicesModal,
  onOpenAddDevicesModal,
  onDeleteGroup,
  onRemoveDevices,
  selectedGroup,
  groupDevices,
  devices,
  selectedDeviceIds,
  setSelectedDeviceIds,
}: DeviceGroupViewProps) {
  // Get group stats（防御：stats 在异步加载完前是 []，万一后端返回非数组也保底）
  const getGroupStats = (groupId: number): GroupStats | undefined => {
    if (!Array.isArray(stats)) return undefined;
    return stats.find((s) => s && s.group_id === groupId);
  };

  return (
    <div className='space-y-6'>
      {loadError && (
        <div className='flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            分组/设备数据加载失败，当前列表可能不完整，请刷新重试
          </p>
        </div>
      )}
      {/* Header */}
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-800'>设备分组管理</h1>
          <p className='text-gray-500 mt-1'>管理和组织您的设备分组</p>
        </div>
        <div className='flex flex-wrap gap-3'>
          <Button variant='outline' icon={RefreshCw} onClick={onLoadData} disabled={isRefreshing}>
            {isRefreshing ? '刷新中...' : '刷新'}
          </Button>
          <PermissionButton
            permission='device-group.manage'
            variant='primary'
            icon={Plus}
            onClick={() => onOpenCreateModal()}
          >
            新建分组
          </PermissionButton>
        </div>
      </div>

      {/* Stats Overview */}
      <StatisticsCards groups={groups} stats={stats} />

      {/* Group List */}
      {!Array.isArray(groups) || groups.length === 0 ? (
        <EmptyState
          icon='folder'
          title='暂无设备分组'
          description='创建设备分组来更好地组织和管理您的设备'
          actionLabel='创建分组'
          onAction={() => onOpenCreateModal()}
        />
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {groups.map((group) => {
            const groupStat = getGroupStats(group.id);
            return (
              <GroupCard
                key={group.id}
                group={group}
                groupStat={groupStat}
                onViewDevices={onOpenDevicesModal}
                onAddDevices={onOpenAddDevicesModal}
                onEdit={onOpenEditModal}
                onDelete={onDeleteGroup}
              />
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <GroupFormModal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title='创建设备分组'
        submitLabel='创建'
        form={groupForm}
        setForm={setGroupForm}
        onSubmit={onSubmitCreate}
        submitting={submitting}
      />

      {/* Edit Modal */}
      <GroupFormModal
        isOpen={showEditModal}
        onClose={closeEditModal}
        title='编辑设备分组'
        submitLabel='保存'
        form={groupForm}
        setForm={setGroupForm}
        onSubmit={onSubmitUpdate}
        submitting={submitting}
      />

      {/* Devices Modal */}
      <DevicesModal
        isOpen={showDevicesModal}
        onClose={closeDevicesModal}
        selectedGroup={selectedGroup}
        groupDevices={groupDevices}
        onRemoveDevices={onRemoveDevices}
        onOpenAddDevicesModal={onOpenAddDevicesModal}
      />

      {/* Add Devices Modal */}
      <AddDevicesModal
        isOpen={showAddDevicesModal}
        onClose={closeAddDevicesModal}
        selectedGroup={selectedGroup}
        devices={devices}
        groupDevices={groupDevices}
        selectedDeviceIds={selectedDeviceIds}
        setSelectedDeviceIds={setSelectedDeviceIds}
        onSubmit={onSubmitAddDevices}
        submitting={submitting}
      />
    </div>
  );
}
