import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import api, { type SystemConfig, type BackupInfo } from '../services/api';
import { useStableToast } from '../hooks';
import { useConfirm } from '../components';
import SettingsView, { type SystemSettings, type LoadingState } from './settings/SettingsView';

function Settings() {
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
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
  const updateSettingsField = useCallback(
    (field: keyof SystemSettings, value: string | number | boolean): void => {
      setSettings((prev: SystemSettings) => ({ ...prev, [field]: value }));
    },
    []
  );

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
      logger.error('加载配置失败:', error);
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
      logger.error('获取备份列表失败:', error);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    fetchBackups();
  }, [loadConfig, fetchBackups]);

  const handleSave = useCallback(async (): Promise<void> => {
    // M3: 数值边界校验，防止 min>max 或非法范围写入
    if (settings.minScore > settings.maxScore) {
      showToast('error', '最低分不能大于最高分');
      return;
    }
    if (settings.defaultScore < settings.minScore || settings.defaultScore > settings.maxScore) {
      showToast('error', '默认分需在最低分与最高分之间');
      return;
    }
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
    // M1: 覆盖全部系统配置前二次确认
    const ok = await confirmRef.current({
      message: '确定要恢复默认设置吗？当前全部系统配置将被覆盖。',
      confirmText: '确定',
      cancelText: '取消',
      type: 'warning',
    });
    if (!ok) return;
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
      const ok = await confirmRef.current({
        message: `确定要从备份文件 ${filename} 恢复数据吗？此操作将覆盖当前数据！`,
        confirmText: '确定',
        cancelText: '取消',
        type: 'warning',
      });
      if (!ok) return;
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
    const ok = await confirmRef.current({
      message: '确定要清理缓存吗？',
      confirmText: '确定',
      cancelText: '取消',
      type: 'info',
    });
    if (!ok) return;
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

  const handleInputChange =
    (field: keyof SystemSettings) =>
    (e: ChangeEvent<HTMLInputElement>): void => {
      const value = e.target.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value;
      updateSettingsField(field, value);
    };

  const handleSelectChange =
    (field: keyof SystemSettings) =>
    (e: ChangeEvent<HTMLSelectElement>): void => {
      updateSettingsField(field, e.target.value);
    };

  const handleToggle = useCallback(
    (field: keyof SystemSettings): void => {
      updateSettingsField(field, !settings[field]);
    },
    [settings, updateSettingsField]
  );

  const handleThemeSelect = useCallback((themeId: string): void => {
    setSettings((prev) => ({ ...prev, theme: themeId }));
  }, []);

  return (
    <SettingsView
      settings={settings}
      saved={saved}
      backups={backups}
      loadError={loadError}
      loading={loading}
      onInputChange={handleInputChange}
      onSelectChange={handleSelectChange}
      onToggle={handleToggle}
      onThemeSelect={handleThemeSelect}
      onSave={handleSave}
      onReset={handleReset}
      onBackup={handleBackup}
      onRefreshBackups={fetchBackups}
      onRestore={handleRestore}
      onClearCache={handleClearCache}
    />
  );
}

export default Settings;
