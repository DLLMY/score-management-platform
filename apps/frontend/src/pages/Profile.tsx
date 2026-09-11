import logger from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useStableToast } from '../hooks';
import ProfileView, {
  type UserInfo,
  type EditForm,
  type PasswordForm,
} from './profile/ProfileView';

interface AdminData {
  real_name?: string;
  username: string;
  phone?: string;
  email?: string;
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

  return (
    <ProfileView
      userInfo={userInfo}
      loading={loading}
      loadError={loadError}
      saving={saving}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      editForm={editForm}
      passwordForm={passwordForm}
      showEditModal={showEditModal}
      showPasswordModal={showPasswordModal}
      onOpenEdit={() => setShowEditModal(true)}
      onOpenPassword={() => setShowPasswordModal(true)}
      onCloseEdit={() => setShowEditModal(false)}
      onClosePassword={() => {
        setShowPasswordModal(false);
        setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
      }}
      onSaveProfile={handleSaveProfile}
      onSavePassword={handleChangePassword}
      onEditFormChange={handleEditFormChange}
      onPasswordFormChange={handlePasswordFormChange}
    />
  );
}

export default Profile;
