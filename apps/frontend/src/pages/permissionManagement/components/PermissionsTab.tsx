// T12-5 拆分（2026-09-12）：自 PermissionManagementView.tsx 原样搬出，行为逐字节等价。
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { SearchFilter, PermissionButton, Card } from '../../../components';
import { PERMISSION_CATEGORIES } from '../helpers';
import type { PermissionManagementViewProps } from '../types';

export function PermissionsTab({
  permissionFilter,
  setPermissionFilter,
  handleOpenCreatePermission,
  groupedPermissions,
  handleOpenEditPermission,
  handleDeletePermission,
}: PermissionManagementViewProps) {
  return (
    <>
      <div>
        <div className='flex gap-4 mb-4'>
          <SearchFilter
            placeholder='搜索权限...'
            value={permissionFilter.search}
            onChange={(value) => setPermissionFilter((prev) => ({ ...prev, search: value }))}
            className='flex-1'
          />
          <select
            value={permissionFilter.category}
            onChange={(e) => setPermissionFilter((prev) => ({ ...prev, category: e.target.value }))}
            className='px-3 py-2 border border-gray-300 rounded-lg text-sm'
          >
            <option value=''>全部分类</option>
            {PERMISSION_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          <PermissionButton permission='system.roles' onClick={handleOpenCreatePermission}>
            <Plus className='w-4 h-4 mr-2' />
            创建权限
          </PermissionButton>
        </div>

        <div className='space-y-6'>
          {Object.entries(groupedPermissions).map(([category, perms]) => (
            <Card key={category}>
              <div className='px-4 py-3 border-b border-gray-200'>
                <h3 className='font-medium text-gray-900'>
                  {PERMISSION_CATEGORIES.find((c) => c.value === category)?.label || category}
                </h3>
              </div>
              <div className='divide-y divide-gray-200'>
                {perms.map((permission) => (
                  <div
                    key={permission.id}
                    className='px-4 py-3 flex items-center justify-between hover:bg-gray-50'
                  >
                    <div>
                      <div className='font-medium text-gray-900'>{permission.name}</div>
                      <div className='text-sm text-gray-500 font-mono'>{permission.code}</div>
                      {permission.description && (
                        <div className='text-sm text-gray-400 mt-1'>{permission.description}</div>
                      )}
                    </div>
                    <div className='flex items-center gap-3'>
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          permission.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {permission.is_active ? '启用' : '禁用'}
                      </span>
                      <div className='flex gap-1'>
                        <PermissionButton
                          permission='system.roles'
                          variant='secondary'
                          size='sm'
                          onClick={() => handleOpenEditPermission(permission)}
                        >
                          <Edit2 className='w-4 h-4' />
                        </PermissionButton>
                        <PermissionButton
                          permission='system.roles'
                          variant='danger'
                          size='sm'
                          onClick={() => handleDeletePermission(permission)}
                        >
                          <Trash2 className='w-4 h-4' />
                        </PermissionButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
