import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { Card, Button, LoadingSpinner } from '../components';
import { useStableToast } from '../hooks/useStableToast';
import api from '../services/api';
import type { User } from '../types';

const { Upload, Send, CheckCircle, Users, TrendingUp, ArrowRight } = LucideIcons;

interface ExamOption {
  id: number;
  name: string;
}
interface ClassOption {
  id: number;
  name: string;
}

const inputCls =
  'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';
const labelCls = 'block text-sm text-gray-600 dark:text-slate-300 mb-1';

const TeacherTools: React.FC = () => {
  const { showToast } = useStableToast();
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);

  // 批量录分
  const [scoreExam, setScoreExam] = useState<number | ''>('');
  const [scoreSubject, setScoreSubject] = useState('');
  const [scoreClass, setScoreClass] = useState<string>('');
  const [scoreStudents, setScoreStudents] = useState<User[]>([]);
  const [scorePaste, setScorePaste] = useState('');
  const [scoreSubmitting, setScoreSubmitting] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ created: number; errors: Array<{ index: number; message: string }>; total: number } | null>(null);

  // 群发通知
  const [notifyClass, setNotifyClass] = useState<string>('');
  const [notifyStudents, setNotifyStudents] = useState<User[]>([]);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyContent, setNotifyContent] = useState('');
  const [notifySubmitting, setNotifySubmitting] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ sent: number; errors: Array<{ user_id: number; message: string }>; total: number } | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      const [examsRes, classesRes] = await Promise.all([api.exams.getAll(), api.classes.getAll()]);
      setExams(Array.isArray(examsRes) ? (examsRes as ExamOption[]) : ((examsRes as { exams?: ExamOption[] })?.exams ?? []));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cl = ((classesRes as any)?.classes ?? []) as Array<{ id: number; name: string }>;
      setClasses(cl.map((c) => ({ id: c.id, name: c.name })));
    } catch (e) {
      showToast('error', '加载基础数据失败: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const loadScoreStudents = useCallback(
    async (className: string) => {
      if (!className) {
        setScoreStudents([]);
        return;
      }
      try {
        const list = await api.classes.getStudents(className);
        setScoreStudents(list || []);
      } catch (e) {
        showToast('error', '加载学生失败: ' + (e as Error).message);
      }
    },
    [showToast]
  );

  const loadNotifyStudents = useCallback(
    async (className: string) => {
      if (!className) {
        setNotifyStudents([]);
        return;
      }
      try {
        const list = await api.classes.getStudents(className);
        setNotifyStudents(list || []);
      } catch (e) {
        showToast('error', '加载学生失败: ' + (e as Error).message);
      }
    },
    [showToast]
  );

  const submitScores = async () => {
    if (!scoreExam) {
      showToast('error', '请选择考试');
      return;
    }
    if (!scoreSubject.trim()) {
      showToast('error', '请填写科目');
      return;
    }
    if (!scorePaste.trim()) {
      showToast('error', '请粘贴成绩数据');
      return;
    }
    const lines = scorePaste.split('\n').map((l) => l.trim()).filter(Boolean);
    const scores: Array<{ card_id: string; subject: string; score: number }> = [];
    for (const line of lines) {
      const parts = line.split(/[,\t]/).map((s) => s.trim());
      const card_id = parts[0];
      const raw = parts[1];
      if (!card_id || raw === undefined) continue;
      const score = Number(raw);
      if (Number.isNaN(score)) {
        showToast('error', `分数非法: ${line}`);
        return;
      }
      scores.push({ card_id, subject: scoreSubject, score });
    }
    if (!scores.length) {
      showToast('error', '没有可提交的成绩');
      return;
    }
    setScoreSubmitting(true);
    try {
      const res = await api.scores.batchCreate({ exam_id: Number(scoreExam), scores });
      setScoreResult(res);
      showToast('success', `成功录入 ${res.created} 条`);
    } catch (e) {
      showToast('error', '批量录分失败: ' + (e as Error).message);
    } finally {
      setScoreSubmitting(false);
    }
  };

  const submitNotify = async () => {
    if (!notifyStudents.length) {
      showToast('error', '请先选择班级（将群发给该班学生）');
      return;
    }
    if (!notifyTitle.trim() || !notifyContent.trim()) {
      showToast('error', '请填写标题与内容');
      return;
    }
    setNotifySubmitting(true);
    try {
      const res = await api.notifications.batchSend({
        user_ids: notifyStudents.map((s) => s.id),
        title: notifyTitle,
        content: notifyContent,
      });
      setNotifyResult(res);
      showToast('success', `成功发送 ${res.sent} 条`);
    } catch (e) {
      showToast('error', '群发失败: ' + (e as Error).message);
    } finally {
      setNotifySubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">教师效率工具</h1>

      {/* 算法洞察入口 */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-violet-500" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">算法洞察</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          一键查看班级成绩波动归因与全班参与度排名，把分析结果直接用于教学行动。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/algorithm-analysis?tab=batchAttribution')}
            className="flex items-center justify-between gap-3 p-4 rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors text-left"
          >
            <span className="flex items-center gap-3">
              <Users className="w-6 h-6 text-violet-500" />
              <span>
                <span className="block text-sm font-semibold text-gray-800 dark:text-white">班级归因一键查看</span>
                <span className="block text-xs text-gray-500 dark:text-slate-400 mt-0.5">全班成绩波动 · 单生异常隔离</span>
              </span>
            </span>
            <ArrowRight className="w-4 h-4 text-violet-400 flex-shrink-0" />
          </button>
          <button
            onClick={() => navigate('/algorithm-analysis?tab=engagement')}
            className="flex items-center justify-between gap-3 p-4 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors text-left"
          >
            <span className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-blue-500" />
              <span>
                <span className="block text-sm font-semibold text-gray-800 dark:text-white">参与度排名榜</span>
                <span className="block text-xs text-gray-500 dark:text-slate-400 mt-0.5">全班参与度指数 · 个人周趋势</span>
              </span>
            </span>
            <ArrowRight className="w-4 h-4 text-blue-400 flex-shrink-0" />
          </button>
        </div>
      </Card>

      {/* 批量录分 */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">批量录入成绩</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className={labelCls}>考试</label>
            <select className={inputCls} value={scoreExam} onChange={(e) => setScoreExam(e.target.value ? Number(e.target.value) : '')}>
              <option value="">请选择</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>科目</label>
            <input className={inputCls} value={scoreSubject} onChange={(e) => setScoreSubject(e.target.value)} placeholder="如：数学" />
          </div>
          <div>
            <label className={labelCls}>班级（用于核对学生数）</label>
            <select
              className={inputCls}
              value={scoreClass}
              onChange={(e) => {
                setScoreClass(e.target.value);
                loadScoreStudents(e.target.value);
              }}
            >
              <option value="">请选择</option>
              {classes.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            {scoreStudents.length > 0 && <p className="text-xs text-gray-500 mt-1">该班 {scoreStudents.length} 名学生</p>}
          </div>
        </div>
        <div className="mb-4">
          <label className={labelCls}>粘贴成绩（每行：学号,分数）</label>
          <textarea
            className={`${inputCls} h-32 font-mono`}
            value={scorePaste}
            onChange={(e) => setScorePaste(e.target.value)}
            placeholder={'STU20230001,88\nSTU20230002,92'}
          />
        </div>
        <Button onClick={submitScores} disabled={scoreSubmitting}>
          {scoreSubmitting ? '提交中...' : '批量录入'}
        </Button>
        {scoreResult && (
          <div className="mt-3 text-sm">
            {scoreResult.errors.length === 0 ? (
              <p className="text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> 成功录入 {scoreResult.created} 条
              </p>
            ) : (
              <div className="text-amber-600">
                <p>
                  成功 {scoreResult.created} 条，失败 {scoreResult.errors.length} 条：
                </p>
                <ul className="list-disc pl-5">
                  {scoreResult.errors.map((er, i) => (
                    <li key={i}>
                      第{er.index + 1}行：{er.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 群发通知 */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">群发通知</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>班级</label>
            <select
              className={inputCls}
              value={notifyClass}
              onChange={(e) => {
                setNotifyClass(e.target.value);
                loadNotifyStudents(e.target.value);
              }}
            >
              <option value="">请选择</option>
              {classes.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            {notifyStudents.length > 0 && <p className="text-xs text-gray-500 mt-1">将发送给 {notifyStudents.length} 名学生</p>}
          </div>
          <div>
            <label className={labelCls}>标题</label>
            <input className={inputCls} value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} placeholder="通知标题" />
          </div>
        </div>
        <div className="mb-4">
          <label className={labelCls}>内容</label>
          <textarea
            className={`${inputCls} h-28`}
            value={notifyContent}
            onChange={(e) => setNotifyContent(e.target.value)}
            placeholder="通知内容"
          />
        </div>
        <Button onClick={submitNotify} disabled={notifySubmitting}>
          {notifySubmitting ? '发送中...' : '群发通知'}
        </Button>
        {notifyResult && (
          <div className="mt-3 text-sm">
            {notifyResult.errors.length === 0 ? (
              <p className="text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> 成功发送 {notifyResult.sent} 条
              </p>
            ) : (
              <p className="text-amber-600">
                成功 {notifyResult.sent} 条，失败 {notifyResult.errors.length} 条
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default TeacherTools;
