import logger from '../utils/logger';
import { useState, useEffect, useCallback, FormEvent, ChangeEvent } from 'react';
import {
  User,
  Mail,
  Phone,
  Shield,
  Globe,
  Calendar,
  Edit2,
  Save,
  Check,
  ChevronRight,
  Key,
  RefreshCw,
  LucideIcon,
  AlertTriangle,
} from 'lucide-react';
import { Card, Modal, Button, Skeleton } from '../components';
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';

interface UserInfo {
  name: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  joinedAt: string;
  lastLogin: string;
  permissions: string[];
}

interface EditForm {
  real_name: string;
  phone: string;
  class_name: string;
}

interface PasswordForm {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

interface LoginHistoryRecord {
  time: string;
  ip: string;
  device: string;
  status: 'success' | 'failed';
}

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface AdminData {
  real_name?: string;
  username: string;
  phone?: string;
  class_name?: string;
  role?: string;
  created_at?: string | Date;
}

function Profile() {
  const { showToast } = useStableToast();
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const adminId: number = Number(localStorage.getItem('adminId')) || 1;

  // 初始值全部置空，避免硬编码伪造个人信息；接口加载后填充，缺失字段渲染为 '--'
  const [userInfo, setUserInfo] = useState<UserInfo>({
    name: '',
    username: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    joinedAt: '',
    lastLogin: '',
    permissions: [],
  });

  const [editForm, setEditForm] = useState<EditForm>({
    real_name: '',
    phone: '',
    class_name: '',
  });

  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  const tabs: Tab[] = [
    { id: 'profile', label: '个人资料', icon: User },
    { id: 'security', label: '安全设置', icon: Shield },
    { id: 'activity', label: '登录记录', icon: Calendar },
  ];

  // 登录记录：当前无 Profile 专用登录历史接口，置空避免伪造（此前为硬编码虚构记录，已移除）
  const loginHistory: LoginHistoryRecord[] = [];

  const loadAdminInfo = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const data: AdminData = await api.admins.getById(adminId);
      setUserInfo((prev: UserInfo) => ({
        ...prev,
        name: data.real_name || data.username || '',
        username: data.username || '',
        phone: data.phone || '',
        email: data.email || '',
        department: data.class_name || '',
        role: data.role || '',
        joinedAt: data.created_at ? new Date(data.created_at).toLocaleDateString('zh-CN') : '',
        // lastLogin：后端无 Profile 专用登录时间字段，保持空（渲染为"暂无记录"），不伪造
      }));
      setLoadError(false);
      setEditForm({
        real_name: data.real_name || '',
        phone: data.phone || '',
        class_name: data.class_name || '',
      });
    } catch (error) {
      logger.error('加载管理员信息失败:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => {
    loadAdminInfo();
  }, [loadAdminInfo]);

