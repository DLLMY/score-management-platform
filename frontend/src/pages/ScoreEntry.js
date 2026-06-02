import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { Card, Button, Modal, LoadingSpinner } from '../components';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

// 提取需要的图标
const {
  Upload,
  CheckCircle,
  Download,
  RefreshCw,
  Edit2,
  Save,
  Users,
  Printer,
  Trash2,
  Filter,
  BarChart3,
  AlertCircle,
  RotateCcw,
  Copy
} = LucideIcons;

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
  const [filterSubject, setFilterSubject] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [batchSubject, setBatchSubject] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showImportResultModal, setShowImportResultModal] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [pendingChanges, setPendingChanges] = useState({});
  const tableRef = useRef(null);
  const editingInputRef = useRef(null);

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
      const usersRes = await api.users.getAll({ class_name: selectedClass, skipCache: true });
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
      setPendingChanges({});
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

  const getVisibleSubjects = () => {
    const allSubjects = getExamSubjects();
    if (!filterSubject) return allSubjects;
    return allSubjects.filter((s) => s === filterSubject);
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
      setPendingChanges((prev) => ({
        ...prev,
        [key]: { student_id: studentId, subject, score },
      }));
    } else if (value === '') {
      setScores((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          score: null,
        },
      }));
      setPendingChanges((prev) => {
        const newChanges = { ...prev };
        delete newChanges[key];
        return newChanges;
      });
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
        const result = await api.scores.create({
          exam_id: parseInt(selectedExam),
          student_id: studentId,
          subject,
          score: data.score,
        });
        setScores((prev) => ({
          ...prev,
          [key]: { ...prev[key], id: result.id || result.data?.id },
        }));
      }
      setPendingChanges((prev) => {
        const newChanges = { ...prev };
        delete newChanges[key];
        return newChanges;
      });
      showToast('保存成功');
    } catch (err) {
      showToast('保存失败: ' + err.message, 'error');
    }
  };

  const handleSaveAll = async () => {
    const keys = Object.keys(pendingChanges);
    if (keys.length === 0) {
      showToast('没有待保存的更改', 'info');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const key of keys) {
      const { student_id, subject, score } = pendingChanges[key];
      try {
        const existingScore = scores[key];
        if (existingScore?.id) {
          await api.scores.update(existingScore.id, { score });
        } else {
          await api.scores.create({
            exam_id: parseInt(selectedExam),
            student_id,
            subject,
            score,
          });
        }
        successCount++;
      } catch (err) {
        failCount++;
        console.error(`保存失败 [${key}]:`, err);
      }
    }

    if (failCount === 0) {
      showToast(`已保存 ${successCount} 条成绩`);
    } else {
      showToast(`保存完成: ${successCount} 成功, ${failCount} 失败`, 'error');
    }

    setPendingChanges({});
    fetchStudentsAndScores();
  };

  const handleImport = async () => {
    if (!importFile || !selectedExam) return;

    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('exam_id', selectedExam);

    try {
      const result = await api.scores.importScores(formData);
      const resultData = result.data || result;
      setImportResult({
        successCount: resultData.success_count || 0,
        failedCount: resultData.failed_count || 0,
        failedMessages: resultData.failed_messages || [],
      });
      setShowImportModal(false);
      setShowImportResultModal(true);
      setImportFile(null);
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

  const handleBatchDelete = async () => {
    if (!batchSubject) {
      showToast('请选择要操作的科目', 'error');
      return;
    }

    const confirmDelete = window.confirm(`确定要删除所有学生的 ${batchSubject} 成绩吗？`);
    if (!confirmDelete) return;

    try {
      const keysToDelete = Object.keys(scores).filter((key) => key.endsWith(`-${batchSubject}`));
      let deletedCount = 0;

      for (const key of keysToDelete) {
        const scoreData = scores[key];
        if (scoreData?.id) {
          await api.scores.delete(scoreData.id);
          deletedCount++;
        }
      }

      showToast(`已删除 ${deletedCount} 条 ${batchSubject} 成绩`);
      setShowBatchModal(false);
      setBatchSubject('');
      fetchStudentsAndScores();
    } catch (err) {
      showToast('批量删除失败: ' + err.message, 'error');
    }
  };

  const handleBatchReset = async () => {
    if (!batchSubject) {
      showToast('请选择要重置的科目', 'error');
      return;
    }

    const confirmReset = window.confirm(`确定要重置所有学生的 ${batchSubject} 成绩为空吗？`);
    if (!confirmReset) return;

    try {
      const keysToReset = Object.keys(scores).filter((key) => key.endsWith(`-${batchSubject}`));

      for (const key of keysToReset) {
        const scoreData = scores[key];
        if (scoreData?.id) {
          await api.scores.delete(scoreData.id);
        }
      }

      showToast(`已重置 ${keysToReset.length} 条 ${batchSubject} 成绩`);
      setShowBatchModal(false);
      setBatchSubject('');
      fetchStudentsAndScores();
    } catch (err) {
      showToast('批量重置失败: ' + err.message, 'error');
    }
  };

  const handleBatchConfirm = async () => {
    if (!batchSubject) {
      showToast('请选择要确认的科目', 'error');
      return;
    }

    try {
      let confirmedCount = 0;
      const keysToConfirm = Object.keys(scores).filter(
        (key) => key.endsWith(`-${batchSubject}`) && scores[key]?.score !== undefined && scores[key]?.score !== null
      );

      for (const key of keysToConfirm) {
        const scoreData = scores[key];
        if (scoreData?.id) {
          await api.scores.update(scoreData.id, { score: scoreData.score });
          confirmedCount++;
        }
      }

      showToast(`已确认 ${confirmedCount} 条 ${batchSubject} 成绩`);
      setShowBatchModal(false);
      setBatchSubject('');
      fetchStudentsAndScores();
    } catch (err) {
      showToast('批量确认失败: ' + err.message, 'error');
    }
  };

  const handleCopyLastScore = async () => {
    if (!batchSubject) {
      showToast('请选择要复制成绩的科目', 'error');
      return;
    }

    const confirmCopy = window.confirm(`确定要复制上次考试中所有学生的 ${batchSubject} 成绩到当前考试吗？`);
    if (!confirmCopy) return;

    showToast('复制功能开发中，敬请期待', 'info');
  };

  const getEntryProgress = () => {
    const subjects = getVisibleSubjects();
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

  const getFilteredStudents = () => {
    let filtered = students;

    if (statusFilter) {
      filtered = filtered.filter((student) => {
        const subjects = getVisibleSubjects();
        const hasAnyScore = subjects.some(
          (subject) => scores[`${student.id}-${subject}`]?.score !== undefined && scores[`${student.id}-${subject}`]?.score !== null
        );

        const allConfirmed = subjects.every(
          (subject) => scores[`${student.id}-${subject}`]?.status === 'confirmed'
        );

        const somePending = subjects.some(
          (subject) => scores[`${student.id}-${subject}`]?.status === 'pending'
        );

        if (statusFilter === 'confirmed') return allConfirmed;
        if (statusFilter === 'pending') return somePending && !allConfirmed;
        if (statusFilter === 'partial') return hasAnyScore && !allConfirmed && !somePending;
        if (statusFilter === 'empty') return !hasAnyScore;

        return true;
      });
    }

    return filtered;
  };

  const handlePrint = () => {
    window.print();
  };

  const exportTemplate = async () => {
    try {
      const baseUrl = '/api/scores/template/download';
      const params = new URLSearchParams();
      if (selectedClass) params.append('class_name', selectedClass);
      if (selectedExam) params.append('exam_id', selectedExam);

      const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('下载模板失败');
      }

      const blob = await response.blob();
      const urlObject = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlObject;
      a.download = `score_import_template_${selectedClass || 'all'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(urlObject);
    } catch (error) {
      console.error('下载模板失败:', error);
      showToast('下载模板失败: ' + error.message, 'error');
    }
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

  const handleKeyDown = useCallback(
    (e) => {
      if (!editingCell) return;

      if (e.key === 'Escape') {
        setEditingCell(null);
        return;
      }

      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSaveAll();
        return;
      }
    },
    [editingCell, pendingChanges]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const selectedExamData = exams.find((e) => e.id.toString() === selectedExam);
  const filteredStudents = getFilteredStudents();
  const visibleSubjects = getVisibleSubjects();

  return (
    <div className='p-6 space-y-6'>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { font-size: 12px; }
          table { font-size: 11px; }
          .overflow-x-auto { overflow: visible !important; }
        }
        .print-only { display: none; }
      `}</style>

      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>成绩录入</h1>
          <p className='text-gray-500 mt-1'>录入和管理学生考试成绩</p>
        </div>
        <div className='flex gap-2 no-print'>
          <Button variant='secondary' onClick={exportTemplate}>
            <Download className='w-4 h-4 mr-2' />
            下载模板
          </Button>
          <Button variant='secondary' onClick={() => setShowBatchModal(true)}>
            <Filter className='w-4 h-4 mr-2' />
            批量操作
          </Button>
          <Button variant='secondary' onClick={handlePrint}>
            <Printer className='w-4 h-4 mr-2' />
            打印
          </Button>
          <Button onClick={() => setShowImportModal(true)}>
            <Upload className='w-4 h-4 mr-2' />
            导入
          </Button>
        </div>
      </div>

      <Card>
        <div className='flex flex-wrap gap-4 items-center'>
          <div className='flex-1 min-w-[240px]'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              选择考试 *
            </label>
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
          <div className='w-40'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>筛选科目</label>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>全部科目</option>
              {getExamSubjects().map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>
          <div className='w-36'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>状态筛选</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>全部</option>
              <option value='empty'>未录入</option>
              <option value='partial'>部分录入</option>
              <option value='pending'>待确认</option>
              <option value='confirmed'>已确认</option>
            </select>
          </div>
          {selectedExam && selectedExamData && (
            <div className='text-sm text-gray-500'>
              考试时间:{' '}
              {selectedExamData.start_time
                ? new Date(selectedExamData.start_time).toLocaleString('zh-CN')
                : '-'}
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
          <div className='flex items-center justify-between p-4 border-b border-gray-200 no-print'>
            <div className='flex items-center gap-4'>
              <span className='text-sm text-gray-500'>录入进度</span>
              <div className='w-64 h-2 bg-gray-200 rounded-full overflow-hidden'>
                <div
                  className='h-full bg-primary-500 transition-all duration-300'
                  style={{ width: `${getEntryProgress()}%` }}
                />
              </div>
              <span className='text-sm font-medium text-gray-700'>{getEntryProgress()}%</span>
              {Object.keys(pendingChanges).length > 0 && (
                <span className='text-sm text-orange-500'>
                  ({Object.keys(pendingChanges).length} 条待保存)
                </span>
              )}
            </div>
            <div className='flex gap-2'>
              {getEntryProgress() === 100 && (
                <Button
                  variant='secondary'
                  onClick={() => {
                    window.location.href = `/score-analysis?exam_id=${selectedExam}`;
                  }}
                >
                  <BarChart3 className='w-4 h-4 mr-2' />
                  查看分析
                </Button>
              )}
              <Button
                variant='secondary'
                onClick={handleSaveAll}
                disabled={Object.keys(pendingChanges).length === 0}
              >
                <Save className='w-4 h-4 mr-2' />
                保存全部
              </Button>
              <Button onClick={handleConfirmAll} className='bg-green-500 hover:bg-green-600'>
                <CheckCircle className='w-4 h-4 mr-2' />
                全部确认
              </Button>
            </div>
          </div>

          <div className='print-only mb-4'>
            <h2 className='text-lg font-bold'>{selectedExamData?.name}</h2>
            <p>
              班级: {selectedClass || '全部'} | 科目: {filterSubject || '全部'} | 打印时间:{' '}
              {new Date().toLocaleString('zh-CN')}
            </p>
          </div>

          <div className='overflow-x-auto'>
            {loading ? (
              <div className='flex items-center justify-center py-12'>
                <LoadingSpinner />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className='text-center py-12 text-gray-500'>
                <Users className='w-12 h-12 mx-auto mb-3 text-gray-300' />
                <p>暂无学生数据</p>
              </div>
            ) : (
              <table className='min-w-full divide-y divide-gray-200' ref={tableRef}>
                <thead className='bg-gray-50'>
                  <tr>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      学号
                    </th>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      姓名
                    </th>
                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      班级
                    </th>
                    {visibleSubjects.map((subject) => (
                      <th
                        key={subject}
                        className='px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider'
                      >
                        {subject}
                      </th>
                    ))}
                    <th className='px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider no-print'>
                      状态
                    </th>
                  </tr>
                </thead>
                <tbody className='bg-white divide-y divide-gray-200'>
                  {filteredStudents.map((student) => {
                    const hasAnyScore = visibleSubjects.some(
                      (subject) =>
                        scores[`${student.id}-${subject}`]?.score !== undefined &&
                        scores[`${student.id}-${subject}`]?.score !== null
                    );

                    let overallStatus = 'empty';
                    if (
                      visibleSubjects.every(
                        (subject) => scores[`${student.id}-${subject}`]?.status === 'confirmed'
                      )
                    ) {
                      overallStatus = 'confirmed';
                    } else if (
                      visibleSubjects.some(
                        (subject) => scores[`${student.id}-${subject}`]?.status === 'pending'
                      )
                    ) {
                      overallStatus = 'pending';
                    } else if (hasAnyScore) {
                      overallStatus = 'partial';
                    }

                    return (
                      <tr key={student.id} className='hover:bg-gray-50'>
                        <td className='px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900'>
                          {student.card_id}
                        </td>
                        <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-900'>
                          {student.name}
                        </td>
                        <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-500'>
                          {student.class_name}
                        </td>
                        {visibleSubjects.map((subject) => {
                          const key = `${student.id}-${subject}`;
                          const score = scores[key];
                          const isEditing = editingCell === key;
                          const hasPendingChange = pendingChanges[key];

                          return (
                            <td
                              key={subject}
                              className='px-4 py-3 whitespace-nowrap text-center'
                            >
                              {isEditing ? (
                                <input
                                  ref={editingInputRef}
                                  type='number'
                                  min='0'
                                  max='100'
                                  step='0.5'
                                  value={score?.score ?? ''}
                                  onChange={(e) =>
                                    handleScoreChange(student.id, subject, e.target.value)
                                  }
                                  className='w-20 text-center px-2 py-1 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                                  autoFocus
                                  onBlur={() => {
                                    setEditingCell(null);
                                    saveScore(student.id, subject);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      setEditingCell(null);
                                      saveScore(student.id, subject);
                                    } else if (e.key === 'Tab') {
                                      e.preventDefault();
                                      setEditingCell(null);
                                      saveScore(student.id, subject);
                                    }
                                  }}
                                />
                              ) : (
                                <button
                                  onClick={() => setEditingCell(key)}
                                  className={`inline-block min-w-[60px] px-2 py-1 rounded hover:bg-gray-100 ${
                                    hasPendingChange ? 'bg-orange-50' : ''
                                  }`}
                                >
                                  {score?.score !== undefined && score?.score !== null ? (
                                    <span
                                      className={`font-medium ${
                                        score.status === 'confirmed'
                                          ? 'text-green-600'
                                          : 'text-gray-900'
                                      }`}
                                    >
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
                        <td className='px-4 py-3 whitespace-nowrap text-center no-print'>
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

      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title='导入成绩'>
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
          <p className='text-sm text-gray-500'>支持格式: Excel (.xlsx, .xls), CSV (.csv)</p>
          <p className='text-sm text-gray-500'>
            模板包含学号、姓名、科目和分数列，请按模板格式填写。
          </p>
          <div className='flex justify-end gap-3 pt-4'>
            <Button variant='secondary' onClick={() => setShowImportModal(false)}>
              取消
            </Button>
            <Button onClick={handleImport} disabled={!importFile}>
              <Upload className='w-4 h-4 mr-2' />
              导入
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        title='批量操作'
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>选择科目</label>
            <select
              value={batchSubject}
              onChange={(e) => setBatchSubject(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>请选择科目</option>
              {getExamSubjects().map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          <div className='border-t pt-4 space-y-3'>
            <p className='text-sm font-medium text-gray-700'>批量操作</p>

            <Button
              variant='secondary'
              className='w-full justify-start'
              onClick={handleBatchConfirm}
              disabled={!batchSubject}
            >
              <CheckCircle className='w-4 h-4 mr-2' />
              批量确认该科目成绩
            </Button>

            <Button
              variant='secondary'
              className='w-full justify-start'
              onClick={handleCopyLastScore}
              disabled={!batchSubject}
            >
              <Copy className='w-4 h-4 mr-2' />
              复制上次考试的成绩
            </Button>

            <Button
              variant='secondary'
              className='w-full justify-start text-orange-600 hover:text-orange-700'
              onClick={handleBatchReset}
              disabled={!batchSubject}
            >
              <RotateCcw className='w-4 h-4 mr-2' />
              重置该科目成绩为空
            </Button>

            <Button
              variant='secondary'
              className='w-full justify-start text-red-600 hover:text-red-700'
              onClick={handleBatchDelete}
              disabled={!batchSubject}
            >
              <Trash2 className='w-4 h-4 mr-2' />
              删除该科目所有成绩
            </Button>
          </div>

          <div className='flex justify-end pt-4'>
            <Button variant='secondary' onClick={() => setShowBatchModal(false)}>
              关闭
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showImportResultModal}
        onClose={() => setShowImportResultModal(false)}
        title='导入结果'
      >
        <div className='space-y-4'>
          {importResult && (
            <>
              <div className='flex items-center gap-4'>
                <div className='flex-1 text-center'>
                  <p className='text-2xl font-bold text-green-600'>
                    {importResult.successCount}
                  </p>
                  <p className='text-sm text-gray-500'>成功</p>
                </div>
                <div className='flex-1 text-center'>
                  <p className='text-2xl font-bold text-red-600'>
                    {importResult.failedCount}
                  </p>
                  <p className='text-sm text-gray-500'>失败</p>
                </div>
              </div>

              {importResult.failedMessages.length > 0 && (
                <div className='mt-4'>
                  <p className='text-sm font-medium text-gray-700 mb-2'>失败详情:</p>
                  <div className='max-h-48 overflow-y-auto bg-red-50 rounded-lg p-3'>
                    {importResult.failedMessages.map((msg, idx) => (
                      <p key={idx} className='text-sm text-red-600'>
                        <AlertCircle className='w-3 h-3 inline mr-1' />
                        {msg}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className='flex justify-end pt-4'>
            <Button onClick={() => setShowImportResultModal(false)}>关闭</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ScoreEntry;
