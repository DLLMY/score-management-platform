import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import api from '../../services/api';
import { useStableToast } from '../../hooks';
import logger from '../../utils/logger';
import type { ClassOption, StudentOption, StudentProfileState } from './types';

export interface StudentProfileLogicDeps {
  showToast: ReturnType<typeof useStableToast>['showToast'];
  predictionDays: number;
  recommendDays: number;
  anomalyDays: number;
  activeTab: string;
  setLoadWarn: Dispatch<SetStateAction<boolean>>;
}

export interface StudentProfileLogicResult {
  classes: ClassOption[];
  loadClasses: () => Promise<void>;
  students: StudentOption[];
  selectedProfileUserId: number | null;
  setSelectedProfileUserId: Dispatch<SetStateAction<number | null>>;
  studentProfile: StudentProfileState | null;
  setStudentProfile: Dispatch<SetStateAction<StudentProfileState | null>>;
  profileLoading: boolean;
  profileError: string | null;
  loadStudents: () => Promise<void>;
  loadStudentProfile: (userId: number) => Promise<void>;
}

/**
 * 学生画像（单用户算法下钻）逻辑子模块：班级/学生列表、画像加载、进入 Tab 自动加载学生列表。
 * 状态、3 个回调与 Tab 自动加载 effect 原样搬自 useAlgorithmAnalysisLogic.ts，函数体逐字不变；
 * showToast / selectedClass / 各天数 / activeTab / setLoadWarn 经 deps 注入。
 */
export function useStudentProfileLogic(deps: StudentProfileLogicDeps): StudentProfileLogicResult {
  const { showToast, predictionDays, recommendDays, anomalyDays, activeTab, setLoadWarn } = deps;
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<number | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfileState | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // 加载班级列表
  const loadClasses = useCallback(async () => {
    try {
      const data = (await api.classes.getAll()) as unknown;
      const classesData = Array.isArray(data)
        ? data
        : (data as { classes?: ClassOption[] }).classes || [];
      setClasses(classesData);
      setLoadWarn(false);
    } catch (err) {
      logger.error('加载班级列表失败:', err);
      setClasses([]);
      setLoadWarn(true);
    }
  }, []);

  // 加载学生列表（用于学生画像下钻）
  const loadStudents = useCallback(async () => {
    if (students.length > 0) return;
    try {
      const usersResponse = (await api.users.getAll()) as unknown;
      const usersList =
        (
          usersResponse as {
            users?: Array<{ id: number | string; name: string; class_name?: string }>;
          }
        ).users || [];
      const studentList = usersList.map((u) => ({
        id: typeof u.id === 'number' ? u.id : parseInt(String(u.id), 10),
        name: u.name,
        class_name: u.class_name || '',
      }));
      setStudents(studentList);
    } catch (err) {
      logger.error('加载学生列表失败:', err);
      showToast('error', '加载学生列表失败');
    }
  }, [students, showToast]);

  // 加载单个学生画像（并行消费全部单用户算法接口）
  const loadStudentProfile = useCallback(
    async (userId: number) => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const [
          prediction,
          scorePredict,
          riskPredict,
          anomaly,
          sudden,
          trend,
          group,
          attribution,
          engagement,
        ] = await Promise.all([
          api.algorithm.getPrediction(userId, predictionDays),
          api.algorithm.getScorePredict(userId, recommendDays),
          api.algorithm.getRiskPredict(userId, recommendDays),
          api.algorithm.getUserAnomaly(userId, anomalyDays),
          api.algorithm.getSuddenChange(userId, anomalyDays),
          api.algorithm.getTrendAnomaly(userId, anomalyDays),
          api.algorithm.getGroupAnomaly(userId, anomalyDays),
          api.algorithm.getScoreAttribution(userId, recommendDays),
          api.algorithm.getEngagement(userId, anomalyDays),
        ]);
        setStudentProfile({
          prediction,
          scorePredict,
          riskPredict,
          anomaly,
          sudden,
          trend,
          group,
          attribution,
          engagement,
        });
      } catch (err) {
        logger.error('加载学生画像失败:', err);
        const msg = err instanceof Error ? err.message : '加载学生画像失败';
        setProfileError(msg);
        showToast('error', '加载学生画像失败');
      } finally {
        setProfileLoading(false);
      }
    },
    [predictionDays, recommendDays, anomalyDays, showToast]
  );

  // 进入学生画像 Tab 时加载学生列表
  useEffect(() => {
    if (activeTab === 'studentProfile') {
      loadStudents();
    }
  }, [activeTab, loadStudents]);

  return {
    classes,
    loadClasses,
    students,
    selectedProfileUserId,
    setSelectedProfileUserId,
    studentProfile,
    setStudentProfile,
    profileLoading,
    profileError,
    loadStudents,
    loadStudentProfile,
  };
}
