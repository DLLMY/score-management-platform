/**
 * 通知管理页（Notifications）的类型契约。
 */

import type { ReactNode, ChangeEvent, FormEvent, Dispatch, SetStateAction } from 'react';
import { useListFetch } from '../../hooks';
import type { AdminNotification } from '../../services/api';

export interface SendForm {
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  priority: 'high' | 'medium' | 'low';
}

/** 通知 type 取值 */
export type NotificationFilterField = 'status' | 'type' | 'priority';

/** useListFetch 在本页的实例化结果类型 */
export type NotificationsListResult = ReturnType<typeof useListFetch<AdminNotification>>;

/**
 * 通知管理页视图层（NotificationsView）所需的全部 props。
 */
export interface NotificationsViewProps {
  /** 通知列表（含 items/total/loading/mutate 等） */
  list: NotificationsListResult;
  loadNotifications: () => void;
  /** 分页 */
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  totalPages: number;
  /** 筛选 */
  filterStatus: string;
  filterType: string;
  filterPriority: string;
  handleFilterChange: (
    field: NotificationFilterField
  ) => (e: ChangeEvent<HTMLSelectElement>) => void;
  /** 操作 */
  handleMarkRead: (id: number) => Promise<void>;
  handleMarkAllRead: () => Promise<void>;
  handleDelete: (id: number) => Promise<void>;
  /** 发送模态 */
  showSendModal: boolean;
  setShowSendModal: Dispatch<SetStateAction<boolean>>;
  sendForm: SendForm;
  setSendForm: Dispatch<SetStateAction<SendForm>>;
  handleFormChange: (
    field: keyof SendForm
  ) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleSendNotification: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  sending: boolean;
  /** 展示辅助 */
  unreadCount: number;
  getTypeColor: (type: string) => string;
  getTypeLabel: (type: string) => string;
  getTypeIcon: (type: string) => ReactNode;
  getPriorityColor: (priority: string) => string;
  getPriorityLabel: (priority: string) => string;
}
