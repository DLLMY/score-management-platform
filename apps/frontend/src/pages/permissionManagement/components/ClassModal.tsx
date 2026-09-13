// T12-5 拆分（2026-09-12）：自 PermissionManagementView.tsx 原样搬出，行为逐字节等价。
import { Modal, Button } from '../../../components';
import type { PermissionManagementViewProps } from '../types';

export function ClassModal({
  showClassModal,
  setShowClassModal,
  editingClass,
  classFormData,
  setClassFormData,
  runSubmit,
  handleSaveClass,
  submitting,
}: PermissionManagementViewProps) {
  return (
    <>
      {/* Class Modal */}
      <Modal
        isOpen={showClassModal}
        onClose={() => setShowClassModal(false)}
        title={editingClass ? '编辑班级' : '添加班级'}
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>班级名称</label>
            <input
              type='text'
              value={classFormData.name}
              onChange={(e) => setClassFormData((prev) => ({ ...prev, name: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>年级</label>
            <input
              type='text'
              value={classFormData.grade}
              onChange={(e) => setClassFormData((prev) => ({ ...prev, grade: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>描述</label>
            <textarea
              value={classFormData.description}
              onChange={(e) =>
                setClassFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
              rows={2}
            />
          </div>
          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => setShowClassModal(false)}>
              取消
            </Button>
            <Button onClick={() => runSubmit(handleSaveClass)} disabled={submitting}>
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