  const handleSaveProfile = useCallback(async (): Promise<void> => {
    // M3: 至少一项需修改，且姓名/电话基本校验
    if (!editForm.real_name.trim() && !editForm.phone.trim() && !editForm.class_name.trim()) {
      showToast('warning', '请至少填写一项要修改的信息');
      return;
    }
    if (editForm.phone && !/^1[3-9]\d{9}$/.test(editForm.phone)) {
      showToast('warning', '请输入正确的 11 位手机号');
      return;
    }
    try {
      setSaving(true);
      await api.admins.update(adminId, {
        real_name: editForm.real_name,
        phone: editForm.phone,
        class_name: editForm.class_name,
      });
      await loadAdminInfo();
      setShowEditModal(false);
      showToast('success', '资料修改成功');
    } catch (error) {
      const err = error as Error;
      showToast('error', '保存失败: ' + (err.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  }, [adminId, editForm, loadAdminInfo, showToast]);

  const handleChangePassword = useCallback(async (): Promise<void> => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showToast('error', '两次输入的密码不一致');
      return;
    }

    if (passwordForm.new_password.length < 6) {
      showToast('error', '新密码长度至少6位');
      return;
    }

    try {
      setSaving(true);
      await api.admins.changePassword(adminId, {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });
      setShowPasswordModal(false);
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
      showToast('success', '密码修改成功');
    } catch (error) {
      const err = error as Error;
      showToast('error', '密码修改失败: ' + (err.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  }, [passwordForm, adminId, showToast]);

  const handleEditFormChange = (field: keyof EditForm, value: string): void => {
    setEditForm((prev: EditForm) => ({ ...prev, [field]: value }));
  };

  const handlePasswordFormChange = (field: keyof PasswordForm, value: string): void => {
    setPasswordForm((prev: PasswordForm) => ({ ...prev, [field]: value }));
  };

  const handleEditSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    handleSaveProfile();
  };

  const handlePasswordSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    handleChangePassword();
  };

  if (loading) {
    return (
      <div className='max-w-4xl mx-auto'>
        <div className='flex items-center gap-4 mb-7'>
          <div className='w-12 h-12 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30'>
            <User className='w-6 h-6 text-white' />
          </div>
          <div>
            <Skeleton variant='text' width={120} height={24} className='font-bold mb-1' />
            <Skeleton variant='text' width={200} height={14} />
          </div>
        </div>

        <div className='bg-gradient-to-r from-primary-500 to-indigo-600 rounded-2xl p-6 text-white mb-6'>
          <div className='flex items-center gap-6'>
            <Skeleton variant='circular' width={96} height={96} className='bg-white/20' />
            <div className='flex-1 space-y-3'>
              <Skeleton variant='text' width={150} height={32} className='bg-white/30' />
              <Skeleton variant='text' width={100} height={16} className='bg-white/20' />
              <div className='flex gap-4'>
                <Skeleton variant='text' width={120} height={14} className='bg-white/20' />
                <Skeleton variant='text' width={120} height={14} className='bg-white/20' />
              </div>
            </div>
            <Skeleton
              variant='rectangular'
              width={100}
              height={40}
              className='bg-white/30 rounded-lg'
            />
          </div>
        </div>

        <div className='flex gap-2 mb-6 bg-white rounded-xl p-1'>
          {tabs.map((tab: Tab) => (
            <button
              key={tab.id}
              className='flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600'
            >
              <Skeleton variant='circular' width={16} height={16} className='bg-gray-300' />
              <Skeleton variant='text' width={50} height={14} />
            </button>
          ))}
        </div>

        <Card>
          <div className='space-y-6'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div>
                <Skeleton variant='text' width={60} height={14} className='mb-1' />
                <Skeleton variant='rectangular' width='100%' height={44} />
              </div>
              <div>
                <Skeleton variant='text' width={40} height={14} className='mb-1' />
                <Skeleton variant='rectangular' width='100%' height={44} />
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className='max-w-4xl mx-auto'>
      {loadError && (
        <div className='mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            个人信息加载失败，当前展示可能不完整，请刷新重试
          </p>
        </div>
      )}
      <div className='flex items-center gap-4 mb-7'>
        <div className='w-12 h-12 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30'>
          <User className='w-6 h-6 text-white' />
        </div>
        <div>
          <h2 className='text-xl font-bold text-gray-900'>个人中心</h2>
          <p className='text-sm text-gray-500'>管理您的账户信息和安全设置</p>
        </div>
      </div>

      <div className='bg-gradient-to-r from-primary-500 to-indigo-600 rounded-2xl p-6 text-white mb-6'>
        <div className='flex items-center gap-6'>
          <div className='w-24 h-24 bg-white/20 rounded-2xl flex items-center justify-center'>
            <User className='w-12 h-12 text-white' />
          </div>
          <div className='flex-1'>
            <h3 className='text-2xl font-bold'>{userInfo.name}</h3>
            <p className='text-white/80 mt-1'>{userInfo.role}</p>
            <div className='flex items-center gap-4 mt-3'>
              <div className='flex items-center gap-2'>
                <Mail className='w-4 h-4 text-white/70' />
                <span className='text-sm'>{userInfo.email}</span>
              </div>
              <div className='flex items-center gap-2'>
                <Phone className='w-4 h-4 text-white/70' />
                <span className='text-sm'>{userInfo.phone || '未设置'}</span>
              </div>
            </div>
          </div>
          {/* S1: profile.edit 后端无此码；资料编辑为本人操作，无需权限门控 */}
          <Button
            variant='secondary'
            onClick={() => setShowEditModal(true)}
            className='bg-white text-primary-600 hover:bg-gray-100'
          >
            <Edit2 className='w-4 h-4' />
            编辑资料
          </Button>
        </div>
      </div>

      <div className='flex gap-2 mb-6 bg-white rounded-xl p-1'>
        {tabs.map((tab: Tab) => {
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
              <Icon className='w-4 h-4' />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'profile' && (
        <Card title='基本信息'>
          <div className='space-y-6'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div>
                <label className='block text-sm font-medium text-gray-500 mb-1'>用户名</label>
                <div className='flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl'>
                  <User className='w-5 h-5 text-gray-400' />
                  <span className='font-medium text-gray-800'>{userInfo.username}</span>
                </div>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-500 mb-1'>姓名</label>
                <div className='flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl'>
                  <User className='w-5 h-5 text-gray-400' />
                  <span className='font-medium text-gray-800'>{userInfo.name || '--'}</span>
                </div>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-500 mb-1'>电话</label>
                <div className='flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl'>
                  <Phone className='w-5 h-5 text-gray-400' />
                  <span className='font-medium text-gray-800'>{userInfo.phone || '未设置'}</span>
                </div>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-500 mb-1'>部门</label>
                <div className='flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl'>
                  <Globe className='w-5 h-5 text-gray-400' />
                  <span className='font-medium text-gray-800'>{userInfo.department || '--'}</span>
                </div>
              </div>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div>
                <label className='block text-sm font-medium text-gray-500 mb-1'>角色</label>
                <span className='inline-flex items-center px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium'>
                  {userInfo.role || '--'}
                </span>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-500 mb-1'>入职时间</label>
                <div className='flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl'>
                  <Calendar className='w-5 h-5 text-gray-400' />
                  <span className='font-medium text-gray-800'>{userInfo.joinedAt || '--'}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'security' && (
        <Card title='安全设置'>
          <div className='space-y-4'>
            <button
              className='w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors'
              onClick={() => setShowPasswordModal(true)}
            >
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center'>
                  <Key className='w-5 h-5 text-green-600' />
                </div>
                <div className='text-left'>
                  <p className='font-medium text-gray-800'>修改密码</p>
                  <p className='text-sm text-gray-500'>定期更换密码以保护账户安全</p>
                </div>
              </div>
              <ChevronRight className='w-5 h-5 text-gray-400' />
            </button>
            <button className='w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center'>
                  <Mail className='w-5 h-5 text-blue-600' />
                </div>
                <div className='text-left'>
                  <p className='font-medium text-gray-800'>绑定邮箱</p>
                  <p className='text-sm text-gray-500'>{userInfo.email || '未绑定'}</p>
                </div>
              </div>
              <Check className='w-5 h-5 text-green-500' />
            </button>
            <button className='w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center'>
                  <Phone className='w-5 h-5 text-yellow-600' />
                </div>
                <div className='text-left'>
                  <p className='font-medium text-gray-800'>绑定手机</p>
                  <p className='text-sm text-gray-500'>{userInfo.phone || '未设置'}</p>
                </div>
              </div>
              {userInfo.phone ? <Check className='w-5 h-5 text-green-500' /> : null}
            </button>
            <div className='p-4 bg-red-50 border border-red-200 rounded-xl'>
              <p className='text-sm text-red-700'>上次登录: {userInfo.lastLogin || '暂无记录'}</p>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'activity' && (
        <Card title='登录记录'>
          <div className='space-y-3'>
            {loginHistory.length === 0 ? (
              <div className='text-center py-8 text-gray-400'>
                <Calendar className='w-8 h-8 mx-auto mb-2 text-gray-300' />
                <p className='text-sm'>暂无登录记录</p>
                <p className='text-xs mt-1'>安全事件可在「系统日志」中查看</p>
              </div>
            ) : (
              loginHistory.map((record: LoginHistoryRecord, index: number) => (
                <div
                  key={index}
                  className='flex items-center justify-between p-4 bg-gray-50 rounded-xl'
                >
                  <div className='flex items-center gap-4'>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        record.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <div>
                      <p className='font-medium text-gray-800'>{record.time}</p>
                      <p className='text-sm text-gray-500'>{record.ip}</p>
                    </div>
                  </div>
                  <div className='text-right'>
                    <p className='text-sm text-gray-600'>{record.device}</p>
                    <p
                      className={`text-xs ${
                        record.status === 'success' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {record.status === 'success' ? '成功' : '失败'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title='编辑个人资料'>
        <form onSubmit={handleEditSubmit} className='space-y-5'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>姓名</label>
              <input
                type='text'
                value={editForm.real_name}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleEditFormChange('real_name', e.target.value)
                }
                className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>电话</label>
              <input
                type='tel'
                value={editForm.phone}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleEditFormChange('phone', e.target.value)
                }
                className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
              />
            </div>
            <div className='md:col-span-2'>
              <label className='block text-sm font-medium text-gray-700 mb-2'>部门</label>
              <input
                type='text'
                value={editForm.class_name}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleEditFormChange('class_name', e.target.value)
                }
                className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
              />
            </div>
          </div>
          <div className='flex gap-3 pt-4 border-t border-gray-100'>
            {/* S1: 本人资料编辑，无需权限门控 */}
            <Button variant='outline' onClick={() => setShowEditModal(false)} disabled={saving}>
              取消
            </Button>
            <Button type='submit' disabled={saving}>
              {saving ? (
                <RefreshCw className='w-4 h-4 animate-spin' />
              ) : (
                <Save className='w-4 h-4' />
              )}
              保存修改
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
        }} /* L7: 关闭重置 */
        title='修改密码'
      >
        <form onSubmit={handlePasswordSubmit} className='space-y-5'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>当前密码</label>
            <input
              type='password'
              value={passwordForm.old_password}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handlePasswordFormChange('old_password', e.target.value)
              }
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
              placeholder='请输入当前密码'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>新密码</label>
            <input
              type='password'
              value={passwordForm.new_password}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handlePasswordFormChange('new_password', e.target.value)
              }
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
              placeholder='请输入新密码（至少6位）'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>确认新密码</label>
            <input
              type='password'
              value={passwordForm.confirm_password}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handlePasswordFormChange('confirm_password', e.target.value)
              }
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
              placeholder='请再次输入新密码'
            />
          </div>
          <div className='flex gap-3 pt-4 border-t border-gray-100'>
            {/* S1: profile.change-password 后端无此码；改密为本人操作，无需权限门控 */}
            <Button
              variant='outline'
              onClick={() => {
                setShowPasswordModal(false);
                setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
              }} /* L7: 关闭重置 */
              disabled={saving}
            >
              取消
            </Button>
            <Button type='submit' disabled={saving}>
              {saving ? (
                <RefreshCw className='w-4 h-4 animate-spin' />
              ) : (
                <Key className='w-4 h-4' />
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
