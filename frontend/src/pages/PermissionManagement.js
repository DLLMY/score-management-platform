import { useState, useEffect } from 'react';
import { 
  Users, Shield, School, Plus, Edit2, Trash2, Search, 
  Key, UserPlus, Eye, Settings, CheckCircle, XCircle
} from 'lucide-react';
import api from '../services/api';
import { Card, Button, Modal, LoadingSpinner } from '../components';

function PermissionManagement() {
  const [activeTab, setActiveTab] = useState('admins');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // 管理员数据
  const [admins, setAdmins] = useState([]);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminFormData, setAdminFormData] = useState({
    username: '',
    password: '',
    real_name: '',
    phone: '',
    role: 'teacher',
    class_name: ''
  });

  // 班级数据
  const [classes, setClasses] = useState([]);
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [classFormData, setClassFormData] = useState({
    name: '',
    grade: '',
    description: ''
  });

  // 子账号数据
  const [subAccounts, setSubAccounts] = useState([]);
  const [showSubAccountModal, setShowSubAccountModal] = useState(false);
  const [editingSubAccount, setEditingSubAccount] = useState(null);
  const [subAccountFormData, setSubAccountFormData] = useState({
    username: '',
    password: '',
    real_name: '',
    phone: '',
    role_type: 'dashboard_viewer'
  });

  // 权限日志
  const [permissionLogs, setPermissionLogs] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [adminsData, classesData, logsData] = await Promise.all([
        api.admins.getAll(),
        api.classes.getAll(),
        api.permissionLogs.getAll()
      ]);
      setAdmins(Array.isArray(adminsData) ? adminsData : adminsData.admins || []);
      setClasses(Array.isArray(classesData) ? classesData : classesData.classes || []);
      setPermissionLogs(Array.isArray(logsData) ? logsData : logsData.logs || []);
    } catch (err) {
      setError('获取数据失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubAccounts = async () => {
    try {
      const data = await api.subAccounts.getAll();
      setSubAccounts(Array.isArray(data) ? data : data.sub_accounts || []);
    } catch (err) {
      setError('获取子账号失败: ' + err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'subaccounts') {
      fetchSubAccounts();
    }
  }, [activeTab]);

  const showSuccess = (text) => {
    setMessage({ type: 'success', text });
    setTimeout(() => setMessage(null), 3000);
  };

  const showError = (text) => {
    setMessage({ type: 'error', text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 管理员操作
  const handleCreateAdmin = () => {
    setEditingAdmin(null);
    setAdminFormData({
      username: '',
      password: '',
      real_name: '',
      phone: '',
      role: 'teacher',
      class_name: ''
    });
    setShowAdminModal(true);
  };

  const handleEditAdmin = (admin) => {
    setEditingAdmin(admin);
    setAdminFormData({
      username: admin.username,
      password: '',
      real_name: admin.real_name,
      phone: admin.phone,
      role: admin.role,
      class_name: admin.class_name || ''
    });
    setShowAdminModal(true);
  };

  const handleSaveAdmin = async () => {
    if (!adminFormData.username) {
      showError('请输入用户名');
      return;
    }

    if (!editingAdmin && !adminFormData.password) {
      showError('请输入密码');
      return;
    }

    try {
      if (editingAdmin) {
        const updateData = { ...adminFormData };
        if (!updateData.password) delete updateData.password;
        await api.admins.update(editingAdmin.id, updateData);
        showSuccess('管理员更新成功');
      } else {
        await api.admins.create(adminFormData);
        showSuccess('管理员创建成功');
      }
      setShowAdminModal(false);
      fetchData();
    } catch (err) {
      showError('操作失败: ' + err.message);
    }
  };

  const handleDeleteAdmin = async (admin) => {
    if (!window.confirm(`确定要删除管理员 ${admin.real_name} 吗？`)) return;
    try {
      await api.admins.delete(admin.id);
      showSuccess('管理员删除成功');
      fetchData();
    } catch (err) {
      showError('删除失败: ' + err.message);
    }
  };

  // 班级操作
  const handleCreateClass = () => {
    setEditingClass(null);
    setClassFormData({ name: '', grade: '', description: '' });
    setShowClassModal(true);
  };

  const handleEditClass = (cls) => {
    setEditingClass(cls);
    setClassFormData({
      name: cls.name,
      grade: cls.grade,
      description: cls.description
    });
    setShowClassModal(true);
  };

  const handleSaveClass = async () => {
    if (!classFormData.name) {
      showError('请输入班级名称');
      return;
    }

    try {
      if (editingClass) {
        await api.classes.update(editingClass.id, classFormData);
        showSuccess('班级更新成功');
      } else {
        await api.classes.create(classFormData);
        showSuccess('班级创建成功');
      }
      setShowClassModal(false);
      fetchData();
    } catch (err) {
      showError('操作失败: ' + err.message);
    }
  };

  const handleDeleteClass = async (cls) => {
    if (!window.confirm(`确定要删除班级 ${cls.name} 吗？`)) return;
    try {
      await api.classes.delete(cls.id);
      showSuccess('班级删除成功');
      fetchData();
    } catch (err) {
      showError('删除失败: ' + err.message);
    }
  };

  // 子账号操作
  const handleCreateSubAccount = () => {
    setEditingSubAccount(null);
    setSubAccountFormData({
      username: '',
      password: '',
      real_name: '',
      phone: '',
      role_type: 'dashboard_viewer'
    });
    setShowSubAccountModal(true);
  };

  const handleEditSubAccount = (sub) => {
    setEditingSubAccount(sub);
    setSubAccountFormData({
      username: sub.username,
      password: '',
      real_name: sub.real_name,
      phone: sub.phone,
      role_type: sub.role_type
    });
    setShowSubAccountModal(true);
  };

  const handleSaveSubAccount = async () => {
    if (!subAccountFormData.username) {
      showError('请输入用户名');
      return;
    }

    if (!editingSubAccount && !subAccountFormData.password) {
      showError('请输入密码');
      return;
    }

    try {
      if (editingSubAccount) {
        const updateData = { ...subAccountFormData };
        if (!updateData.password) delete updateData.password;
        await api.subAccounts.update(editingSubAccount.id, updateData);
        showSuccess('子账号更新成功');
      } else {
        await api.subAccounts.create(subAccountFormData);
        showSuccess('子账号创建成功');
      }
      setShowSubAccountModal(false);
      fetchSubAccounts();
    } catch (err) {
      showError('操作失败: ' + err.message);
    }
  };

  const handleDeleteSubAccount = async (sub) => {
    if (!window.confirm(`确定要删除子账号 ${sub.real_name} 吗？`)) return;
    try {
      await api.subAccounts.delete(sub.id);
      showSuccess('子账号删除成功');
      fetchSubAccounts();
    } catch (err) {
      showError('删除失败: ' + err.message);
    }
  };

  // 分配班级给管理员
  const handleAssignClass = async (admin, classId, isPrimary = false) => {
    try {
      await api.adminClasses.assign(admin.id, classId, isPrimary);
      showSuccess('班级分配成功');
      fetchData();
    } catch (err) {
      showError('分配失败: ' + err.message);
    }
  };

  const getRoleLabel = (role) => {
    const roles = {
      admin: '超级管理员',
      teacher: '班主任',
      dashboard: '数据大屏用户'
    };
    return roles[role] || role;
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      teacher: 'bg-blue-100 text-blue-800',
      dashboard: 'bg-purple-100 text-purple-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

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
          <h1 className="text-2xl font-bold text-gray-900">用户及权限管理</h1>
          <p className="text-gray-500 mt-1">管理系统用户、班级和权限分配</p>
        </div>
      </div>

      {/* 标签页 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('admins')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'admins'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>管理员用户</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('classes')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'classes'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <School className="w-5 h-5" />
              <span>班级管理</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('subaccounts')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'subaccounts'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Key className="w-5 h-5" />
              <span>子账号管理</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'logs'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>权限日志</span>
            </div>
          </button>
        </nav>
      </div>

      {/* 管理员用户 */}
      {activeTab === 'admins' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">管理员列表</h2>
            <Button onClick={handleCreateAdmin}>
              <UserPlus className="w-4 h-4 mr-2" />
              添加管理员
            </Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">班级</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">电话</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold">{(admin.real_name || admin.username)[0]}</span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{admin.real_name}</div>
                            <div className="text-sm text-gray-500">{admin.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(admin.role)}`}>
                          {getRoleLabel(admin.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {admin.class_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {admin.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <Button variant="secondary" size="sm" onClick={() => handleEditAdmin(admin)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {admin.username !== 'admin' && (
                          <Button variant="danger" size="sm" onClick={() => handleDeleteAdmin(admin)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 班级管理 */}
      {activeTab === 'classes' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">班级列表</h2>
            <Button onClick={handleCreateClass}>
              <Plus className="w-4 h-4 mr-2" />
              添加班级
            </Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">班级名称</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">年级</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">描述</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {classes.map((cls) => (
                    <tr key={cls.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{cls.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cls.grade || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cls.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {cls.is_active !== false ? (
                          <span className="flex items-center text-green-600">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            启用
                          </span>
                        ) : (
                          <span className="flex items-center text-red-600">
                            <XCircle className="w-4 h-4 mr-1" />
                            禁用
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <Button variant="secondary" size="sm" onClick={() => handleEditClass(cls)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDeleteClass(cls)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 子账号管理 */}
      {activeTab === 'subaccounts' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">子账号列表</h2>
            <Button onClick={handleCreateSubAccount}>
              <UserPlus className="w-4 h-4 mr-2" />
              添加子账号
            </Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色类型</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">电话</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subAccounts.map((sub) => (
                    <tr key={sub.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold">{(sub.real_name || sub.username)[0]}</span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{sub.real_name}</div>
                            <div className="text-sm text-gray-500">{sub.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                          {sub.role_type === 'dashboard_viewer' ? '数据大屏用户' : sub.role_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {sub.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {sub.is_active !== false ? (
                          <span className="flex items-center text-green-600">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            启用
                          </span>
                        ) : (
                          <span className="flex items-center text-red-600">
                            <XCircle className="w-4 h-4 mr-1" />
                            禁用
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <Button variant="secondary" size="sm" onClick={() => handleEditSubAccount(sub)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDeleteSubAccount(sub)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 权限日志 */}
      {activeTab === 'logs' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">权限操作日志</h2>

          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">目标类型</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">描述</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP地址</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {permissionLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.action}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.target_type || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {log.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.ip_address || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.created_at ? new Date(log.created_at).toLocaleString('zh-CN') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 管理员编辑弹窗 */}
      <Modal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        title={editingAdmin ? '编辑管理员' : '添加管理员'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名 *</label>
            <input
              type="text"
              value={adminFormData.username}
              onChange={(e) => setAdminFormData(prev => ({ ...prev, username: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入用户名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码 {editingAdmin ? '(留空不修改)' : '*'}</label>
            <input
              type="password"
              value={adminFormData.password}
              onChange={(e) => setAdminFormData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入密码"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">真实姓名</label>
            <input
              type="text"
              value={adminFormData.real_name}
              onChange={(e) => setAdminFormData(prev => ({ ...prev, real_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入真实姓名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">角色 *</label>
            <select
              value={adminFormData.role}
              onChange={(e) => setAdminFormData(prev => ({ ...prev, role: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="admin">超级管理员</option>
              <option value="teacher">班主任</option>
              <option value="dashboard">数据大屏用户</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">管理班级</label>
            <select
              value={adminFormData.class_name}
              onChange={(e) => setAdminFormData(prev => ({ ...prev, class_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">请选择班级</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.name}>{cls.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">电话</label>
            <input
              type="text"
              value={adminFormData.phone}
              onChange={(e) => setAdminFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入电话"
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <Button onClick={handleSaveAdmin}>保存</Button>
            <Button variant="secondary" onClick={() => setShowAdminModal(false)}>取消</Button>
          </div>
        </div>
      </Modal>

      {/* 班级编辑弹窗 */}
      <Modal
        isOpen={showClassModal}
        onClose={() => setShowClassModal(false)}
        title={editingClass ? '编辑班级' : '添加班级'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">班级名称 *</label>
            <input
              type="text"
              value={classFormData.name}
              onChange={(e) => setClassFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入班级名称"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">年级</label>
            <input
              type="text"
              value={classFormData.grade}
              onChange={(e) => setClassFormData(prev => ({ ...prev, grade: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入年级"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              value={classFormData.description}
              onChange={(e) => setClassFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入班级描述"
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <Button onClick={handleSaveClass}>保存</Button>
            <Button variant="secondary" onClick={() => setShowClassModal(false)}>取消</Button>
          </div>
        </div>
      </Modal>

      {/* 子账号编辑弹窗 */}
      <Modal
        isOpen={showSubAccountModal}
        onClose={() => setShowSubAccountModal(false)}
        title={editingSubAccount ? '编辑子账号' : '添加子账号'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名 *</label>
            <input
              type="text"
              value={subAccountFormData.username}
              onChange={(e) => setSubAccountFormData(prev => ({ ...prev, username: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入用户名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码 {editingSubAccount ? '(留空不修改)' : '*'}</label>
            <input
              type="password"
              value={subAccountFormData.password}
              onChange={(e) => setSubAccountFormData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入密码"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">真实姓名</label>
            <input
              type="text"
              value={subAccountFormData.real_name}
              onChange={(e) => setSubAccountFormData(prev => ({ ...prev, real_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入真实姓名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">角色类型</label>
            <select
              value={subAccountFormData.role_type}
              onChange={(e) => setSubAccountFormData(prev => ({ ...prev, role_type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="dashboard_viewer">数据大屏用户</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">电话</label>
            <input
              type="text"
              value={subAccountFormData.phone}
              onChange={(e) => setSubAccountFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入电话"
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <Button onClick={handleSaveSubAccount}>保存</Button>
            <Button variant="secondary" onClick={() => setShowSubAccountModal(false)}>取消</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default PermissionManagement;
