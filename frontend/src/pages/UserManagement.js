import { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Edit2, Trash2, Search, ChevronDown,
  User, GraduationCap, Phone, Building
} from 'lucide-react';
import api from '../services/api';
import { Card, Button, Modal, LoadingSpinner } from '../components';

function UserManagement() {
  const [activeTab, setActiveTab] = useState('teachers');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 教师数据
  const [teachers, setTeachers] = useState([]);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [teacherFormData, setTeacherFormData] = useState({
    username: '',
    password: '',
    real_name: '',
    phone: '',
    role: 'teacher',
    class_name: ''
  });

  // 班级数据
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [adminsData, classesData] = await Promise.all([
        api.admins.getAll(),
        api.classes.getAll()
      ]);
      setTeachers(Array.isArray(adminsData) ? adminsData.filter(a => a.role === 'teacher') : (adminsData.admins || []).filter(a => a.role === 'teacher'));
      setClasses(Array.isArray(classesData) ? classesData : classesData.classes || []);
    } catch (err) {
      setError('获取数据失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (text) => {
    setMessage({ type: 'success', text });
    setTimeout(() => setMessage(null), 3000);
  };

  const showError = (text) => {
    setMessage({ type: 'error', text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 教师操作
  const handleCreateTeacher = () => {
    setEditingTeacher(null);
    setTeacherFormData({
      username: '',
      password: '',
      real_name: '',
      phone: '',
      role: 'teacher',
      class_name: ''
    });
    setShowTeacherModal(true);
  };

  const handleEditTeacher = (teacher) => {
    setEditingTeacher(teacher);
    setTeacherFormData({
      username: teacher.username,
      password: '',
      real_name: teacher.real_name,
      phone: teacher.phone,
      role: teacher.role,
      class_name: teacher.class_name || ''
    });
    setShowTeacherModal(true);
  };

  const handleSaveTeacher = async () => {
    if (!teacherFormData.username) {
      showError('请输入用户名');
      return;
    }

    if (!editingTeacher && !teacherFormData.password) {
      showError('请输入密码');
      return;
    }

    try {
      if (editingTeacher) {
        const updateData = { ...teacherFormData };
        if (!updateData.password) delete updateData.password;
        await api.admins.update(editingTeacher.id, updateData);
        showSuccess('教师信息更新成功');
      } else {
        await api.admins.create(teacherFormData);
        showSuccess('教师添加成功');
      }
      setShowTeacherModal(false);
      fetchData();
    } catch (err) {
      showError('操作失败: ' + err.message);
    }
  };

  const handleDeleteTeacher = async (teacher) => {
    if (!window.confirm(`确定要删除教师 ${teacher.real_name} 吗？`)) return;
    try {
      await api.admins.delete(teacher.id);
      showSuccess('教师删除成功');
      fetchData();
    } catch (err) {
      showError('删除失败: ' + err.message);
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.real_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.phone?.includes(searchTerm) ||
    t.class_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 space-y-6">
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
          <p className="text-gray-500 mt-1">管理班主任和教师账号</p>
        </div>
      </div>

      {/* 标签页 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('teachers')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'teachers'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>教师管理</span>
            </div>
          </button>
        </nav>
      </div>

      {/* 教师管理 */}
      {activeTab === 'teachers' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent w-64"
                placeholder="搜索教师..."
              />
            </div>
            <Button onClick={handleCreateTeacher}>
              <UserPlus className="w-4 h-4 mr-2" />
              添加教师
            </Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">教师信息</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">管理班级</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">联系电话</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTeachers.length > 0 ? (
                    filteredTeachers.map((teacher) => (
                      <tr key={teacher.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                              <GraduationCap className="w-6 h-6 text-white" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{teacher.real_name}</div>
                              <div className="text-sm text-gray-500">@{teacher.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-500">
                            <Building className="w-4 h-4 mr-2" />
                            {teacher.class_name || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-500">
                            <Phone className="w-4 h-4 mr-2" />
                            {teacher.phone || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <Button variant="secondary" size="sm" onClick={() => handleEditTeacher(teacher)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDeleteTeacher(teacher)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>暂无教师数据</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 教师编辑弹窗 */}
      <Modal
        isOpen={showTeacherModal}
        onClose={() => setShowTeacherModal(false)}
        title={editingTeacher ? '编辑教师' : '添加教师'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名 *</label>
            <input
              type="text"
              value={teacherFormData.username}
              onChange={(e) => setTeacherFormData(prev => ({ ...prev, username: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入用户名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码 {editingTeacher ? '(留空不修改)' : '*'}</label>
            <input
              type="password"
              value={teacherFormData.password}
              onChange={(e) => setTeacherFormData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入密码"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">真实姓名 *</label>
            <input
              type="text"
              value={teacherFormData.real_name}
              onChange={(e) => setTeacherFormData(prev => ({ ...prev, real_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入真实姓名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
            <input
              type="text"
              value={teacherFormData.phone}
              onChange={(e) => setTeacherFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入联系电话"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">管理班级</label>
            <div className="relative">
              <select
                value={teacherFormData.class_name}
                onChange={(e) => setTeacherFormData(prev => ({ ...prev, class_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="">请选择班级</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.name}>{cls.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex space-x-3 pt-4">
            <Button onClick={handleSaveTeacher}>保存</Button>
            <Button variant="secondary" onClick={() => setShowTeacherModal(false)}>取消</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default UserManagement;
