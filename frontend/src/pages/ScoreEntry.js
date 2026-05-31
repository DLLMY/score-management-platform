import { useState, useEffect } from 'react';
import {
  Upload,
  CheckCircle,
  Download,
  RefreshCw,
  Edit2,
  Save,
  Users,
} from 'lucide-react';
import { Card, Button, Modal, LoadingSpinner } from '../components';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

function ScoreEntry() {
  const { showToast } = useToast();
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [editingCell, setEditingCell] = useState(null);

  const fetchData = async () => {
    try {
      const [examsRes, classesRes] = await Promise.all([
        api.exams.getAll(),
        api.classes.getAll(),
      ]);

      const allExams = Array.isArray(examsRes) ? examsRes : examsRes.data || [];
      setExams(allExams.filter((e) => e.status === 'published'));
      setClasses(Array.isArray(classesRes) ? classesRes : classesRes.classes || []);
    } catch (err) {
      showToast('获取数据失败: ' + err.message, 'error');
    }
  };

  const fetchStudentsAndScores = async () => {
    if (!selectedExam) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedClass) params.append('class_name', selectedClass);
      const usersRes = await api.users.getAll({ class_name: selectedClass });
      const allUsers = Array.isArray(usersRes) ? usersRes : usersRes.users || [];
      setStudents(allUsers.filter((u) => u.role === 'student'));

      const scoresRes = await api.scores.getAll({ exam_id: selectedExam });
      const scoresList = Array.isArray(scoresRes) ? scoresRes : scoresRes.data || [];
      
      const scoresMap = {};
      scoresList.forEach((score) => {
        const key = `${score.student_id}-${score.subject}`;
        scoresMap[key] = score;
      });
      setScores(scoresMap);
    } catch (err) {
      showToast('获取数据失败: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedExam) {
      fetchStudentsAndScores();
    }
  }, [selectedExam, selectedClass]);

  const getExamSubjects = () => {
    const exam = exams.find((e) => e.id.toString() === selectedExam);
    if (!exam) return [];
    return Array.isArray(exam.subjects) ? exam.subjects : exam.subjects?.split(',') || [];
  };

  const getScore = (studentId, subject) => {
    const key = `${studentId}-${subject}`;
    return scores[key];
  };

  const handleScoreChange = (studentId, subject, value) => {
    const key = `${studentId}-${subject}`;
    const score = parseFloat(value);
    
    if (!isNaN(score) && score >= 0 && score <= 100) {
      setScores((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          score: score,
        },
      }));
    } else if (value === '') {
      setScores((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          score: null,
        },
      }));
    }
  };

  const saveScore = async (studentId, subject) => {
    const key = `${studentId}-${subject}`;
    const data = scores[key];
    
    if (!data || data.score === undefined || data.score === null) return;
    
    try {
      if (data.id) {
        await api.scores.update(data.id, { score: data.score });
      } else {
        await api.scores.create({
          exam_id: parseInt(selectedExam),
          student_id: studentId,
          subject,
          score: data.score,
        });
      }
      showToast('保存成功');
    } catch (err) {
      showToast('保存失败: ' + err.message, 'error');
    }
  };

  const handleImport = async () => {
    if (!importFile || !selectedExam) return;
    
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('exam_id', selectedExam);
    
    try {
      await api.scores.importScores(formData);
      showToast('导入成功');
      setShowImportModal(false);
      fetchStudentsAndScores();
    } catch (err) {
      showToast('导入失败: ' + err.message, 'error');
    }
  };

  const handleConfirmAll = async () => {
    try {
      await api.scores.confirmAll(selectedExam);
      showToast('确认成功');
      fetchStudentsAndScores();
    } catch (err) {
      showToast('确认失败: ' + err.message, 'error');
    }
  };

  const getEntryProgress = () => {
    const subjects = getExamSubjects();
    if (students.length === 0 || subjects.length === 0) return 0;
    
    let filled = 0;
    let total = students.length * subjects.length;
    
    students.forEach((student) => {
      subjects.forEach((subject) => {
        const key = `${student.id}-${subject}`;
        if (scores[key]?.score !== undefined && scores[key]?.score !== null) {
          filled++;
        }
      });
    });
    
    return Math.round((filled / total) * 100);
  };

  const exportTemplate = () => {
    const subjects = getExamSubjects();
    let csv = '学号,科目,分数\n';
    
    students.forEach((student) => {
      subjects.forEach((subject) => {
        csv += `${student.card_id},${subject},\n`;
      });
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '成绩导入模板.csv';
    link.click();
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      locked: 'bg-gray-100 text-gray-800',
    };
    const labels = {
      pending: '待确认',
      confirmed: '已确认',
      locked: '已锁定',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  const selectedExamData = exams.find((e) => e.id.toString() === selectedExam);

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>成绩录入</h1>
          <p className='text-gray-500 mt-1'>录入和管理学生考试成绩</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='secondary' onClick={exportTemplate}>
            <Download className='w-4 h-4 mr-2' />
            下载模板
          </Button>
          <Button onClick={() => setShowImportModal(true)}>
            <Upload className='w-4 h-4 mr-2' />
            导入成绩
          </Button>
        </div>
      </div>

      {/* 筛选栏 */}
      <Card>
        <div className='flex flex-wrap gap-4 items-center'>
          <div className='flex-1 min-w-[240px]'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>选择考试 *</label>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>请选择考试</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id.toString()}>
                  {exam.name}
                </option>
              ))}
            </select>
          </div>
          <div className='w-48'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>筛选班级</label>
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
          </div>
          {selectedExam && selectedExamData && (
            <div className='text-sm text-gray-500'>
              考试时间: {selectedExamData.start_time ? new Date(selectedExamData.start_time).toLocaleString('zh-CN') : '-'}
            </div>
          )}
          <Button variant='ghost' onClick={fetchStudentsAndScores}>
            <RefreshCw className='w-4 h-4 mr-2' />
            刷新
          </Button>
        </div>
      </Card>

      {selectedExam && (
        <Card>
          {/* 进度条和操作 */}
          <div className='flex items-center justify-between p-4 border-b border-gray-200'>
            <div className='flex items-center gap-4'>
              <span className='text-sm text-gray-500'>录入进度</span>
              <div className='w-64 h-2 bg-gray-200 rounded-full overflow-hidden'>
                <div
                  className='h-full bg-primary-500 transition-all duration-300'
                  style={{ width: `${getEntryProgress()}%` }}
                />
              </div>
              <span className='text-sm font-medium text-gray-700'>{getEntryProgress()}%</span>
            </div>
            <Button onClick={handleConfirmAll} className='bg-green-500 hover:bg-green-600'>
              <CheckCircle className='w-4 h-4 mr-2' />
              全部确认
            </Button>
          </div>

          {/* 成绩表格 */}
          <div className='overflow-x-auto'>
            {loading ? (
              <div className='flex items-center justify-center py-12'>
                <LoadingSpinner />
              </div>
            ) : students.length === 0 ? (
              <div className='text-center py-12 text-gray-500'>
                <Users className='w-12 h-12 mx-auto mb-3 text-gray-300' />
                <p>暂无学生数据</p>
              </div>
            ) : (
              <table className='min-w-full divide-y divide-gray-200'>
                <thead className='bg-gray-50'>
                  <tr>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                      学号
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                      姓名
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                      班级
                    </th>
                    {getExamSubjects().map((subject) => (
                      <th key={subject} className='px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase'>
                        {subject}
                      </th>
                    ))}
                    <th className='px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase'>
                      状态
                    </th>
                  </tr>
                </thead>
                <tbody className='bg-white divide-y divide-gray-200'>
                  {students.map((student) => {
                    const hasAnyScore = getExamSubjects().some((subject) => {
                      const key = `${student.id}-${subject}`;
                      return scores[key]?.score !== undefined && scores[key]?.score !== null;
                    });

                    let overallStatus = 'empty';
                    if (getExamSubjects().every((subject) => {
                      const key = `${student.id}-${subject}`;
                      return scores[key]?.status === 'confirmed';
                    })) {
                      overallStatus = 'confirmed';
                    } else if (getExamSubjects().some((subject) => {
                      const key = `${student.id}-${subject}`;
                      return scores[key]?.status === 'pending';
                    })) {
                      overallStatus = 'pending';
                    } else if (hasAnyScore) {
                      overallStatus = 'partial';
                    }

                    return (
                      <tr key={student.id} className='hover:bg-gray-50'>
                        <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900'>
                          {student.card_id}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                          {student.name}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                          {student.class_name}
                        </td>
                        {getExamSubjects().map((subject) => {
                          const key = `${student.id}-${subject}`;
                          const score = scores[key];
                          const isEditing = editingCell === key;

                          return (
                            <td key={subject} className='px-6 py-4 whitespace-nowrap text-center'>
                              {isEditing ? (
                                <div className='flex items-center justify-center gap-2'>
                                  <input
                                    type='number'
                                    min='0'
                                    max='100'
                                    step='0.5'
                                    value={score?.score || ''}
                                    onChange={(e) => handleScoreChange(student.id, subject, e.target.value)}
                                    className='w-20 text-center px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                                    autoFocus
                                    onBlur={() => {
                                      setEditingCell(null);
                                      saveScore(student.id, subject);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        setEditingCell(null);
                                        saveScore(student.id, subject);
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCell(key)}
                                  className='inline-block min-w-[60px] px-2 py-1 rounded hover:bg-gray-100'
                                >
                                  {score?.score !== undefined && score?.score !== null ? (
                                    <span className={`font-medium ${score.status === 'confirmed' ? 'text-green-600' : 'text-gray-900'}`}>
                                      {score.score}
                                    </span>
                                  ) : (
                                    <span className='text-gray-300'>-</span>
                                  )}
                                </button>
                              )}
                            </td>
                          );
                        })}
                        <td className='px-6 py-4 whitespace-nowrap text-center'>
                          {overallStatus === 'confirmed' && getStatusBadge('confirmed')}
                          {overallStatus === 'pending' && getStatusBadge('pending')}
                          {overallStatus === 'partial' && (
                            <span className='px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                              部分录入
                            </span>
                          )}
                          {overallStatus === 'empty' && (
                            <span className='px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500'>
                              未录入
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      {!selectedExam && (
        <Card className='text-center py-12'>
          <Edit2 className='w-12 h-12 text-gray-300 mx-auto mb-3' />
          <h3 className='text-lg font-semibold text-gray-900 mb-2'>请选择考试</h3>
          <p className='text-gray-500'>选择一个已发布的考试开始录入成绩</p>
        </Card>
      )}

      {/* 导入弹窗 */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title='导入成绩'
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>选择文件</label>
            <input
              type='file'
              accept='.xlsx,.xls,.csv'
              onChange={(e) => setImportFile(e.target.files[0])}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            />
          </div>
          <p className='text-sm text-gray-500'>
            支持格式: Excel (.xlsx, .xls), CSV (.csv)
          </p>
          <div className='flex justify-end gap-3 pt-4'>
            <Button variant='secondary' onClick={() => setShowImportModal(false)}>
              取消
            </Button>
            <Button onClick={handleImport}>
              <Upload className='w-4 h-4 mr-2' />
              导入
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ScoreEntry;
