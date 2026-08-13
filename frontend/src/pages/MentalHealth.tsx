import { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  X,
  Check,
  Heart,
  Moon,
  Activity,
  Smile,
  Frown,
  Meh,
  Sparkles,
  Clock,
} from 'lucide-react';
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import {
  MentalHealthRecord,
  MentalHealthRecordCreateInput,
  MentalHealthAlert,
} from '../types';

interface RecordFormData {
  student_id: number;
  mood_level: number;
  stress_level: number;
  sleep_hours: number;
  notes: string;
}

const defaultRecordForm: RecordFormData = {
  student_id: 0,
  mood_level: 3,
  stress_level: 3,
  sleep_hours: 8,
  notes: '',
};

function MentalHealth() {
  const { showToast } = useStableToast();
  const [records, setRecords] = useState<MentalHealthRecord[]>([]);
  const [alerts, setAlerts] = useState<MentalHealthAlert[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState<boolean>(false);
  const [formData, setFormData] = useState<RecordFormData>(defaultRecordForm);
  const [errors, setErrors] = useState<Partial<Record<keyof RecordFormData, string>>>({});
  const [activeTab, setActiveTab] = useState<'records' | 'alerts'>('records');

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.mentalHealth.getRecords();
      setRecords(data || []);
    } catch (error) {
      console.error('获取心理健康记录失败:', error);
      showToast('error', '获取心理健康记录失败');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await api.mentalHealth.getAlerts();
      setAlerts(data || []);
    } catch (error) {
      console.error('获取预警列表失败:', error);
      setAlerts(null); // 加载失败：不伪装成"已处理"或"无预警"
      showToast('error', '获取预警列表失败，请稍后重试');
    }
  }, [showToast]);

  useEffect(() => {
    fetchRecords();
    fetchAlerts();
  }, [fetchRecords, fetchAlerts]);

  const filteredRecords = records.filter(
    (r) =>
      (r.student_name && r.student_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.notes && r.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const unresolvedAlerts = (alerts || []).filter((a) => !a.is_resolved);
  const resolvedAlerts = (alerts || []).filter((a) => a.is_resolved);

  const handleOpenForm = useCallback(() => {
    setFormData(defaultRecordForm);
    setErrors({});
    setShowForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setFormData(defaultRecordForm);
    setErrors({});
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof RecordFormData, string>> = {};
    if (!formData.student_id || formData.student_id <= 0) newErrors.student_id = '请输入学生 ID';
    if (formData.mood_level < 1 || formData.mood_level > 5) newErrors.mood_level = '心情等级需在 1-5 之间';
    if (formData.stress_level < 1 || formData.stress_level > 5) newErrors.stress_level = '压力等级需在 1-5 之间';
    if (formData.sleep_hours < 0 || formData.sleep_hours > 24) newErrors.sleep_hours = '睡眠小时数需在 0-24 之间';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    try {
      const data: MentalHealthRecordCreateInput = {
        student_id: formData.student_id,
        mood_level: formData.mood_level,
        stress_level: formData.stress_level,
        sleep_hours: formData.sleep_hours,
        notes: formData.notes,
      };
      await api.mentalHealth.createRecord(data);
      showToast('success', '心理健康记录创建成功');
      handleCloseForm();
      fetchRecords();
      fetchAlerts();
    } catch (error) {
      console.error('创建记录失败:', error);
      showToast('error', '创建记录失败');
    }
  }, [formData, showToast, handleCloseForm, fetchRecords, fetchAlerts, validateForm]);

  const handleResolveAlert = useCallback(
    async (alertId: number) => {
      try {
        await api.mentalHealth.resolveAlert(alertId);
        showToast('success', '预警已解决');
        fetchAlerts();
      } catch (error) {
        console.error('解决预警失败:', error);
        showToast('error', '解决预警失败');
      }
    },
    [showToast, fetchAlerts]
  );

  const getMoodIcon = (level: number) => {
    if (level <= 2) return <Frown className="w-5 h-5 text-red-500" />;
    if (level === 3) return <Meh className="w-5 h-5 text-amber-500" />;
    return <Smile className="w-5 h-5 text-emerald-500" />;
  };

  const getMoodLabel = (level: number) => {
    const labels: Record<number, string> = { 1: '很差', 2: '较差', 3: '一般', 4: '良好', 5: '优秀' };
    return labels[level] || '未知';
  };

  const getStressLabel = (level: number) => {
    const labels: Record<number, string> = { 1: '极低', 2: '较低', 3: '中等', 4: '较高', 5: '极高' };
    return labels[level] || '未知';
  };

  const getAlertSeverityColor = (severity: number) => {
    if (severity >= 4) return 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800';
    if (severity >= 3) return 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    return 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800';
  };

  const getAlertSeverityLabel = (severity: number) => {
    if (severity >= 4) return '高危';
    if (severity >= 3) return '中等';
    return '低';
  };

  const avgMood = records.length > 0 ? (records.reduce((sum, r) => sum + (r.mood_level || 0), 0) / records.length).toFixed(1) : '—';
  const avgStress = records.length > 0 ? (records.reduce((sum, r) => sum + (r.stress_level || 0), 0) / records.length).toFixed(1) : '—';
  const avgSleep = records.length > 0 ? (records.reduce((sum, r) => sum + (r.sleep_hours || 0), 0) / records.length).toFixed(1) : '—';

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text">
                心理健康
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">记录心理健康数据与预警管理</p>
            </div>
          </div>
          <button
            onClick={handleOpenForm}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium"
          >
            <Plus className="w-5 h-5" />
            快速记录
          </button>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-full -mr-6 -mt-6 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">平均心情</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{avgMood}</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full -mr-6 -mt-6 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">平均压力</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{avgStress}</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full -mr-6 -mt-6 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <Moon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">平均睡眠</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{avgSleep}h</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-red-500/10 to-pink-500/10 rounded-full -mr-6 -mt-6 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">未处理预警</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{alerts === null ? '—' : unresolvedAlerts.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜索学生或备注..."
                  className="w-64 pl-12 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('records')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'records'
                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                记录 ({records.length})
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'alerts'
                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                预警 ({alerts === null ? '—' : unresolvedAlerts.length})
              </button>
            </div>
          </div>

          {activeTab === 'records' ? (
            <div>
              {isLoading ? (
                <div className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">加载中...</p>
                  </div>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <Brain className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">暂无心理健康记录</p>
                    <button onClick={handleOpenForm} className="text-cyan-500 hover:text-cyan-600 font-medium text-sm">
                      创建第一条记录
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-700/50 dark:to-slate-700/30">
                        <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">学生</th>
                        <th className="px-5 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">心情</th>
                        <th className="px-5 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">压力</th>
                        <th className="px-5 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">睡眠</th>
                        <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">备注</th>
                        <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {filteredRecords.map((record) => (
                        <tr
                          key={record.id}
                          className="group hover:bg-gradient-to-r hover:from-cyan-50/50 hover:to-blue-50/50 dark:hover:from-slate-700/50 dark:hover:to-slate-700/30 transition-all duration-200"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 flex items-center justify-center">
                                <Brain className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                              </div>
                              <p className="font-medium text-slate-800 dark:text-slate-200">
                                {record.student_name || `学生 #${record.student_id}`}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {getMoodIcon(record.mood_level || 3)}
                              <span className="text-sm text-slate-600 dark:text-slate-300">
                                {getMoodLabel(record.mood_level || 3)}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                (record.stress_level || 3) >= 4
                                  ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                  : (record.stress_level || 3) >= 3
                                  ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                  : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {getStressLabel(record.stress_level || 3)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                              <Moon className="w-4 h-4 text-indigo-400" />
                              {record.sleep_hours}h
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">
                            {record.notes || '-'}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                              <Clock className="w-4 h-4" />
                              {record.created_at}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="p-5 space-y-4">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    未处理预警 ({unresolvedAlerts.length})
                  </h3>
                  {alerts === null ? (
                    <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl px-5 py-8 text-center">
                      <AlertTriangle className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 dark:text-slate-400 font-medium">预警加载失败</p>
                      <p className="text-xs text-gray-400 mt-1">请刷新或稍后重试</p>
                    </div>
                  ) : unresolvedAlerts.length === 0 ? (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-5 py-8 text-center">
                      <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                      <p className="text-emerald-700 dark:text-emerald-300 font-medium">所有预警已处理</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {unresolvedAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`p-4 rounded-xl border ${getAlertSeverityColor(alert.severity)} transition-all hover:shadow-md`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-white/50 dark:bg-slate-800/50 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold">
                                    {alert.student_name || `学生 #${alert.student_id}`}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 dark:bg-slate-800/50 font-medium">
                                    {getAlertSeverityLabel(alert.severity)}
                                  </span>
                                </div>
                                <p className="text-sm opacity-80">{alert.message}</p>
                                <p className="text-xs mt-1 opacity-60">{alert.created_at}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleResolveAlert(alert.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all text-sm font-medium"
                            >
                              <Check className="w-4 h-4" />
                              解决
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {resolvedAlerts.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      已处理预警 ({resolvedAlerts.length})
                    </h3>
                    <div className="space-y-2">
                      {resolvedAlerts.slice(0, 5).map((alert) => (
                        <div
                          key={alert.id}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-70"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{alert.student_name || `学生 #${alert.student_id}`}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">{alert.message}</span>
                            </div>
                            <span className="text-xs text-emerald-500 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              已解决
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleCloseForm}>
          <div
            className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">快速记录</h3>
                </div>
                <button
                  onClick={handleCloseForm}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  学生 ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.student_id || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, student_id: Number(e.target.value) }))}
                  placeholder="输入学生 ID"
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-slate-800 dark:text-slate-100 ${
                    errors.student_id ? 'border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-cyan-500'
                  }`}
                />
                {errors.student_id && <p className="mt-1 text-xs text-red-500">{errors.student_id}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">心情等级</label>
                <div className="flex items-center gap-2">
                  {[
                    { value: 1, icon: <Frown className="w-6 h-6" />, label: '很差', color: 'red' },
                    { value: 2, icon: <Frown className="w-6 h-6" />, label: '较差', color: 'orange' },
                    { value: 3, icon: <Meh className="w-6 h-6" />, label: '一般', color: 'amber' },
                    { value: 4, icon: <Smile className="w-6 h-6" />, label: '良好', color: 'lime' },
                    { value: 5, icon: <Smile className="w-6 h-6" />, label: '优秀', color: 'emerald' },
                  ].map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, mood_level: m.value }))}
                      className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all ${
                        formData.mood_level === m.value
                          ? `bg-${m.color}-500 text-white shadow-lg`
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {m.icon}
                      <span className="text-xs font-medium">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">压力等级</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, stress_level: level }))}
                      className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                        formData.stress_level >= level
                          ? level <= 2
                            ? 'bg-emerald-500 text-white'
                            : level <= 3
                            ? 'bg-amber-500 text-white'
                            : 'bg-red-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>低</span>
                  <span>高</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  睡眠小时数 ({formData.sleep_hours}h)
                </label>
                <input
                  type="range"
                  min="0"
                  max="24"
                  step="0.5"
                  value={formData.sleep_hours}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sleep_hours: Number(e.target.value) }))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>0h</span>
                  <span>12h</span>
                  <span>24h</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">备注</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="添加备注（可选）"
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all resize-none text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={handleCloseForm}
                className="px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200 font-medium"
              >
                <Check className="w-5 h-5" />
                保存记录
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MentalHealth;