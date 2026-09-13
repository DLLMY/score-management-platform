/**
 * T12-7 拆分（2026-09-12）：派生数据域（考试科目解析 / 科目 ID 映射 / 可见科目 / 录入进度 / 学生过滤）。
 * 自 useScoreEntryLogic.tsx 原样搬出。
 */

import { useMemo, useCallback } from 'react';
import type { User, Subject } from '../../../types';
import type { ExamData, ScoreItem } from '../types';

export interface ScoreEntryDerivedParams {
  exams: ExamData[];
  selectedExam: string;
  subjects: Subject[];
  filterSubject: string;
  statusFilter: string;
  students: User[];
  scores: Record<string, ScoreItem>;
}

export interface ScoreEntryDerivedResult {
  examSubjects: string[];
  getSubjectId: (subjectName: string) => number | undefined;
  visibleSubjects: string[];
  getEntryProgress: number;
  filteredStudents: User[];
}

export function useScoreEntryDerived(params: ScoreEntryDerivedParams): ScoreEntryDerivedResult {
  const { exams, selectedExam, subjects, filterSubject, statusFilter, students, scores } = params;

  const examSubjects = useMemo((): string[] => {
    const exam = exams.find((e) => e.id.toString() === selectedExam);
    if (!exam) return [];
    const raw = exam.subjects as unknown;
    // 1) 已经是数组：直接用
    if (Array.isArray(raw)) {
      return raw.map((x) => String(x));
    }
    // 2) 不是数组但有内容：尝试多种解析方式（防御性兼容历史脏数据）
    if (typeof raw === 'string' && raw.length > 0) {
      const s = raw.trim();
      try {
        // JSON 数组字符串，例如 '["语文","数学"]'
        let v: unknown = JSON.parse(s);
        if (typeof v === 'string') {
          // 嵌套字符串：再 parse 一次
          v = JSON.parse(v);
        }
        if (Array.isArray(v)) {
          return (v as unknown[]).map((x) => String(x));
        }
      } catch {
        /* 忽略，退回 split */
      }
      // 3) CSV 形式的 fallback："语文,数学,英语" -> ['语文','数学','英语']
      return s
        .split(',')
        .map((t) => t.trim().replace(/^["'[\]]+|["'[\]]+$/g, ''))
        .filter(Boolean);
    }
    return [];
  }, [exams, selectedExam]);

  const getSubjectId = useCallback(
    (subjectName: string): number | undefined => {
      const subject = subjects.find(
        (s) =>
          s.name === subjectName && s.exam_id !== undefined && s.exam_id.toString() === selectedExam
      );
      return subject?.id;
    },
    [subjects, selectedExam]
  );

  const visibleSubjects = useMemo((): string[] => {
    if (!filterSubject) return examSubjects;
    return examSubjects.filter((s) => s === filterSubject);
  }, [examSubjects, filterSubject]);

  const getEntryProgress = useMemo((): number => {
    if (students.length === 0 || visibleSubjects.length === 0) return 0;

    let filled = 0;
    const total = students.length * visibleSubjects.length;

    students.forEach((student) => {
      visibleSubjects.forEach((subject) => {
        const key = `${student.id}-${subject}`;
        if (scores[key]?.score !== undefined && scores[key]?.score !== null) {
          filled++;
        }
      });
    });

    return total > 0 ? Math.round((filled / total) * 100) : 0;
  }, [students, visibleSubjects, scores]);

  const filteredStudents = useMemo((): User[] => {
    let filtered = students;

    if (statusFilter) {
      filtered = filtered.filter((student) => {
        const hasAnyScore = visibleSubjects.some(
          (subject) =>
            scores[`${student.id}-${subject}`]?.score !== undefined &&
            scores[`${student.id}-${subject}`]?.score !== null
        );

        const allConfirmed = visibleSubjects.every(
          (subject) => scores[`${student.id}-${subject}`]?.status === 'confirmed'
        );

        const somePending = visibleSubjects.some(
          (subject) => scores[`${student.id}-${subject}`]?.status === 'pending'
        );

        if (statusFilter === 'confirmed') return allConfirmed;
        if (statusFilter === 'pending') return somePending && !allConfirmed;
        if (statusFilter === 'partial') return hasAnyScore && !allConfirmed && !somePending;
        if (statusFilter === 'empty') return !hasAnyScore;

        return true;
      });
    }

    return filtered;
  }, [students, statusFilter, visibleSubjects, scores]);

  return { examSubjects, getSubjectId, visibleSubjects, getEntryProgress, filteredStudents };
}
