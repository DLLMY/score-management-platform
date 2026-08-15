import logger from '../utils/logger';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { Users, Award, TrendingDown, Activity, LockOpen, BarChart3, RefreshCw, CheckCircle, Circle, AlertTriangle } from 'lucide-react';
import api, { ClassInfo } from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { PermissionButton } from '../components';

interface ClassCompareData {
  class_name: string;
  student_count: number;
  total_score: number;
  avg_score: number;
  max_score: number;
  min_score: number;
  period_records: number;
  period_total_change: number;
  period_total_add: number;
  period_total_subtract: number;
  period_active_students: number;
  unlock_count: number;
  unlock_cost: number;
  avg_daily_records: number;
  daily_trend: { date: string; record_count: number; score_change: number }[];
  top_students: { id: number; name: string; current_score: number }[];
}

const CLASS_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500', light: 'bg-blue-50' },
  { bg: 'bg-green-500', text: 'text-green-500', border: 'border-green-500', light: 'bg-green-50' },
  { bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500', light: 'bg-purple-50' },
  { bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500', light: 'bg-orange-50' },
  { bg: 'bg-pink-500', text: 'text-pink-500', border: 'border-pink-500', light: 'bg-pink-50' },
  { bg: 'bg-cyan-500', text: 'text-cyan-500', border: 'border-cyan-500', light: 'bg-cyan-50' },
];

function ClassCompare() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [compareData, setCompareData] = useState<ClassCompareData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const { showToast } = useStableToast();

  const fetchClasses = useCallback(async () => {
    try {
      const result = await api.classes.getAll();
      if (result.classes) {
        setClasses(result.classes);
        setLoadError(false);
      }
    } catch (err: unknown) {
      logger.error('获取班级列表失败:', err);
      setLoadError(true);
    }
  }, []);

  const fetchCompareData = useCallback(async () => {
    if (selectedClasses.length === 0) {
      showToast('error', '请至少选择一个班级');
      return;
    }

    setIsLoading(true);
    try {
      // 后端返回 success(data=[...])，request 已剥信封 → 直接消费数组（此前误期待信封致整页永不渲染）
      const result = await api.analysis.getClassCompare(selectedClasses, period);
      const list = Array.isArray(result) ? (result as ClassCompareData[]) : [];
      setCompareData(list);
      if (list.length === 0) {
        showToast('info', '所选班级暂无对比数据');
      }
    } catch (err: unknown) {
      showToast('error', '获取对比数据失败: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedClasses, period, showToast]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const toggleClass = (className: string) => {
    setSelectedClasses((prev) =>
      prev.includes(className)
        ? prev.filter((c) => c !== className)
        : [...prev, className]
    );
  };

  const getClassColor = (index: number) => CLASS_COLORS[index % CLASS_COLORS.length];

  const barChartData = useMemo(() => {
    if (!compareData.length) return [];
    const metrics = ['avg_score', 'period_total_change', 'unlock_count', 'period_active_students'];
    const metricNames = ['平均积分', '周期积分变化', '开锁次数', '活跃学生数'];
    
    return metricNames.map((name, idx) => ({
      name,
      ...compareData.reduce((acc, classData, classIdx) => {
        acc[`class${classIdx}`] = classData[metrics[idx] as keyof ClassCompareData] as number;
        return acc;
      }, {} as Record<string, number>),
    }));
  }, [compareData]);

  const lineChartData = useMemo(() => {
    if (!compareData.length || !compareData[0].daily_trend.length) return [];
    
    const allDates = new Set<string>();
    compareData.forEach((classData) => {
      classData.daily_trend.forEach((d) => allDates.add(d.date));
    });

    const sortedDates = Array.from(allDates).sort();
    
    return sortedDates.map((date) => ({
      date: date.slice(5),
      ...compareData.reduce((acc, classData, classIdx) => {
        const dayData = classData.daily_trend.find((d) => d.date === date);
        acc[`class${classIdx}`] = dayData?.score_change || 0;
        return acc;
      }, {} as Record<string, number>),
    }));
  }, [compareData]);

  return (
    <div className="space-y-6">
      {loadError && (
        <div className='mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>班级列表加载失败，请刷新重试</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">班级对比分析</h1>
          <p className="text-gray-500 mt-1">对比多个班级的积分统计和行为数据</p>
        </div>
        <PermissionButton
          permission='algorithm.view'
          onClick={fetchCompareData}
          disabled={isLoading || selectedClasses.length === 0}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? '加载中...' : '开始分析'}
        </PermissionButton>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">选择班级</label>
          <div className="flex flex-wrap gap-2">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => toggleClass(cls.name)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedClasses.includes(cls.name)
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {selectedClasses.includes(cls.name) ? (
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                ) : (
                  <Circle className="w-4 h-4 inline mr-1" />
                )}
                {cls.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">统计周期</label>
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  period === p
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p === '7d' ? '近7天' : p === '30d' ? '近30天' : '近90天'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {compareData.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {compareData.map((classData, idx) => {
              const colors = getClassColor(idx);
              return (
                <div key={classData.class_name} className={`${colors.light} rounded-xl p-5 border border-gray-200`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 ${colors.bg} rounded-xl flex items-center justify-center`}>
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{classData.class_name}</h3>
                      <p className="text-xs text-gray-500">{classData.student_count} 名学生</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">平均积分</span>
                      <span className="font-bold text-gray-800">{classData.avg_score}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">周期积分变化</span>
                      <span className={`font-bold ${classData.period_total_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {classData.period_total_change >= 0 ? '+' : ''}{classData.period_total_change}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">活跃学生</span>
                      <span className="font-semibold text-gray-800">{classData.period_active_students}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">指标对比</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Legend />
                  {compareData.map((classData, idx) => (
                    <Bar
                      key={classData.class_name}
                      dataKey={`class${idx}`}
                      name={classData.class_name}
                      fill={CLASS_COLORS[idx % CLASS_COLORS.length].bg.replace('bg-', '#')}
                      radius={[0, 4, 4, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">积分趋势</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {compareData.map((classData, idx) => (
                    <Line
                      key={classData.class_name}
                      dataKey={`class${idx}`}
                      name={classData.class_name}
                      stroke={CLASS_COLORS[idx % CLASS_COLORS.length].bg.replace('bg-', '#')}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {compareData.map((classData, idx) => {
              const colors = getClassColor(idx);
              return (
                <div key={classData.class_name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-8 h-8 ${colors.bg} rounded-lg flex items-center justify-center`}>
                      <BarChart3 className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800">{classData.class_name} - 详细数据</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="w-4 h-4 text-amber-500" />
                        <span className="text-xs text-gray-500">最高积分</span>
                      </div>
                      <p className="text-xl font-bold text-gray-800">{classData.max_score}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500">最低积分</span>
                      </div>
                      <p className="text-xl font-bold text-gray-800">{classData.min_score}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <LockOpen className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-gray-500">开锁次数</span>
                      </div>
                      <p className="text-xl font-bold text-gray-800">{classData.unlock_count}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-red-500" />
                        <span className="text-xs text-gray-500">开锁消耗</span>
                      </div>
                      <p className="text-xl font-bold text-gray-800">{classData.unlock_cost}</p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">积分统计</h4>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">加分</p>
                        <p className="text-lg font-bold text-green-600">+{classData.period_total_add}</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">扣分</p>
                        <p className="text-lg font-bold text-red-600">-{classData.period_total_subtract}</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">日均记录</p>
                        <p className="text-lg font-bold text-gray-800">{classData.avg_daily_records}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">TOP 5 学生</h4>
                    <div className="space-y-2">
                      {classData.top_students.map((student, sIdx) => (
                        <div key={student.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              sIdx === 0 ? 'bg-amber-100 text-amber-600' :
                              sIdx === 1 ? 'bg-gray-100 text-gray-600' :
                              sIdx === 2 ? 'bg-orange-100 text-orange-600' :
                              'bg-gray-50 text-gray-500'
                            }`}>
                              {sIdx + 1}
                            </span>
                            <span className="text-sm text-gray-700">{student.name}</span>
                          </div>
                          <span className={`font-semibold ${student.current_score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {student.current_score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {compareData.length === 0 && !isLoading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">选择班级开始对比</h3>
          <p className="text-gray-500">选择一个或多个班级，点击"开始分析"按钮查看对比数据</p>
        </div>
      )}
    </div>
  );
}

export default ClassCompare;