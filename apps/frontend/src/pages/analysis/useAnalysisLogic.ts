import logger from '../../utils/logger';
import { downloadTextAsFile } from '../../utils/download';
import { useStableToast } from '../../hooks';
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Award,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  GitBranch,
  Shield,
} from 'lucide-react';
import api from '../../services/api';
import { User } from '../../types';
import type {
  UserWithCluster,
  AlgorithmData,
  ScoreDistributionItem,
  ClusterPieItem,
  WeeklyDataItem,
  BasicStat,
  AlgorithmStat,
} from './AnalysisSections';

/**
 * 数据分析页面逻辑层（数据加载 + 统计/图表数据派生 + 导出）
 *
 * 展示区块见 ./AnalysisSections；主渲染与装配见 ../Analysis。
 */
export function useAnalysisLogic() {
  const { showToast } = useStableToast();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedClass, setSelectedClass] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [algorithmData, setAlgorithmData] = useState<AlgorithmData>({
    statistics: null,
    clusters: null,
    warnings: null,
  });

  const [classList, setClassList] = useState<{ id: number; name: string }[]>([]);
  // 数据加载失败警示（不阻断内容，提示数据可能不完整）
  const [loadWarn, setLoadWarn] = useState(false);

  const fetchAlgorithmData = useCallback(async () => {
    try {
      const [statsRes, clusterRes, warningRes] = await Promise.all([
        api.algorithm.getStatistics().catch(() => null), // 算法子模块加载失败不影响主面板，置 null 由各区块空态兜底
        api.algorithm.getClusters().catch(() => null),
        api.algorithm.getWarnings().catch(() => null),
      ]);

      setAlgorithmData({
        statistics: statsRes || null,
        clusters: clusterRes || null,
        warnings: warningRes || null,
      });
      if (!statsRes && !clusterRes && !warningRes) {
        setLoadWarn(true);
      } else {
        setLoadWarn(false);
      }
    } catch (error) {
      logger.error('获取算法数据失败:', error);
      setLoadWarn(true);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchClasses();
    fetchAlgorithmData();
  }, [fetchAlgorithmData]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api.users.getAll();
      setUsers(data.users || []);
      setLoadWarn(false);
    } catch (error) {
      logger.error('获取用户数据失败:', error);
      setLoadWarn(true);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const data = (await api.classes.getAll()) as unknown;
      const classesData = Array.isArray(data)
        ? data
        : (data as { classes?: { id: number; name: string }[] }).classes || [];
      setClassList(classesData);
      setLoadWarn(false);
    } catch (error) {
      logger.error('获取班级列表失败:', error);
      setLoadWarn(true);
    }
  };

  useEffect(() => {
    fetchAlgorithmData();
  }, [fetchAlgorithmData]);

  const handleRefresh = () => {
    fetchUsers();
    fetchClasses();
    fetchAlgorithmData();
  };

  const selectedClassName = selectedClass
    ? classList.find((c) => c.id === selectedClass)?.name
    : '';
  const filteredUsers = selectedClassName
    ? users.filter((u) => u.class_name === selectedClassName)
    : users;

  // 使用 useMemo 优化用户数据处理
  const usersWithCluster = useMemo((): UserWithCluster[] => {
    if (!algorithmData.clusters?.students) return filteredUsers as UserWithCluster[];

    const clusterMap = new Map(algorithmData.clusters.students.map((s) => [s.user_id, s]));

    return filteredUsers.map((user) => ({
      ...user,
      cluster: clusterMap.get(Number(user.id)) || null,
    }));
  }, [filteredUsers, algorithmData.clusters]);

  const topUsers = useMemo(
    () =>
      [...usersWithCluster]
        .sort((a, b) => (b.current_score || 0) - (a.current_score || 0))
        .slice(0, 10),
    [usersWithCluster]
  );

  // 使用 useMemo 优化统计计算（无学生时统计值置 null，避免 0 冒充真实值）
  const { minScore, maxScore, avgScore, stdDev, needAttention, excellentCount } = useMemo(() => {
    const scores = filteredUsers.map((u) => u.current_score || 0);
    const has = scores.length > 0;
    const min = has ? Math.min(...scores) : null;
    const max = has ? Math.max(...scores) : null;
    const avg = has ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;
    const variance = has
      ? scores.reduce((sum, s) => sum + Math.pow((s - avg) as number, 2), 0) / scores.length
      : 0;
    const std = has ? Math.round(Math.sqrt(variance)) : null;
    const need = filteredUsers.filter((u) => (u.current_score || 0) < 60);
    const excellent = filteredUsers.filter((u) => (u.current_score || 0) >= 90).length;
    return {
      minScore: min,
      maxScore: max,
      avgScore: avg,
      stdDev: std,
      needAttention: need,
      excellentCount: excellent,
    };
  }, [filteredUsers]);

  const { statistics, clusters, warnings } = algorithmData;

  // 使用 useMemo 优化风险学生统计
  const { highRiskCount, mediumRiskCount, lowRiskCount } = useMemo(() => {
    const riskStudents = warnings?.risk_students || [];
    return {
      highRiskCount: riskStudents.filter((s) => s.risk_level === 'high').length,
      mediumRiskCount: riskStudents.filter((s) => s.risk_level === 'medium').length,
      lowRiskCount: riskStudents.filter((s) => s.risk_level === 'low').length,
    };
  }, [warnings]);

  // 使用 useMemo 优化聚类摘要数据
  const clusterSummary = useMemo(
    () => clusters?.cluster_summary || [],
    [clusters?.cluster_summary]
  );

  // 使用 useMemo 优化图表数据
  const clusterPieData: ClusterPieItem[] = useMemo(
    () =>
      clusterSummary.map((cluster) => ({
        name: cluster.label,
        value: cluster.count,
        color:
          // CLUSTER_COLORS 已迁至 AnalysisSections，此处仅做颜色推导（与子组件一致）
          cluster.label === '全面优秀型'
            ? '#3b82f6'
            : cluster.label === '遵纪但学业吃力型'
            ? '#eab308'
            : cluster.label === '聪明但散漫型'
            ? '#f97316'
            : cluster.label === '双困型'
            ? '#ef4444'
            : '#6b7280',
      })),
    [clusterSummary]
  );

  const scoreDistribution: ScoreDistributionItem[] = useMemo(
    () => [
      {
        name: '0-59',
        count: filteredUsers.filter((u) => (u.current_score || 0) < 60).length,
        color: '#ef4444',
      },
      {
        name: '60-79',
        count: filteredUsers.filter(
          (u) => (u.current_score || 0) >= 60 && (u.current_score || 0) < 80
        ).length,
        color: '#f59e0b',
      },
      {
        name: '80-100',
        count: filteredUsers.filter((u) => (u.current_score || 0) >= 80).length,
        color: '#22c55e',
      },
    ],
    [filteredUsers]
  );

  // 积分趋势：当前无真实周级数据源，置空并在图表区显示诚实空态（此前为硬编码假数据，已移除）
  const weeklyData: WeeklyDataItem[] = [];

  // 使用 useMemo 优化基础统计数据
  const basicStats: BasicStat[] = useMemo(
    () => [
      {
        label: '学生总数',
        value: filteredUsers.length,
        icon: Users,
        bgColor: 'bg-primary-100',
        textColor: 'text-primary-600',
      },
      {
        label: '平均积分',
        value: avgScore,
        icon: Award,
        bgColor: 'bg-success-100',
        textColor: 'text-success-600',
      },
      {
        label: '最高积分',
        value: maxScore,
        icon: TrendingUp,
        bgColor: 'bg-accent-100',
        textColor: 'text-accent-600',
      },
      {
        label: '最低积分',
        value: minScore,
        icon: TrendingDown,
        bgColor: 'bg-danger-100',
        textColor: 'text-danger-600',
      },
      {
        label: '标准差',
        value: stdDev,
        icon: Activity,
        bgColor: 'bg-info-100',
        textColor: 'text-info-600',
      },
      {
        label: '优秀人数',
        value: excellentCount,
        icon: Zap,
        bgColor: 'bg-warning-100',
        textColor: 'text-warning-600',
      },
    ],
    [filteredUsers.length, avgScore, maxScore, minScore, stdDev, excellentCount]
  );

  const correlation = statistics?.correlation ?? 0;
  const riskStudents = useMemo(() => warnings?.risk_students || [], [warnings?.risk_students]);

  // 使用 useMemo 优化算法统计数据
  const algorithmStats: AlgorithmStat[] = useMemo(
    () => [
      {
        label: '行为-学业相关性',
        value: statistics?.correlation !== undefined ? statistics.correlation.toFixed(2) : '—',
        icon: TrendingUp,
        bgColor: correlation > 0.5 ? 'bg-green-100' : 'bg-yellow-100',
        textColor: correlation > 0.5 ? 'text-green-600' : 'text-yellow-600',
        trend: correlation > 0.5 ? '正相关' : correlation > 0 ? '弱相关' : '负相关',
        description: '积分与成绩关联度',
      },
      {
        label: '学生分群',
        value: clusters?.n_clusters || '—',
        icon: GitBranch,
        bgColor: 'bg-purple-100',
        textColor: 'text-purple-600',
        trend: `${clusters?.students?.length || 0}名学生`,
        description: '已分群学生数量',
      },
      {
        label: '风险预警',
        // warnings 为 null（接口失败/未加载）→ 灰 "无法获取"，不伪装成"无预警"
        value: warnings === null ? '—' : riskStudents.length,
        icon: Shield,
        bgColor:
          warnings === null
            ? 'bg-gray-100'
            : riskStudents.length > 0
            ? 'bg-red-100'
            : 'bg-green-100',
        textColor:
          warnings === null
            ? 'text-gray-500'
            : riskStudents.length > 0
            ? 'text-red-600'
            : 'text-green-600',
        trend: warnings === null ? '无法获取' : riskStudents.length > 0 ? '需关注' : '无预警',
        description: '高/中/低风险学生',
      },
    ],
    [statistics, clusters, correlation, riskStudents]
  );

  const handleExport = () => {
    // 无数据不导出空壳报告（此前直接下载空 JSON，用户无感知）
    if (filteredUsers.length === 0 && !statistics) {
      showToast('warning', '暂无数据可导出，请先加载学生数据');
      return;
    }
    const exportData = {
      exportTime: new Date().toISOString(),
      filterClass: selectedClassName || '全部班级',
      basicStats: {
        totalStudents: filteredUsers.length,
        avgScore,
        maxScore,
        minScore,
        stdDev,
        excellentCount,
      },
      algorithmStats: {
        correlation: statistics?.correlation,
        nClusters: clusters?.n_clusters,
        riskCount: riskStudents.length,
      },
      scoreDistribution,
      clusterSummary,
      riskStudents: riskStudents.slice(0, 10),
      topUsers: topUsers.map((u) => ({
        name: u.name,
        class_name: u.class_name,
        current_score: u.current_score,
        cluster: u.cluster?.cluster_name,
      })),
    };

    downloadTextAsFile(
      JSON.stringify(exportData, null, 2),
      `analysis_report_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`,
      'application/json'
    );
  };

  return {
    loadWarn,
    selectedClass,
    setSelectedClass,
    classList,
    handleRefresh,
    isLoading,
    basicStats,
    algorithmStats,
    riskStudents,
    correlation,
    scoreDistribution,
    clusterSummary,
    clusterPieData,
    topUsers,
    weeklyData,
    statistics,
    needAttention,
    usersWithCluster,
    handleExport,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
  };
}
