// T12-6 拆分（2026-09-12）：类型自 ParentContactView.tsx 原样搬出。
import type { Dispatch, SetStateAction } from 'react';
import type { ParentContact, ContactLog } from '../../types';
import { UseListFetchResult } from '../../hooks';
export interface ContactFormData {
  student_id: number;
  father_name: string;
  father_phone: string;
  mother_name: string;
  mother_phone: string;
  address: string;
  email: string;
}

export interface LogFormData {
  contact_type: string;
  content: string;
}

export interface ParentContactViewProps {
  contacts: UseListFetchResult<ParentContact>;
  isLoading: boolean;
  logs: ContactLog[];
  selectedContact: ParentContact | null;
  expandedContactId: number | null;
  showContactModal: boolean;
  showLogModal: boolean;
  editingContactId: number | null;
  contactForm: ContactFormData;
  logForm: LogFormData;
  filterClassId: number;
  submitting: boolean;
  setFilterClassId: (id: number) => void;
  openCreateContactModal: () => void;
  toggleExpand: (contact: ParentContact) => void;
  openEditContactModal: (contact: ParentContact) => void;
  openAddLogModal: (contact: ParentContact) => void;
  handleDeleteContact: (id: number) => void;
  handleContactSubmit: () => void;
  handleAddLog: () => void;
  setContactForm: Dispatch<SetStateAction<ContactFormData>>;
  setLogForm: Dispatch<SetStateAction<LogFormData>>;
  setShowContactModal: (v: boolean) => void;
  setShowLogModal: (v: boolean) => void;
  contactPage: number;
  setContactPage: (p: number) => void;
  runSubmit: (fn: () => Promise<unknown> | unknown) => Promise<void>;
  totalLogs: number;
  resolvedLogs: number;
}
