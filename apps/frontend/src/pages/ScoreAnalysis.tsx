import logger from '../utils/logger';
/**
 * 成绩分析页面组件
 * 提供学生积分数据统计与分析功能
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStableToast } from '../hooks';
import api from '../services/api';
import type { Exam, ClassInfo } from '../services/api';
import {
  ScoreAnalysisView,
  type ExamAnalysis,
  type AlgorithmData,
  type ClusterResult,
  type CompositeScoreResult,
  type WarningResult,
} from './scoreAnalysis/ScoreAnalysisSections';

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
      const [examsRes, classesRes] = await Promise.all([api.exams.getAll(), api.classes.getAll()]);

      setExams(Array.isArray(examsRes) ? examsRes : (examsRes as { data?: Exam[] }).data || []);
      setClasses(
        Array.isArray(classesRes)
          ? classesRes
          : (classesRes as { classes?: ClassInfo[] }).classes || []
      );
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
      logger.error('获取算法数据失败:', error);
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
    a.download = `score_analysis_report_${new Date()
      .toLocaleDateString('zh-CN')
      .replace(/\//g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    return [0, 20, 40, 60, 80, 100].map(
      (range) =>
        scores.filter((s) => s.composite_score >= range && s.composite_score < range + 20).length
    );
  }, [compositeScores]);

  // 行为-学业相关性：无真实计算数据源，置空避免伪造数值（此前为硬编码模拟数据 0.68，已移除）
  const behaviorAcademicCorrelation: number | null = null;

  return (
    <ScoreAnalysisView
      exams={exams}
      selectedExam={selectedExam}
      setSelectedExam={setSelectedExam}
      classes={classes}
      selectedClass={selectedClass}
      setSelectedClass={setSelectedClass}
      loadWarn={loadWarn}
      examAnalysis={examAnalysis}
      clusters={clusters}
      compositeScores={compositeScores}
      warnings={warnings}
      loading={loading}
      handleRefresh={handleRefresh}
      handleExport={handleExport}
      riskStats={riskStats}
      compositeScoreDistribution={compositeScoreDistribution}
      behaviorAcademicCorrelation={behaviorAcademicCorrelation}
      riskStudents={riskStudents}
      clusterSummary={clusterSummary}
    />
  );
}

export default ScoreAnalysis;
