import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Clock, AlertCircle, CheckCircle, Calendar, Save, X } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { validateForm } from '../utils/validation';

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
  const { showToast } = useToast();
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

  const [formErrors, setFormErrors] = useState({});

  const validationRules = {
    name: ['required', { maxLength: 50 }],
    description: [{ maxLength: 200 }],
    start_hour: ['required', 'integer', { min: 0 }, { max: 23 }],
    start_minute: ['required', 'integer', { min: 0 }, { max: 59 }],
    end_hour: ['required', 'integer', { min: 0 }, { max: 23 }],
    end_minute: ['required', 'integer', { min: 0 }, { max: 59 }]
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await api.timeRules.getAll();
      setRules(response.rules || response);
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
      setRules(prev => prev.filter(r => r.id !== id));
      showToast('删除成功', 'success');
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const { isValid, errors } = validateForm(formData, validationRules);
    
    if (!isValid) {
      setFormErrors(errors);
      return;
    }
    
    if (formData.start_hour > formData.end_hour || 
        (formData.start_hour === formData.end_hour && formData.start_minute >= formData.end_minute)) {
      setFormErrors({ time: '结束时间必须晚于开始时间' });
      return;
    }
    
    setFormErrors({});
    
    try {
      if (editingRule) {
        await api.timeRules.update(editingRule.id, formData);
        setRules(prev => prev.map(r => r.id === editingRule.id ? { ...r, ...formData, id: editingRule.id } : r));
        showToast('更新成功', 'success');
      } else {
        const newRule = await api.timeRules.create(formData);
        setRules(prev => [newRule, ...prev]);
        showToast('添加成功', 'success');
      }
      setShowModal(false);
      setEditingRule(null);
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
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
          <div className="p-3 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl">
            <Clock className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">时间规则管理</h1>
            <p className="text-sm text-gray-500">管理手机箱开锁的时间规则</p>
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          添加规则
        </button>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
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
                    <tr key={rule.id}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">{rule.name}</span>
                          {rule.description && (
                            <span className="text-xs text-gray-400">- {rule.description}</span>
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
                            <CheckCircle className="w-5 h-5 text-success-500" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-gray-400" />
                          )}
                          <span className={`badge ${rule.allow_unlock ? 'badge-success' : 'badge-danger'}`}>
                            {rule.allow_unlock ? '允许开锁' : '禁止开锁'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(rule)}
                            className="btn-icon text-gray-500 hover:text-primary-600"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id)}
                            className="btn-icon text-gray-500 hover:text-danger-600"
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
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingRule(null); }}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                  {editingRule ? <Edit2 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{editingRule ? '编辑时间规则' : '添加新规则'}</h3>
                  <p className="text-xs text-gray-500">{editingRule ? '修改规则的详细信息' : '创建新的时间规则'}</p>
                </div>
              </div>
              <button onClick={() => { setShowModal(false); setEditingRule(null); }} className="p-2.5 hover:bg-gray-100 rounded-xl transition-all">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">规则名称 <span className="text-danger-500">*</span></label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) {
                      setFormErrors(prev => ({ ...prev, name: null }));
                    }
                  }}
                  className={`form-input ${formErrors.name ? 'border-danger-300 focus:ring-danger-500' : ''}`}
                  placeholder="如：上午上课"
                />
                {formErrors.name && (
                  <p className="mt-2 text-sm text-danger-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {formErrors.name}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                    if (formErrors.description) {
                      setFormErrors(prev => ({ ...prev, description: null }));
                    }
                  }}
                  className={`form-textarea ${formErrors.description ? 'border-danger-300 focus:ring-danger-500' : ''}`}
                  placeholder="规则描述"
                  rows={2}
                />
                {formErrors.description && (
                  <p className="mt-2 text-sm text-danger-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {formErrors.description}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">适用星期</label>
                <select
                  value={formData.day_of_week}
                  onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                  className="form-select"
                >
                  {weekDays.map((day) => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">开始时间</label>
                  <div className="flex gap-2 items-center">
                    <select
                      value={formData.start_hour}
                      onChange={(e) => {
                        setFormData({ ...formData, start_hour: parseInt(e.target.value) });
                        if (formErrors.start_hour || formErrors.time) {
                          setFormErrors(prev => ({ ...prev, start_hour: null, time: null }));
                        }
                      }}
                      className={`form-select flex-1 ${formErrors.start_hour ? 'border-danger-300 focus:ring-danger-500' : ''}`}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <span className="text-gray-400 font-semibold">:</span>
                    <select
                      value={formData.start_minute}
                      onChange={(e) => {
                        setFormData({ ...formData, start_minute: parseInt(e.target.value) });
                        if (formErrors.start_minute || formErrors.time) {
                          setFormErrors(prev => ({ ...prev, start_minute: null, time: null }));
                        }
                      }}
                      className={`form-select flex-1 ${formErrors.start_minute ? 'border-danger-300 focus:ring-danger-500' : ''}`}
                    >
                      {[0, 15, 30, 45].map((m) => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  {(formErrors.start_hour || formErrors.start_minute) && (
                    <p className="mt-2 text-sm text-danger-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {formErrors.start_hour || formErrors.start_minute}
                    </p>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">结束时间</label>
                  <div className="flex gap-2 items-center">
                    <select
                      value={formData.end_hour}
                      onChange={(e) => {
                        setFormData({ ...formData, end_hour: parseInt(e.target.value) });
                        if (formErrors.end_hour || formErrors.time) {
                          setFormErrors(prev => ({ ...prev, end_hour: null, time: null }));
                        }
                      }}
                      className={`form-select flex-1 ${formErrors.end_hour ? 'border-danger-300 focus:ring-danger-500' : ''}`}
                    >
                      {Array.from({ length: 25 }, (_, i) => (
                        <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <span className="text-gray-400 font-semibold">:</span>
                    <select
                      value={formData.end_minute}
                      onChange={(e) => {
                        setFormData({ ...formData, end_minute: parseInt(e.target.value) });
                        if (formErrors.end_minute || formErrors.time) {
                          setFormErrors(prev => ({ ...prev, end_minute: null, time: null }));
                        }
                      }}
                      className={`form-select flex-1 ${formErrors.end_minute ? 'border-danger-300 focus:ring-danger-500' : ''}`}
                    >
                      {[0, 15, 30, 45].map((m) => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  {(formErrors.end_hour || formErrors.end_minute) && (
                    <p className="mt-2 text-sm text-danger-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {formErrors.end_hour || formErrors.end_minute}
                    </p>
                  )}
                </div>
              </div>

              {formErrors.time && (
                <div className="form-group">
                  <p className="text-sm text-danger-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {formErrors.time}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">启用规则</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_unlock}
                    onChange={(e) => setFormData({ ...formData, allow_unlock: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">允许开锁</span>
                </label>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingRule(null); }}
                  className="btn btn-outline"
                >
                  取消
                </button>
                <button type="submit" className="btn btn-primary flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeRuleList;