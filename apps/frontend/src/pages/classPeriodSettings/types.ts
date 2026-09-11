import type { ClassPeriod } from '../../services/api';

export interface PeriodFormData {
  name: string;
  period_number: number;
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
  description: string;
  is_active: boolean;
  sort_order: number;
}

export interface ClassPeriodSettingsViewProps {
  periods: ClassPeriod[];
  hasChanges: boolean;
  showModal: boolean;
  editingPeriod: ClassPeriod | null;
  formData: PeriodFormData;

  // handlers
  handleAdd: () => void;
  handleEdit: (period: ClassPeriod) => void;
  handleDelete: (id: number, name: string) => void;
  handleReset: () => void;
  handleMove: (index: number, direction: 'up' | 'down') => void;
  handleToggleActive: (period: ClassPeriod) => void;
  handleSaveOrder: () => void;
  handleCancelChanges: () => void;
  setFormData: (data: Partial<PeriodFormData>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  setShowModal: (b: boolean) => void;
}
