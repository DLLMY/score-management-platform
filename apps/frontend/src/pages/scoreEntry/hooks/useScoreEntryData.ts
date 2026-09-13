/* eslint-disable react-hooks/exhaustive-deps */
/**
 * T12-7 拆分（2026-09-12）：数据拉取域（初始拉取 / 学生与成绩拉取 + 竞态防护 / 班级防抖 / 节流刷新）。
 * 自 useScoreEntryLogic.tsx 原样搬出，共享原语（dispatch / showToast / selectedExam / selectedClass）由组合根注入。
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useDebouncedValue, useThrottledCallback } from '../../../hooks';
import api from '../../../services/api';
import type { User, Subject } from '../../../types';
import type { ClassInfo, ExamData, ScoreEntryAction, ScoreItem, ShowToast } from '../types';

export interface ScoreEntryDataParams {
  dispatch: Dispatch<ScoreEntryAction>;
  showToast: ShowToast;
  selectedExam: string;
  selectedClass: string;
}

export interface ScoreEntryDataResult {
  setClassInput: Dispatch<SetStateAction<string>>;
  fetchStudentsAndScores: () => Promise<void>;
  throttledRefresh: () => void;
}

export function useScoreEntryData(params: ScoreEntryDataParams): ScoreEntryDataResult {
  const { dispatch, showToast, selectedExam, selectedClass } = params;

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [examsRes, classesRes, subjectsRes] = await Promise.all([
        api.exams.getAll(),
        api.classes.getAll(),
        api.subjects.getAll(),
      ]);

      const allExams: ExamData[] = Array.isArray(examsRes)
        ? examsRes
        : (examsRes as { data?: ExamData[] }).data || [];
      dispatch({ type: 'SET_EXAMS', payload: allExams.filter((e) => e.status === 'published') });
      dispatch({
        type: 'SET_CLASSES',
        payload: Array.isArray(classesRes)
          ? classesRes
          : (classesRes as { classes?: ClassInfo[] }).classes || [],
      });
      dispatch({
        type: 'SET_SUBJECTS',
        payload: Array.isArray(subjectsRes)
          ? subjectsRes
          : (subjectsRes as { data?: Subject[] }).data || [],
      });
    } catch (err: unknown) {
      showToast('error', '获取数据失败: ' + (err as Error).message);
    }
  }, [showToast]);

  // M8: 竞态防护——切换考试/班级时仅最新请求生效
  const fetchSeqRef = useRef(0);
  const fetchStudentsAndScores = useCallback(async (): Promise<void> => {
    if (!selectedExam) return;
    const seq = ++fetchSeqRef.current;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const usersRes = await api.users.getAll({
        class_id: selectedClass ? Number(selectedClass) : undefined,
        skipCache: true,
      });
      if (seq !== fetchSeqRef.current) return;
      const allUsers = Array.isArray(usersRes)
        ? usersRes
        : (usersRes as { users?: User[] }).users || [];
      dispatch({ type: 'SET_STUDENTS', payload: allUsers.filter((u) => u.role === 'student') });

      const scoresRes = await api.scores.getAll({ exam_id: selectedExam });
      if (seq !== fetchSeqRef.current) return;
      const scoresList: ScoreItem[] = Array.isArray(scoresRes)
        ? scoresRes
        : (scoresRes as { data?: ScoreItem[] }).data || [];

      const scoresMap: Record<string, ScoreItem> = {};
      scoresList.forEach((score) => {
        const key = `${score.student_id}-${score.subject}`;
        scoresMap[key] = score;
      });
      dispatch({ type: 'SET_SCORES', payload: scoresMap });
      dispatch({ type: 'CLEAR_PENDING_CHANGES' });
    } catch (err: unknown) {
      if (seq !== fetchSeqRef.current) return;
      showToast('error', '获取数据失败: ' + (err as Error).message);
    } finally {
      if (seq === fetchSeqRef.current) dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [selectedExam, selectedClass, showToast]);

  // 防抖搜索 - 班级选择不会频繁变化，所以使用较短延迟
  const [classInput, setClassInput] = useState(selectedClass);
  const debouncedClass = useDebouncedValue(classInput, 150);

  // 班级变化时更新 selectedClass
  useEffect(() => {
    if (debouncedClass !== selectedClass) {
      dispatch({ type: 'SET_SELECTED_CLASS', payload: debouncedClass });
    }
  }, [debouncedClass, selectedClass]);

  // 节流刷新 - 限制刷新频率（最少间隔 1 秒）
  const fetchDataRef = useRef<typeof fetchData | null>(null);
  const fetchStudentsRef = useRef<typeof fetchStudentsAndScores | null>(null);

  const throttledRefresh = useThrottledCallback(() => {
    if (fetchStudentsRef.current) {
      fetchStudentsRef.current();
    }
  }, 1000);

  useEffect(() => {
    fetchDataRef.current = fetchData;
    fetchStudentsRef.current = fetchStudentsAndScores;
  }, [fetchData, fetchStudentsAndScores]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedExam) {
      fetchStudentsAndScores();
    }
  }, [selectedExam, selectedClass, fetchStudentsAndScores]);

  return { setClassInput, fetchStudentsAndScores, throttledRefresh };
}
