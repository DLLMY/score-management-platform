import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, ArrowUpRight, ArrowDownRight, Users, Eye, RefreshCw, X, User, Upload, Download, CheckSquare, Square, FileText, Zap, Award, TrendingUp, TrendingDown } from 'lucide-react';
import api from '../services/api';
import { Card, Button, Modal, Badge, SearchFilter, LoadingSpinner } from '../components';

function UserList() {
  const [users, setUsers] = useState([]);
  const [rules, setRules] = useState([]);
  const [rankRules, setRankRules] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchScoreChange, setBatchScoreChange] = useState(0);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showQuickScoreModal, setShowQuickScoreModal] = useState(false);
  const [quickScoreUser, setQuickScoreUser] = useState(null);
  const [scoreTab, setScoreTab] = useState('add');
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 50,
    total: 0,
    pages: 0
  });

  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    class_name: '',
    phone: '',
    parent_info: '',
    father_name: '',
    father_phone: '',
    mother_name: '',
    mother_phone: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_relation: '',
    card_id: '',
    current_score: 0
  });

  useEffect(() => {
    fetchUsers();
    fetchRankRules();
    fetchRules();
  }, [pagination.page]);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.users.getAll({
        page: pagination.page,
        per_page: pagination.per_page,
        search: searchTerm,
        class_name: selectedClass
      });
      if (Array.isArray(data)) {
        setUsers(data);
        setPagination(prev => ({
          ...prev,
          total: data.length,
          pages: 1
        }));
      } else {
        setUsers(data.users || []);
        setPagination(prev => ({
          ...prev,
          total: data.total,
          pages: data.pages
        }));
      }
    } catch (err) {
      setError('获取学生列表失败: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchUsers();
  };

  const fetchRules = async () => {
    try {
      const data = await api.rules.getAll();
      if (Array.isArray(data)) {
        setRules(data);
      } else {
        setRules(data.rules || []);
      }
    } catch (err) {
      console.error('获取规则失败:', err);
    }
  };

  const fetchRankRules = async () => {
    try {
      const data = await api.rankRules.getAll();
      setRankRules(data);
    } catch (err) {
      console.error('获取排名规则失败:', err);
    }
  };

  const getRankInfo = (score) => {
    const rule = rankRules.find(r => score >= r.min_score && score <= r.max_score);
    return rule || { name: '未定义', color: '#6b7280' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setMessage({ type: 'success', text: '请输入学生姓名' });
      return;
    }
    
    if (!formData.card_id.trim()) {
      setMessage({ type: 'success', text: '请输入饭卡号' });
      return;
    }

    try {
      if (editingUser) {
        await api.users.update(editingUser.id, formData);
        setMessage({ type: 'success', text: '学生信息更新成功' });
      } else {
        await api.users.create(formData);
        setMessage({ type: 'success', text: '学生添加成功' });
      }
      fetchUsers();
      setShowModal(false);
      setEditingUser(null);
      setFormData({ name: '', gender: '', class_name: '', phone: '', parent_info: '', father_name: '', father_phone: '', mother_name: '', mother_phone: '', guardian_name: '', guardian_phone: '', guardian_relation: '', card_id: '', current_score: 0 });
    } catch (err) {
      setMessage({ type: 'success', text: '操作失败: ' + err.message });
    }

    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除该学生吗？此操作不可撤销。')) {
      return;
    }
    
    try {
      await api.users.delete(id);
      setMessage({ type: 'success', text: '删除成功' });
      fetchUsers();
    } catch (err) {
      setMessage({ type: 'success', text: '删除失败: ' + err.message });
    }
    
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddScore = async (userId, score) => {
    try {
      await api.records.create({
        user_id: userId,
        score_change: score,
        description: score > 0 ? '手动加分' : '手动扣分',
        operator: '管理员'
      });
      setMessage({ type: 'success', text: score > 0 ? '加分成功' : '扣分成功' });
      fetchUsers();
    } catch (err) {
      setMessage({ type: 'error', text: '操作失败: ' + err.message });
    }
    
    setTimeout(() => setMessage(null), 3000);
  };

  const handleOpenQuickScore = (user) => {
    setQuickScoreUser(user);
    setShowQuickScoreModal(true);
  };

  const handleQuickScore = async (rule) => {
    try {
      await api.records.create({
        user_id: quickScoreUser.id,
        rule_id: rule.id,
        score_change: rule.score,
        description: rule.name,
        operator: '管理员'
      });
      const action = rule.score > 0 ? '加分' : '扣分';
      const scoreText = rule.score > 0 ? `+${rule.score}分` : `${rule.score}分`;
      setMessage({ type: 'success', text: `${action}成功: ${rule.name} (${scoreText})` });
      setShowQuickScoreModal(false);
      setQuickScoreUser(null);
      fetchUsers();
    } catch (err) {
      setMessage({ type: 'error', text: '操作失败: ' + (err.response?.data?.error || err.message) });
    }
    
    setTimeout(() => setMessage(null), 3000);
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleAllSelection = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedUsers.length === 0) {
      setMessage({ type: 'error', text: '请选择要删除的学生' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    
    if (!window.confirm(`确定要删除选中的 ${selectedUsers.length} 名学生吗？此操作不可撤销。`)) {
      return;
    }
    
    try {
      await api.users.batchDelete(selectedUsers);
      setMessage({ type: 'success', text: `成功删除 ${selectedUsers.length} 名学生` });
      setSelectedUsers([]);
      fetchUsers();
    } catch (err) {
      setMessage({ type: 'error', text: '删除失败: ' + err.message });
    }
    
    setTimeout(() => setMessage(null), 3000);
  };

  const handleBatchScore = async () => {
    if (selectedUsers.length === 0) {
      setMessage({ type: 'error', text: '请选择要调整的学生' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    
    if (batchScoreChange === 0) {
      setMessage({ type: 'error', text: '请输入调整分数' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    
    try {
      const description = batchScoreChange > 0 ? '批量加分' : '批量扣分';
      await api.users.batchUpdateScore(selectedUsers, batchScoreChange, description);
      setMessage({ type: 'success', text: `成功调整 ${selectedUsers.length} 名学生的积分` });
      setSelectedUsers([]);
      setShowBatchModal(false);
      setBatchScoreChange(0);
      fetchUsers();
    } catch (err) {
      setMessage({ type: 'error', text: '操作失败: ' + err.message });
    }
    
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(api.users.downloadTemplate());
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'user_import_template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('下载模板失败:', error);
      setMessage({ type: 'error', text: '下载模板失败: ' + error.message });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, ''));
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          if (inQuotes && line[j + 1] === '"') {
            current += '"';
            j++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      rows.push(values);
    }
    
    return { headers, rows };
  };

  const handleImport = async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setMessage({ type: 'error', text: '请选择CSV格式的文件' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    
    setImporting(true);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('http://localhost:5000/api/users/import-file', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(result.message);
        setMessage({ type: 'success', text: result.message });
        
        if (result.errors && result.errors.length > 0) {
          const errorMsg = result.errors.slice(0, 5).join('; ') + 
            (result.errors.length > 5 ? `...共${result.errors.length}条错误` : '');
          alert('部分数据导入失败:\n' + errorMsg);
        }
        
        setShowImportModal(false);
        fetchUsers();
      } else {
        throw new Error(result.error || '导入失败');
      }
    } catch (err) {
      console.error('导入错误:', err);
      alert('导入失败: ' + (err.message || '未知错误'));
      setMessage({ type: 'error', text: '导入失败: ' + (err.message || '未知错误') });
    } finally {
      setImporting(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.card_id.includes(searchTerm) ||
                           user.class_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = !selectedClass || user.class_name === selectedClass;
      return matchesSearch && matchesClass;
    });
  }, [users, searchTerm, selectedClass]);

  const classes = useMemo(() => [...new Set(users.map(u => u.class_name))], [users]);

  const renderUserRow = (user) => {
    const scoreColor = user.current_score >= 80 ? 'text-green-600' :
                       user.current_score >= 60 ? 'text-blue-600' : 'text-red-600';
    const isSelected = selectedUsers.includes(user.id);
    const rankInfo = getRankInfo(user.current_score);

    return (
      <div key={user.id} className={`flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-100 transition-colors ${
        isSelected ? 'bg-primary-50/30' : 'hover:bg-gray-50/50'
      }`}>
        <div className="flex-shrink-0">
          <button
            onClick={() => toggleUserSelection(user.id)}
            className="text-primary-600 hover:text-primary-800 transition-colors"
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>
        </div>
        
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm">
          <User className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link to={`/users/${user.id}`} className="font-semibold text-gray-800 hover:text-primary-600 transition-colors truncate">
              {user.name}
            </Link>
            <Badge variant={user.gender === '男' ? 'blue' : 'purple'}>{user.gender}</Badge>
            <span className="text-gray-600 text-sm">{user.class_name}</span>
            <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{user.card_id}</span>
          </div>
          <p className="text-xs text-gray-500 hidden sm:block">{user.phone || '暂无电话'}</p>
        </div>
        
        <div className="flex-shrink-0 flex items-center gap-2">
          <span 
            className="px-2 sm:px-3 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: `${rankInfo.color}20`, color: rankInfo.color }}
          >
            {rankInfo.name}
          </span>
        </div>
        
        <div className="flex-shrink-0 text-right">
          <span className={`text-lg font-bold ${scoreColor}`}>{user.current_score}</span>
          <span className="text-sm text-gray-500 ml-1">分</span>
        </div>
        
        <div className="flex-shrink-0 flex items-center gap-1">
          <button
            onClick={() => handleOpenQuickScore(user)}
            className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
            title="快速操作"
          >
            <Zap className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleAddScore(user.id, 10)}
            className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
            title="+10分"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleAddScore(user.id, -10)}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="-10分"
          >
            <ArrowDownRight className="w-4 h-4" />
          </button>
          <Link to={`/users/${user.id}`} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
            <Eye className="w-4 h-4" />
          </Link>
          <button
            onClick={() => { setEditingUser(user); setFormData(user); setShowModal(true); }}
            className="p-2 text-yellow-500 hover:bg-yellow-50 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(user.id)}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-7">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">学生管理</h2>
            <p className="text-sm text-gray-500">管理学生信息和积分数据</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={fetchUsers}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button 
            variant="outline"
            onClick={handleDownloadTemplate}
          >
            <Download className="w-4 h-4" />
            下载模板
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowImportModal(true)}
          >
            <Upload className="w-4 h-4" />
            导入学生
          </Button>
          {selectedUsers.length > 0 && (
            <>
              <Button 
                variant="warning"
                onClick={() => setShowBatchModal(true)}
              >
                <Plus className="w-4 h-4" />
                批量调整积分 ({selectedUsers.length})
              </Button>
              <Button 
                variant="danger"
                onClick={handleBatchDelete}
              >
                <Trash2 className="w-4 h-4" />
                批量删除 ({selectedUsers.length})
              </Button>
            </>
          )}
          <Button 
            onClick={() => { setEditingUser(null); setShowModal(true); }}
          >
            <Plus className="w-5 h-5" />
            添加学生
          </Button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-700' 
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <span className="font-medium">{message.text}</span>
          <button 
            onClick={() => setMessage(null)} 
            className="ml-auto text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-3">
          <span>{error}</span>
          <button 
            onClick={() => { setError(null); fetchUsers(); }} 
            className="ml-auto text-red-600 hover:text-red-800"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <SearchFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearch={handleSearch}
          filters={[
            { label: '全部班级', value: '' },
            ...classes.map(c => ({ label: c, value: c }))
          ]}
          activeFilter={selectedClass}
          onFilterChange={(value) => {
            setSelectedClass(value);
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
          placeholder="搜索姓名、班级或饭卡号..."
        />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-xl">
              <Users className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-semibold text-primary-700">{filteredUsers.length} 名学生</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" text="加载中..." />
          </div>
        ) : (
            filteredUsers.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-5">
                <Users className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">暂无学生数据</h3>
              <p className="text-gray-500 mb-6">添加学生开始管理积分系统</p>
              <Button onClick={() => setShowModal(true)}>
                <Plus className="w-5 h-5" />
                添加第一个学生
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map(renderUserRow)}
            </div>
          )
        )}
      </Card>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-600">
            共 <span className="font-semibold">{pagination.total}</span> 条记录，当前第 <span className="font-semibold">{pagination.page}</span> / <span className="font-semibold">{pagination.pages}</span> 页
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="small"
              disabled={pagination.page <= 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              上一页
            </Button>
            <div className="flex items-center gap-1">
              {[...Array(Math.min(5, pagination.pages))].map((_, idx) => {
                let pageNum;
                if (pagination.pages <= 5) {
                  pageNum = idx + 1;
                } else if (pagination.page <= 3) {
                  pageNum = idx + 1;
                } else if (pagination.page >= pagination.pages - 2) {
                  pageNum = pagination.pages - 4 + idx;
                } else {
                  pageNum = pagination.page - 2 + idx;
                }
                return (
                  <button
                    key={idx}
                    onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                      pagination.page === pageNum
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="small"
              disabled={pagination.page >= pagination.pages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      <Modal 
        isOpen={showModal} 
        onClose={() => { setShowModal(false); setEditingUser(null); }}
        title={editingUser ? '编辑学生信息' : '添加新学生'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="请输入学生姓名"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">性别</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">请选择性别</option>
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">班级</label>
              <input
                type="text"
                value={formData.class_name}
                onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="如：高三(1)班"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">联系电话</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="请输入联系电话"
              />
            </div>
          </div>
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">家长信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">父亲姓名</label>
                <input
                  type="text"
                  value={formData.father_name}
                  onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="请输入父亲姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">父亲电话</label>
                <input
                  type="tel"
                  value={formData.father_phone}
                  onChange={(e) => setFormData({ ...formData, father_phone: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="请输入父亲电话"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">母亲姓名</label>
                <input
                  type="text"
                  value={formData.mother_name}
                  onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="请输入母亲姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">母亲电话</label>
                <input
                  type="tel"
                  value={formData.mother_phone}
                  onChange={(e) => setFormData({ ...formData, mother_phone: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="请输入母亲电话"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">监护人姓名</label>
                <input
                  type="text"
                  value={formData.guardian_name}
                  onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="请输入监护人姓名（非父母时填写）"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">监护人电话</label>
                  <input
                    type="tel"
                    value={formData.guardian_phone}
                    onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="监护人电话"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">监护关系</label>
                  <input
                    type="text"
                    value={formData.guardian_relation}
                    onChange={(e) => setFormData({ ...formData, guardian_relation: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="如：祖父"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                饭卡号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.card_id}
                onChange={(e) => setFormData({ ...formData, card_id: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="请输入饭卡号"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">初始积分</label>
            <input
              type="number"
              min="0"
              value={formData.current_score}
              onChange={(e) => setFormData({ ...formData, current_score: parseInt(e.target.value) || 0 })}
              className="w-48 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="0"
            />
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Button 
              variant="outline" 
              onClick={() => { setShowModal(false); setEditingUser(null); }}
            >
              取消
            </Button>
            <Button type="submit">
              {editingUser ? '保存修改' : '添加学生'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        title="批量调整积分"
        size="sm"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              调整分数（可输入负数）
            </label>
            <input
              type="number"
              value={batchScoreChange}
              onChange={(e) => setBatchScoreChange(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="输入正数加分，负数扣分"
            />
            <p className="text-xs text-gray-500 mt-2">
              将为选中的 {selectedUsers.length} 名学生统一调整积分
            </p>
          </div>
          
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Button 
              variant="outline" 
              onClick={() => { setShowBatchModal(false); setBatchScoreChange(0); }}
            >
              取消
            </Button>
            <Button onClick={handleBatchScore}>
              确认调整
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="导入学生数据"
        size="md"
      >
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800">导入说明</h4>
                <ul className="text-sm text-blue-700 mt-2 space-y-1">
                  <li>• 支持 CSV 格式文件</li>
                  <li>• 第一行必须为表头（姓名、性别、班级、电话、家长信息、饭卡号、初始积分）</li>
                  <li>• 饭卡号为必填项，其他为可选项</li>
                  <li>• 如果饭卡号已存在，将更新该学生信息</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              选择导入文件
            </label>
            <div 
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary-500 transition-colors"
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file) {
                  const event = { target: { files: [file] } };
                  handleImport(event);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleImport}
                className="hidden"
                id="importFile"
                disabled={importing}
              />
              <label htmlFor="importFile" className="cursor-pointer block">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">
                  {importing ? '正在导入...' : '点击选择文件或拖拽到此处'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  支持 .csv 格式
                </p>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              <Download className="w-4 h-4" />
              下载导入模板
            </button>
            <Button variant="outline" onClick={() => setShowImportModal(false)}>
              关闭
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showQuickScoreModal}
        onClose={() => { setShowQuickScoreModal(false); setQuickScoreUser(null); }}
        title={quickScoreUser ? `快速操作 - ${quickScoreUser.name}` : '快速操作'}
        size="lg"
      >
        <div className="space-y-6">
          {quickScoreUser && (
            <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white shadow-sm">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">{quickScoreUser.name}</h3>
                <p className="text-sm text-gray-600">{quickScoreUser.class_name} · 当前积分: <span className="font-bold text-amber-600">{quickScoreUser.current_score}分</span></p>
              </div>
            </div>
          )}
          
          <div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setScoreTab('add')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  scoreTab === 'add' 
                    ? 'bg-green-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  加分规则
                </span>
              </button>
              <button
                onClick={() => setScoreTab('subtract')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  scoreTab === 'subtract' 
                    ? 'bg-red-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  扣分规则
                </span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {scoreTab === 'add' 
                ? rules.filter(r => r.is_active && r.score > 0).map(rule => (
                    <button
                      key={rule.id}
                      onClick={() => handleQuickScore(rule)}
                      className="p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-green-500 hover:shadow-md transition-all text-left group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-semibold text-gray-800 group-hover:text-green-600">{rule.name}</span>
                        <span className="text-lg font-bold text-green-600">+{rule.score}分</span>
                      </div>
                      {rule.description && (
                        <p className="text-xs text-gray-500 line-clamp-2">{rule.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {rule.daily_limit > 0 && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">每日{rule.daily_limit}次</span>
                        )}
                        {rule.min_interval > 0 && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">间隔{rule.min_interval}秒</span>
                        )}
                      </div>
                    </button>
                  ))
                : rules.filter(r => r.is_active && r.score < 0).map(rule => (
                    <button
                      key={rule.id}
                      onClick={() => handleQuickScore(rule)}
                      className="p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-red-500 hover:shadow-md transition-all text-left group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-semibold text-gray-800 group-hover:text-red-600">{rule.name}</span>
                        <span className="text-lg font-bold text-red-600">{rule.score}分</span>
                      </div>
                      {rule.description && (
                        <p className="text-xs text-gray-500 line-clamp-2">{rule.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {rule.daily_limit > 0 && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">每日{rule.daily_limit}次</span>
                        )}
                        {rule.min_interval > 0 && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">间隔{rule.min_interval}秒</span>
                        )}
                      </div>
                    </button>
                  ))
              }
            </div>
            
            {scoreTab === 'add' && rules.filter(r => r.is_active && r.score > 0).length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-sm">暂无可用的加分规则，请先创建规则</div>
              </div>
            )}
            {scoreTab === 'subtract' && rules.filter(r => r.is_active && r.score < 0).length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-sm">暂无可用的扣分规则，请先创建规则</div>
              </div>
            )}
          </div>
          
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Button 
              variant="outline" 
              onClick={() => { setShowQuickScoreModal(false); setQuickScoreUser(null); }}
            >
              取消
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default UserList;
