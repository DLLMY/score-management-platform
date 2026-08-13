/**
 * 成绩分析页面组件
 * 提供学生积分数据统计与分析功能
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  Award,
  Target,
  GitBranch,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Download,
  Users,
  TrendingDown as TrendingDownIcon,
} from 'lucide-react';
import { Card, LoadingSpinner, PermissionButton } from '../components';
import { useStableToast } from '../hooks/useStableToast';
import api from '../services/api';
import type { Exam, ClassInfo } from '../services/api';

// 学科统计类型
interface SubjectStats {
  count: number;
  average: number;
  max: number;
  min: number;
  pass_rate: number;
  scores?: number[];
}

// 考试分析类型
interface ExamAnalysis {
  overall: {
    total_students: number;
    overall_average: number;
    highest_score: number;
    lowest_score: number;
    std_deviation: number;
    excellent_count: number;
    excellent_rate: number;
    pass_rate: number;
  };
  subject_stats: Record<string, SubjectStats>;
}

// 聚类学生类型
interface ClusterStudent {
  user_id: number;
  cluster: number;
  cluster_name?: string;
}

// 聚类结果类型
interface ClusterResult {
  n_clusters: number;
  cluster_summary: {
    label: string;
    count: number;
  }[];
  students?: ClusterStudent[];
}

// 综合评分类型
interface CompositeScore {
  user_id: number;
  composite_score: number;
}

// 综合评分结果类型
interface CompositeScoreResult {
  scores: CompositeScore[];
}

// 风险学生类型
interface RiskStudent {
  user_id: number;
  risk_level: 'high' | 'medium' | 'low';
}

// 预警结果类型
interface WarningResult {
  risk_students: RiskStudent[];
}

// 算法数据类型
interface AlgorithmData {
  clusters: ClusterResult | null;
  compositeScores: CompositeScoreResult | null;
  warnings: WarningResult | null;
}

function ScoreAnalysis(): React.ReactElement {
  const { showToast } = useStableToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  // 算法数据加载失败警示
  const [loadWarn, setLoadWarn] = useState(false);
  const [examAnalysis, setExamAnalysis] = useState<ExamAnalysis | null>(null);
  const [classAnalysis, setClassAnalysis] = useState<unknown>(null);
  const [algorithmData, setAlgorithmData] = useState<AlgorithmData>({
    clusters: null,
    compositeScores: null,
    warnings: null,
  });
  const [loading, setLoading] = useState<boolean>(false);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [examsRes, classesRes] = await Promise.all([
        api.exams.getAll(),
        api.classes.getAll(),
      ]);

      setExams(Array.isArray(examsRes) ? examsRes : (examsRes as { data?: Exam[] }).data || []);
      setClasses(Array.isArray(classesRes) ? classesRes : (classesRes as { classes?: ClassInfo[] }).classes || []);
    } catch (err: unknown) {
      showToast('error', '获取数据失败: ' + (err as Error).message);
    }
  }, [showToast]);

  const fetchExamAnalysis = useCallback(async (): Promise<void> => {
    if (!selectedExam) return;
    setLoading(true);
    try {
      const res = await api.scoreAnalysis.getExamAnalysis(selectedExam);
      setExamAnalysis(res);
    } catch (err: unknown) {
      showToast('error', '获取考试分析失败: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedExam, showToast]);

  const fetchClassAnalysis = useCallback(async (): Promise<void> => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const res = await api.scoreAnalysis.getClassAnalysis(selectedClass);
      setClassAnalysis(res);
    } catch (err: unknown) {
      showToast('error', '获取班级分析失败: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedClass, showToast]);

  const fetchAlgorithmData = useCallback(async (): Promise<void> => {
    const params = selectedClass ? { class_name: selectedClass } : {};
    try {
      const [clusterRes, compositeRes, warningRes] = await Promise.all([
        api.algorithm.getClusters(params).catch(() => null),
        api.algorithm.getCompositeScores(params).catch(() => null),
        api.algorithm.getWarnings(params).catch(() => null),
      ]);

      setAlgorithmData({
        clusters: clusterRes as unknown as ClusterResult,
        compositeScores: compositeRes as unknown as CompositeScoreResult,
        warnings: warningRes as unknown as WarningResult,
      });
      if (!clusterRes && !compositeRes && !warningRes) {
        setLoadWarn(true);
      } else {
        setLoadWarn(false);
      }
    } catch (error) {
      console.error('获取算法数据失败:', error);
      setLoadWarn(true);
    }
  }, [selectedClass]);

  useEffect(() => {
    fetchData();
    fetchAlgorithmData();
  }, [fetchData, fetchAlgorithmData]);

  useEffect(() => {
    if (selectedExam) {
      fetchExamAnalysis();
    }
  }, [selectedExam, fetchExamAnalysis]);

  useEffect(() => {
    if (selectedClass) {
      fetchClassAnalysis();
      fetchAlgorithmData();
    }
  }, [selectedClass, fetchClassAnalysis, fetchAlgorithmData]);

  const handleRefresh = (): void => {
    fetchData();
    fetchAlgorithmData();
    if (selectedExam) fetchExamAnalysis();
    if (selectedClass) fetchClassAnalysis();
  };

  const handleExport = (): void => {
    // 无数据不导出空壳报告（此前直接下载空 JSON，用户无感知）
    if (!examAnalysis && !classAnalysis && !algorithmData) {
      showToast('error', '暂无数据可导出，请先加载考试/班级分析');
      return;
    }
    const exportData = {
      exportTime: new Date().toISOString(),
      selectedExam,
      selectedClass,
      examAnalysis,
      classAnalysis,
      algorithmData,
      clusterSummary: algorithmData.clusters?.cluster_summary || [],
      riskStudents: algorithmData.warnings?.risk_students || [],
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `score_analysis_report_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderScoreDistribution = (scores: number[]): React.ReactElement | null => {
    if (!scores || scores.length === 0) return null;

    const bins = [0, 60, 70, 80, 90, 101];
    const counts = [0, 0, 0, 0, 0];

    scores.forEach((score) => {
      for (let i = 0; i < bins.length - 1; i++) {
        if (score >= bins[i] && score < bins[i + 1]) {
          counts[i]++;
          break;
        }
      }
    });

    const maxCount = Math.max(...counts, 1);
    const labels = ['0-59', '60-69', '70-79', '80-89', '90-100'];
    const gradients = [
      'from-red-500 to-red-600',
      'from-amber-400 to-amber-500',
      'from-lime-500 to-lime-600',
      'from-emerald-500 to-emerald-600',
      'from-cyan-500 to-cyan-600',
    ];

    return (
      <div className='flex items-end justify-around h-40 gap-2'>
        {counts.map((count, index) => {
          const height = maxCount > 0 ? `${(count / maxCount) * 100}%` : '0%';
          return (
            <div key={index} className='flex flex-col items-center flex-1'>
              <div className='text-xs font-medium text-gray-600 mb-1.5'>{count}</div>
              <div
                className={`w-full rounded-t-md bg-gradient-to-t ${gradients[index]} transition-all duration-700 hover:opacity-80 relative`}
                style={{
                  height: height,
                  minHeight: count > 0 ? '12px' : '0',
                }}
              >
                {count > 0 && (
                  <div className='absolute inset-0 rounded-t-md bg-white/20' />
                )}
              </div>
              <div className='text-xs text-gray-500 mt-1.5'>{labels[index]}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSubjectBarChart = (stats: Record<string, SubjectStats>): React.ReactElement | null => {
    if (!stats) return null;

    const subjects = Object.keys(stats);
    const maxAvg = subjects.length > 0 ? Math.max(...subjects.map((s) => stats[s].average || 0), 1) : 100;

    const barColors = [
      'from-blue-500 to-blue-600',
      'from-purple-500 to-purple-600',
      'from-pink-500 to-pink-600',
      'from-green-500 to-green-600',
      'from-amber-500 to-amber-600',
      'from-cyan-500 to-cyan-600',
      'from-orange-500 to-orange-600',
      'from-indigo-500 to-indigo-600',
    ];

    return (
      <div className='flex items-end justify-around h-36 gap-2'>
        {subjects.map((subject, index) => {
          const avg = stats[subject].average || 0;
          const height = maxAvg > 0 ? `${(avg / maxAvg) * 100}%` : '0%';
          const colorIndex = index % barColors.length;

          return (
            <div key={subject} className='flex flex-col items-center flex-1'>
              <div className={`text-sm font-bold text-gray-700 mb-1.5`}>
                {avg.toFixed(1)}
              </div>
              <div
                className={`w-full rounded-t-md bg-gradient-to-t ${barColors[colorIndex]} transition-all duration-700 hover:opacity-80 relative shadow-sm`}
                style={{
                  height: height,
                  minHeight: avg > 0 ? '10px' : '0',
                }}
              >
                {avg > 0 && (
                  <div className='absolute inset-0 rounded-t-md bg-white/20' />
                )}
              </div>
              <div className='text-xs text-gray-500 mt-1.5 truncate max-w-full px-1'>{subject}</div>
            </div>
          );
        })}
      </div>
    );
  };

  // 分群配色
  const CLUSTER_COLORS: Record<string, { bg: string; text: string; light: string; border: string }> = {
    '全面优秀型': { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50', border: 'border-blue-200' },
    '遵纪但学业吃力型': { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50', border: 'border-yellow-200' },
    '聪明但散漫型': { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-50', border: 'border-orange-200' },
    '双困型': { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50', border: 'border-red-200' },
  };

  const { clusters, compositeScores, warnings } = algorithmData;
  const clusterSummary = clusters?.cluster_summary || [];
  const riskStudents = useMemo(() => warnings?.risk_students || [], [warnings]);
  
  // 使用 useMemo 优化风险学生统计
  const riskStats = useMemo(() => {
    const high = riskStudents.filter((s) => s.risk_level === 'high').length;
    const medium = riskStudents.filter((s) => s.risk_level === 'medium').length;
    const low = riskStudents.filter((s) => s.risk_level === 'low').length;
    return { high, medium, low, total: riskStudents.length };
  }, [riskStudents]);
  
  // 使用 useMemo 优化综合评分分布计算
  const compositeScoreDistribution = useMemo(() => {
    const scores = compositeScores?.scores || [];
    return [0, 20, 40, 60, 80, 100].map((range) => 
      scores.filter((s) => s.composite_score >= range && s.composite_score < range + 20).length
    );
  }, [compositeScores]);
  
  // 行为-学业相关性：无真实计算数据源，置空避免伪造数值（此前为硬编码模拟数据 0.68，已移除）
  const behaviorAcademicCorrelation: number | null = null;

  return (
    <div className='p-5 space-y-5'>
      {loadWarn && (
        <div className='mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>算法分析数据加载失败，相关图表可能不完整，请刷新重试</p>
        </div>
      )}
      <div>
        <h1 className='text-xl font-bold text-gray-900'>数据分析</h1>
        <p className='text-sm text-gray-500 mt-1'>学生积分数据统计与分析</p>
      </div>

      {/* 筛选栏 */}
      <Card className='rounded-xl'>
        <div className='p-3 flex flex-wrap gap-3 items-center'>
          <div className='flex-1 min-w-[200px]'>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className='w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white'
            >
              <option value=''>选择考试</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id.toString()}>
                  {exam.name}
                </option>
              ))}
            </select>
          </div>
          <div className='w-40'>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className='w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white'
            >
              <option value=''>全部班级</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id.toString()}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className='flex gap-2'>
            <PermissionButton
              permission='algorithm.view'
              onClick={handleRefresh}
              disabled={loading}
              className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50'
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </PermissionButton>
            <PermissionButton
              permission='report.export'
              onClick={handleExport}
              className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors'
            >
              <Download className='w-3.5 h-3.5' />
              导出报告
            </PermissionButton>
          </div>
        </div>
      </Card>

      {/* 算法洞察统计卡片 */}
      <div className='grid grid-cols-2 md:grid-cols-6 gap-3'>
        <Card className='border-l-3 border-l-blue-500 bg-gradient-to-r from-blue-50/60 to-transparent'>
          <div className='p-3'>
            <div className='flex items-center gap-2'>
              <div className='p-1.5 bg-blue-100 rounded-md'>
                <Users className='w-4 h-4 text-blue-600' />
              </div>
              <div>
                <div className='text-[10px] text-gray-500'>学生总数</div>
                <div className='text-lg font-bold text-gray-900'>
                  {clusters?.students?.length || '—'}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className='border-l-3 border-l-green-500 bg-gradient-to-r from-green-50/60 to-transparent'>
          <div className='p-3'>
            <div className='flex items-center gap-2'>
              <div className='p-1.5 bg-green-100 rounded-md'>
                <TrendingUp className='w-4 h-4 text-green-600' />
              </div>
              <div>
                <div className='text-[10px] text-gray-500'>平均积分</div>
                <div className='text-lg font-bold text-gray-900'>
                  {examAnalysis?.overall?.overall_average || '—'}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className='border-l-3 border-l-purple-500 bg-gradient-to-r from-purple-50/60 to-transparent'>
          <div className='p-3'>
            <div className='flex items-center gap-2'>
              <div className='p-1.5 bg-purple-100 rounded-md'>
                <Target className='w-4 h-4 text-purple-600' />
              </div>
              <div>
                <div className='text-[10px] text-gray-500'>最高积分</div>
                <div className='text-lg font-bold text-gray-900'>
                  {examAnalysis?.overall?.highest_score || '—'}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className='border-l-3 border-l-red-500 bg-gradient-to-r from-red-50/60 to-transparent'>
          <div className='p-3'>
            <div className='flex items-center gap-2'>
              <div className='p-1.5 bg-red-100 rounded-md'>
                <TrendingDownIcon className='w-4 h-4 text-red-600' />
              </div>
              <div>
                <div className='text-[10px] text-gray-500'>最低积分</div>
                <div className='text-lg font-bold text-gray-900'>
                  {examAnalysis?.overall?.lowest_score || '—'}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className='border-l-3 border-l-cyan-500 bg-gradient-to-r from-cyan-50/60 to-transparent'>
          <div className='p-3'>
            <div className='flex items-center gap-2'>
              <div className='p-1.5 bg-cyan-100 rounded-md'>
                <BarChart3 className='w-4 h-4 text-cyan-600' />
              </div>
              <div>
                <div className='text-[10px] text-gray-500'>标准差</div>
                <div className='text-lg font-bold text-gray-900'>
                  {examAnalysis?.overall?.std_deviation || '—'}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className='border-l-3 border-l-amber-500 bg-gradient-to-r from-amber-50/60 to-transparent'>
          <div className='p-3'>
            <div className='flex items-center gap-2'>
              <div className='p-1.5 bg-amber-100 rounded-md'>
                <Award className='w-4 h-4 text-amber-600' />
              </div>
              <div>
                <div className='text-[10px] text-gray-500'>优秀人数</div>
                <div className='text-lg font-bold text-gray-900'>
                  {examAnalysis?.overall?.excellent_count || '—'}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 算法洞察区域 */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <Card className='border-l-3 border-l-purple-500 bg-gradient-to-r from-purple-50/50 to-transparent'>
          <div className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-purple-100 rounded-lg'>
                <GitBranch className='w-5 h-5 text-purple-600' />
              </div>
              <div>
                <div className='text-xs text-gray-500'>学生分群</div>
                <div className='text-xl font-bold text-gray-900'>
                  {clusters?.n_clusters || '—'}
                  <span className='text-xs font-normal text-gray-500 ml-1'>个群</span>
                </div>
              </div>
            </div>
            <p className='text-xs text-gray-500 mt-2'>{clusters && clusters.students ? `${clusters.students.length}名学生已分群` : '—'}</p>
          </div>
        </Card>

        <Card className='border-l-3 border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent'>
          <div className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-blue-100 rounded-lg'>
                <Sparkles className='w-5 h-5 text-blue-600' />
              </div>
              <div>
                <div className='text-xs text-gray-500'>综合评分学生</div>
                <div className='text-xl font-bold text-gray-900'>
                  {compositeScores?.scores?.length || '—'}
                  <span className='text-xs font-normal text-gray-500 ml-1'>人</span>
                </div>
              </div>
            </div>
            <p className='text-xs text-gray-500 mt-2'>基于熵权法计算综合评分</p>
          </div>
        </Card>

        <Card className={`border-l-3 ${warnings === null ? 'border-l-gray-300' : riskStudents.length > 0 ? 'border-l-red-500' : 'border-l-green-500'} bg-gradient-to-r ${warnings === null ? 'from-gray-50' : riskStudents.length > 0 ? 'from-red-50/50' : 'from-green-50/50'} to-transparent`}>
          <div className='p-4'>
            <div className='flex items-center gap-3'>
              <div className={`p-2 rounded-lg ${warnings === null ? 'bg-gray-100' : riskStudents.length > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                <ShieldAlert className={`w-5 h-5 ${warnings === null ? 'text-gray-400' : riskStudents.length > 0 ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <div>
                <div className='text-xs text-gray-500'>风险预警学生</div>
                {warnings === null ? (
                  <div className='text-sm font-bold text-gray-400'>无法获取</div>
                ) : (
                  <div className={`text-xl font-bold ${riskStudents.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {riskStudents.length}
                    <span className='text-xs font-normal text-gray-500 ml-1'>人</span>
                  </div>
                )}
              </div>
            </div>
            <p className='text-xs text-gray-500 mt-2'>
              {warnings === null
                ? '预警接口加载失败，请稍后重试'
                : `高风险: ${riskStudents.filter((s) => s.risk_level === 'high').length}人`}
            </p>
          </div>
        </Card>
      </div>

      {/* 风险预警提醒 */}
      {riskStats.total > 0 && (
        <Card className='bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10 border border-red-500/30 rounded-xl'>
          <div className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='flex-shrink-0 w-10 h-10 bg-gradient-to-br from-red-500 to-rose-500 rounded-lg flex items-center justify-center shadow-md shadow-red-500/30'>
                <AlertTriangle className='w-5 h-5 text-white' />
              </div>
              <div className='flex-1'>
                <h3 className='font-semibold text-gray-900 mb-0.5'>风险预警提醒</h3>
                <p className='text-sm text-gray-600'>
                  当前有 <span className='font-semibold text-red-600'>{riskStats.total}</span> 名学生处于风险状态（高风险: {riskStats.high}人，中风险: {riskStats.medium}人），建议结合成绩分析及时关注并采取干预措施。
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className='flex items-center justify-center py-12'>
          <LoadingSpinner />
        </div>
      ) : (
        <div className='space-y-4'>
          {/* 考试分析统计卡片 */}
          {examAnalysis && examAnalysis.overall && (
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
              <Card className='rounded-xl'>
                <div className='p-3'>
                  <div className='flex items-center gap-2'>
                    <div className='p-1.5 bg-blue-100 rounded-md'>
                      <Users className='w-4 h-4 text-blue-600' />
                    </div>
                    <div>
                      <div className='text-[10px] text-gray-500'>参考人数</div>
                      <div className='text-lg font-bold text-gray-900'>
                        {examAnalysis.overall.total_students != null ? examAnalysis.overall.total_students : '--'}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              <Card className='rounded-xl'>
                <div className='p-3'>
                  <div className='flex items-center gap-2'>
                    <div className='p-1.5 bg-green-100 rounded-md'>
                      <TrendingUp className='w-4 h-4 text-green-600' />
                    </div>
                    <div>
                      <div className='text-[10px] text-gray-500'>平均成绩</div>
                      <div className='text-lg font-bold text-gray-900'>
                        {examAnalysis.overall.overall_average != null ? examAnalysis.overall.overall_average : '--'}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              <Card className='rounded-xl'>
                <div className='p-3'>
                  <div className='flex items-center gap-2'>
                    <div className='p-1.5 bg-yellow-100 rounded-md'>
                      <Award className='w-4 h-4 text-yellow-600' />
                    </div>
                    <div>
                      <div className='text-[10px] text-gray-500'>优秀率</div>
                      <div className='text-lg font-bold text-gray-900'>
                        {examAnalysis.overall.excellent_rate != null ? `${examAnalysis.overall.excellent_rate}%` : '--'}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              <Card className='rounded-xl'>
                <div className='p-3'>
                  <div className='flex items-center gap-2'>
                    <div className='p-1.5 bg-purple-100 rounded-md'>
                      <BarChart3 className='w-4 h-4 text-purple-600' />
                    </div>
                    <div>
                      <div className='text-[10px] text-gray-500'>及格率</div>
                      <div className='text-lg font-bold text-gray-900'>
                        {examAnalysis.overall.pass_rate != null ? `${examAnalysis.overall.pass_rate}%` : '--'}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 主内容区域：三列布局 */}
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
            {/* 左侧：考试分析 */}
            <div className='lg:col-span-2 space-y-4'>
              {/* 各科平均分对比 */}
              {examAnalysis && examAnalysis.subject_stats && (
                <Card className='rounded-xl'>
                  <div className='p-3 border-b border-gray-100'>
                    <h3 className='font-medium text-gray-800 flex items-center gap-2'>
                      <BarChart3 className='w-4 h-4 text-gray-600' />
                      各科平均分对比
                    </h3>
                  </div>
                  <div className='p-3'>
                    {renderSubjectBarChart(examAnalysis.subject_stats)}
                  </div>
                </Card>
              )}

              {/* 成绩分布 */}
              {examAnalysis && (
                <Card className='rounded-xl'>
                  <div className='p-3 border-b border-gray-100'>
                    <h3 className='font-medium text-gray-800 flex items-center gap-2'>
                      <BarChart3 className='w-4 h-4 text-gray-600' />
                      成绩分布
                    </h3>
                  </div>
                  <div className='p-3'>
                    {renderScoreDistribution(
                      examAnalysis.subject_stats
                        ? Object.values(examAnalysis.subject_stats).flatMap((s) => s.scores || [])
                        : []
                    )}
                    <div className='flex justify-around mt-3 text-xs text-gray-500'>
                      <span>不及格</span>
                      <span>及格</span>
                      <span>中等</span>
                      <span>良好</span>
                      <span>优秀</span>
                    </div>
                  </div>
                </Card>
              )}

              {/* 各科详细统计 */}
              {examAnalysis && examAnalysis.subject_stats && (
                <Card className='rounded-xl'>
                  <div className='p-3 border-b border-gray-100'>
                    <h3 className='font-medium text-gray-800 flex items-center gap-2'>
                      <TrendingUp className='w-4 h-4 text-gray-600' />
                      各科详细统计
                    </h3>
                  </div>
                  <div className='p-3'>
                    <div className='space-y-2'>
                      {Object.entries(examAnalysis.subject_stats).map(([subject, data]) => (
                        <div key={subject} className='flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg'>
                          <div className='flex items-center gap-2'>
                            <span className='px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary-100 text-primary-700 whitespace-nowrap'>
                              {subject}
                            </span>
                            <div>
                              <div className='text-[10px] text-gray-500'>参考 {data.count != null ? data.count : '--'} 人</div>
                            </div>
                          </div>
                          <div className='flex items-center gap-4'>
                            <div className='text-center min-w-[50px]'>
                              <div className='text-[9px] text-gray-500'>平均分</div>
                              <div className='text-sm font-bold text-gray-900'>{data.average != null ? data.average.toFixed(1) : '--'}</div>
                            </div>
                            <div className='text-center min-w-[50px]'>
                              <div className='text-[9px] text-gray-500'>最高分</div>
                              <div className='text-sm font-bold text-green-600'>{data.max != null ? data.max : '--'}</div>
                            </div>
                            <div className='text-center min-w-[50px]'>
                              <div className='text-[9px] text-gray-500'>最低分</div>
                              <div className='text-sm font-bold text-red-600'>{data.min != null ? data.min : '--'}</div>
                            </div>
                            <div className='text-center min-w-[50px]'>
                              <div className='text-[9px] text-gray-500'>及格率</div>
                              <div className='text-sm font-bold text-purple-600'>{data.pass_rate != null ? `${data.pass_rate}%` : '--'}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {/* 右侧：算法分析仪表盘 */}
            <div className='space-y-4'>
              {/* 风险预警分布 */}
              <Card className='rounded-xl'>
                <div className='p-3 border-b border-gray-100'>
                  <h3 className='font-medium text-gray-800 flex items-center gap-2'>
                    <AlertTriangle className='w-4 h-4 text-orange-500' />
                    风险预警分布
                  </h3>
                </div>
                <div className='p-3'>
                  <div className='flex items-center justify-between mb-3'>
                    <div className='flex-1 space-y-2.5'>
                      {[
                        { label: '高风险', count: riskStats.high, color: 'bg-red-500' },
                        { label: '中风险', count: riskStats.medium, color: 'bg-yellow-500' },
                        { label: '低风险', count: riskStats.low, color: 'bg-green-500' },
                      ].map((item, index) => (
                        <div key={index} className='flex items-center gap-1.5'>
                          <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                          <span className='text-[10px] text-gray-600 w-10'>{item.label}</span>
                          <div className='flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden'>
                            <div 
                              className={`h-full ${item.color}`}
                              style={{ width: `${riskStudents.length > 0 ? (item.count / riskStudents.length) * 100 : 0}%` }}
                            />
                          </div>
                          <span className='text-[10px] font-semibold text-gray-800 w-6 text-right'>{item.count}</span>
                        </div>
                      ))}
                    </div>
                    <div className='relative w-18 h-18 ml-3'>
                      <svg className='w-full h-full transform -rotate-90'>
                        <circle cx='36' cy='36' r='30' stroke='#e5e7eb' strokeWidth='5' fill='none' />
                        <circle 
                          cx='36' cy='36' r='30' 
                          stroke='#ef4444' strokeWidth='5' fill='none'
                          strokeDasharray={`${riskStudents.length ? riskStudents.filter((r) => r.risk_level === 'high').length / riskStudents.length * 188 : 0} 188`}
                        />
                        <circle 
                          cx='36' cy='36' r='30' 
                          stroke='#eab308' strokeWidth='5' fill='none'
                          strokeDasharray={`${riskStudents.length ? riskStudents.filter((r) => r.risk_level === 'medium').length / riskStudents.length * 188 : 0} 188`}
                          transform='rotate(180 36 36)'
                        />
                      </svg>
                      <div className='absolute inset-0 flex flex-col items-center justify-center'>
                        <span className='text-base font-bold text-gray-800'>{riskStudents.length}</span>
                        <span className='text-[8px] text-gray-500'>预警人数</span>
                      </div>
                    </div>
                  </div>
                  <div className='bg-blue-50 rounded-lg p-2'>
                    <p className='text-[10px] text-gray-600'>
                      <strong>预警说明：</strong>基于行为数据和学业表现综合评估
                    </p>
                  </div>
                </div>
              </Card>

              {/* 行为-学业相关性分析 */}
              <Card className='rounded-xl'>
                <div className='p-3 border-b border-gray-100'>
                  <h3 className='font-medium text-gray-800 flex items-center gap-2'>
                    <TrendingUp className='w-4 h-4 text-cyan-500' />
                    行为-学业相关性
                  </h3>
                </div>
                <div className='p-3'>
                  <div className='flex items-center justify-center h-16'>
                    {behaviorAcademicCorrelation === null ? (
                      <div className='text-center'>
                        <div className='text-sm text-gray-400'>暂无相关数据</div>
                        <div className='text-[10px] text-gray-400 mt-0.5'>需同时存在行为积分与成绩记录</div>
                      </div>
                    ) : (
                    <div className='text-center'>
                      <div className={`text-2xl font-bold ${
                        Math.abs(behaviorAcademicCorrelation) >= 0.7 ? 'text-green-600' :
                        Math.abs(behaviorAcademicCorrelation) >= 0.4 ? 'text-yellow-600' :
                        'text-gray-500'
                      }`}>
                        {behaviorAcademicCorrelation.toFixed(2)}
                      </div>
                      <div className='text-[10px] text-gray-500 mt-0.5'>相关系数</div>
                      <div className='text-[9px] text-gray-400 mt-0.5'>
                        {behaviorAcademicCorrelation > 0 ? '正相关' : behaviorAcademicCorrelation < 0 ? '负相关' : '无明显相关'}
                      </div>
                    </div>
                    )}
                  </div>
                  <div className='mt-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-1.5'>
                    <div className='flex items-center gap-1.5'>
                      <div className='w-5 h-5 bg-blue-100 rounded-md flex items-center justify-center'>
                        <span className='text-[9px] font-bold text-blue-600'>B</span>
                      </div>
                      <div className='flex-1 h-px bg-gradient-to-r from-blue-300 to-purple-300' />
                      <div className='w-5 h-5 bg-purple-100 rounded-md flex items-center justify-center'>
                        <span className='text-[9px] font-bold text-purple-600'>A</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 综合评分分布 */}
              <Card className='rounded-xl'>
                <div className='p-3 border-b border-gray-100'>
                  <h3 className='font-medium text-gray-800 flex items-center gap-2'>
                    <BarChart3 className='w-4 h-4 text-indigo-500' />
                    综合评分分布
                  </h3>
                </div>
                <div className='p-3'>
                  <div className='flex items-end justify-between h-14 gap-0.5'>
                    {compositeScoreDistribution.map((count, index) => {
                      const maxCount = Math.max(...compositeScoreDistribution, 1);
                      return (
                        <div key={index} className='flex-1 flex flex-col items-center'>
                          <div 
                            className='w-full bg-gradient-to-t from-indigo-500 to-indigo-300 rounded-t transition-all duration-500 hover:from-indigo-600 hover:to-indigo-400'
                            style={{ height: `${(count / maxCount) * 45}px`, minHeight: '5px' }}
                          />
                          <span className='text-[8px] text-gray-500 mt-0.5'>{index * 20}+</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className='mt-2 flex justify-between text-[9px] text-gray-500'>
                    <span>低分</span>
                    <span>高分</span>
                  </div>
                </div>
              </Card>

              {/* 分群特征分析 */}
              <Card className='rounded-xl'>
                <div className='p-3 border-b border-gray-100'>
                  <h3 className='font-medium text-gray-800 flex items-center gap-2'>
                    <GitBranch className='w-4 h-4 text-purple-500' />
                    分群特征分析
                  </h3>
                </div>
                <div className='p-3'>
                  <div className='space-y-1.5'>
                    {clusterSummary.map((cluster, index) => {
                      const colors = CLUSTER_COLORS[cluster.label];
                      const features: Record<string, { desc: string; suggestion: string }> = {
                        '全面优秀型': { desc: '行为规范，学业优秀', suggestion: '保持状态，引领同学' },
                        '遵纪但学业吃力型': { desc: '遵守纪律，学习待提高', suggestion: '加强学习辅导' },
                        '聪明但散漫型': { desc: '学习能力强，行为需改进', suggestion: '加强纪律教育' },
                        '双困型': { desc: '行为和学业需关注', suggestion: '制定个性化方案' },
                      };
                      const feature = features[cluster.label] || { desc: '-', suggestion: '-' };
                      
                      return (
                        <div key={index} className={`p-2 rounded-lg ${colors?.light} border ${colors?.border}`}>
                          <div className='flex items-center justify-between mb-0.5'>
                            <div className='flex items-center gap-1'>
                              <div className={`w-1.5 h-1.5 rounded-full ${colors?.bg}`} />
                              <span className='text-[10px] font-semibold text-gray-800'>{cluster.label}</span>
                            </div>
                            <span className='text-xs font-bold text-gray-900'>{cluster.count}人</span>
                          </div>
                          <p className='text-[9px] text-gray-600'>{feature.desc}</p>
                          <p className='text-[9px] text-gray-500 mt-0.5'>{feature.suggestion}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScoreAnalysis;