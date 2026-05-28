import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, AlertCircle, X, RefreshCw, Tag, Palette } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { validateForm } from '../utils/validation';

const COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', 
  '#EF4444', '#6366F1', '#EC4899', '#14B8A6', '#F97316'
];

function CategoryList() {
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: COLORS[0],
    is_active: true
  });

  const [formErrors, setFormErrors] = useState({});

  const validationRules = {
    name: ['required', { maxLength: 50 }],
    description: [{ maxLength: 200 }]
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.categories.getAll();
      setCategories(data.categories || data);
    } catch (err) {
      setError('获取分类列表失败: ' + err.message);
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
    
    setFormErrors({});

    try {
      if (editingCategory) {
        const updatedCategory = await api.categories.update(editingCategory.id, formData);
        showToast('分类更新成功', 'success');
        
        setCategories(prevCategories => 
          prevCategories.map(cat => 
            cat.id === editingCategory.id ? updatedCategory : cat
          )
        );
      } else {
        const newCategory = await api.categories.create(formData);
        showToast('分类添加成功', 'success');
        
        setCategories(prevCategories => [newCategory, ...prevCategories]);
      }
      setShowModal(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '', color: COLORS[0], is_active: true });
    } catch (err) {
      showToast('操作失败: ' + err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除该分类吗？此操作不可撤销。')) {
      return;
    }
    
    try {
      await api.categories.delete(id);
      showToast('删除成功', 'success');
      
      setCategories(prevCategories => prevCategories.filter(cat => cat.id !== id));
    } catch (err) {
      showToast('删除失败: ' + err.message, 'error');
    }
  };

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-7">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Tag className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="page-title">分类管理</h2>
            <p className="page-subtitle">管理积分规则的分类体系</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => fetchCategories()} className="btn btn-outline flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button onClick={() => { setEditingCategory(null); setShowModal(true); }} className="btn btn-primary shadow-lg hover:shadow-xl transition-all">
            <Plus className="w-5 h-5 mr-2" />
            添加分类
          </button>
        </div>
      </div>

      

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => { setError(null); fetchCategories(); }} className="ml-auto text-danger-600 hover:text-danger-800">
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
              placeholder="搜索分类名称或描述..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-12 w-72"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-xl">
              <Tag className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-semibold text-primary-700">{filteredCategories.length} 个分类</span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredCategories.map(cat => (
                <div 
                  key={cat.id} 
                  className="card card-hover p-5 border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                  style={{ borderColor: `${cat.color}33` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                        style={{ backgroundColor: `${cat.color}20` }}
                      >
                        <Tag className="w-6 h-6" style={{ color: cat.color }} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">{cat.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          cat.is_active 
                            ? 'bg-success-100 text-success-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {cat.is_active ? '启用' : '禁用'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">{cat.description || '暂无描述'}</p>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-gray-500" />
                      <div className="flex gap-1">
                        <div 
                          className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-xs text-gray-500 font-mono">{cat.color}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditingCategory(cat); setFormData(cat); setShowModal(true); }}
                        className="btn-icon text-warning-500 hover:bg-warning-50 hover:text-warning-600"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="btn-icon text-danger-500 hover:bg-danger-50 hover:text-danger-600"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredCategories.length === 0 && (
                <div className="col-span-full text-center py-20">
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-5">
                    <Tag className="w-12 h-12 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">暂无分类数据</h3>
                  <p className="text-gray-500 mb-6">添加分类开始组织积分规则</p>
                  <button onClick={() => setShowModal(true)} className="btn btn-primary shadow-lg hover:shadow-xl transition-all">
                    <Plus className="w-5 h-5 mr-2" />
                    添加第一个分类
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
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                  {editingCategory ? <Edit2 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{editingCategory ? '编辑分类' : '添加新分类'}</h3>
                  <p className="text-xs text-gray-500">{editingCategory ? '修改分类的详细信息' : '创建新的分类'}</p>
                </div>
              </div>
              <button onClick={() => { setShowModal(false); setEditingCategory(null); }} className="p-2.5 hover:bg-gray-100 rounded-xl transition-all">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">分类名称 <span className="text-danger-500">*</span></label>
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
                  placeholder="请输入分类名称"
                />
                {formErrors.name && (
                  <p className="mt-2 text-sm text-danger-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {formErrors.name}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">分类描述</label>
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
                  placeholder="请输入分类描述"
                />
                {formErrors.description && (
                  <p className="mt-2 text-sm text-danger-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {formErrors.description}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">颜色标识</label>
                <div className="flex items-center gap-3">
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
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="form-input w-32 font-mono text-sm"
                    placeholder="#3B82F6"
                  />
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
                  <span className="text-sm font-medium text-gray-700">启用分类</span>
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => { setShowModal(false); setEditingCategory(null); }} className="btn btn-outline">
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCategory ? '保存修改' : '添加分类'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoryList;
