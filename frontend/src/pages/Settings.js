import { useState, useEffect, useCallback } from 'react';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Palette, 
  Database, 
  Save, 
  RefreshCw,
  Check,
  AlertCircle,
  Download,
  Upload,
  Trash2,
  FileText,
  Loader2
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

function Settings() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState({
    systemName: '积分管理平台',
    systemLogo: '',
    defaultScore: 60,
    minScore: 0,
    maxScore: 100,
    enableNotifications: true,
    notificationSound: true,
    autoSave: true,
    theme: 'light',
    language: 'zh-CN'
  });

  const [saved, setSaved] = useState(false);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState({ backup: false, restore: false, cache: false, config: true });

  // 记忆化配置更新函数
  const updateSettingsField = useCallback((field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  }, []);

  // 加载系统配置
  const loadConfig = useCallback(async () => {
    try {
      const data = await api.system.getConfig();
      setSettings({
        systemName: data.system_name,
        systemLogo: data.system_logo,
        defaultScore: data.default_score,
        minScore: data.min_score,
        maxScore: data.max_score,
        enableNotifications: data.enable_notifications,
        notificationSound: data.notification_sound,
        autoSave: data.auto_save,
        theme: data.theme,
        language: data.language
      });
    } catch (error) {
      console.error('加载配置失败:', error);
    } finally {
      setLoading(prev => ({ ...prev, config: false }));
    }
  }, []);

  // 获取备份列表
  const fetchBackups = useCallback(async () => {
    try {
      const data = await api.system.listBackups();
      setBackups(data);
    } catch (error) {
      console.error('获取备份列表失败:', error);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    fetchBackups();
  }, [loadConfig, fetchBackups]);

  const handleSave = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, config: true }));
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
        language: settings.language
      });
      setSaved(true);
      showToast('配置已保存', 'success');
      setTimeout(() => {
        setSaved(false);
      }, 2000);
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, config: false }));
    }
  }, [settings, showToast]);

  const handleReset = useCallback(async () => {
    const defaultSettings = {
      systemName: '积分管理平台',
      systemLogo: '',
      defaultScore: 60,
      minScore: 0,
      maxScore: 100,
      enableNotifications: true,
      notificationSound: true,
      autoSave: true,
      theme: 'light',
      language: 'zh-CN'
    };
    setSettings(defaultSettings);
    try {
      setLoading(prev => ({ ...prev, config: true }));
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
        language: defaultSettings.language
      });
      showToast('已恢复默认设置', 'success');
    } catch (error) {
      showToast('恢复失败: ' + error.message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, config: false }));
    }
  }, [showToast]);

  const handleBackup = useCallback(async () => {
    setLoading(prev => ({ ...prev, backup: true }));
    try {
      const response = await api.system.backup();
      showToast(response.message, 'success');
      fetchBackups();
    } catch (error) {
      showToast('备份失败: ' + error.message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, backup: false }));
    }
  }, [showToast, fetchBackups]);

  const handleRestore = useCallback(async (filename) => {
    if (!window.confirm(`确定要从备份文件 ${filename} 恢复数据吗？此操作将覆盖当前数据！`)) {
      return;
    }
    setLoading(prev => ({ ...prev, restore: true }));
    try {
      const response = await api.system.restore(filename);
      showToast(response.message, 'success');
    } catch (error) {
      showToast('恢复失败: ' + error.message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, restore: false }));
    }
  }, [showToast]);

  const handleClearCache = useCallback(async () => {
    if (!window.confirm('确定要清理缓存吗？')) {
      return;
    }
    setLoading(prev => ({ ...prev, cache: true }));
    try {
      const response = await api.system.clearCache();
      showToast(response.message, 'success');
    } catch (error) {
      showToast('清理失败: ' + error.message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, cache: false }));
    }
  }, [showToast]);

  const formatFileSize = useCallback((bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center shadow-lg">
              <SettingsIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">系统设置</h1>
              <p className="text-sm text-gray-500">配置系统参数和偏好设置</p>
            </div>
          </div>
        </header>

        {loading.config ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />
            <p className="text-gray-500">加载配置中...</p>
          </div>
        ) : (
          <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">基本设置</h3>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">系统名称</label>
                <input
                  type="text"
                  value={settings.systemName}
                  onChange={(e) => updateSettingsField('systemName', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">默认积分</label>
                  <input
                    type="number"
                    value={settings.defaultScore}
                    onChange={(e) => updateSettingsField('defaultScore', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">最低积分</label>
                  <input
                    type="number"
                    value={settings.minScore}
                    onChange={(e) => updateSettingsField('minScore', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">最高积分</label>
                  <input
                    type="number"
                    value={settings.maxScore}
                    onChange={(e) => updateSettingsField('maxScore', parseInt(e.target.value) || 100)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">通知设置</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">启用通知</h4>
                  <p className="text-sm text-gray-500">接收系统通知和提醒</p>
                </div>
                <button
                  onClick={() => updateSettingsField('enableNotifications', !settings.enableNotifications)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.enableNotifications ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                      settings.enableNotifications ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">通知声音</h4>
                  <p className="text-sm text-gray-500">收到通知时播放提示音</p>
                </div>
                <button
                  onClick={() => updateSettingsField('notificationSound', !settings.notificationSound)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.notificationSound ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                      settings.notificationSound ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">自动保存</h4>
                  <p className="text-sm text-gray-500">自动保存更改，无需手动保存</p>
                </div>
                <button
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
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">外观设置</h3>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">主题模式</label>
                <div className="flex gap-3">
                  {[
                    { id: 'light', label: '浅色', description: '明亮清爽的界面' },
                    { id: 'dark', label: '深色', description: '护眼暗色界面' },
                    { id: 'auto', label: '跟随系统', description: '根据系统设置自动切换' }
                  ].map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => setSettings({ ...settings, theme })}
                      className={`flex-1 p-4 rounded-xl border-2 transition-all text-left ${
                        settings.theme === theme.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{theme.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{theme.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">语言设置</label>
                <select
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="zh-TW">繁体中文</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">数据管理</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <button
                  onClick={handleBackup}
                  disabled={loading.backup}
                  className="p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2"
                >
                  <Download className="w-6 h-6 text-blue-600" />
                  <div className="font-medium text-blue-700">备份数据库</div>
                  <div className="text-xs text-blue-600">导出所有数据到文件</div>
                </button>
                <button
                  onClick={() => fetchBackups()}
                  disabled={loading.restore}
                  className="p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2"
                >
                  <Upload className="w-6 h-6 text-green-600" />
                  <div className="font-medium text-green-700">恢复数据</div>
                  <div className="text-xs text-green-600">从备份文件恢复数据</div>
                </button>
                <button
                  onClick={handleClearCache}
                  disabled={loading.cache}
                  className="p-4 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2"
                >
                  <Trash2 className="w-6 h-6 text-orange-600" />
                  <div className="font-medium text-orange-700">清理缓存</div>
                  <div className="text-xs text-orange-600">清除临时数据和缓存</div>
                </button>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <h4 className="font-medium text-gray-700">备份文件列表</h4>
                </div>
                {backups.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">暂无备份文件</p>
                ) : (
                  <div className="space-y-2">
                    {backups.map(backup => (
                      <div key={backup.filename} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                        <div>
                          <div className="font-medium text-gray-800">{backup.filename}</div>
                          <div className="text-xs text-gray-500">
                            {formatFileSize(backup.size)} - {new Date(backup.modified).toLocaleString()}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRestore(backup.filename)}
                          className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200 transition-colors"
                        >
                          恢复
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800">注意事项</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  修改系统设置后需要点击保存按钮才能生效。建议定期备份数据库，以防数据丢失。
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={loading.config}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-4 h-4" />
              重置设置
            </button>
            <button
              onClick={handleSave}
              disabled={loading.config}
              className="flex-1 py-3 bg-gradient-to-r from-primary-500 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading.config ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 保存中...</>
              ) : saved ? (
                <><Check className="w-4 h-4" /> 已保存</>
              ) : (
                <><Save className="w-4 h-4" /> 保存设置</>
              )}
            </button>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;
