import type { Dispatch, SetStateAction } from 'react';
import type { MentalHealthRecord, MentalHealthAlert } from '../../types';

export interface RecordFormData {
  student_id: number;
  mood_level: number;
  stress_level: number;
  sleep_hours: number;
  notes: string;
}

export const defaultRecordForm: RecordFormData = {
  student_id: 0,
  mood_level: 3,
  stress_level: 3,
  sleep_hours: 8,
  notes: '',
};

export interface MentalHealthViewProps {
  records: MentalHealthRecord[];
  isLoading: boolean;
  alerts: MentalHealthAlert[] | null;
  filteredRecords: MentalHealthRecord[];
  unresolvedAlerts: MentalHealthAlert[];
  resolvedAlerts: MentalHealthAlert[];
  avgMood: string;
  avgStress: string;
  avgSleep: string;
  recordTotal: number;
  alertTotal: number;
  recordPage: number;
  alertPage: number;
  activeTab: 'records' | 'alerts';
  resolvedFilter: boolean | undefined;
  searchTerm: string;
  filterClassId: number;
  showForm: boolean;
  formData: RecordFormData;
  errors: Partial<Record<keyof RecordFormData, string>>;
  submitting: boolean;
  setSearchTerm: (v: string) => void;
  setActiveTab: (t: 'records' | 'alerts') => void;
  setResolvedFilter: (v: boolean | undefined) => void;
  setRecordPage: (p: number) => void;
  setAlertPage: (p: number) => void;
  setFilterClassId: (id: number) => void;
  setFormData: Dispatch<SetStateAction<RecordFormData>>;
  handleOpenForm: () => void;
  handleCloseForm: () => void;
  handleSubmit: () => void;
  handleResolveAlert: (id: number) => void;
  runSubmit: (fn: () => Promise<unknown> | unknown) => Promise<void>;
}
