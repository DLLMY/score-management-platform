import logger from '../utils/logger';
import { useState, useEffect, useCallback, useMemo } from 'react';
import api, { ClassInfo } from '../services/api';
import { useStableToast } from '../hooks';
import ClassCompareView from './classCompare/ClassCompareView';
import { CLASS_COLORS, type ClassCompareData } from './classCompare/types';

/**
 * 班级对比分析（逻辑层）：班级列表加载、对比数据获取、图表数据派生。
 * 视图见 ./classCompare/ClassCompareView。
 */
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
      } else {
        showToast('success', '对比数据已生成'); // L9: 成功反馈
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
      prev.includes(className) ? prev.filter((c) => c !== className) : [...prev, className]
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
    <ClassCompareView
      loadError={loadError}
      fetchCompareData={fetchCompareData}
      isLoading={isLoading}
      classes={classes}
      toggleClass={toggleClass}
      selectedClasses={selectedClasses}
      period={period}
      setPeriod={setPeriod}
      compareData={compareData}
      getClassColor={getClassColor}
      barChartData={barChartData}
      lineChartData={lineChartData}
    />
  );
}

export default ClassCompare;
