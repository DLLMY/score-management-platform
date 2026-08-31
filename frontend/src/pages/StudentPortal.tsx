import { useState, useEffect, useCallback } from 'react';
import { formatNumber } from '../utils/formatNumber';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  RefreshCw,
  Award,
  History,
  Bell,
  CalendarDays,
  Smartphone,
  Send,
  Trophy,
  TrendingUp,
  ShieldAlert,
  Target,
} from 'lucide-react';
import { useStableToast } from '../hooks/useStableToast';
import api, {
  StudentInfo,
  ScoreRecordItem,
  NotificationItem,
  LeaveItem,
  PhoneboxUnlockResult,
  MyRankResult,
  StudentInsight,
} from '../services/api';

type TabKey = 'score' | 'notifications' | 'leaves' | 'phonebox' | 'rank' | 'growth';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'score', label: '积分', icon: <Award className='w-4 h-4' /> },
  { key: 'notifications', label: '通知', icon: <Bell className='w-4 h-4' /> },
  { key: 'leaves', label: '请假', icon: <CalendarDays className='w-4 h-4' /> },
  { key: 'phonebox', label: '手机箱', icon: <Smartphone className='w-4 h-4' /> },
  { key: 'rank', label: '排名', icon: <Trophy className='w-4 h-4' /> },
  { key: 'growth', label: '我的成长', icon: <TrendingUp className='w-4 h-4' /> },
];

