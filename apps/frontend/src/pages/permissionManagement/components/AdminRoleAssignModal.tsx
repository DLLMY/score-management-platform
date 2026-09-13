// T12-5 拆分（2026-09-12）：自 PermissionManagementView.tsx 原样搬出，行为逐字节等价。
import { Modal, Button } from '../../../components';
import type { PermissionManagementViewProps } from '../types';

export function AdminRoleAssignModal({
  showRoleAssignModal,
  setShowRoleAssignModal,
  selectedAdminForRoles,
  roles,
  selectedRolesForAdmin,
  toggleAdminRole,
  runSubmit,
  handleSaveAdminRoles,
  submitting,
}: PermissionManagementViewProps) {
  return (
    <>
      {/* Admin Role Assignment Modal */}
      <Modal
        isOpen={showRoleAssignModal}
        onClose={() => setShowRoleAssignModal(false)}
        title={`为 ${selectedAdminForRoles?.real_name || selectedAdminForRoles?.username} 分配角色`}
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>选择角色</label>
            <div className='border border-gray-200 rounded-lg max-h-64 overflow-y-auto'>
              {roles.length === 0 ? (
                <div className='p-4 text-center text-gray-500 text-sm'>暂无角色可选</div>
              ) : (
                <div className='divide-y divide-gray-100'>
                  {roles.map((role) => (
                    <label
                      key={role.role_code}
                      className='flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer'
                    >
                      <div>
                        <div className='font-medium text-gray-900 text-sm'>{role.role_name}</div>
                        <div className='text-xs text-gray-500 font-mono'>{role.role_code}</div>
                        {role.description && (
                          <div className='text-xs text-gray-400 mt-1'>{role.description}</div>
                        )}
                      </div>
                      <input
                        type='checkbox'
                        checked={selectedRolesForAdmin.includes(role.role_code)}
                        onChange={() => toggleAdminRole(role.role_code)}
                        className='w-4 h-4 text-blue-600 rounded'
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className='text-xs text-gray-500 mt-1'>
              已选择 {selectedRolesForAdmin.length} 个角色
            </div>
          </div>
          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => setShowRoleAssignModal(false)}>
              取消
            </Button>
            <Button onClick={() => runSubmit(handleSaveAdminRoles)} disabled={submitting}>
              保存分配
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
