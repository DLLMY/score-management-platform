import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, AlertCircle, X, RefreshCw, Trophy, Star, Award, Medal, Crown, Sparkles, Zap, RotateCcw, Shield, Eye, Monitor, CheckCircle, TrendingUp, Rocket } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { validateForm } from '../utils/validation';

const ICONS = ['Star', 'Award', 'Medal', 'Crown', 'Sparkles', 'Zap', 'RotateCcw', 'Shield', 'AlertTriangle', 'Eye', 'Search', 'Monitor', 'CheckCircle', 'TrendingUp', 'Rocket'];

const COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', 
  '#EF4444', '#6366F1', '#14B8A6', '#F97316', '#84CC16'
];

function RankRuleList() {
  const { showToast } = useToast();
  const [rankRules, setRankRules] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    min_score: 0,
    max_score: 100,
    color: COLORS[0],
    icon: 'Star',
    description: '',
    is_active: true
  });

  const [formErrors, setFormErrors] = useState({});

  const validationRules = {
    rank_name: ['required', { maxLength: 50 }],
    min_score: ['required', 'integer', { min: 0 }, { max: 10000 }],
    max_score: ['required', 'integer', { min: 0 }, { max: 10000 }],
    description: [{ maxLength: 200 }]
  };

  useEffect(() => {
    fetchRankRules();
  }, []);

  const fetchRankRules = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.rankRules.getAll();
      setRankRules(data.rules || data);
    } catch (err) {
      setError('获取排名规则失败: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const { isValid, errors } = validateForm(formData, validationRules);
    
    if (!isValid) {
      setFormErrors(errors);
      return;
    }
    
    if (formData.min_score >= formData.max_score) {
      setFormErrors({ range: '最低分必须小于最高分' });
      return;
    }
    
    setFormErrors({});

    try {
      if (editingRule) {
        const updatedRule = await api.rankRules.update(editingRule.id, formData);
        showToast('排名规则更新成功', 'success');
        
        setRankRules(prevRules => 
          prevRules.map(rule => 
            rule.id === editingRule.id ? updatedRule : rule
          )
        );
      } else {
        const newRule = await api.rankRules.create(formData);
        showToast('排名规则添加成功', 'success');
        
        setRankRules(prevRules => [newRule, ...prevRules]);
      }
      setShowModal(false);
      setEditingRule(null);
      setFormData({ name: '', min_score: 0, max_score: 100, color: COLORS[0], icon: 'Star', description: '', is_active: true });
    } catch (err) {
      showToast('操作失败: ' + err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除该排名规则吗？此操作不可撤销。')) {
      return;
    }
    
    try {
      await api.rankRules.delete(id);
      showToast('删除成功', 'success');
      
      setRankRules(prevRules => prevRules.filter(rule => rule.id !== id));
    } catch (err) {
      showToast('删除失败: ' + err.message, 'error');
    }
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

      

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => { setError(null); fetchRankRules(); }} className="ml-auto text-danger-600 hover:text-danger-800">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-2xl border border-slate-700/50">
        <div className="px-6 py-5 border-b border-slate-700/50 bg-slate-700/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="搜索等级名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-72 px-12 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary-500/20 rounded-xl">
              <Trophy className="w-4 h-4 text-primary-400" />
              <span className="text-sm font-semibold text-primary-400">{filteredRules.length} 个等级</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-slate-400 text-sm">加载中...</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedRules.map(rule => {
                const IconComponent = getIconComponent(rule.icon);
                return (
                  <div 
                    key={rule.id} 
                    className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600/70 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden"
                    style={{ borderColor: `${rule.color}50` }}
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
                            <h3 className="text-xl font-bold text-white">{rule.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold mt-1 inline-block ${
                              rule.is_active 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                : 'bg-slate-600/50 text-slate-400'
                            }`}>
                              {rule.is_active ? '启用' : '禁用'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-700/50 rounded-xl p-4 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">分数范围</span>
                          <span className="font-bold text-lg" style={{ color: rule.color }}>
                            {rule.min_score} - {rule.max_score} 分
                          </span>
                        </div>
                        <div className="mt-3 h-2 bg-slate-600 rounded-full overflow-hidden">
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
                        <p className="text-sm text-slate-300 mb-4">{rule.description}</p>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-5 h-5 rounded-full border-2 border-slate-600"
                            style={{ backgroundColor: rule.color }}
                          />
                          <span className="text-xs text-slate-400 font-mono">{rule.color}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEditingRule(rule); setFormData(rule); setShowModal(true); }}
                            className="p-2.5 rounded-xl text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 transition-all"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id)}
                            className="p-2.5 rounded-xl text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
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
                  <div className="w-24 h-24 bg-gradient-to-br from-slate-700 to-slate-800 rounded-full flex items-center justify-center mx-auto mb-5">
                    <Trophy className="w-12 h-12 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-300 mb-2">暂无排名规则</h3>
                  <p className="text-slate-400 mb-6">添加等级开始配置排名体系</p>
                  <button onClick={() => setShowModal(true)} className="bg-gradient-to-r from-primary-500 via-blue-500 to-accent-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-xl hover:shadow-primary-500/30 hover:scale-[1.02] transition-all">
                    <Plus className="w-5 h-5 mr-2 inline" />
                    添加第一个等级
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-start justify-center z-[100] p-4 pt-16" onClick={() => setShowModal(false)}>
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-700/50 flex items-center justify-between bg-slate-700/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center">
                  {editingRule ? <Edit2 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{editingRule ? '编辑等级' : '添加新等级'}</h3>
                  <p className="text-xs text-slate-400">{editingRule ? '修改等级的详细信息' : '创建新的积分等级'}</p>
                </div>
              </div>
              <button onClick={() => { setShowModal(false); setEditingRule(null); }} className="p-2.5 hover:bg-slate-700/50 rounded-xl transition-all">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-300 mb-2.5">等级名称 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={formData.rank_name}
                  onChange={(e) => {
                    setFormData({ ...formData, rank_name: e.target.value });
                    if (formErrors.rank_name) {
                      setFormErrors(prev => ({ ...prev, rank_name: null }));
                    }
                  }}
                  className={`w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 ${formErrors.rank_name ? 'border-red-500/50 focus:ring-red-500/50' : ''}`}
                  placeholder="如：卓越、优秀、合格"
                />
                {formErrors.rank_name && (
                  <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {formErrors.rank_name}
                  </p>
                )}
              </div>

              {formErrors.range && (
                <div className="mb-5">
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {formErrors.range}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-slate-300 mb-2.5">最低分 <span className="text-red-400">*</span></label>
                  <input
                    type="number"
                    min="0"
                    value={formData.min_score}
                    onChange={(e) => {
                      setFormData({ ...formData, min_score: parseInt(e.target.value) || 0 });
                      if (formErrors.min_score || formErrors.range) {
                        setFormErrors(prev => ({ ...prev, min_score: null, range: null }));
                      }
                    }}
                    className={`w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 ${formErrors.min_score ? 'border-red-500/50 focus:ring-red-500/50' : ''}`}
                    placeholder="0"
                  />
                  {formErrors.min_score && (
                    <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {formErrors.min_score}
                    </p>
                  )}
                </div>
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-slate-300 mb-2.5">最高分 <span className="text-red-400">*</span></label>
                  <input
                    type="number"
                    min="0"
                    value={formData.max_score}
                    onChange={(e) => {
                      setFormData({ ...formData, max_score: parseInt(e.target.value) || 100 });
                      if (formErrors.max_score || formErrors.range) {
                        setFormErrors(prev => ({ ...prev, max_score: null, range: null }));
                      }
                    }}
                    className={`w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 ${formErrors.max_score ? 'border-red-500/50 focus:ring-red-500/50' : ''}`}
                    placeholder="100"
                  />
                  {formErrors.max_score && (
                    <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {formErrors.max_score}
                    </p>
                  )}
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-300 mb-2.5">颜色标识</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full transition-all hover:scale-110 ${
                        formData.color === color ? 'ring-2 ring-offset-2 ring-primary-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-300 mb-2.5">图标选择</label>
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
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-300 mb-2.5">等级描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                    if (formErrors.description) {
                      setFormErrors(prev => ({ ...prev, description: null }));
                    }
                  }}
                  className={`w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 resize-none ${formErrors.description ? 'border-red-500/50 focus:ring-red-500/50' : ''}`}
                  rows={3}
                  placeholder="请输入等级描述"
                />
                {formErrors.description && (
                  <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {formErrors.description}
                  </p>
                )}
              </div>

              <div className="mb-5">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 text-primary-500 rounded focus:ring-primary-500 bg-slate-700 border-slate-600"
                  />
                  <span className="text-sm font-medium text-slate-300">启用等级</span>
                </label>
              </div>

              <div className="px-6 py-4 border-t border-slate-700/50 flex justify-end gap-3 bg-slate-700/10">
                <button type="button" onClick={() => { setShowModal(false); setEditingRule(null); }} className="px-4 py-2.5 rounded-xl font-medium border-2 border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500 hover:text-white transition-all">
                  取消
                </button>
                <button type="submit" className="bg-gradient-to-r from-primary-500 via-blue-500 to-accent-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:shadow-xl hover:shadow-primary-500/30 hover:scale-[1.02] transition-all">
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
