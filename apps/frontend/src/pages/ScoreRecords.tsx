/**
 * 成绩档案页面（逻辑层）。
 *
 * 视图渲染已拆到 ./scoreRecords/ScoreRecordsView（含学生列表 / 信息卡 /
 * 成绩概览 / 历次考试四个子组件），本文件只保留数据获取与派生逻辑。
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useStableToast } from '../hooks';
import { formatNumber } from '../utils/format';
import api from '../services/api';
import type { User } from '../types';
import type { ClassInfo } from '../services/api';
import { ExamWithScores } from '../types';
import ScoreRecordsView from './scoreRecords/ScoreRecordsView';
import type {
  Student,
  StudentDetail,
  StudentScoreStats,
  StudentAnalysisResponse,
  UserResponse,
} from './scoreRecords/types';

const ScoreRecords: React.FC = () => {
  const { showToast } = useStableToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);
  const [examScores, setExamScores] = useState<Record<string, ExamWithScores>>({});
  const [searchInput, setSearchInput] = useState<string>('');
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleApiError = useCallback(
    (error: unknown, message: string): void => {
      showToast('error', `${message}: ${(error as Error).message}`);
    },
    [showToast]
  );

  const parseClassResponse = useCallback((response: unknown): ClassInfo[] => {
    if (Array.isArray(response)) {
      return response;
    }
    return (response as { classes?: ClassInfo[] }).classes || [];
  }, []);

  const parseUserResponse = useCallback((response: unknown): User[] => {
    if (Array.isArray(response)) {
      return response;
    }
    return (response as { users?: User[] }).users || [];
  }, []);

  const parseStudentDetail = useCallback((response: unknown): StudentDetail => {
    const userResponse = response as UserResponse;
    if (userResponse.user) {
      return userResponse.user;
    }
    return response as StudentDetail;
  }, []);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const classesRes = await api.classes.getAll();
      setClasses(parseClassResponse(classesRes));
    } catch (err: unknown) {
      handleApiError(err, '获取班级数据失败');
    }
  }, [handleApiError, parseClassResponse]);

  const fetchStudents = useCallback(async (): Promise<void> => {
    try {
      const usersRes = await api.users.getAll({ class_name: selectedClass });
      const allUsers = parseUserResponse(usersRes);
      const studentList = allUsers.filter((u) => u.role === 'student') as Student[];
      setStudents(studentList);
    } catch (err: unknown) {
      handleApiError(err, '获取学生列表失败');
    }
  }, [selectedClass, handleApiError, parseUserResponse]);

  const fetchStudentDetail = useCallback(async (): Promise<void> => {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      const [userRes, analysisRes] = await Promise.all([
        api.users.getById(Number(selectedStudent)),
        api.scoreAnalysis.getStudentAnalysis(selectedStudent),
      ]);

      setStudentDetail(parseStudentDetail(userRes));
      setExamScores((analysisRes as StudentAnalysisResponse).exam_scores || {});
    } catch (err: unknown) {
      handleApiError(err, '获取学生成绩失败');
    } finally {
      setLoading(false);
    }
  }, [selectedStudent, handleApiError, parseStudentDetail]);

  const stats = useMemo((): StudentScoreStats | null => {
    if (!studentDetail || Object.keys(examScores).length === 0) return null;

    let totalScore = 0;
    let count = 0;
    const subjectScores: Record<string, number[]> = {};

    Object.values(examScores).forEach((exam) => {
      Object.values(exam.scores || {}).forEach((score) => {
        if (score.score) {
          totalScore += score.score;
          count++;
          const subjectKey = score.subject || '';
          if (!subjectScores[subjectKey]) {
            subjectScores[subjectKey] = [];
          }
          subjectScores[subjectKey].push(score.score);
        }
      });
    });

    const avgScore = count > 0 ? formatNumber(totalScore / count, 2) : '—';

    const subjectStats: Record<string, { avg: string; max: number; min: number; count: number }> =
      {};
    Object.entries(subjectScores).forEach(([subject, scores]) => {
      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        subjectStats[subject] = {
          avg: formatNumber(avg, 2),
          max,
          min,
          count: scores.length,
        };
      }
    });

    return { avgScore, subjectStats, totalExams: Object.keys(examScores).length };
  }, [studentDetail, examScores]);

  const handleExportScores = useCallback(
    async (_format: 'excel' | 'csv'): Promise<Blob> => {
      if (!studentDetail) {
        throw new Error('请先选择学生');
      }
      // 学生无任何成绩：拦截空表导出（此前仅校验 studentDetail，空成绩表照常导出并提示成功）
      if (Object.keys(examScores).length === 0) {
        throw new Error('该学生暂无考试成绩，无可导出数据');
      }

      const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office'
            xmlns:x='urn:schemas-microsoft-com:office:excel'
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='UTF-8' />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>学生成绩</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
      </head>
      <body>
        <table border='1'>
          <tr><th colspan='4' style='font-size:14pt;background:#4472C4;color:white'>学生成绩档案</th></tr>
          <tr><td>姓名</td><td>${studentDetail.name}</td><td>学号</td><td>${
        studentDetail.card_id
      }</td></tr>
          <tr><td>班级</td><td>${studentDetail.class_name || ''}</td><td>当前积分</td><td>${
        studentDetail.current_score ?? ''
      }</td></tr>
          <tr><th colspan='4' style='background:#4472C4;color:white'>成绩概览</th></tr>
          <tr><td>平均成绩</td><td>${stats?.avgScore || '-'}</td><td>参加考试</td><td>${
        stats?.totalExams || 0
      }</td></tr>
          <tr><th colspan='4' style='background:#4472C4;color:white'>各科成绩</th></tr>
          <tr><th>科目</th><th>平均分</th><th>最低分</th><th>最高分</th></tr>
          ${
            stats
              ? Object.entries(stats.subjectStats)
                  .map(
                    ([subject, data]) =>
                      `<tr><td>${subject}</td><td>${data.avg}</td><td>${data.min}</td><td>${data.max}</td></tr>`
                  )
                  .join('')
              : ''
          }
          <tr><th colspan='4' style='background:#4472C4;color:white'>历次考试成绩</th></tr>
          ${Object.entries(examScores)
            .map(([examId, exam]) => {
              const scores = exam.scores || {};
              return (
                `<tr><td colspan='4' style='background:#D6DCE4;font-weight:bold'>${
                  exam.exam_name
                } (${
                  exam.exam_time ? new Date(exam.exam_time).toLocaleDateString('zh-CN') : ''
                })</td></tr>` +
                Object.entries(scores)
                  .map(
                    ([subject, score]) =>
                      `<tr><td>${subject}</td><td>${score.score ?? '-'}</td><td colspan='2'>${
                        score.rank ? '排名 ' + score.rank : ''
                      }</td></tr>`
                  )
                  .join('')
              );
            })
            .join('')}
        </table>
      </body>
      </html>
    `;

      return new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    },
    [studentDetail, stats, examScores]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchStudents();
    setSelectedStudent('');
    setStudentDetail(null);
    setExamScores({});
  }, [fetchStudents]);

  useEffect(() => {
    if (selectedStudent) {
      fetchStudentDetail();
    }
  }, [selectedStudent, fetchStudentDetail]);

  return (
    <ScoreRecordsView
      students={students}
      selectedStudent={selectedStudent}
      setSelectedStudent={setSelectedStudent}
      studentDetail={studentDetail}
      examScores={examScores}
      searchInput={searchInput}
      setSearchInput={setSearchInput}
      classes={classes}
      selectedClass={selectedClass}
      setSelectedClass={setSelectedClass}
      loading={loading}
      stats={stats}
      handleExportScores={handleExportScores}
    />
  );
};

export default ScoreRecords;
