import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { Settings as SettingsIcon, Bell, Shield, Palette, Database, Save, RefreshCw, Check, AlertCircle, Download, Upload, Trash2, FileText, Loader2, AlertTriangle } from 'lucide-react';
import api, { SystemConfig, BackupInfo } from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { PermissionButton, FormSkeleton, Skeleton } from '../components';

interface SystemSettings {
  systemName: string;
  systemLogo: string;
  defaultScore: number;
  minScore: number;
  maxScore: number;
  enableNotifications: boolean;
  notificationSound: boolean;
  autoSave: boolean;
  theme: string;
  language: string;
}

interface LoadingState {
  backup: boolean;
  restore: boolean;
  cache: boolean;
  config: boolean;
}

interface ThemeOption {
  id: string;
  label: string;
  description: string;
}

function Settings() {
  const { showToast } = useStableToast();
  const [settings, setSettings] = useState<SystemSettings>({
    systemName: '积分管理平台',
    systemLogo: '',
    defaultScore: 60,
    minScore: 0,
    maxScore: 100,
    enableNotifications: true,
    notificationSound: true,
    autoSave: true,
    theme: 'light',
    language: 'zh-CN',
  });

  const [saved, setSaved] = useState<boolean>(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState<LoadingState>({
    backup: false,
    restore: false,
    cache: false,
    config: true,
  });

  // 记忆化配置更新函数
  const updateSettingsField = useCallback((field: keyof SystemSettings, value: string | number | boolean): void => {
    setSettings((prev: SystemSettings) => ({ ...prev, [field]: value }));
  }, []);

  // 加载系统配置
  const loadConfig = useCallback(async (): Promise<void> => {
    try {
      const data: SystemConfig = await api.system.getConfig();
      setLoadError(false);
      setSettings({
        systemName: data.system_name || '积分管理平台',
        systemLogo: data.system_logo || '',
        defaultScore: data.default_score ?? 60,
        minScore: data.min_score ?? 0,
        maxScore: data.max_score ?? 100,
        enableNotifications: data.enable_notifications ?? true,
        notificationSound: data.notification_sound ?? true,
        autoSave: data.auto_save ?? true,
        theme: data.theme || 'light',
        language: data.language || 'zh-CN',
      });
    } catch (error) {
      console.error('加载配置失败:', error);
      setLoadError(true);
    } finally {
      setLoading((prev: LoadingState) => ({ ...prev, config: false }));
    }
  }, []);

  // 获取备份列表
  const fetchBackups = useCallback(async (): Promise<void> => {
    try {
      const data: BackupInfo[] = await api.system.listBackups();
      setBackups(data);
      setLoadError(false);
    } catch (error) {
      console.error('获取备份列表失败:', error);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    fetchBackups();
  }, [loadConfig, fetchBackups]);

  const handleSave = useCallback(async (): Promise<void> => {
    try {
      setLoading((prev: LoadingState) => ({ ...prev, config: true }));
      await api.system.updateConfig({
        system_name: settings.systemName,
        system_logo: settings.systemLogo,
        default_score: settings.defaultScore,
        min_score: settings.minScore,
        max_score: settings.maxScore,
        enable_notifications: settings.enableNotifications,
        notification_sound: settings.notificationSound,
        auto_save: settings.autoSave,
        theme: settings.theme,
        language: settings.language,
      });
      setSaved(true);
      showToast('success', '配置已保存');
      setTimeout(() => {
        setSaved(false);
      }, 2000);
    } catch (error) {
      const err = error as Error;
      showToast('error', '保存失败: ' + err.message);
    } finally {
      setLoading((prev: LoadingState) => ({ ...prev, config: false }));
    }
  }, [settings, showToast]);

  const handleReset = useCallback(async (): Promise<void> => {
    const defaultSettings: SystemSettings = {
      systemName: '积分管理平台',
      systemLogo: '',
      defaultScore: 60,
      minScore: 0,
      maxScore: 100,
      enableNotifications: true,
      notificationSound: true,
      autoSave: true,
      theme: 'light',
      language: 'zh-CN',
    };
    setSettings(defaultSettings);
    try {
      setLoading((prev: LoadingState) => ({ ...prev, config: true }));
      await api.system.updateConfig({
        system_name: defaultSettings.systemName,
        system_logo: defaultSettings.systemLogo,
        default_score: defaultSettings.defaultScore,
        min_score: defaultSettings.minScore,
        max_score: defaultSettings.maxScore,
        enable_notifications: defaultSettings.enableNotifications,
        notification_sound: defaultSettings.notificationSound,
        auto_save: defaultSettings.autoSave,
        theme: defaultSettings.theme,
        language: defaultSettings.language,
      });
      showToast('success', '已恢复默认设置');
    } catch (error) {
      const err = error as Error;
      showToast('error', '恢复失败: ' + err.message);
    } finally {
      setLoading((prev: LoadingState) => ({ ...prev, config: false }));
    }
  }, [showToast]);

  const handleBackup = useCallback(async (): Promise<void> => {
    setLoading((prev: LoadingState) => ({ ...prev, backup: true }));
    try {
      const response = await api.system.backup();
      showToast('success', `备份成功: ${response.filename}`);
      fetchBackups();
    } catch (error) {
      const err = error as Error;
      showToast('error', '备份失败: ' + err.message);
    } finally {
      setLoading((prev: LoadingState) => ({ ...prev, backup: false }));
    }
  }, [showToast, fetchBackups]);

  const handleRestore = useCallback(
    async (filename: string): Promise<void> => {
      if (!window.confirm(`确定要从备份文件 ${filename} 恢复数据吗？此操作将覆盖当前数据！`)) {
        return;
      }
      setLoading((prev: LoadingState) => ({ ...prev, restore: true }));
      try {
        await api.system.restore(filename);
        showToast('success', '恢复成功');
      } catch (error) {
        const err = error as Error;
        showToast('error', '恢复失败: ' + err.message);
      } finally {
        setLoading((prev: LoadingState) => ({ ...prev, restore: false }));
      }
    },
    [showToast]
  );

  const handleClearCache = useCallback(async (): Promise<void> => {
    if (!window.confirm('确定要清理缓存吗？')) {
      return;
    }
    setLoading((prev: LoadingState) => ({ ...prev, cache: true }));
    try {
      await api.system.clearCache();
      showToast('success', '缓存清理成功');
    } catch (error) {
      const err = error as Error;
      showToast('error', '清理失败: ' + err.message);
    } finally {
      setLoading((prev: LoadingState) => ({ ...prev, cache: false }));
    }
  }, [showToast]);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }, []);

  const handleInputChange = (field: keyof SystemSettings) => (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value;
    updateSettingsField(field, value);
  };

  const handleSelectChange = (field: keyof SystemSettings) => (e: ChangeEvent<HTMLSelectElement>): void => {
    updateSettingsField(field, e.target.value);
  };

  const themeOptions: ThemeOption[] = [
    { id: 'light', label: '浅色', description: '明亮清爽的界面' },
    { id: 'dark', label: '深色', description: '护眼暗色界面' },
    { id: 'auto', label: '跟随系统', description: '根据系统设置自动切换' },
  ];

  return (
    <div className='min-h-screen bg-slate-50'>
      {loadError && (
        <div className='mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>系统配置加载失败，当前展示可能不完整，请刷新重试</p>
        </div>
      )}
      <div className='max-w-4xl mx-auto px-4 py-6'>
        <header className='mb-6'>
          <div className='flex items-center gap-3'>
            <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary-500/30'>
              <SettingsIcon className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-xl font-bold text-gray-900'>系统设置</h1>
              <p className='text-sm text-gray-500'>配置系统参数和偏好设置</p>
            </div>
          </div>
        </header>

        {loading.config ? (
          <div className='space-y-6'>
            <div className='card'>
              <div className='card-header'>
                <div className='flex items-center gap-2'>
                  <Palette className='w-5 h-5 text-gray-600' />
                  <Skeleton variant='text' width={100} height={20} className='font-semibold' />
                </div>
              </div>
              <div className='card-body'>
                <FormSkeleton fieldCount={4} showActions={false} />
              </div>
            </div>
            <div className='card'>
              <div className='card-header'>
                <div className='flex items-center gap-2'>
                  <Bell className='w-5 h-5 text-gray-600' />
                  <Skeleton variant='text' width={100} height={20} className='font-semibold' />
                </div>
              </div>
              <div className='card-body'>
                <FormSkeleton fieldCount={2} showActions={false} />
              </div>
            </div>
          </div>
        ) : (
          <div className='space-y-6'>
            <div className='card'>
              <div className='card-header'>
                <div className='flex items-center gap-2'>
                  <Palette className='w-5 h-5 text-gray-600' />
                  <h3 className='font-semibold text-gray-900'>基本设置</h3>
                </div>
              </div>
              <div className='card-body space-y-6'>
                <div>
                  <label className='form-label'>系统名称</label>
                  <input
                    type='text'
                    value={settings.systemName}
                    onChange={handleInputChange('systemName')}
                    className='form-input'
                  />
                </div>

                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <div>
                    <label className='form-label'>默认积分</label>
                    <input
                      type='number'
                      value={settings.defaultScore}
                      onChange={handleInputChange('defaultScore')}
                      className='form-input'
                    />
                  </div>
                  <div>
                    <label className='form-label'>最低积分</label>
                    <input
                      type='number'
                      value={settings.minScore}
                      onChange={handleInputChange('minScore')}
                      className='form-input'
                    />
                  </div>
                  <div>
                    <label className='form-label'>最高积分</label>
                    <input
                      type='number'
                      value={settings.maxScore}
                      onChange={handleInputChange('maxScore')}
                      className='form-input'
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className='card'>
              <div className='card-header'>
                <div className='flex items-center gap-2'>
                  <Bell className='w-5 h-5 text-gray-600' />
                  <h3 className='font-semibold text-gray-900'>通知设置</h3>
                </div>
              </div>
              <div className='card-body space-y-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <h4 className='font-medium text-gray-900'>启用通知</h4>
                    <p className='text-sm text-gray-500'>接收系统通知和提醒</p>
                  </div>
                  <PermissionButton
                    permission='system.manage'
                    onClick={() =>
                      updateSettingsField('enableNotifications', !settings.enableNotifications)
                    }
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.enableNotifications ? 'bg-primary-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                        settings.enableNotifications ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </PermissionButton>
                </div>

                <div className='flex items-center justify-between'>
                  <div>
                    <h4 className='font-medium text-gray-900'>通知声音</h4>
                    <p className='text-sm text-gray-500'>收到通知时播放提示音</p>
                  </div>
                  <PermissionButton
                    permission='system.manage'
                    onClick={() =>
                      updateSettingsField('notificationSound', !settings.notificationSound)
                    }
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.notificationSound ? 'bg-primary-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                        settings.notificationSound ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </PermissionButton>
                </div>

                <div className='flex items-center justify-between'>
                  <div>
                    <h4 className='font-medium text-gray-900'>自动保存</h4>
                    <p className='text-sm text-gray-500'>自动保存更改，无需手动保存</p>
                  </div>
                  <PermissionButton
                    permission='system.manage'
                    onClick={() => updateSettingsField('autoSave', !settings.autoSave)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.autoSave ? 'bg-primary-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                        settings.autoSave ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </PermissionButton>
                </div>
              </div>
            </div>

            <div className='card'>
              <div className='card-header'>
                <div className='flex items-center gap-2'>
                  <Shield className='w-5 h-5 text-gray-600' />
                  <h3 className='font-semibold text-gray-900'>外观设置</h3>
                </div>
              </div>
              <div className='card-body space-y-6'>
                <div>
                  <label className='form-label'>主题模式</label>
                  <div className='flex gap-3'>
                    {themeOptions.map((theme: ThemeOption) => (
                      <PermissionButton
                        permission='system.manage'
                        key={theme.id}
                        onClick={() => setSettings({ ...settings, theme: theme.id })}
                        className={`flex-1 p-4 rounded-xl border-2 transition-all text-left ${
                          settings.theme === theme.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className='font-medium text-gray-900'>{theme.label}</div>
                        <div className='text-xs text-gray-500 mt-1'>{theme.description}</div>
                      </PermissionButton>
                    ))}
                  </div>
                </div>

                <div>
                  <label className='form-label'>语言设置</label>
                  <select
                    value={settings.language}
                    onChange={handleSelectChange('language')}
                    className='form-select'
                  >
                    <option value='zh-CN'>简体中文</option>
                    <option value='zh-TW'>繁体中文</option>
                    <option value='en'>English</option>
                  </select>
                </div>
              </div>
            </div>

            <div className='card'>
              <div className='card-header'>
                <div className='flex items-center gap-2'>
                  <Database className='w-5 h-5 text-gray-600' />
                  <h3 className='font-semibold text-gray-900'>数据管理</h3>
                </div>
              </div>
              <div className='card-body'>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
                  <PermissionButton
                    permission='system.backup'
                    onClick={handleBackup}
                    disabled={loading.backup}
                    className='p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2'
                  >
                    <Download className='w-6 h-6 text-blue-600' />
                    <div className='font-medium text-blue-700'>备份数据库</div>
                    <div className='text-xs text-blue-600'>导出所有数据到文件</div>
                  </PermissionButton>
                  <PermissionButton
                    permission='system.restore'
                    onClick={() => fetchBackups()}
                    disabled={loading.restore}
                    className='p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2'
                  >
                    <Upload className='w-6 h-6 text-green-600' />
                    <div className='font-medium text-green-700'>恢复数据</div>
                    <div className='text-xs text-green-600'>从备份文件恢复数据</div>
                  </PermissionButton>
                  <PermissionButton
                    permission='system.clear-cache'
                    onClick={handleClearCache}
                    disabled={loading.cache}
                    className='p-4 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2'
                  >
                    <Trash2 className='w-6 h-6 text-orange-600' />
                    <div className='font-medium text-orange-700'>清理缓存</div>
                    <div className='text-xs text-orange-600'>清除临时数据和缓存</div>
                  </PermissionButton>
                </div>

                <div className='bg-gray-50 rounded-xl p-4'>
                  <div className='flex items-center gap-2 mb-3'>
                    <FileText className='w-4 h-4 text-gray-600' />
                    <h4 className='font-medium text-gray-700'>备份文件列表</h4>
                  </div>
                  {backups.length === 0 ? (
                    <p className='text-sm text-gray-500 text-center py-4'>暂无备份文件</p>
                  ) : (
                    <div className='space-y-2'>
                      {backups.map((backup: BackupInfo) => (
                        <div
                          key={backup.filename}
                          className='flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100'
                        >
                          <div>
                            <div className='font-medium text-gray-800'>{backup.filename}</div>
                            <div className='text-xs text-gray-500'>
                              {formatFileSize(backup.size)} -{' '}
                              {backup.modified ? new Date(backup.modified).toLocaleString() : new Date(backup.created_at).toLocaleString()}
                            </div>
                          </div>
                          <PermissionButton
                            permission='system.restore'
                            onClick={() => handleRestore(backup.filename)}
                            className='px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200 transition-colors'
                          >
                            恢复
                          </PermissionButton>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className='bg-yellow-50 border border-yellow-200 rounded-xl p-4'>
              <div className='flex items-start gap-3'>
                <AlertCircle className='w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5' />
                <div>
                  <h4 className='font-medium text-yellow-800'>注意事项</h4>
                  <p className='text-sm text-yellow-700 mt-1'>
                    修改系统设置后需要点击保存按钮才能生效。建议定期备份数据库，以防数据丢失。
                  </p>
                </div>
              </div>
            </div>

            <div className='flex gap-3'>
              <PermissionButton
                permission='system.manage'
                onClick={handleReset}
                disabled={loading.config}
                className='flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <RefreshCw className='w-4 h-4' />
                重置设置
              </PermissionButton>
              <PermissionButton
                permission='system.manage'
                onClick={handleSave}
                disabled={loading.config}
                className='btn btn-primary flex-1 justify-center'
              >
                {loading.config ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin mr-2' /> 保存中...
                  </>
                ) : saved ? (
                  <>
                    <Check className='w-4 h-4 mr-2' /> 已保存
                  </>
                ) : (
                  <>
                    <Save className='w-4 h-4 mr-2' /> 保存设置
                  </>
                )}
              </PermissionButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;