import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BookOpen, Award, Users } from 'lucide-react';
import { Card, LoadingSpinner, SearchFilter } from '../components';
import ImportExportPanel from '../components/special/ImportExportPanel';
import { useStableToast } from '../hooks/useStableToast';
import api from '../services/api';
import type { User } from '../types';
import type { ClassInfo } from '../services/api';
import { ExamWithScores } from '../types';
import { useDebouncedValue } from '../hooks';

interface Student extends User {
  role: string;
  class_name: string;
}

interface StudentDetail {
  id: number;
  name: string;
  card_id: string;
  class_name?: string;
  gender?: string;
  current_score?: number;
}

interface StudentScoreStats {
  avgScore: string;
  subjectStats: Record<string, { avg: string; max: number; min: number; count: number }>;
  totalExams: number;
}

interface StudentAnalysisResponse {
  exam_scores: Record<string, ExamWithScores>;
}

interface UserResponse {
  user?: StudentDetail;
}

const StudentList: React.FC<{
  students: Student[];
  selectedStudent: string;
  classes: ClassInfo[];
  selectedClass: string;
  searchInput: string;
  onStudentSelect: (id: string) => void;
  onClassChange: (className: string) => void;
  onSearchChange: (value: string) => void;
}> = ({
  students,
  selectedStudent,
  classes,
  selectedClass,
  searchInput,
  onStudentSelect,
  onClassChange,
  onSearchChange,
}) => {
  const debouncedSearchTerm = useDebouncedValue(searchInput, 300);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        student.card_id?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesClass = !selectedClass || student.class_name === selectedClass;
      return matchesSearch && matchesClass;
    });
  }, [students, debouncedSearchTerm, selectedClass]);

  return (
    <Card className='lg:col-span-1'>
      <div className='p-4 border-b border-gray-200'>
        <h3 className='font-medium text-gray-900'>学生列表</h3>
      </div>
      <div className='p-4 space-y-4'>
        <SearchFilter
          value={searchInput}
          onChange={onSearchChange}
          placeholder='搜索学生姓名或学号'
          showReset={true}
          onReset={() => {
            onSearchChange('');
            onClassChange('');
          }}
          selectFilters={[
            {
              label: '班级',
              value: selectedClass,
              onChange: onClassChange,
              options: [
                { label: '全部班级', value: '' },
                ...classes.map((cls) => ({ label: cls.name, value: cls.name })),
              ],
            },
          ]}
          maxWidth='w-full'
          className='w-full'
        />
        <div className='max-h-[600px] overflow-y-auto space-y-2'>
          {filteredStudents.map((student) => (
            <button
              key={student.id}
              onClick={() => onStudentSelect(student.id.toString())}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedStudent === student.id.toString()
                  ? 'bg-primary-100 text-primary-800'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
              }`}
            >
              <div className='font-medium'>{student.name}</div>
              <div className='text-sm text-gray-500'>{student.card_id}</div>
              <div className='text-sm text-gray-500'>{student.class_name}</div>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
};

const StudentInfoCard: React.FC<{ student: StudentDetail }> = ({ student }) => {
  return (
    <Card>
      <div className='p-4 border-b border-gray-200 flex items-center justify-between'>
        <h3 className='font-medium text-gray-900'>学生信息</h3>
        <span className='px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
          {student.class_name}
        </span>
      </div>
      <div className='p-4 grid grid-cols-2 md:grid-cols-4 gap-4'>
        <div className='p-4 bg-gray-50 rounded-lg'>
          <div className='text-sm text-gray-500'>姓名</div>
          <div className='font-medium text-gray-900'>{student.name}</div>
        </div>
        <div className='p-4 bg-gray-50 rounded-lg'>
          <div className='text-sm text-gray-500'>学号</div>
          <div className='font-medium text-gray-900'>{student.card_id}</div>
        </div>
        <div className='p-4 bg-gray-50 rounded-lg'>
          <div className='text-sm text-gray-500'>性别</div>
          <div className='font-medium text-gray-900'>{student.gender || '-'}</div>
        </div>
        <div className='p-4 bg-gray-50 rounded-lg'>
          <div className='text-sm text-gray-500'>当前积分</div>
          <div className='font-medium text-gray-900'>{student.current_score}</div>
        </div>
      </div>
    </Card>
  );
};

const ScoreStatsCard: React.FC<{ stats: StudentScoreStats }> = ({ stats }) => {
  return (
    <Card>
      <div className='p-4 border-b border-gray-200'>
        <h3 className='font-medium text-gray-900 flex items-center gap-2'>
          <Award className='w-5 h-5' />
          成绩概览
        </h3>
      </div>
      <div className='p-4'>
        <div className='grid grid-cols-3 gap-4 mb-6'>
          <div className='p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg'>
            <div className='text-sm text-blue-600'>平均成绩</div>
            <div className='text-2xl font-bold text-blue-800'>{stats.avgScore}</div>
          </div>
          <div className='p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg'>
            <div className='text-sm text-green-600'>参加考试</div>
            <div className='text-2xl font-bold text-green-800'>{stats.totalExams}</div>
          </div>
          <div className='p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg'>
            <div className='text-sm text-purple-600'>学科数量</div>
            <div className='text-2xl font-bold text-purple-800'>
              {Object.keys(stats.subjectStats).length}
            </div>
          </div>
        </div>

        <div className='space-y-3'>
          <div className='text-sm font-medium text-gray-700'>各科平均成绩</div>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
            {Object.entries(stats.subjectStats).map(([subject, data]) => (
              <div key={subject} className='p-3 bg-gray-50 rounded-lg'>
                <div className='text-sm text-gray-500'>{subject}</div>
                <div className='text-lg font-bold text-gray-900'>{data.avg}</div>
                <div className='text-xs text-gray-400'>
                  {data.min}-{data.max} ({data.count}次)
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

const ExamScoresList: React.FC<{
  examScores: Record<string, ExamWithScores>;
  loading: boolean;
}> = ({ examScores, loading }) => {
  if (loading) {
    return (
      <Card>
        <div className='p-4 border-b border-gray-200'>
          <h3 className='font-medium text-gray-900 flex items-center gap-2'>
            <BookOpen className='w-5 h-5' />
            历次考试成绩
          </h3>
        </div>
        <div className='flex items-center justify-center py-12'>
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (Object.keys(examScores).length === 0) {
    return (
      <Card>
        <div className='p-4 border-b border-gray-200'>
          <h3 className='font-medium text-gray-900 flex items-center gap-2'>
            <BookOpen className='w-5 h-5' />
            历次考试成绩
          </h3>
        </div>
        <div className='text-center py-12 text-gray-500'>
          <BookOpen className='w-12 h-12 mx-auto mb-3 text-gray-300' />
          <p>暂无考试成绩记录</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className='p-4 border-b border-gray-200'>
        <h3 className='font-medium text-gray-900 flex items-center gap-2'>
          <BookOpen className='w-5 h-5' />
          历次考试成绩
        </h3>
      </div>
      <div className='p-4'>
        <div className='space-y-4'>
          {Object.entries(examScores).map(([examId, exam]) => {
            const scores = exam.scores || {};
            const scoreCount = Object.values(scores).filter((s) => s.score).length;

            return (
              <div key={examId} className='border border-gray-200 rounded-lg overflow-hidden'>
                <div className='px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between'>
                  <div>
                    <span className='font-medium'>{exam.exam_name}</span>
                    <span className='text-sm text-gray-500 ml-2'>
                      {exam.exam_time ? new Date(exam.exam_time).toLocaleDateString('zh-CN') : ''}
                    </span>
                  </div>
                  {scoreCount > 0 && (
                    <span className='px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                      已录入 {scoreCount} 科
                    </span>
                  )}
                </div>
                <div className='p-4'>
                  <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                    {Object.entries(scores).map(([subject, score]) => (
                      <div key={subject} className='p-3 bg-white border border-gray-100 rounded-lg'>
                        <div className='text-sm text-gray-500'>{subject}</div>
                        <div className='text-xl font-bold text-gray-900'>
                          {score.score !== undefined && score.score !== null ? score.score : '-'}
                        </div>
                        {score.rank && (
                          <div className='flex items-center gap-1 text-sm text-yellow-600'>
                            <Award className='w-3 h-3' />
                            排名 {score.rank}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

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

  const handleApiError = useCallback((error: unknown, message: string): void => {
    showToast('error', `${message}: ${(error as Error).message}`);
  }, [showToast]);

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

    const avgScore = count > 0 ? (totalScore / count).toFixed(2) : '—';

    const subjectStats: Record<string, { avg: string; max: number; min: number; count: number }> = {};
    Object.entries(subjectScores).forEach(([subject, scores]) => {
      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        subjectStats[subject] = {
          avg: avg.toFixed(2),
          max,
          min,
          count: scores.length,
        };
      }
    });

    return { avgScore, subjectStats, totalExams: Object.keys(examScores).length };
  }, [studentDetail, examScores]);

  const handleExportScores = useCallback(async (_format: 'excel' | 'csv'): Promise<Blob> => {
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
          <tr><td>姓名</td><td>${studentDetail.name}</td><td>学号</td><td>${studentDetail.card_id}</td></tr>
          <tr><td>班级</td><td>${studentDetail.class_name || ''}</td><td>当前积分</td><td>${studentDetail.current_score ?? ''}</td></tr>
          <tr><th colspan='4' style='background:#4472C4;color:white'>成绩概览</th></tr>
          <tr><td>平均成绩</td><td>${stats?.avgScore || '-'}</td><td>参加考试</td><td>${stats?.totalExams || 0}</td></tr>
          <tr><th colspan='4' style='background:#4472C4;color:white'>各科成绩</th></tr>
          <tr><th>科目</th><th>平均分</th><th>最低分</th><th>最高分</th></tr>
          ${stats ? Object.entries(stats.subjectStats).map(([subject, data]) =>
            `<tr><td>${subject}</td><td>${data.avg}</td><td>${data.min}</td><td>${data.max}</td></tr>`
          ).join('') : ''}
          <tr><th colspan='4' style='background:#4472C4;color:white'>历次考试成绩</th></tr>
          ${Object.entries(examScores).map(([examId, exam]) => {
            const scores = exam.scores || {};
            return `<tr><td colspan='4' style='background:#D6DCE4;font-weight:bold'>${exam.exam_name} (${exam.exam_time ? new Date(exam.exam_time).toLocaleDateString('zh-CN') : ''})</td></tr>` +
              Object.entries(scores).map(([subject, score]) =>
                `<tr><td>${subject}</td><td>${score.score ?? '-'}</td><td colspan='2'>${score.rank ? '排名 ' + score.rank : ''}</td></tr>`
              ).join('');
          }).join('')}
        </table>
      </body>
      </html>
    `;

    return new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  }, [studentDetail, stats, examScores]);

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
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>成绩档案</h1>
          <p className='text-gray-500 mt-1'>查看学生历次考试成绩记录</p>
        </div>
        {selectedStudent && studentDetail && (
          <ImportExportPanel
            type="score"
            showExport={true}
            showImport={false}
            showTemplate={false}
            onDataExport={handleExportScores}
            permissions={{
              export: 'score.export',
            }}
          />
        )}
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <StudentList
          students={students}
          selectedStudent={selectedStudent}
          classes={classes}
          selectedClass={selectedClass}
          searchInput={searchInput}
          onStudentSelect={setSelectedStudent}
          onClassChange={setSelectedClass}
          onSearchChange={setSearchInput}
        />

        <div className='lg:col-span-2 space-y-6'>
          {selectedStudent && studentDetail ? (
            <>
              <StudentInfoCard student={studentDetail} />
              {stats && <ScoreStatsCard stats={stats} />}
              <ExamScoresList examScores={examScores} loading={loading} />
            </>
          ) : (
            <Card className='text-center py-12'>
              <Users className='w-12 h-12 text-gray-300 mx-auto mb-3' />
              <h3 className='text-lg font-semibold text-gray-900 mb-2'>选择学生</h3>
              <p className='text-gray-500'>从左侧列表中选择学生查看成绩档案</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScoreRecords;
