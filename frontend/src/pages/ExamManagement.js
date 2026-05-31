import { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { Card, Button, Modal, LoadingSpinner } from '../components';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

function ExamManagement() {
  const { showToast } = useToast();
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingExam, setEditingExam] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subjects: '语文,数学,英语',
    start_time: '',
    end_time: '',
    importance: 'medium',
    class_id: '',
    status: 'draft',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [examsRes, classesRes] = await Promise.all([
        api.exams.getAll(),
        api.classes.getAll(),
      ]);
      
      setExams(Array.isArray(examsRes) ? examsRes : examsRes.data || []);
      setClasses(Array.isArray(classesRes) ? classesRes : classesRes.classes || []);
    } catch (err) {
      showToast('获取数据失败: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateExam = () => {
    setEditingExam(null);
    setFormData({
      name: '',
      description: '',
      subjects: '语文,数学,英语',
      start_time: '',
      end_time: '',
      importance: 'medium',
      class_id: '',
      status: 'draft',
    });
    setShowModal(true);
  };

  const handleEditExam = (exam) => {
    setEditingExam(exam);
    setFormData({
      name: exam.name || '',
      description: exam.description || '',
      subjects: exam.subjects ? (Array.isArray(exam.subjects) ? exam.subjects.join(',') : exam.subjects) : '',
      start_time: exam.start_time ? new Date(exam.start_time).toISOString().slice(0, 16) : '',
      end_time: exam.end_time ? new Date(exam.end_time).toISOString().slice(0, 16) : '',
      importance: exam.importance || 'medium',
      class_id: exam.class_id || '',
      status: exam.status || 'draft',
    });
    setShowModal(true);
  };

  const handleSaveExam = async () => {
    if (!formData.name) {
      showToast('请输入考试名称', 'error');
      return;
    }

    if (!formData.start_time || !formData.end_time) {
      showToast('请选择开始和结束时间', 'error');
      return;
    }

    try {
      const data = {
        ...formData,
        subjects: formData.subjects.split(',').map((s) => s.trim()).filter(Boolean),
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
      };

      if (editingExam) {
        await api.exams.update(editingExam.id, data);
        showToast('考试更新成功');
      } else {
        await api.exams.create(data);
        showToast('考试创建成功');
      }

      setShowModal(false);
      fetchData();
    } catch (err) {
      showToast('保存失败: ' + err.message, 'error');
    }
  };

  const handlePublishExam = async (exam) => {
    if (!window.confirm(`确定要发布考试 ${exam.name} 吗？`)) return;
    try {
      await api.exams.update(exam.id, { status: 'published' });
      showToast('考试发布成功');
      fetchData();
    } catch (err) {
      showToast('发布失败: ' + err.message, 'error');
    }
  };

  const handleCloseExam = async (exam) => {
    if (!window.confirm(`确定要结束考试 ${exam.name} 吗？`)) return;
    try {
      await api.exams.update(exam.id, { status: 'closed' });
      showToast('考试已结束');
      fetchData();
    } catch (err) {
      showToast('操作失败: ' + err.message, 'error');
    }
  };

  const handleDeleteExam = async (exam) => {
    if (!window.confirm(`确定要删除考试 ${exam.name} 吗？`)) return;
    try {
      await api.exams.delete(exam.id);
      showToast('考试删除成功');
      fetchData();
    } catch (err) {
      showToast('删除失败: ' + err.message, 'error');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      published: 'bg-green-100 text-green-800',
      closed: 'bg-blue-100 text-blue-800',
    };
    const labels = {
      draft: '草稿',
      published: '进行中',
      closed: '已结束',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getImportanceBadge = (importance) => {
    const styles = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    };
    const labels = {
      low: '低',
      medium: '中',
      high: '高',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[importance] || styles.medium}`}>
        {labels[importance] || importance}
      </span>
    );
  };

  const filteredExams = exams.filter((exam) => {
    const matchesSearch = exam.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = !selectedClass || exam.class_id === parseInt(selectedClass);
    return matchesSearch && matchesClass;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>考试管理</h1>
          <p className='text-gray-500 mt-1'>创建和管理考试安排</p>
        </div>
        <Button onClick={handleCreateExam}>
          <Plus className='w-4 h-4 mr-2' />
          新建考试
        </Button>
      </div>

      {/* 筛选栏 */}
      <Card>
        <div className='flex flex-wrap gap-4 items-center'>
          <div className='relative flex-1 min-w-[240px]'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400' />
            <input
              type='text'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className='pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent w-full'
              placeholder='搜索考试...'
            />
          </div>
          <div className='flex items-center gap-2'>
            <Filter className='w-4 h-4 text-gray-400' />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className='px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>全部班级</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* 考试列表 */}
      <Card>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                  考试信息
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                  科目
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                  时间
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                  状态
                </th>
                <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase'>
                  操作
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {filteredExams.length > 0 ? (
                filteredExams.map((exam) => (
                  <tr key={exam.id} className='hover:bg-gray-50'>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center'>
                        <div className='flex-shrink-0 h-10 w-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center'>
                          <Calendar className='w-5 h-5 text-white' />
                        </div>
                        <div className='ml-4'>
                          <div className='text-sm font-medium text-gray-900'>
                            {exam.name}
                          </div>
                          <div className='text-sm text-gray-500'>
                            {exam.class_name || '全部班级'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className='px-6 py-4'>
                      <div className='text-sm text-gray-900'>
                        {Array.isArray(exam.subjects) ? exam.subjects.join(', ') : exam.subjects || '-'}
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='text-sm text-gray-900'>
                        <div className='flex items-center gap-1'>
                          <Clock className='w-4 h-4 text-gray-400' />
                          {exam.start_time ? new Date(exam.start_time).toLocaleString('zh-CN') : '-'}
                        </div>
                        {exam.end_time && (
                          <div className='text-gray-500 text-xs mt-1'>
                            至 {new Date(exam.end_time).toLocaleString('zh-CN')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center gap-2'>
                        {getStatusBadge(exam.status)}
                        {getImportanceBadge(exam.importance)}
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
                      {exam.status === 'draft' && (
                        <>
                          <Button variant='secondary' size='sm' onClick={() => handleEditExam(exam)}>
                            <Edit2 className='w-4 h-4' />
                          </Button>
                          <Button size='sm' onClick={() => handlePublishExam(exam)}>
                            <CheckCircle className='w-4 h-4' />
                          </Button>
                          <Button variant='danger' size='sm' onClick={() => handleDeleteExam(exam)}>
                            <Trash2 className='w-4 h-4' />
                          </Button>
                        </>
                      )}
                      {exam.status === 'published' && (
                        <Button variant='secondary' size='sm' onClick={() => handleCloseExam(exam)}>
                          <XCircle className='w-4 h-4' />
                        </Button>
                      )}
                      {exam.status === 'closed' && (
                        <Button variant='secondary' size='sm' onClick={() => handleEditExam(exam)}>
                          <Edit2 className='w-4 h-4' />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className='px-6 py-12 text-center text-gray-500'>
                    <Calendar className='w-12 h-12 mx-auto mb-3 text-gray-300' />
                    <p>暂无考试数据</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 考试编辑弹窗 */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingExam ? '编辑考试' : '新建考试'}
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>考试名称 *</label>
            <input
              type='text'
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              placeholder='请输入考试名称'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>考试说明</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              placeholder='请输入考试说明'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>考试科目 *</label>
            <input
              type='text'
              value={formData.subjects}
              onChange={(e) => setFormData((prev) => ({ ...prev, subjects: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              placeholder='请输入科目，用逗号分隔'
            />
            <p className='text-xs text-gray-500 mt-1'>多个科目用英文逗号分隔</p>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>开始时间 *</label>
              <input
                type='datetime-local'
                value={formData.start_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, start_time: e.target.value }))}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>结束时间 *</label>
              <input
                type='datetime-local'
                value={formData.end_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, end_time: e.target.value }))}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              />
            </div>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>重要性</label>
            <select
              value={formData.importance}
              onChange={(e) => setFormData((prev) => ({ ...prev, importance: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value='low'>低</option>
              <option value='medium'>中</option>
              <option value='high'>高</option>
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>班级</label>
            <select
              value={formData.class_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, class_id: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>全部班级</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className='flex space-x-3 pt-4'>
            <Button onClick={handleSaveExam}>保存</Button>
            <Button variant='secondary' onClick={() => setShowModal(false)}>
              取消
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ExamManagement;
