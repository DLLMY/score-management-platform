import React from 'react';
/**
 * 固件管理页（FirmwareManagement）的类型契约。
 */

import type { ChangeEvent } from 'react';
import { useListFetch } from '../../hooks';
import type { UseFormResult } from '../../hooks';
import type { Firmware, FirmwareRecord, OTAStatus } from '../../services/api';
import type { ColumnType } from '../../components';

export interface UploadFormData {
  version: string;
  description: string;
  min_compatible_version: string;
  is_mandatory: boolean;
  [key: string]: unknown;
}

/** 上传表单 setter（来自 useForm） */
export type UploadFormSetter = UseFormResult<UploadFormData>['setFormData'];

/** useListFetch 在本页的实例化结果类型 */
export type VersionsListResult = ReturnType<typeof useListFetch<Firmware>>;

/**
 * 固件管理页视图层（FirmwareManagementView）所需的全部 props。
 */
export interface FirmwareManagementViewProps {
  /** 固件版本列表（含 items/total/loading 等） */
  versions: VersionsListResult;
  /** 版本列表当前页 */
  versionsPage: number;
  /** 版本列表每页条数（由逻辑层固定） */
  versionsPerPage: number;
  setVersionsPage: React.Dispatch<React.SetStateAction<number>>;
  /** OTA 状态概览 */
  otaStatus: OTAStatus | null;
  /** 升级记录 */
  upgradeRecords: FirmwareRecord[];
  /** 版本表格列定义 */
  versionColumns: ColumnType<Firmware>[];
  /** 升级记录表格列定义 */
  recordColumns: ColumnType<FirmwareRecord>[];
  /** 刷新 */
  handleRefresh: () => void;
  isRefreshing: boolean;
  /** 上传表单 */
  uploadForm: UploadFormData;
  setUploadForm: UploadFormSetter;
  handleFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  handleUpload: () => Promise<void>;
  uploadFile: File | null;
  isUploading: boolean;
  /** 上传模态 */
  showUploadModal: boolean;
  openUploadModal: () => void;
  closeUploadModal: () => void;
}
