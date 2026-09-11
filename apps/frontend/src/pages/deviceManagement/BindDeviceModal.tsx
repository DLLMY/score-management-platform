import { Button, Modal, Select } from '../../components';
import type { ClassItem, AdminItem, BindForm } from './types';

interface BindDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceLabel: string;
  bindForm: BindForm;
  onChange: (field: 'class_id' | 'admin_id', value: string) => void;
  classes: ClassItem[];
  admins: AdminItem[];
  submitting: boolean;
  onSubmit: () => void;
}

export function BindDeviceModal({
  isOpen,
  onClose,
  deviceLabel,
  bindForm,
  onChange,
  classes,
  admins,
  submitting,
  onSubmit,
}: BindDeviceModalProps) {
  return (
    <Modal
      title={`绑定设置 - ${deviceLabel}`}
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            确认绑定
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>所属班级</label>
          <Select value={bindForm.class_id} onChange={(value) => onChange('class_id', value)}>
            <option value=''>选择班级</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id.toString()}>
                {cls.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>绑定班主任</label>
          <Select value={bindForm.admin_id} onChange={(value) => onChange('admin_id', value)}>
            <option value=''>选择班主任</option>
            {admins.map((admin) => (
              <option key={admin.id} value={admin.id.toString()}>
                {admin.real_name} ({admin.username})
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Modal>
  );
}
