import { useState, useEffect, useCallback } from 'react';
import { User, Mail, Phone, Shield, Globe, Calendar, Edit2, Save, Check, ChevronRight, Key, RefreshCw } from 'lucide-react';
import { Card, Button, Modal } from '../components';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

function Profile() {
  const { showToast } = useToast();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 从 localStorage 获取当前管理员ID，默认是1
  const adminId = localStorage.getItem('adminId') || 1;

  const [userInfo, setUserInfo] = useState({
    name: '管理员',
    username: 'admin',
    email: 'admin@school.com',
    phone: '13800138000',
    role: '系统管理员',
    department: '信息中心',
    joinedAt: '2024-09-01',
    lastLogin: '2026-05-19 10:30',
    permissions: ['学生管理', '积分规则', '数据分析', '系统设置']
  });

  const [editForm, setEditForm] = useState({
    real_name: '',
    phone: '',
    class_name: ''
  });

  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });

  const tabs = [
    { id: 'profile', label: '个人资料', icon: User },
    { id: 'security', label: '安全设置', icon: Shield },
    { id: 'activity', label: '登录记录', icon: Calendar },
  ];

  const loginHistory = [
    { time: '2026-05-19 10:30', ip: '192.168.1.100', device: 'Chrome on Windows', status: 'success' },
    { time: '2026-05-18 14:20', ip: '192.168.1.101', device: 'Safari on Mac', status: 'success' },
    { time: '2026-05-17 09:15', ip: '10.0.0.50', device: 'Mobile Safari', status: 'success' },
    { time: '2026-05-16 16:45', ip: '192.168.1.102', device: 'Firefox on Linux', status: 'failed' },
  ];

  const loadAdminInfo = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.admins.getById(adminId);
      setUserInfo(prev => ({
        ...prev,
        name: data.real_name || data.username,
        username: data.username,
        phone: data.phone || '',
        department: data.class_name || '信息中心',
        role: data.role || '系统管理员',
        joinedAt: data.created_at ? new Date(data.created_at).toLocaleDateString('zh-CN') : prev.joinedAt
      }));
      setEditForm({
        real_name: data.real_name || '',
        phone: data.phone || '',
        class_name: data.class_name || ''
      });
    } catch (error) {
      console.error('加载管理员信息失败:', error);
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => {
    loadAdminInfo();
  }, [loadAdminInfo]);

  const handleSaveProfile = useCallback(async () => {
    try {
      setSaving(true);
      await api.admins.update(adminId, {
        real_name: editForm.real_name,
        phone: editForm.phone,
        class_name: editForm.class_name
      });
      await loadAdminInfo();
      setShowEditModal(false);
      showToast('资料修改成功', 'success');
    } catch (error) {
      showToast('保存失败: ' + (error.message || '未知错误'), 'error');
    } finally {
      setSaving(false);
    }
  }, [adminId, editForm, loadAdminInfo, showToast]);

  const handleChangePassword = useCallback(async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showToast('两次输入的密码不一致', 'error');
      return;
    }

    if (passwordForm.new_password.length < 6) {
      showToast('新密码长度至少6位', 'error');
      return;
    }

    try {
      setSaving(true);
      await api.admins.changePassword(adminId, {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password
      });
      setShowPasswordModal(false);
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
      showToast('密码修改成功', 'success');
    } catch (error) {
      showToast('密码修改失败: ' + (error.message || '未知错误'), 'error');
    } finally {
      setSaving(false);
    }
  }, [passwordForm, adminId, showToast]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-7">
        <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30">
          <User className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">个人中心</h2>
          <p className="text-sm text-gray-500">管理您的账户信息和安全设置</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary-500 to-indigo-600 rounded-2xl p-6 text-white mb-6">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-white/20 rounded-2xl flex items-center justify-center">
            <User className="w-12 h-12 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold">{userInfo.name}</h3>
            <p className="text-white/80 mt-1">{userInfo.role}</p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-white/70" />
                <span className="text-sm">{userInfo.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-white/70" />
                <span className="text-sm">{userInfo.phone || '未设置'}</span>
              </div>
            </div>
          </div>
          <Button 
            variant="secondary"
            onClick={() => setShowEditModal(true)}
            className="bg-white text-primary-600 hover:bg-gray-100"
          >
            <Edit2 className="w-4 h-4" />
            编辑资料
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 bg-white rounded-xl p-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'profile' && (
        <Card title="基本信息">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">用户名</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="font-medium text-gray-800">{userInfo.username}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">姓名</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="font-medium text-gray-800">{userInfo.name}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">电话</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <span className="font-medium text-gray-800">{userInfo.phone || '未设置'}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">部门</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                  <Globe className="w-5 h-5 text-gray-400" />
                  <span className="font-medium text-gray-800">{userInfo.department}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">角色</label>
                <span className="inline-flex items-center px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium">
                  {userInfo.role}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">入职时间</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="font-medium text-gray-800">{userInfo.joinedAt}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'security' && (
        <Card title="安全设置">
          <div className="space-y-4">
            <button 
              className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              onClick={() => setShowPasswordModal(true)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <Key className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-800">修改密码</p>
                  <p className="text-sm text-gray-500">定期更换密码以保护账户安全</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-800">绑定邮箱</p>
                  <p className="text-sm text-gray-500">{userInfo.email}</p>
                </div>
              </div>
              <Check className="w-5 h-5 text-green-500" />
            </button>
            <button className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Phone className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-800">绑定手机</p>
                  <p className="text-sm text-gray-500">{userInfo.phone || '未设置'}</p>
                </div>
              </div>
              {userInfo.phone ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : null}
            </button>
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700">上次登录: {userInfo.lastLogin}</p>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'activity' && (
        <Card title="登录记录">
          <div className="space-y-3">
            {loginHistory.map((record, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${record.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div>
                    <p className="font-medium text-gray-800">{record.time}</p>
                    <p className="text-sm text-gray-500">{record.ip}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">{record.device}</p>
                  <p className={`text-xs ${record.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {record.status === 'success' ? '成功' : '失败'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="编辑个人资料"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">姓名</label>
              <input
                type="text"
                value={editForm.real_name}
                onChange={(e) => setEditForm({ ...editForm, real_name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">电话</label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">部门</label>
              <input
                type="text"
                value={editForm.class_name}
                onChange={(e) => setEditForm({ ...editForm, class_name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={saving}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              保存修改
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="修改密码"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">当前密码</label>
            <input
              type="password"
              value={passwordForm.old_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="请输入当前密码"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">新密码</label>
            <input
              type="password"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="请输入新密码（至少6位）"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">确认新密码</label>
            <input
              type="password"
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="请再次输入新密码"
            />
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={() => setShowPasswordModal(false)} disabled={saving}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Key className="w-4 h-4" />
              )}
              修改密码
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Profile;
