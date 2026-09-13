// T12-5 拆分（2026-09-12）：自 PermissionManagementView.tsx 原样搬出，行为逐字节等价。
import { Modal, Button } from '../../../components';
import { PERMISSION_CATEGORIES } from '../helpers';
import type { PermissionManagementViewProps } from '../types';

export function PermissionModal({
  showPermissionModal,
  setShowPermissionModal,
  isEditingPermission,
  permissionFormData,
  setPermissionFormData,
  runSubmit,
  handleSavePermission,
  submitting,
}: PermissionManagementViewProps) {
  return (
    <>
      {/* Permission Modal */}
      <Modal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title={isEditingPermission ? '编辑权限' : '创建权限'}
      >
        <div className='space-y-4'>
          {!isEditingPermission && (
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                权限代码 <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={permissionFormData.code}
                onChange={(e) =>
                  setPermissionFormData((prev) => ({ ...prev, code: e.target.value }))
                }
                placeholder='如: device.create'
                className='w-full px-3 py-2 border border-gray-300 rounded-lg'
              />
            </div>
          )}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              权限名称 <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={permissionFormData.name}
              onChange={(e) => setPermissionFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder='如: 创建设备'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>分类</label>
            <select
              value={permissionFormData.category}
              onChange={(e) =>
                setPermissionFormData((prev) => ({ ...prev, category: e.target.value }))
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            >
              {PERMISSION_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>描述</label>
            <textarea
              value={permissionFormData.description}
              onChange={(e) =>
                setPermissionFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder='权限描述...'
              rows={2}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              id='perm-is-active'
              checked={permissionFormData.is_active}
              onChange={(e) =>
                setPermissionFormData((prev) => ({ ...prev, is_active: e.target.checked }))
              }
              className='w-4 h-4 text-blue-600 rounded'
            />
            <label htmlFor='perm-is-active' className='text-sm text-gray-700'>
              启用此权限
            </label>
          </div>
          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => setShowPermissionModal(false)}>
              取消
            </Button>
            <Button onClick={() => runSubmit(handleSavePermission)} disabled={submitting}>
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
