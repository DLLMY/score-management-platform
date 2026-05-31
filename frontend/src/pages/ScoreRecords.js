import { useState, useEffect } from 'react';
import {
  Search,
  BookOpen,
  Award,
  Users,
} from 'lucide-react';
import { Card, Button, LoadingSpinner } from '../components';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

function ScoreRecords() {
  const { showToast } = useToast();
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [studentDetail, setStudentDetail] = useState(null);
  const [examScores, setExamScores] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const classesRes = await api.classes.getAll();
      setClasses(Array.isArray(classesRes) ? classesRes : classesRes.classes || []);
    } catch (err) {
      showToast('获取数据失败: ' + err.message, 'error');
    }
  };

  const fetchStudents = async () => {
    try {
      const usersRes = await api.users.getAll({ class_name: selectedClass });
      const allUsers = Array.isArray(usersRes) ? usersRes : usersRes.users || [];
      setStudents(allUsers.filter((u) => u.role === 'student'));
    } catch (err) {
      showToast('获取学生列表失败: ' + err.message, 'error');
    }
  };

  const fetchStudentDetail = async () => {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      const userRes = await api.users.getById(selectedStudent);
      setStudentDetail(userRes.user || userRes);

      const analysisRes = await api.scoreAnalysis.getStudentAnalysis(selectedStudent);
      setExamScores(analysisRes.exam_scores || {});
    } catch (err) {
      showToast('获取学生成绩失败: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [selectedClass]);

  useEffect(() => {
    if (selectedStudent) {
      fetchStudentDetail();
    }
  }, [selectedStudent]);

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.card_id?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const calculateStats = () => {
    if (!studentDetail || Object.keys(examScores).length === 0) return null;

    let totalScore = 0;
    let count = 0;
    const subjectScores = {};

    Object.values(examScores).forEach((exam) => {
      Object.values(exam.scores || {}).forEach((score) => {
        if (score.score) {
          totalScore += score.score;
          count++;
          if (!subjectScores[score.subject]) {
            subjectScores[score.subject] = [];
          }
          subjectScores[score.subject].push(score.score);
        }
      });
    });

    const avgScore = count > 0 ? (totalScore / count).toFixed(2) : '0';

    const subjectStats = {};
    Object.entries(subjectScores).forEach(([subject, scores]) => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const max = Math.max(...scores);
      const min = Math.min(...scores);
      subjectStats[subject] = {
        avg: avg.toFixed(2),
        max,
        min,
        count: scores.length,
      };
    });

    return { avgScore, subjectStats, totalExams: Object.keys(examScores).length };
  };

  const stats = calculateStats();

  return (
    <div className='p-6 space-y-6'>
      <div>
        <h1 className='text-2xl font-bold text-gray-900'>成绩档案</h1>
        <p className='text-gray-500 mt-1'>查看学生历次考试成绩记录</p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* 学生列表 */}
        <Card className='lg:col-span-1'>
          <div className='p-4 border-b border-gray-200'>
            <h3 className='font-medium text-gray-900'>学生列表</h3>
          </div>
          <div className='p-4 space-y-4'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400' />
              <input
                type='text'
                placeholder='搜索学生姓名或学号'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent w-full'
              />
            </div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>全部班级</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.name}>
                  {cls.name}
                </option>
              ))}
            </select>
            <div className='max-h-[600px] overflow-y-auto space-y-2'>
              {filteredStudents.map((student) => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudent(student.id.toString())}
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

        {/* 学生详情 */}
        <div className='lg:col-span-2 space-y-6'>
          {selectedStudent && studentDetail ? (
            <>
              {/* 学生信息卡片 */}
              <Card>
                <div className='p-4 border-b border-gray-200 flex items-center justify-between'>
                  <h3 className='font-medium text-gray-900'>学生信息</h3>
                  <span className='px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                    {studentDetail.class_name}
                  </span>
                </div>
                <div className='p-4 grid grid-cols-2 md:grid-cols-4 gap-4'>
                  <div className='p-4 bg-gray-50 rounded-lg'>
                    <div className='text-sm text-gray-500'>姓名</div>
                    <div className='font-medium text-gray-900'>{studentDetail.name}</div>
                  </div>
                  <div className='p-4 bg-gray-50 rounded-lg'>
                    <div className='text-sm text-gray-500'>学号</div>
                    <div className='font-medium text-gray-900'>{studentDetail.card_id}</div>
                  </div>
                  <div className='p-4 bg-gray-50 rounded-lg'>
                    <div className='text-sm text-gray-500'>性别</div>
                    <div className='font-medium text-gray-900'>{studentDetail.gender || '-'}</div>
                  </div>
                  <div className='p-4 bg-gray-50 rounded-lg'>
                    <div className='text-sm text-gray-500'>当前积分</div>
                    <div className='font-medium text-gray-900'>{studentDetail.current_score}</div>
                  </div>
                </div>
              </Card>

              {/* 统计卡片 */}
              {stats && (
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
              )}

              {/* 考试成绩列表 */}
              <Card>
                <div className='p-4 border-b border-gray-200'>
                  <h3 className='font-medium text-gray-900 flex items-center gap-2'>
                    <BookOpen className='w-5 h-5' />
                    历次考试成绩
                  </h3>
                </div>
                <div className='p-4'>
                  {loading ? (
                    <div className='flex items-center justify-center py-12'>
                      <LoadingSpinner />
                    </div>
                  ) : Object.keys(examScores).length === 0 ? (
                    <div className='text-center py-12 text-gray-500'>
                      <BookOpen className='w-12 h-12 mx-auto mb-3 text-gray-300' />
                      <p>暂无考试成绩记录</p>
                    </div>
                  ) : (
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
                  )}
                </div>
              </Card>
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
}

export default ScoreRecords;
