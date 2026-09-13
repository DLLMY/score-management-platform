// T12-5 拆分（2026-09-12）：自 PermissionManagementView.tsx 原样搬出，行为逐字节等价。
import { UserPlus, Edit2, Crown, Trash2 } from 'lucide-react';
import { PermissionButton, Card, DataTable } from '../../../components';
import type { Admin } from '../../../types';
import type { PermissionManagementViewProps } from '../types';

export function AdminsTab({
  adminColumns,
  admins,
  handleCreateAdmin,
  handleEditAdmin,
  handleOpenRoleAssign,
  handleDeleteAdmin,
}: PermissionManagementViewProps) {
  return (
    <>
      <div>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-lg font-semibold text-gray-900'>管理员列表</h2>
          <PermissionButton permission='system.users' onClick={handleCreateAdmin}>
            <UserPlus className='w-4 h-4 mr-2' />
            添加管理员
          </PermissionButton>
        </div>

        <Card>
          <DataTable<Admin>
            columns={adminColumns}
            dataSource={admins}
            rowKey='id'
            scroll={{ x: 900 }}
            empty={{
              icon: 'users',
              title: '暂无管理员',
              description: '点击「添加管理员」创建第一个管理员',
            }}
            rowActions={(admin) => (
              <div className='flex items-center justify-end gap-2'>
                <PermissionButton
                  permission='system.users'
                  variant='secondary'
                  size='sm'
                  onClick={() => handleEditAdmin(admin)}
                >
                  <Edit2 className='w-4 h-4' />
                </PermissionButton>
                <PermissionButton
                  permission='system.roles'
                  variant='outline'
                  size='sm'
                  onClick={() => handleOpenRoleAssign(admin)}
                >
                  <Crown className='w-4 h-4' />
                </PermissionButton>
                {admin.username !== 'admin' && (
                  <PermissionButton
                    permission='system.users'
                    variant='danger'
                    size='sm'
                    onClick={() => handleDeleteAdmin(admin)}
                  >
                    <Trash2 className='w-4 h-4' />
                  </PermissionButton>
                )}
              </div>
            )}
          />
        </Card>
      </div>
    </>
  );
}
