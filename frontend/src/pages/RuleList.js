import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Download, Upload, AlertCircle, X, Filter, RefreshCw, FileJson, Sliders, Info } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { validateForm } from '../utils/validation';

function RuleList() {
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  
  const { showToast } = useToast();
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 50,
    total: 0,
    pages: 0
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    score: 0,
    is_active: true,
    max_per_day: 0,
    min_interval: 0
  });

  const [formErrors, setFormErrors] = useState({});

  const validationRules = {
    name: ['required', { maxLength: 100 }],
    score: ['required', 'integer', { min: -1000 }, { max: 1000 }],
    description: [{ maxLength: 500 }],
    max_per_day: ['integer', { min: 0 }, { max: 100 }],
    min_interval: ['integer', { min: 0 }, { max: 1440 }]
  };

  const fetchCategories = useCallback(async () => {
    try {
      const data = await api.categories.getAll();
      setCategories(data.categories || data);
    } catch (err) {
      console.error('获取分类失败:', err);
    }
  }, []);

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.rules.getAll({
        page: pagination.page,
        per_page: pagination.per_page,
        category_id: selectedCategory || undefined,
        is_active: null
      });
      if (Array.isArray(data)) {
        setRules(data);
        setPagination(prev => ({
          ...prev,
          total: data.length,
          pages: 1
        }));
      } else {
        setRules(data.rules || []);
        setPagination(prev => ({
          ...prev,
          total: data.total,
          pages: data.pages
        }));
      }
    } catch (err) {
      setError('获取规则列表失败: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.per_page, selectedCategory]);

  useEffect(() => {
    fetchRules();
    fetchCategories();
  }, [fetchRules, fetchCategories]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    const { isValid, errors } = validateForm(formData, validationRules);
    
    if (!isValid) {
      setFormErrors(errors);
      return;
    }
    
    setFormErrors({});

    try {
      if (editingRule) {
        const updatedRule = await api.rules.update(editingRule.id, formData);
        showToast('规则更新成功', 'success');
        
        setRules(prevRules => 
          prevRules.map(rule => 
            rule.id === editingRule.id ? updatedRule : rule
          )
        );
      } else {
        const newRule = await api.rules.create(formData);
        showToast('规则添加成功', 'success');
        
        setRules(prevRules => [newRule, ...prevRules]);
      }
      setShowModal(false);
      setEditingRule(null);
      setFormData({ name: '', description: '', category_id: '', score: 0, is_active: true, max_per_day: 0, min_interval: 0 });
    } catch (err) {
      showToast('操作失败: ' + err.message, 'error');
    }
  }, [formData, editingRule, showToast]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('确定要删除该规则吗？此操作不可撤销。')) {
      return;
    }
    
    try {
      await api.rules.delete(id);
      showToast('删除成功', 'success');
      
      setRules(prevRules => prevRules.filter(rule => rule.id !== id));
    } catch (err) {
      showToast('删除失败: ' + err.message, 'error');
    }
  }, [showToast]);

  const handleExport = useCallback(async () => {
    try {
      const data = await api.rules.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'score_rules.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('导出成功', 'success');
    } catch (err) {
      showToast('导出失败: ' + err.message, 'error');
    }
  }, [showToast]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const response = await fetch(api.rules.downloadTemplate());
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rule_import_template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('下载模板失败:', error);
      showToast('下载模板失败: ' + error.message, 'error');
    }
  }, [showToast]);

  const handleImport = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setImporting(true);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          showToast('导入文件格式错误或没有有效数据', 'error');
          setImporting(false);
          return;
        }
        
        const headers = lines[0].split(',').map(h => h.trim());
        const rulesData = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const rule = {};
          headers.forEach((header, index) => {
            const mapping = {
              '规则名称': 'name',
              '描述': 'description',
              '分类名称': 'category_name',
              '分数': 'score',
              '是否启用': 'is_active',
              '每日上限': 'daily_limit',
              '最小间隔(秒)': 'min_interval'
            };
            if (mapping[header]) {
              const key = mapping[header];
              let value = values[index] || '';
              if (key === 'score' || key === 'daily_limit' || key === 'min_interval') {
                value = parseInt(value) || 0;
              } else if (key === 'is_active') {
                value = value === '是' || value === 'true' || value === '1';
              }
              rule[key] = value;
            }
          });
          if (rule.name) {
            rulesData.push(rule);
          }
        }
        
        if (rulesData.length === 0) {
          showToast('没有有效数据', 'error');
          setImporting(false);
          return;
        }
        
        const result = await api.rules.import({ rules: rulesData });
        showToast(result.message, 'success');
        if (result.errors && result.errors.length > 0) {
          console.warn('导入错误:', result.errors);
        }
        setShowImportModal(false);
        
        if (result.rules && result.rules.length > 0) {
          setRules(prevRules => [...result.rules, ...prevRules]);
        }
      } catch (err) {
        showToast('导入失败: ' + err.message, 'error');
      }
      setImporting(false);
    };
    
    reader.readAsText(file);
  }, [showToast]);

  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      if (!rule) return false;
      const matchesSearch = (rule.name && rule.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (rule.description && rule.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const categoryId = selectedCategory ? parseInt(selectedCategory) : null;
      const matchesCategory = !selectedCategory || rule.category_id === categoryId;
      return matchesSearch && matchesCategory;
    });
  }, [rules, searchTerm, selectedCategory]);

  const getCategoryName = useMemo(() => {
    return (categoryId) => {
      const cat = categories.find(c => c.id === categoryId);
      return cat ? cat.name : '-';
    };
  }, [categories]);

  const getCategoryColor = useMemo(() => {
    return (categoryId) => {
      const cat = categories.find(c => c.id === categoryId);
      return cat ? cat.color : '#6b7280';
    };
  }, [categories]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-7">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Sliders className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="page-title">积分规则</h2>
            <p className="page-subtitle">管理积分规则的创建和配置</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => fetchRules()} className="btn btn-outline flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button onClick={handleDownloadTemplate} className="btn btn-outline flex items-center gap-2">
            <Download className="w-4 h-4" />
            下载模板
          </button>
          <button onClick={() => setShowImportModal(true)} className="btn btn-outline flex items-center gap-2">
            <Upload className="w-4 h-4" />
            导入规则
          </button>
          <button onClick={handleExport} className="btn btn-outline flex items-center gap-2">
            <FileJson className="w-4 h-4" />
            导出规则(JSON)
          </button>
          <button onClick={() => { setEditingRule(null); setShowModal(true); }} className="btn btn-primary shadow-lg hover:shadow-xl transition-all">
            <Plus className="w-5 h-5 mr-2" />
            添加规则
          </button>
        </div>
      </div>

      

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => { setError(null); fetchRules(); }} className="ml-auto text-danger-600 hover:text-danger-800">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索规则名称或描述..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-12 w-72"
              />
            </div>
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent border-none text-sm font-medium text-gray-700 focus:outline-none cursor-pointer"
              >
                <option value="">全部分类</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-xl">
              <Sliders className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-semibold text-primary-700">{filteredRules.length} 条规则</span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRules.map(rule => (
                <div 
                  key={rule.id} 
                  className="group relative bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                >
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1.5"
                    style={{ backgroundColor: getCategoryColor(rule.category_id) }}
                  />
                  <div className="p-5 pl-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${getCategoryColor(rule.category_id)}20` }}
                        >
                          <span className="text-lg" style={{ color: getCategoryColor(rule.category_id) }}>
                            {rule.score >= 0 ? '+' : ''}{rule.score}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800 text-lg">{rule.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span 
                              className="text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `${getCategoryColor(rule.category_id)}20`, color: getCategoryColor(rule.category_id) }}
                            >
                              {getCategoryName(rule.category_id)}
                            </span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              rule.is_active 
                                ? 'bg-success-100 text-success-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {rule.is_active ? '启用' : '禁用'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {rule.description && (
                      <p className="text-sm text-gray-500 mb-4 line-clamp-2">{rule.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {rule.daily_limit > 0 && (
                          <span className="text-xs font-medium text-gray-500 px-2 py-1 bg-gray-50 rounded-lg">
                            每日{rule.daily_limit}次
                          </span>
                        )}
                        {rule.min_interval > 0 && (
                          <span className="text-xs font-medium text-gray-500 px-2 py-1 bg-gray-50 rounded-lg">
                            间隔{rule.min_interval}秒
                          </span>
                        )}
                        {rule.score_min !== null && rule.score_min !== undefined && (
                          <span className="text-xs font-medium text-gray-500 px-2 py-1 bg-gray-50 rounded-lg">
                            下限{rule.score_min}
                          </span>
                        )}
                        {rule.score_max !== null && rule.score_max !== undefined && (
                          <span className="text-xs font-medium text-gray-500 px-2 py-1 bg-gray-50 rounded-lg">
                            上限{rule.score_max}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingRule(rule); setFormData(rule); setShowModal(true); }}
                          className="p-2 hover:bg-warning-50 rounded-lg text-gray-400 hover:text-warning-500 transition-all"
                          title="编辑"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="p-2 hover:bg-danger-50 rounded-lg text-gray-400 hover:text-danger-500 transition-all"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredRules.length === 0 && (
                <div className="text-center py-20">
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-5">
                    <Sliders className="w-12 h-12 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">暂无规则数据</h3>
                  <p className="text-gray-500 mb-6">添加规则开始配置积分系统</p>
                  <button onClick={() => setShowModal(true)} className="btn btn-primary shadow-lg hover:shadow-xl transition-all">
                    <Plus className="w-5 h-5 mr-2" />
                    添加第一个规则
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                  {editingRule ? <Edit2 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{editingRule ? '编辑规则' : '添加新规则'}</h3>
                  <p className="text-xs text-gray-500">{editingRule ? '修改规则的详细信息' : '创建新的积分规则'}</p>
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
                  placeholder="请输入规则名称"
                />
                {formErrors.name && (
                  <p className="mt-2 text-sm text-danger-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {formErrors.name}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">分类</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="form-select"
                >
                  <option value="">请选择分类</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">积分值 <span className="text-danger-500">*</span></label>
                <input
                  type="number"
                  value={formData.score}
                  onChange={(e) => {
                    setFormData({ ...formData, score: parseInt(e.target.value) || 0 });
                    if (formErrors.score) {
                      setFormErrors(prev => ({ ...prev, score: null }));
                    }
                  }}
                  className={`form-input ${formErrors.score ? 'border-danger-300 focus:ring-danger-500' : ''}`}
                  placeholder="正数为加分，负数为扣分"
                />
                {formErrors.score && (
                  <p className="mt-2 text-sm text-danger-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {formErrors.score}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">规则描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                    if (formErrors.description) {
                      setFormErrors(prev => ({ ...prev, description: null }));
                    }
                  }}
                  className={`form-input resize-none ${formErrors.description ? 'border-danger-300 focus:ring-danger-500' : ''}`}
                  rows={3}
                  placeholder="请输入规则描述"
                />
                {formErrors.description && (
                  <p className="mt-2 text-sm text-danger-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {formErrors.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">每日上限次数</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.max_per_day}
                    onChange={(e) => {
                      setFormData({ ...formData, max_per_day: parseInt(e.target.value) || 0 });
                      if (formErrors.max_per_day) {
                        setFormErrors(prev => ({ ...prev, max_per_day: null }));
                      }
                    }}
                    className={`form-input ${formErrors.max_per_day ? 'border-danger-300 focus:ring-danger-500' : ''}`}
                    placeholder="0表示无限制"
                  />
                  {formErrors.max_per_day && (
                    <p className="mt-2 text-sm text-danger-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {formErrors.max_per_day}
                    </p>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">最小间隔(分钟)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.min_interval}
                    onChange={(e) => {
                      setFormData({ ...formData, min_interval: parseInt(e.target.value) || 0 });
                      if (formErrors.min_interval) {
                        setFormErrors(prev => ({ ...prev, min_interval: null }));
                      }
                    }}
                    className={`form-input ${formErrors.min_interval ? 'border-danger-300 focus:ring-danger-500' : ''}`}
                    placeholder="0表示无限制"
                  />
                  {formErrors.min_interval && (
                    <p className="mt-2 text-sm text-danger-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {formErrors.min_interval}
                    </p>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">启用规则</span>
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => { setShowModal(false); setEditingRule(null); }} className="btn btn-outline">
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingRule ? '保存修改' : '添加规则'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">导入规则</h3>
                  <p className="text-xs text-gray-500">从CSV文件导入积分规则</p>
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} className="p-2.5 hover:bg-gray-100 rounded-xl transition-all">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="modal-body">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800">导入说明</h4>
                    <ul className="text-sm text-blue-700 mt-2 space-y-1">
                      <li>• 支持 CSV 格式文件（Excel可直接导出为CSV）</li>
                      <li>• 第一行必须为表头（规则名称、描述、分类名称、分数、是否启用、每日上限、最小间隔(秒)）</li>
                      <li>• 如果分类名称不存在，将自动创建</li>
                      <li>• 如果规则名称已存在，将更新该规则</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  选择导入文件
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary-500 transition-colors">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleImport}
                    className="hidden"
                    id="ruleImportFile"
                    disabled={importing}
                  />
                  <label htmlFor="ruleImportFile" className="cursor-pointer">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">
                      {importing ? '正在导入...' : '点击选择文件或拖拽到此处'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      支持 .csv, .xlsx, .xls 格式
                    </p>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
                >
                  <Download className="w-4 h-4" />
                  下载导入模板
                </button>
                <button onClick={() => setShowImportModal(false)} className="btn btn-outline">
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RuleList;
