import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  GraduationCap,
  Building,
  Plus,
  Trash2,
  Star,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import api from '../services/api';
import { Card, Button, Modal, LoadingSpinner } from '../components';
import { useToast } from '../context/ToastContext';

function ClassAssignment() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherClasses, setTeacherClasses] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableClasses, setAvailableClasses] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [adminsData, classesData] = await Promise.all([
        api.admins.getAll(),
        api.classes.getAll(),
      ]);

      const teachersList = Array.isArray(adminsData)
        ? adminsData.filter((a) => a.role === 'teacher')
        : (adminsData.admins || []).filter((a) => a.role === 'teacher');

      setTeachers(teachersList);
      setClasses(Array.isArray(classesData) ? classesData : classesData.classes || []);
    } catch (err) {
      showToast('获取数据失败: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showSuccess = (text) => {
    showToast(text, 'success');
  };

  const showError = (text) => {
    showToast(text, 'error');
  };

  const handleViewClasses = async (teacher) => {
    setSelectedTeacher(teacher);
    setLoading(true);
    try {
      const classesData = await api.adminClasses.getByAdmin(teacher.id);
      setTeacherClasses(Array.isArray(classesData) ? classesData : []);
      setShowAssignModal(true);
    } catch (err) {
      showError('获取班级信息失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignClass = async (classId, isPrimary = false) => {
    if (!selectedTeacher) return;

    setLoading(true);
    try {
      await api.adminClasses.assign(selectedTeacher.id, classId, isPrimary);
      showSuccess('班级分配成功');
      
      const classesData = await api.adminClasses.getByAdmin(selectedTeacher.id);
      setTeacherClasses(Array.isArray(classesData) ? classesData : []);
      
      fetchData();
    } catch (err) {
      showError('班级分配失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveClass = async (classId) => {
    if (!selectedTeacher) return;

    setLoading(true);
    try {
      await api.adminClasses.remove(selectedTeacher.id, classId);
      showSuccess('班级移除成功');
      
      const classesData = await api.adminClasses.getByAdmin(selectedTeacher.id);
      setTeacherClasses(Array.isArray(classesData) ? classesData : []);
      
      fetchData();
    } catch (err) {
      showError('班级移除失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrimary = async (classId) => {
    if (!selectedTeacher) return;

    setLoading(true);
    try {
      await api.adminClasses.assign(selectedTeacher.id, classId, true);
      showSuccess('主要班级设置成功');
      
      const classesData = await api.adminClasses.getByAdmin(selectedTeacher.id);
      setTeacherClasses(Array.isArray(classesData) ? classesData : []);
      
      fetchData();
    } catch (err) {
      showError('设置主要班级失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableClasses = () => {
    const assignedClassIds = teacherClasses.map((tc) => tc.class_id);
    return classes.filter((c) => !assignedClassIds.includes(c.id));
  };

  const filteredTeachers = teachers.filter(
    (teacher) =>
      teacher.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.real_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>班级分配管理</h1>
          <p className='text-gray-500 mt-1'>为教师分配和管理班级权限</p>
        </div>
      </div>

      <Card>
        <div className='flex justify-between items-center mb-4'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400' />
            <input
              type='text'
              placeholder='搜索教师...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className='pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent w-64'
            />
          </div>
        </div>

        {loading && filteredTeachers.length === 0 ? (
          <div className='flex items-center justify-center py-12'>
            <LoadingSpinner />
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className='text-center py-12 text-gray-500'>
            <Users className='w-12 h-12 mx-auto mb-3 text-gray-300' />
            <p>暂无教师数据</p>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-gray-200'>
              <thead className='bg-gray-50'>
                <tr>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    教师信息
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    管理班级数
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                    联系电话
                  </th>
                  <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase'>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200'>
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className='hover:bg-gray-50'>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center'>
                        <div className='flex-shrink-0 h-12 w-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center'>
                          <GraduationCap className='w-6 h-6 text-white' />
                        </div>
                        <div className='ml-4'>
                          <div className='text-sm font-medium text-gray-900'>
                            {teacher.real_name || teacher.username}
                          </div>
                          <div className='text-sm text-gray-500'>@{teacher.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center text-sm text-gray-500'>
                        <Building className='w-4 h-4 mr-2' />
                        {teacher.class_count || 0} 个班级
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                      {teacher.phone || '-'}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleViewClasses(teacher)}
                      >
                        <Building className='w-4 h-4 mr-1' />
                        管理班级
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedTeacher(null);
          setTeacherClasses([]);
        }}
        title={`管理班级 - ${selectedTeacher?.real_name || selectedTeacher?.username}`}
        size='lg'
      >
        <div className='space-y-6'>
          <div>
            <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
              <Building className='w-5 h-5 mr-2' />
              已分配班级
            </h3>
            {teacherClasses.length === 0 ? (
              <div className='text-center py-8 bg-gray-50 rounded-lg'>
                <AlertCircle className='w-12 h-12 mx-auto mb-3 text-gray-300' />
                <p className='text-gray-500'>暂无分配班级</p>
              </div>
            ) : (
              <div className='space-y-3'>
                {teacherClasses.map((tc) => (
                  <div
                    key={tc.class_id}
                    className='flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors'
                  >
                    <div className='flex items-center space-x-3'>
                      {tc.is_primary && (
                        <Star className='w-5 h-5 text-yellow-500 fill-yellow-500' />
                      )}
                      <div>
                        <div className='font-medium text-gray-900'>
                          {tc.class_name}
                        </div>
                        <div className='text-sm text-gray-500'>
                          {tc.is_primary ? '主要班级' : '普通班级'}
                        </div>
                      </div>
                    </div>
                    <div className='flex items-center space-x-2'>
                      {!tc.is_primary && (
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => handleSetPrimary(tc.class_id)}
                          title='设为主要班级'
                        >
                          <Star className='w-4 h-4' />
                        </Button>
                      )}
                      <Button
                        variant='danger'
                        size='sm'
                        onClick={() => handleRemoveClass(tc.class_id)}
                        title='移除班级'
                      >
                        <Trash2 className='w-4 h-4' />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
              <Plus className='w-5 h-5 mr-2' />
              分配新班级
            </h3>
            {getAvailableClasses().length === 0 ? (
              <div className='text-center py-8 bg-gray-50 rounded-lg'>
                <CheckCircle className='w-12 h-12 mx-auto mb-3 text-gray-300' />
                <p className='text-gray-500'>所有班级已分配</p>
              </div>
            ) : (
              <div className='grid grid-cols-2 gap-3'>
                {getAvailableClasses().map((cls) => (
                  <div
                    key={cls.id}
                    className='flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:shadow-md transition-all'
                  >
                    <div className='flex items-center space-x-3'>
                      <Building className='w-5 h-5 text-gray-400' />
                      <div>
                        <div className='font-medium text-gray-900'>{cls.name}</div>
                        <div className='text-sm text-gray-500'>年级: {cls.grade}</div>
                      </div>
                    </div>
                    <Button
                      variant='primary'
                      size='sm'
                      onClick={() => handleAssignClass(cls.id)}
                    >
                      <Plus className='w-4 h-4 mr-1' />
                      分配
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ClassAssignment;