function StudentPortal() {
  const navigate = useNavigate();
  const { showToast } = useStableToast();
  const [tab, setTab] = useState<TabKey>('score');
  const [student, setStudent] = useState<StudentInfo | null>(null);

  // 积分
  const [score, setScore] = useState<number | null>(null);
  const [records, setRecords] = useState<ScoreRecordItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 0 });

  // 通知
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifTotal, setNotifTotal] = useState(0);

  // 请假
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'personal',
    start_date: '',
    end_date: '',
    reason: '',
  });

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

  const loadScore = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const [scoreRes, recRes] = await Promise.all([
        api.student.getScore(),
        api.student.getRecords({ page, per_page: 20 }),
      ]);
      setScore(scoreRes.current_score);
      setRecords(recRes.data);
      setPagination(recRes.pagination);
    } catch (err: unknown) {
      setError((err as Error)?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.student.getNotifications({ page: 1, per_page: 20 });
      // M7: 数组赋值防护，非数组时置空避免渲染崩溃
      setNotifications(Array.isArray(res.data) ? res.data : []);
      setNotifTotal(res.pagination.total);
    } catch (err: unknown) {
      setError((err as Error)?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (tab === 'score') loadScore(1);
    else if (tab === 'notifications') loadNotifications();
    else if (tab === 'leaves') loadLeaves();
    else if (tab === 'rank') loadMyRank();
    else if (tab === 'growth') loadInsights();
  }, [tab, loadScore, loadNotifications, loadLeaves, loadMyRank, loadInsights]);

  const handleLogout = (): void => {
    localStorage.removeItem('student_token');
    localStorage.removeItem('student');
    navigate('/student/login', { replace: true });
  };

  const totalChange = records.reduce((sum, r) => sum + (r.score_change || 0), 0);

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
    <div className='min-h-screen bg-gray-50 dark:bg-slate-900'>
      <header className='bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10'>
        <div>
          <h1 className='text-lg font-bold text-gray-800 dark:text-white'>学生自助中心</h1>
          {student && (
            <p className='text-sm text-gray-500'>
              {student.name} · {student.card_id}
              {student.class_name ? ` · ${student.class_name}` : ''}
            </p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className='flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors'
        >
          <LogOut className='w-4 h-4' /> 退出
        </button>
      </header>

      <nav className='flex gap-1 px-4 pt-3 max-w-3xl mx-auto'>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 px-3 py-2 text-sm rounded-t-lg border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary-500 text-primary-500 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>

      <main className='p-4 max-w-3xl mx-auto space-y-4'>
        {error && (
          <div
            className='bg-red-500/20 border border-red-500/40 text-red-500 px-4 py-3 rounded-xl text-sm flex items-center gap-2'
            role='alert'
          >
            {error}
          </div>
        )}

        {tab === 'score' && (
          <>
            <div className='bg-gradient-to-r from-primary-500 via-blue-500 to-accent-600 rounded-2xl p-6 text-white shadow-lg'>
              <div className='flex items-center gap-2 text-white/80 text-sm'>
                <Award className='w-4 h-4' /> 当前积分
              </div>
              <div className='text-4xl font-bold mt-2'>{loading ? '...' : score ?? '—'}</div>
              {records.length > 0 && (
                <div className='text-white/70 text-xs mt-1'>
                  本页流水合计 {totalChange >= 0 ? '+' : ''}
                  {totalChange}
                </div>
              )}
            </div>

            <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
              <div className='flex items-center justify-between mb-3'>
                <div className='flex items-center gap-2 font-semibold text-gray-800 dark:text-white'>
                  <History className='w-4 h-4' /> 积分流水
                </div>
                <button
                  onClick={() => loadScore(pagination.page)}
                  disabled={loading}
                  className='text-sm text-primary-500 flex items-center gap-1 disabled:opacity-50'
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 刷新
                </button>
              </div>

              {records.length === 0 ? (
                <p className='text-sm text-gray-400 py-6 text-center'>暂无积分记录</p>
              ) : (
                <ul className='divide-y divide-gray-100 dark:divide-slate-700'>
                  {records.map((r) => (
                    <li key={r.id} className='py-3 flex items-center justify-between'>
                      <div className='min-w-0'>
                        <p className='text-sm text-gray-800 dark:text-gray-100 truncate'>
                          {r.description || '积分变动'}
                        </p>
                        <p className='text-xs text-gray-400'>
                          {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                          {r.operator ? ` · ${r.operator}` : ''}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold flex-shrink-0 ml-3 ${
                          r.score_change >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {r.score_change >= 0 ? '+' : ''}
                        {r.score_change}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {pagination.pages > 1 && (
                <div className='flex items-center justify-center gap-3 mt-4'>
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => loadScore(pagination.page - 1)}
                    className='px-3 py-1 text-sm rounded-lg border border-gray-200 dark:border-slate-600 disabled:opacity-40'
                  >
                    上一页
                  </button>
                  <span className='text-sm text-gray-500'>
                    {pagination.page} / {pagination.pages}
                  </span>
                  <button
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => loadScore(pagination.page + 1)}
                    className='px-3 py-1 text-sm rounded-lg border border-gray-200 dark:border-slate-600 disabled:opacity-40'
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'notifications' && (
          <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center gap-2 font-semibold text-gray-800 dark:text-white'>
                <Bell className='w-4 h-4' /> 我的通知
                {notifTotal > 0 && <span className='text-xs text-gray-400'>({notifTotal})</span>}
              </div>
              <button
                onClick={loadNotifications}
                disabled={loading}
                className='text-sm text-primary-500 flex items-center gap-1 disabled:opacity-50'
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 刷新
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className='text-sm text-gray-400 py-6 text-center'>暂无通知</p>
            ) : (
              <ul className='divide-y divide-gray-100 dark:divide-slate-700'>
                {notifications.map((n) => (
                  <li key={n.id} className='py-3'>
                    <div className='flex items-center justify-between'>
                      <p className='text-sm font-medium text-gray-800 dark:text-gray-100'>
                        {n.title || '通知'}
                      </p>
                      {n.status && (
                        <span className='text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500'>
                          {n.status}
                        </span>
                      )}
                    </div>
                    <p className='text-sm text-gray-600 dark:text-gray-300 mt-1'>{n.content}</p>
                    <p className='text-xs text-gray-400 mt-1'>
                      {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'leaves' && (
          <div className='space-y-4'>
            <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
              <div className='flex items-center gap-2 font-semibold text-gray-800 dark:text-white mb-3'>
                <Send className='w-4 h-4' /> 提交请假申请
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                  className='col-span-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-transparent px-3 py-2'
                >
                  <option value='personal'>事假</option>
                  <option value='sick'>病假</option>
                  <option value='other'>其他</option>
                </select>
                <input
                  type='date'
                  value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                  className='text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-transparent px-3 py-2'
                />
                <input
                  type='date'
                  value={leaveForm.end_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                  className='text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-transparent px-3 py-2'
                />
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder='请假事由（选填）'
                  rows={2}
                  className='col-span-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-transparent px-3 py-2 resize-none'
                />
              </div>
              <button
                onClick={submitLeave}
                disabled={loading}
                className='mt-3 w-full py-2 rounded-lg bg-primary-500 text-white text-sm font-medium disabled:opacity-50'
              >
                提交申请
              </button>
            </div>

            <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
              <div className='flex items-center gap-2 font-semibold text-gray-800 dark:text-white mb-3'>
                <CalendarDays className='w-4 h-4' /> 请假记录
              </div>
              {leaves.length === 0 ? (
                <p className='text-sm text-gray-400 py-6 text-center'>暂无请假记录</p>
              ) : (
                <ul className='divide-y divide-gray-100 dark:divide-slate-700'>
                  {leaves.map((lv) => (
                    <li key={lv.id} className='py-3 flex items-center justify-between'>
                      <div className='min-w-0'>
                        <p className='text-sm text-gray-800 dark:text-gray-100'>
                          {lv.start_date} ~ {lv.end_date}
                        </p>
                        <p className='text-xs text-gray-400'>{lv.reason || lv.leave_type || ''}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-3 ${
                          lv.status === 'approved'
                            ? 'bg-green-500/20 text-green-500'
                            : lv.status === 'rejected'
                            ? 'bg-red-500/20 text-red-500'
                            : 'bg-amber-500/20 text-amber-500'
                        }`}
                      >
                        {lv.status === 'approved'
                          ? '已通过'
                          : lv.status === 'rejected'
                          ? '已拒绝'
                          : '待审批'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === 'phonebox' && (
          <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
            <div className='flex items-center gap-2 font-semibold text-gray-800 dark:text-white mb-3'>
              <Smartphone className='w-4 h-4' /> 手机箱自助开箱
            </div>
            <p className='text-sm text-gray-500 mb-4'>
              依据本班手机箱策略判定是否允许开箱。允许时将自动下发开箱指令。
            </p>
            <button
              onClick={requestUnlock}
              disabled={loading}
              className='w-full py-2 rounded-lg bg-primary-500 text-white text-sm font-medium disabled:opacity-50'
            >
              {loading ? '申请中...' : '申请开箱'}
            </button>
            {unlockRes && (
              <div
                className={`mt-3 px-4 py-3 rounded-xl text-sm ${
                  unlockRes.allowed
                    ? 'bg-green-500/20 text-green-600'
                    : 'bg-amber-500/20 text-amber-600'
                }`}
              >
                {unlockRes.allowed
                  ? `开箱指令已下发${unlockRes.dispatched ? '' : '（设备离线，指令未送达）'}`
                  : unlockRes.reason === 'teacher_disabled'
                  ? '班主任已关闭本班自助开箱'
                  : '本班暂未开放自助开箱，请联系老师'}
              </div>
            )}
          </div>
        )}

        {tab === 'rank' && (
          <div className='space-y-4'>
            <div className='bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 rounded-2xl p-6 text-white shadow-lg'>
              <div className='flex items-center gap-2 text-white/80 text-sm'>
                <Trophy className='w-4 h-4' /> 我的班级排名
              </div>
              <div className='text-4xl font-bold mt-2'>
                {myRank?.my_rank ? `#${myRank.my_rank}` : '—'}
                <span className='text-lg font-normal ml-2'>/ {myRank?.total_students ?? '—'}</span>
              </div>
              <div className='text-white/70 text-xs mt-1'>
                {myRank?.class_name || '未分班'} · 当前积分 {myRank?.my_score ?? '—'}
              </div>
            </div>

            <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
              <div className='flex items-center gap-2 font-semibold text-gray-800 dark:text-white mb-3'>
                <Trophy className='w-4 h-4' /> 班级积分榜
              </div>
              {!myRank || myRank.ranking.length === 0 ? (
                <p className='text-sm text-gray-400 py-6 text-center'>暂无排名数据</p>
              ) : (
                <ol className='divide-y divide-gray-100 dark:divide-slate-700'>
                  {myRank.ranking.map((item, idx) => (
                    <li
                      key={item.user_id}
                      className={`py-3 flex items-center justify-between ${
                        item.user_id === student?.id ? 'bg-amber-500/10 rounded-lg px-2' : ''
                      }`}
                    >
                      <div className='flex items-center gap-3 min-w-0'>
                        <span className='text-sm font-bold text-gray-400 w-6 text-center'>
                          {idx + 1}
                        </span>
                        <span className='text-sm text-gray-800 dark:text-gray-100 truncate'>
                          {item.name}
                          {item.user_id === student?.id ? '（我）' : ''}
                        </span>
                      </div>
                      <span className='text-sm font-semibold text-amber-500'>
                        {item.current_score}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}

        {tab === 'growth' && (
          <div className='space-y-4'>
            {/* 参与度指数卡片 */}
            <div className='bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-2xl p-6 text-white shadow-lg'>
              <div className='flex items-center gap-2 text-white/80 text-sm'>
                <TrendingUp className='w-4 h-4' /> 我的参与度指数
              </div>
              <div className='flex items-end gap-3 mt-2'>
                <div className='text-4xl font-bold'>
                  {growthLoading
                    ? '...'
                    : insights?.engagement?.error
                    ? '!'
                    : insights?.engagement?.has_data
                    ? insights.engagement.engagement_score
                    : '—'}
                </div>
                <span className='text-white/80 text-sm mb-1'>
                  {insights?.engagement?.error
                    ? '加载失败'
                    : insights?.engagement?.level === 'high'
                    ? '高参与'
                    : insights?.engagement?.level === 'medium'
                    ? '中参与'
                    : insights?.engagement?.level === 'low'
                    ? '低参与'
                    : '暂无数据'}
                </span>
              </div>
              <div className='text-white/70 text-xs mt-1'>
                {insights?.engagement?.error
                  ? '参与度计算失败，请稍后刷新重试'
                  : insights?.engagement?.description || '综合出勤、作业提交与积分活跃度评估'}
              </div>
            </div>

            {insights?.engagement?.has_data && (
              <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
                <div className='text-sm font-semibold text-gray-800 dark:text-white mb-3'>
                  参与度构成
                </div>
                <div className='space-y-3'>
                  {(insights.engagement.components?.attendance_rate != null ||
                    insights.engagement.components?.homework_rate != null ||
                    insights.engagement.components?.activity_rate != null) && (
                    <>
                      {insights.engagement.components?.attendance_rate != null && (
                        <div>
                          <div className='flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1'>
                            <span>出勤率</span>
                            <span>
                              {Math.round(insights.engagement.components.attendance_rate * 100)}%
                            </span>
                          </div>
                          <div className='h-2 rounded-full bg-gray-100 dark:bg-slate-700'>
                            <div
                              className='h-2 rounded-full bg-purple-500'
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, insights.engagement.components.attendance_rate * 100)
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {insights.engagement.components?.homework_rate != null && (
                        <div>
                          <div className='flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1'>
                            <span>作业提交率</span>
                            <span>
                              {Math.round(insights.engagement.components.homework_rate * 100)}%
                            </span>
                          </div>
                          <div className='h-2 rounded-full bg-gray-100 dark:bg-slate-700'>
                            <div
                              className='h-2 rounded-full bg-blue-500'
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, insights.engagement.components.homework_rate * 100)
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {insights.engagement.components?.activity_rate != null && (
                        <div>
                          <div className='flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1'>
                            <span>积分活跃度</span>
                            <span>
                              {Math.round(insights.engagement.components.activity_rate * 100)}%
                            </span>
                          </div>
                          <div className='h-2 rounded-full bg-gray-100 dark:bg-slate-700'>
                            <div
                              className='h-2 rounded-full bg-emerald-500'
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, insights.engagement.components.activity_rate * 100)
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 参与度周趋势（SVG 折线） */}
            {insights?.participation_trend?.error ? (
              <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
                <div className='flex items-center gap-2 font-semibold text-gray-800 dark:text-white mb-1'>
                  <TrendingUp className='w-4 h-4' /> 参与度周趋势
                  <span className='text-xs px-2 py-0.5 rounded-full font-medium bg-gray-400 text-white'>
                    加载失败
                  </span>
                </div>
                <p className='text-xs text-gray-500 dark:text-slate-400'>
                  趋势计算失败，请稍后刷新重试
                </p>
              </div>
            ) : insights?.participation_trend?.series?.length ? (
              <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
                <div className='flex items-center gap-2 font-semibold text-gray-800 dark:text-white mb-3'>
                  <TrendingUp className='w-4 h-4' /> 参与度周趋势
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      insights.participation_trend.trend === 'up'
                        ? 'bg-emerald-500 text-white'
                        : insights.participation_trend.trend === 'down'
                        ? 'bg-red-500 text-white'
                        : 'bg-violet-500 text-white'
                    }`}
                  >
                    {insights.participation_trend.trend === 'up'
                      ? '上升'
                      : insights.participation_trend.trend === 'down'
                      ? '下降'
                      : '平稳'}
                  </span>
                </div>
                {(() => {
                  const series = insights.participation_trend.series;
                  const valid = series.filter((p) => p.has_data !== false);
                  if (!valid.length) {
                    return (
                      <p className='text-sm text-gray-400 py-6 text-center'>暂无参与度趋势数据</p>
                    );
                  }
                  const W = 340;
                  const H = 140;
                  const PAD = 16;
                  const min = Math.min(0, ...valid.map((p) => p.engagement_score));
                  const max = Math.max(100, ...valid.map((p) => p.engagement_score));
                  const span = Math.max(1, max - min);
                  const x = (i: number) =>
                    PAD + (i * (W - PAD * 2)) / Math.max(1, series.length - 1);
                  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
                  const pts = series.map(
                    (p, i) => `${formatNumber(x(i), 1)},${formatNumber(y(p.engagement_score), 1)}`
                  );
                  const color =
                    insights.participation_trend.trend === 'up'
                      ? '#10b981'
                      : insights.participation_trend.trend === 'down'
                      ? '#ef4444'
                      : '#8b5cf6';
                  return (
                    <svg
                      viewBox={`0 0 ${W} ${H}`}
                      className='w-full h-auto'
                      role='img'
                      aria-label='参与度周趋势'
                    >
                      {[0, 25, 50, 75, 100].map((g) => (
                        <g key={g}>
                          <line
                            x1={PAD}
                            x2={W - PAD}
                            y1={y(g)}
                            y2={y(g)}
                            stroke='#e5e7eb'
                            strokeWidth='1'
                            strokeDasharray={g === 0 || g === 100 ? '0' : '4 4'}
                          />
                          <text x={2} y={y(g) + 3} fontSize='8' fill='#9ca3af'>
                            {g}
                          </text>
                        </g>
                      ))}
                      <polygon
                        points={`${PAD},${y(min)} ${pts.join(' ')} ${x(series.length - 1)},${y(
                          min
                        )}`}
                        fill={color}
                        opacity='0.12'
                      />
                      <polyline
                        points={pts.join(' ')}
                        fill='none'
                        stroke={color}
                        strokeWidth='2.5'
                        strokeLinejoin='round'
                        strokeLinecap='round'
                      />
                      {series.map((p, i) => (
                        <circle
                          key={i}
                          cx={x(i)}
                          cy={y(p.engagement_score)}
                          r={p.has_data === false ? 2.5 : 3.5}
                          fill={color}
                        />
                      ))}
                      {series.map((p, i) => (
                        <text
                          key={`l${i}`}
                          x={x(i)}
                          y={H - 2}
                          fontSize='8'
                          fill='#9ca3af'
                          textAnchor='middle'
                        >
                          {p.week_label || `W${p.week_index + 1}`}
                        </text>
                      ))}
                    </svg>
                  );
                })()}
              </div>
            ) : null}

            {/* 风险预警卡片 */}
            <div
              className={`rounded-2xl p-4 shadow ${
                insights?.risk?.error
                  ? 'bg-gray-50 dark:bg-slate-800'
                  : insights?.risk?.overall_risk_level === 'high'
                  ? 'bg-red-50 dark:bg-red-500/10'
                  : insights?.risk?.overall_risk_level === 'medium'
                  ? 'bg-amber-50 dark:bg-amber-500/10'
                  : 'bg-emerald-50 dark:bg-emerald-500/10'
              }`}
            >
              <div className='flex items-center gap-2 font-semibold mb-2 text-gray-800 dark:text-white'>
                <ShieldAlert className='w-4 h-4' /> 风险预警
                {insights?.risk?.error ? (
                  <span className='text-xs px-2 py-0.5 rounded-full font-medium bg-gray-400 text-white'>
                    加载失败
                  </span>
                ) : (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      insights?.risk?.overall_risk_level === 'high'
                        ? 'bg-red-500 text-white'
                        : insights?.risk?.overall_risk_level === 'medium'
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {insights?.risk?.overall_risk_level === 'high'
                      ? '高风险'
                      : insights?.risk?.overall_risk_level === 'medium'
                      ? '中风险'
                      : '低风险'}
                  </span>
                )}
              </div>
              {insights?.risk?.error ? (
                <p className='text-xs text-gray-500 dark:text-slate-400'>
                  风险评估失败，请稍后刷新重试
                </p>
              ) : insights?.risk?.intervention_suggestions?.length ? (
                <ul className='space-y-1'>
                  {insights.risk.intervention_suggestions.slice(0, 3).map((s, i) => (
                    <li
                      key={i}
                      className='text-xs text-gray-600 dark:text-slate-300 flex items-start gap-1.5'
                    >
                      <span className='text-gray-400'>·</span>
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className='text-xs text-gray-400'>暂无风险因素，表现良好</p>
              )}
            </div>

            {/* 近周积分趋势 */}
            <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
              <div className='flex items-center gap-2 font-semibold text-gray-800 dark:text-white mb-3'>
                <Target className='w-4 h-4' /> 近 8 周积分变动
              </div>
              {growthLoading ? (
                <p className='text-sm text-gray-400 py-6 text-center'>加载中...</p>
              ) : !insights?.score_trend?.length ? (
                <p className='text-sm text-gray-400 py-6 text-center'>暂无积分趋势数据</p>
              ) : (
                <div className='flex items-end justify-between gap-1 h-28 px-1'>
                  {insights.score_trend.map((pt) => {
                    const maxAbs = Math.max(
                      1,
                      ...insights.score_trend.map((p) => Math.abs(p.score_change || 0))
                    );
                    const h = Math.max(4, (Math.abs(pt.score_change || 0) / maxAbs) * 96);
                    const positive = (pt.score_change || 0) >= 0;
                    return (
                      <div
                        key={pt.week_index}
                        className='flex flex-col items-center justify-end flex-1 gap-1'
                      >
                        <span className='text-[10px] text-gray-400 font-medium'>
                          {(pt.score_change || 0) >= 0 ? '+' : ''}
                          {pt.score_change ?? 0}
                        </span>
                        <div
                          className={`w-full max-w-[18px] rounded-t ${
                            positive ? 'bg-emerald-400' : 'bg-red-400'
                          }`}
                          style={{ height: `${h}px` }}
                          title={`第${pt.week_index}周 ${pt.score_change ?? 0}`}
                        />
                        <span className='text-[10px] text-gray-400'>W{pt.week_index}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default StudentPortal;
