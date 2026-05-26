import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, AlertCircle, X, RefreshCw, Check, Trophy, Star, Award, Medal, Crown, Sparkles, Zap, RotateCcw, Shield, Eye, Monitor, CheckCircle, TrendingUp, Rocket } from 'lucide-react';
import api from '../services/api';

const ICONS = ['Star', 'Award', 'Medal', 'Crown', 'Sparkles', 'Zap', 'RotateCcw', 'Shield', 'AlertTriangle', 'Eye', 'Search', 'Monitor', 'CheckCircle', 'TrendingUp', 'Rocket'];

const COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', 
  '#EF4444', '#6366F1', '#14B8A6', '#F97316', '#84CC16'
];

function RankRuleList() {
  const [rankRules, setRankRules] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    min_score: 0,
    max_score: 100,
    color: COLORS[0],
    icon: 'Star',
    description: '',
    is_active: true
  });

  useEffect(() => {
    fetchRankRules();
  }, []);

  const fetchRankRules = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.rankRules.getAll();
      setRankRules(data);
    } catch (err) {
      setError('获取排名规则失败: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: '请输入排名名称' });
      return;
    }

    if (formData.min_score >= formData.max_score) {
      setMessage({ type: 'error', text: '最低分必须小于最高分' });
      return;
    }

    try {
      if (editingRule) {
        await api.rankRules.update(editingRule.id, formData);
        setMessage({ type: 'success', text: '排名规则更新成功' });
      } else {
        await api.rankRules.create(formData);
        setMessage({ type: 'success', text: '排名规则添加成功' });
      }
      fetchRankRules();
      setShowModal(false);
      setEditingRule(null);
      setFormData({ name: '', min_score: 0, max_score: 100, color: COLORS[0], icon: 'Star', description: '', is_active: true });
    } catch (err) {
      setMessage({ type: 'error', text: '操作失败: ' + err.message });
    }

    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除该排名规则吗？此操作不可撤销。')) {
      return;
    }
    
    try {
      await api.rankRules.delete(id);
      setMessage({ type: 'success', text: '删除成功' });
      fetchRankRules();
    } catch (err) {
      setMessage({ type: 'error', text: '删除失败: ' + err.message });
    }
    
    setTimeout(() => setMessage(null), 3000);
  };

  const filteredRules = rankRules.filter(rule => 
    rule && rule.name && rule.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getIconComponent = (iconName) => {
    const icons = { Star, Award, Medal, Crown, Sparkles, Zap, RotateCcw, Shield, AlertCircle, Eye, Search, Monitor, CheckCircle, TrendingUp, Rocket };
    const Icon = icons[iconName] || Star;
    return Icon;
  };

  const sortedRules = [...filteredRules].sort((a, b) => b.min_score - a.min_score);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-7">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="page-title">排名规则</h2>
            <p className="page-subtitle">管理积分排名等级和分数段配置</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => fetchRankRules()} className="btn btn-outline flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button onClick={() => { setEditingRule(null); setShowModal(true); }} className="btn btn-primary shadow-lg hover:shadow-xl transition-all">
            <Plus className="w-5 h-5 mr-2" />
            添加等级
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-success-50 border border-success-200 text-success-700' 
            : 'bg-danger-50 border border-danger-200 text-danger-700'
        }`}>
          {message.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="font-medium">{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => { setError(null); fetchRankRules(); }} className="ml-auto text-danger-600 hover:text-danger-800">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索等级名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-12 w-72"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-xl">
              <Trophy className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-semibold text-primary-700">{filteredRules.length} 个等级</span>
            </div>
          </div>
        </div>

        <div className="card-body">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-gray-500 text-sm">加载中...</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedRules.map(rule => {
                const IconComponent = getIconComponent(rule.icon);
                return (
                  <div 
                    key={rule.id} 
                    className="card card-hover p-6 border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden"
                    style={{ borderColor: `${rule.color}40` }}
                  >
                    <div 
                      className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10"
                      style={{ backgroundColor: rule.color }}
                    />
                    
                    <div className="relative">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg"
                            style={{ backgroundColor: `${rule.color}20` }}
                          >
                            <IconComponent className="w-7 h-7" style={{ color: rule.color }} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-800">{rule.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold mt-1 inline-block ${
                              rule.is_active 
                                ? 'bg-success-100 text-success-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {rule.is_active ? '启用' : '禁用'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">分数范围</span>
                          <span className="font-bold text-lg" style={{ color: rule.color }}>
                            {rule.min_score} - {rule.max_score} 分
                          </span>
                        </div>
                        <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${((rule.max_score - rule.min_score) / 100) * 100}%`,
                              backgroundColor: rule.color 
                            }}
                          />
                        </div>
                      </div>

                      {rule.description && (
                        <p className="text-sm text-gray-600 mb-4">{rule.description}</p>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: rule.color }}
                          />
                          <span className="text-xs text-gray-500 font-mono">{rule.color}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEditingRule(rule); setFormData(rule); setShowModal(true); }}
                            className="btn-icon text-warning-500 hover:bg-warning-50 hover:text-warning-600"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id)}
                            className="btn-icon text-danger-500 hover:bg-danger-50 hover:text-danger-600"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredRules.length === 0 && (
                <div className="col-span-full text-center py-20">
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-5">
                    <Trophy className="w-12 h-12 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">暂无排名规则</h3>
                  <p className="text-gray-500 mb-6">添加等级开始配置排名体系</p>
                  <button onClick={() => setShowModal(true)} className="btn btn-primary shadow-lg hover:shadow-xl transition-all">
                    <Plus className="w-5 h-5 mr-2" />
                    添加第一个等级
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center">
                  {editingRule ? <Edit2 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{editingRule ? '编辑等级' : '添加新等级'}</h3>
                  <p className="text-xs text-gray-500">{editingRule ? '修改等级的详细信息' : '创建新的积分等级'}</p>
                </div>
              </div>
              <button onClick={() => { setShowModal(false); setEditingRule(null); }} className="p-2.5 hover:bg-gray-100 rounded-xl transition-all">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">等级名称 <span className="text-danger-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.rank_name}
                  onChange={(e) => setFormData({ ...formData, rank_name: e.target.value })}
                  className="form-input"
                  placeholder="如：卓越、优秀、合格"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">最低分 <span className="text-danger-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={formData.min_score}
                    onChange={(e) => setFormData({ ...formData, min_score: parseInt(e.target.value) || 0 })}
                    className="form-input"
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">最高分 <span className="text-danger-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={formData.max_score}
                    onChange={(e) => setFormData({ ...formData, max_score: parseInt(e.target.value) || 100 })}
                    className="form-input"
                    placeholder="100"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">颜色标识</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full transition-all hover:scale-110 ${
                        formData.color === color ? 'ring-2 ring-offset-2 ring-primary-500 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">图标选择</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(iconName => {
                    const Icon = getIconComponent(iconName);
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: iconName })}
                        className={`w-10 h-10 rounded-xl transition-all hover:scale-110 flex items-center justify-center ${
                          formData.icon === iconName 
                            ? 'bg-primary-500 text-white shadow-lg' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">等级描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="form-input resize-none"
                  rows={3}
                  placeholder="请输入等级描述"
                />
              </div>

              <div className="form-group">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">启用等级</span>
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => { setShowModal(false); setEditingRule(null); }} className="btn btn-outline">
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingRule ? '保存修改' : '添加等级'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RankRuleList;
