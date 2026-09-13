// T12-5 拆分（2026-09-12）：自 PermissionManagementView.tsx 原样搬出，行为逐字节等价。
import { Modal, Button } from '../../../components';
import type { PermissionManagementViewProps } from '../types';

export function RoleModal({
  showRoleModal,
  setShowRoleModal,
  isEditingRole,
  roleFormData,
  setRoleFormData,
  availablePermissions,
  selectedPermissions,
  togglePermission,
  runSubmit,
  handleSaveRole,
  submitting,
}: PermissionManagementViewProps) {
  return (
    <>
      {/* Role Modal */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={isEditingRole ? '编辑角色' : '创建角色'}
        size='lg'
      >
        <div className='space-y-4'>
          {!isEditingRole && (
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                角色代码 <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={roleFormData.role_code}
                onChange={(e) =>
                  setRoleFormData((prev) => ({ ...prev, role_code: e.target.value }))
                }
                placeholder='如: operator'
                className='w-full px-3 py-2 border border-gray-300 rounded-lg'
              />
            </div>
          )}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              角色名称 <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={roleFormData.role_name}
              onChange={(e) => setRoleFormData((prev) => ({ ...prev, role_name: e.target.value }))}
              placeholder='如: 运维人员'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>描述</label>
            <textarea
              value={roleFormData.description}
              onChange={(e) =>
                setRoleFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder='角色描述...'
              rows={2}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>权限分配</label>
            <div className='border border-gray-200 rounded-lg max-h-64 overflow-y-auto'>
              {availablePermissions.length === 0 ? (
                <div className='p-4 text-center text-gray-500 text-sm'>暂无权限可选</div>
              ) : (
                <div className='divide-y divide-gray-100'>
                  {availablePermissions.map((perm) => (
                    <label
                      key={perm.id}
                      className='flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer'
                    >
                      <div>
                        <div className='font-medium text-gray-900 text-sm'>{perm.name}</div>
                        <div className='text-xs text-gray-500 font-mono'>{perm.code}</div>
                      </div>
                      <input
                        type='checkbox'
                        checked={selectedPermissions.includes(perm.code)}
                        onChange={() => togglePermission(perm.code)}
                        className='w-4 h-4 text-blue-600 rounded'
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className='text-xs text-gray-500 mt-1'>
              已选择 {selectedPermissions.length} 个权限
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              id='role-is-active'
              checked={roleFormData.is_active}
              onChange={(e) =>
                setRoleFormData((prev) => ({ ...prev, is_active: e.target.checked }))
              }
              className='w-4 h-4 text-blue-600 rounded'
            />
            <label htmlFor='role-is-active' className='text-sm text-gray-700'>
              启用此角色
            </label>
          </div>
          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => setShowRoleModal(false)}>
              取消
            </Button>
            <Button onClick={() => runSubmit(handleSaveRole)} disabled={submitting}>
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
