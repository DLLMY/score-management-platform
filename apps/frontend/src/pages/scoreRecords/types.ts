import React from 'react';
/**
 * 成绩档案页（ScoreRecords）的类型契约。
 *
 * 从原 ScoreRecords.tsx 原样搬入，主逻辑层与视图层共享。
 */

import type { User } from '../../types';
import type { ClassInfo } from '../../services/api';
import type { ExamWithScores } from '../../types';

export interface Student extends User {
  role: string;
  class_name: string;
}

export interface StudentDetail {
  id: number;
  name: string;
  card_id: string;
  class_name?: string;
  gender?: string;
  current_score?: number;
}

export interface StudentScoreStats {
  avgScore: string;
  subjectStats: Record<string, { avg: string; max: number; min: number; count: number }>;
  totalExams: number;
}

export interface StudentAnalysisResponse {
  exam_scores: Record<string, ExamWithScores>;
}

export interface UserResponse {
  user?: StudentDetail;
}

/**
 * 成绩档案页视图层（ScoreRecordsView）所需的全部 props。
 *
 * 与原主渲染闭包引用的变量一一对应，不含任何派生逻辑。
 */
export interface ScoreRecordsViewProps {
  /** 学生列表（已按班级/搜索过滤前的全量） */
  students: Student[];
  /** 当前选中学生 ID */
  selectedStudent: string;
  setSelectedStudent: React.Dispatch<React.SetStateAction<string>>;
  /** 选中学生的详情 */
  studentDetail: StudentDetail | null;
  /** 该学生历次考试成绩 */
  examScores: Record<string, ExamWithScores>;
  /** 搜索输入 */
  searchInput: string;
  setSearchInput: React.Dispatch<React.SetStateAction<string>>;
  /** 班级列表 */
  classes: ClassInfo[];
  /** 当前筛选班级 */
  selectedClass: string;
  setSelectedClass: React.Dispatch<React.SetStateAction<string>>;
  /** 详情加载中 */
  loading: boolean;
  /** 成绩概览统计（无成绩时为 null） */
  stats: StudentScoreStats | null;
  /** 导出成绩（返回 Blob） */
  handleExportScores: (format: 'excel' | 'csv') => Promise<Blob>;
}
