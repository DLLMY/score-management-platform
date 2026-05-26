import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Clock, AlertCircle, CheckCircle, Calendar, Save, X } from 'lucide-react';
import api from '../services/api';

const weekDays = [
  { value: -1, label: '每天' },
  { value: 0, label: '周一' },
  { value: 1, label: '周二' },
  { value: 2, label: '周三' },
  { value: 3, label: '周四' },
  { value: 4, label: '周五' },
  { value: 5, label: '周六' },
  { value: 6, label: '周日' }
];

const TimeRuleList = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    day_of_week: -1,
    start_hour: 8,
    start_minute: 0,
    end_hour: 12,
    end_minute: 0,
    is_active: true,
    allow_unlock: false
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await api.timeRules.getAll();
      setRules(response);
    } catch (error) {
      console.error('获取时间规则失败:', error);
    }
    setLoading(false);
  };

  const handleAdd = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      description: '',
      day_of_week: -1,
      start_hour: 8,
      start_minute: 0,
      end_hour: 12,
      end_minute: 0,
      is_active: true,
      allow_unlock: false
    });
    setShowModal(true);
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      day_of_week: rule.day_of_week,
      start_hour: rule.start_hour,
      start_minute: rule.start_minute,
      end_hour: rule.end_hour,
      end_minute: rule.end_minute,
      is_active: rule.is_active,
      allow_unlock: rule.allow_unlock
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除这条规则吗？')) return;
    try {
      await api.timeRules.delete(id);
      fetchRules();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('请输入规则名称');
      return;
    }
    try {
      if (editingRule) {
        await api.timeRules.update(editingRule.id, formData);
      } else {
        await api.timeRules.create(formData);
      }
      setShowModal(false);
      fetchRules();
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const getDayLabel = (value) => {
    const day = weekDays.find(d => d.value === value);
    return day ? day.label : '未知';
  };

  const formatTime = (hour, minute) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-xl">
            <Clock className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">时间规则管理</h1>
            <p className="text-gray-500">管理手机箱开锁的时间规则</p>
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          添加规则
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">规则名称</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">时间段</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">适用星期</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">状态</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    加载中...
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    暂无时间规则，点击上方按钮添加
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{rule.name}</span>
                        {rule.description && (
                          <span className="text-xs text-gray-400">{rule.description}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatTime(rule.start_hour, rule.start_minute)} - {formatTime(rule.end_hour, rule.end_minute)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {getDayLabel(rule.day_of_week)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {rule.is_active ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-gray-400" />
                        )}
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          rule.allow_unlock 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {rule.allow_unlock ? '允许开锁' : '禁止开锁'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(rule)}
                          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="编辑"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-gray-800">
                  {editingRule ? '编辑时间规则' : '添加时间规则'}
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">规则名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="如：上午上课"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="规则描述"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">适用星期</label>
                <select
                  value={formData.day_of_week}
                  onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {weekDays.map((day) => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.start_hour}
                      onChange={(e) => setFormData({ ...formData, start_hour: parseInt(e.target.value) })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <span className="flex items-center text-gray-400">:</span>
                    <select
                      value={formData.start_minute}
                      onChange={(e) => setFormData({ ...formData, start_minute: parseInt(e.target.value) })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {[0, 15, 30, 45].map((m) => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.end_hour}
                      onChange={(e) => setFormData({ ...formData, end_hour: parseInt(e.target.value) })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {Array.from({ length: 25 }, (_, i) => (
                        <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <span className="flex items-center text-gray-400">:</span>
                    <select
                      value={formData.end_minute}
                      onChange={(e) => setFormData({ ...formData, end_minute: parseInt(e.target.value) })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {[0, 15, 30, 45].map((m) => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">启用规则</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_unlock}
                    onChange={(e) => setFormData({ ...formData, allow_unlock: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">允许开锁</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeRuleList;
