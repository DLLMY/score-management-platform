import { useState, useEffect, useCallback } from 'react';
import { useListFetch, useStableToast } from '../hooks';
import { useNavigate } from 'react-router-dom';
import api, {
  StudentInfo,
  ScoreRecordItem,
  NotificationItem,
  LeaveItem,
  PhoneboxUnlockResult,
  MyRankResult,
  StudentInsight,
} from '../services/api';
import StudentPortalView from './studentPortal/StudentPortalView';
import type { LeaveFormData } from './studentPortal/types';

type TabKey = 'score' | 'notifications' | 'leaves' | 'phonebox' | 'rank' | 'growth';

function StudentPortal() {
  const navigate = useNavigate();
  const { showToast } = useStableToast();
  const [tab, setTab] = useState<TabKey>('score');
  const [student, setStudent] = useState<StudentInfo | null>(null);

  // 积分
  const [score, setScore] = useState<number | null>(null);
  const [scorePage, setScorePage] = useState(1);

  // 请假
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [leaveForm, setLeaveForm] = useState<LeaveFormData>({
    leave_type: 'personal',
    start_date: '',
    end_date: '',
    reason: '',
  });
  // 视图层以 Partial 形式增量更新表单字段，此处收敛为合并语义，避免直接替换丢失其他字段
  const setLeaveFormMerged = useCallback(
    (data: Partial<LeaveFormData>) => setLeaveForm((prev) => ({ ...prev, ...data })),
    [setLeaveForm]
  );

  // 手机箱
  const [unlockRes, setUnlockRes] = useState<PhoneboxUnlockResult | null>(null);

  // 排名
  const [myRank, setMyRank] = useState<MyRankResult | null>(null);

  // 我的成长（算法洞察聚合）
  const [insights, setInsights] = useState<StudentInsight | null>(null);
  const [growthLoading, setGrowthLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const s = localStorage.getItem('student');
    if (s) {
      try {
        setStudent(JSON.parse(s));
      } catch {
        // ignore
      }
    }
  }, []);

  const loadMyRank = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.student.getMyRank();
      setMyRank(res);
    } catch (err: unknown) {
      setError((err as Error)?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const scoreRecords = useListFetch<ScoreRecordItem>({
    fetcher: async (p) => {
      const res = await api.student.getRecords({ page: p.page, per_page: p.pageSize });
      return { items: res?.data ?? [], total: res?.pagination?.total ?? 0 };
    },
    params: { page: scorePage, pageSize: 20 },
  });

  const loadScore = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const scoreRes = await api.student.getScore();
      setScore(scoreRes.current_score);
    } catch (err: unknown) {
      setError((err as Error)?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // A 轨：通知列表迁 useListFetch（enabled 跟随 tab 切换按需加载，切到通知 tab 才拉取）
  const notifList = useListFetch<NotificationItem>({
    enabled: tab === 'notifications',
    params: { page: 1, pageSize: 20 },
    initialData: [],
    fetcher: async () => {
      const res = await api.student.getNotifications({ page: 1, per_page: 20 });
      // M7: 数组赋值防护，非数组时置空避免渲染崩溃
      return { items: Array.isArray(res.data) ? res.data : [], total: res?.pagination?.total ?? 0 };
    },
  });

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.student.getLeaves();
      setLeaves(res);
    } catch (err: unknown) {
      setError((err as Error)?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInsights = useCallback(async () => {
    setGrowthLoading(true);
    setError('');
    try {
      const res = await api.student.getInsights(30, 8);
      setInsights(res);
    } catch (err: unknown) {
      setError((err as Error)?.message || '加载失败');
    } finally {
      setGrowthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'score') loadScore();
    else if (tab === 'leaves') loadLeaves();
    else if (tab === 'rank') loadMyRank();
    else if (tab === 'growth') loadInsights();
  }, [tab, loadScore, loadLeaves, loadMyRank, loadInsights]);

  const handleLogout = (): void => {
    localStorage.removeItem('student_token');
    localStorage.removeItem('student');
    navigate('/student/login', { replace: true });
  };

  const totalChange = scoreRecords.items.reduce((sum, r) => sum + (r.score_change || 0), 0);

  const submitLeave = async () => {
    if (!leaveForm.start_date || !leaveForm.end_date) {
      setError('请填写开始与结束日期');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.student.applyLeave(leaveForm);
      setLeaveForm({ leave_type: 'personal', start_date: '', end_date: '', reason: '' });
      await loadLeaves();
      showToast('success', '请假申请已提交'); // L9: 成功反馈
    } catch (err: unknown) {
      setError((err as Error)?.message || '提交失败');
    } finally {
      setLoading(false);
    }
  };

  const requestUnlock = async () => {
    setLoading(true);
    setError('');
    setUnlockRes(null);
    try {
      const res = await api.student.requestPhoneboxUnlock();
      setUnlockRes(res);
    } catch (err: unknown) {
      setError((err as Error)?.message || '申请失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <StudentPortalView
      tab={tab}
      setTab={setTab}
      student={student}
      handleLogout={handleLogout}
      score={score}
      scorePage={scorePage}
      setScorePage={setScorePage}
      scoreRecords={scoreRecords}
      loading={loading}
      totalChange={totalChange}
      notifList={notifList}
      leaves={leaves}
      leaveForm={leaveForm}
      setLeaveForm={setLeaveFormMerged}
      submitLeave={submitLeave}
      unlockRes={unlockRes}
      requestUnlock={requestUnlock}
      myRank={myRank}
      insights={insights}
      growthLoading={growthLoading}
      error={error}
    />
  );
}

export default StudentPortal;
