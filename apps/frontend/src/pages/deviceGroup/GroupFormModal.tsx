import { Modal, Button } from '../../components';
import { ICON_OPTIONS, COLOR_OPTIONS, type FormData } from './types';

interface GroupFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  submitLabel: string;
  form: FormData;
  setForm: (data: Partial<FormData> | ((prev: FormData) => Partial<FormData>)) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export default function GroupFormModal({
  isOpen,
  onClose,
  title,
  submitLabel,
  form,
  setForm,
  onSubmit,
  submitting,
}: GroupFormModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className='space-y-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>分组名称 *</label>
          <input
            type='text'
            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder='请输入分组名称'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>描述</label>
          <textarea
            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder='请输入分组描述（可选）'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>位置</label>
          <input
            type='text'
            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder='如：一楼教室、实验室A'
          />
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>图标</label>
            <select
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
            >
              {ICON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>颜色</label>
            <select
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            >
              {COLOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>排序</label>
          <input
            type='number'
            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className='flex justify-end space-x-3 mt-6'>
        <Button variant='outline' onClick={onClose}>
          取消
        </Button>
        <Button variant='primary' onClick={onSubmit} disabled={submitting}>
          {submitLabel}
        </Button>
      </div>
    </Modal>
  );
}
