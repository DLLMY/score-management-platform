// T12-5 拆分（2026-09-12）：自 PermissionManagementView.tsx 原样搬出，行为逐字节等价。
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { PermissionButton, Card, DataTable } from '../../../components';
import type { RoleWithPermissions } from '../../../services/rbacApi';
import type { PermissionManagementViewProps } from '../types';

export function RolesTab({
  roleColumns,
  roles,
  handleOpenCreateRole,
  handleOpenEditRole,
  handleDeleteRole,
}: PermissionManagementViewProps) {
  return (
    <>
      <div>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-lg font-semibold text-gray-900'>角色列表</h2>
          <PermissionButton permission='system.roles' onClick={handleOpenCreateRole}>
            <Plus className='w-4 h-4 mr-2' />
            创建角色
          </PermissionButton>
        </div>

        <Card>
          <DataTable<RoleWithPermissions>
            columns={roleColumns}
            dataSource={roles}
            rowKey='role_code'
            scroll={{ x: 720 }}
            empty={{
              icon: 'data',
              title: '暂无角色',
              description: '点击「创建角色」创建第一个角色',
            }}
            rowActions={(role) => (
              <div className='flex items-center justify-end gap-2'>
                <PermissionButton
                  permission='system.roles'
                  variant='secondary'
                  size='sm'
                  onClick={() => handleOpenEditRole(role)}
                >
                  <Edit2 className='w-4 h-4' />
                </PermissionButton>
                <PermissionButton
                  permission='system.roles'
                  variant='danger'
                  size='sm'
                  onClick={() => handleDeleteRole(role)}
                >
                  <Trash2 className='w-4 h-4' />
                </PermissionButton>
              </div>
            )}
          />
        </Card>
      </div>
    </>
  );
}
