// T12-5 拆分（2026-09-12）：自 PermissionManagementView.tsx 原样搬出，行为逐字节等价。
import { Modal, Button } from '../../../components';
import type { UserRole } from '../types';
import type { PermissionManagementViewProps } from '../types';

export function AdminModal({
  showAdminModal,
  setShowAdminModal,
  editingAdmin,
  adminFormData,
  setAdminFormData,
  roles,
  classes,
  runSubmit,
  handleSaveAdmin,
  submitting,
}: PermissionManagementViewProps) {
  return (
    <>
      {/* Admin Modal */}
      <Modal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        title={editingAdmin ? '编辑管理员' : '添加管理员'}
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>用户名</label>
            <input
              type='text'
              value={adminFormData.username}
              onChange={(e) => setAdminFormData((prev) => ({ ...prev, username: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              {editingAdmin ? '新密码（留空不修改）' : '密码'}
            </label>
            <input
              type='password'
              value={adminFormData.password || ''}
              onChange={(e) => setAdminFormData((prev) => ({ ...prev, password: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>真实姓名</label>
            <input
              type='text'
              value={adminFormData.real_name}
              onChange={(e) => setAdminFormData((prev) => ({ ...prev, real_name: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>电话</label>
            <input
              type='text'
              value={adminFormData.phone}
              onChange={(e) => setAdminFormData((prev) => ({ ...prev, phone: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>角色（可多选）</label>
            <div className='flex flex-wrap gap-3'>
              {roles
                .filter((r) => r.is_active)
                .map((role) => (
                  <label
                    key={role.role_code}
                    className='flex items-center space-x-2 cursor-pointer'
                  >
                    <input
                      type='checkbox'
                      checked={adminFormData.roles.includes(role.role_code)}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setAdminFormData((prev) => ({
                          ...prev,
                          roles: isChecked
                            ? [...prev.roles, role.role_code]
                            : prev.roles.filter((r) => r !== role.role_code),
                          role: (isChecked
                            ? role.role_code
                            : prev.roles.length > 1
                            ? prev.role
                            : 'viewer') as UserRole,
                        }));
                      }}
                      className='w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500'
                    />
                    <span className='text-sm text-gray-700'>{role.role_name}</span>
                  </label>
                ))}
            </div>
            <div className='text-xs text-gray-500 mt-1'>
              已选择 {adminFormData.roles.length} 个角色
            </div>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>班级</label>
            <select
              value={adminFormData.class_name}
              onChange={(e) =>
                setAdminFormData((prev) => ({ ...prev, class_name: e.target.value }))
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            >
              <option value=''>无</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.name}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => setShowAdminModal(false)}>
              取消
            </Button>
            <Button onClick={() => runSubmit(handleSaveAdmin)} disabled={submitting}>
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
