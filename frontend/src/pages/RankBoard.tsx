import { useState, useEffect } from 'react';
import { Trophy, Users, GraduationCap, RefreshCw } from 'lucide-react';
import api, { StudentRankItem, ClassRankItem } from '../services/api';

type TabKey = 'class' | 'student';

interface ClassOption {
  id: number;
  name: string;
}

function RankBoard() {
  const [tab, setTab] = useState<TabKey>('class');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 班级榜
  const [classRanking, setClassRanking] = useState<ClassRankItem[]>([]);
  const [totalClasses, setTotalClasses] = useState(0);

  // 学生榜
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [studentRanking, setStudentRanking] = useState<StudentRankItem[]>([]);
  const [studentTotal, setStudentTotal] = useState(0);

  const loadClassRanking = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.rank.getClassRanking({ limit: 50 });
      setClassRanking(res.ranking);
      setTotalClasses(res.total_classes);
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => {
    try {
      const res = await api.classes.getAll();
      const list = (res.classes || []) as ClassOption[];
      setClasses(list);
      if (list.length > 0 && !selectedClass) setSelectedClass(list[0].name);
    } catch {
      // 班级列表加载失败不阻断
    }
  };

  const loadStudentRanking = async (className?: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.rank.getStudentRanking({ class_name: className, limit: 50 });
      setStudentRanking(res.ranking);
      setStudentTotal(res.total_students);
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'class') {
      loadClassRanking();
    } else {
      loadClasses();
      loadStudentRanking(selectedClass || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const onSelectClass = (name: string) => {
    setSelectedClass(name);
    loadStudentRanking(name || undefined);
  };

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-slate-900'>
      <header className='bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-3 sticky top-0 z-10'>
        <h1 className='text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2'>
          <Trophy className='w-5 h-5 text-amber-500' /> 积分排行榜
        </h1>
      </header>

      <nav className='flex gap-1 px-4 pt-3 max-w-4xl mx-auto'>
        <button
          onClick={() => setTab('class')}
          className={`flex items-center gap-1 px-3 py-2 text-sm rounded-t-lg border-b-2 transition-colors ${
            tab === 'class'
              ? 'border-amber-500 text-amber-500 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Users className='w-4 h-4' /> 班级榜
        </button>
        <button
          onClick={() => setTab('student')}
          className={`flex items-center gap-1 px-3 py-2 text-sm rounded-t-lg border-b-2 transition-colors ${
            tab === 'student'
              ? 'border-amber-500 text-amber-500 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <GraduationCap className='w-4 h-4' /> 学生榜
        </button>
      </nav>

      <main className='p-4 max-w-4xl mx-auto space-y-4'>
        {error && (
          <div className='bg-red-500/20 border border-red-500/40 text-red-500 px-4 py-3 rounded-xl text-sm' role='alert'>
            {error}
          </div>
        )}

        {tab === 'class' && (
          <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center gap-2 font-semibold text-gray-800 dark:text-white'>
                <Users className='w-4 h-4' /> 班级积分排行（共 {totalClasses} 个班）
              </div>
              <button
                onClick={loadClassRanking}
                disabled={loading}
                className='text-sm text-amber-500 flex items-center gap-1 disabled:opacity-50'
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 刷新
              </button>
            </div>
            {classRanking.length === 0 ? (
              <p className='text-sm text-gray-400 py-6 text-center'>暂无数据</p>
            ) : (
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-gray-400 text-left'>
                    <th className='py-2'>#</th>
                    <th>班级</th>
                    <th>人数</th>
                    <th>总分</th>
                    <th>平均分</th>
                    <th>近30天开锁</th>
                  </tr>
                </thead>
                <tbody>
                  {classRanking.map((c, i) => (
                    <tr key={c.class_name} className='border-t border-gray-100 dark:border-slate-700'>
                      <td className='py-2 font-bold text-gray-400'>{i + 1}</td>
                      <td className='text-gray-800 dark:text-gray-100'>{c.class_name}</td>
                      <td>{c.student_count}</td>
                      <td>{c.total_score}</td>
                      <td>{c.avg_score}</td>
                      <td>{c.unlock_count_30d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'student' && (
          <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
            <div className='flex items-center gap-2 mb-3'>
              <GraduationCap className='w-4 h-4 text-gray-400' />
              <select
                value={selectedClass}
                onChange={(e) => onSelectClass(e.target.value)}
                className='text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-transparent px-3 py-2 flex-1'
              >
                {classes.length === 0 && <option value=''>（无班级）</option>}
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => loadStudentRanking(selectedClass || undefined)}
                disabled={loading}
                className='text-sm text-amber-500 flex items-center gap-1 disabled:opacity-50'
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 刷新
              </button>
            </div>
            <p className='text-xs text-gray-400 mb-2'>共 {studentTotal} 名学生</p>
            {studentRanking.length === 0 ? (
              <p className='text-sm text-gray-400 py-6 text-center'>暂无数据</p>
            ) : (
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-gray-400 text-left'>
                    <th className='py-2'>#</th>
                    <th>姓名</th>
                    <th>班级</th>
                    <th>积分</th>
                    <th>剩余开锁</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRanking.map((s, i) => (
                    <tr key={s.user_id} className='border-t border-gray-100 dark:border-slate-700'>
                      <td className='py-2 font-bold text-gray-400'>{i + 1}</td>
                      <td className='text-gray-800 dark:text-gray-100'>{s.name}</td>
                      <td>{s.class_name}</td>
                      <td className='text-amber-500 font-semibold'>{s.current_score}</td>
                      <td>
                        {s.remaining_unlock}/{s.daily_unlock_limit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default RankBoard;
