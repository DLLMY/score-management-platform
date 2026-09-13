// T12-5 拆分（2026-09-12）：本文件退化为布局编排 View；区块组件见 ./components，
// 类型见 ./types；全部逻辑见 ./usePermissionManagementLogic，页面装配层见 ../PermissionManagement。
import { LoadingSpinner } from '../../components';
import {
  TabNav,
  AdminsTab,
  ClassesTab,
  RolesTab,
  PermissionsTab,
  LogsTab,
  AdminModal,
  AdminRoleAssignModal,
  ClassModal,
  RoleModal,
  PermissionModal,
} from './components';
import type { PermissionManagementViewProps } from './types';

export type { PermissionManagementViewProps } from './types';

export default function PermissionManagementView(props: PermissionManagementViewProps) {
  const { loading, activeTab } = props;

  if (loading) return <LoadingSpinner />;

  return (
    <div className='space-y-6'>
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>权限管理系统</h1>
          <p className='text-gray-500 mt-1'>管理系统用户、角色和权限</p>
        </div>
      </div>

      <TabNav {...props} />

      {activeTab === 'admins' && <AdminsTab {...props} />}
      {activeTab === 'classes' && <ClassesTab {...props} />}
      {activeTab === 'roles' && <RolesTab {...props} />}
      {activeTab === 'permissions' && <PermissionsTab {...props} />}
      {activeTab === 'logs' && <LogsTab {...props} />}

      <AdminModal {...props} />
      <AdminRoleAssignModal {...props} />
      <ClassModal {...props} />
      <RoleModal {...props} />
      <PermissionModal {...props} />
    </div>
  );
}
