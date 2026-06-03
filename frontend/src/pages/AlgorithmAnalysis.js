import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  BarChart3, Users, AlertTriangle, Target, RefreshCw, 
  TrendingUp, Award, Shield, ChevronDown, Filter,
  ArrowUp, ArrowDown, CheckCircle, XCircle, Settings,
  Activity, PieChart as PieChartIcon, ScatterChart
} from 'lucide-react';
import { api } from '../services/api';

const TABS = [
  { id: 'statistics', label: '统计分析', icon: BarChart3 },
  { id: 'cluster', label: '学生分群', icon: Users },
  { id: 'composite', label: '综合评分', icon: Award },
  { id: 'warning', label: '风险预警', icon: AlertTriangle },
];

const CLUSTER_COLORS = {
  '全面优秀型': { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50 dark:bg-blue-500/10' },
  '遵纪但学业吃力型': { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50 dark:bg-yellow-500/10' },
  '聪明但散漫型': { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-50 dark:bg-orange-500/10' },
  '双困型': { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50 dark:bg-red-500/10' },
};

const RISK_COLORS = {
  high: { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50 dark:bg-red-500/10' },
  medium: { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50 dark:bg-yellow-500/10' },
  low: { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50 dark:bg-green-500/10' },
};

export default function AlgorithmAnalysis() {
  const [activeTab, setActiveTab] = useState('statistics');
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 数据状态
  const [statistics, setStatistics] = useState(null);
  const [clusters, setClusters] = useState(null);
  const [compositeScores, setCompositeScores] = useState(null);
  const [warnings, setWarnings] = useState(null);
  const [warningConfig, setWarningConfig] = useState(null);
  
  // 班级列表
  const [classes, setClasses] = useState([]);

  // 加载所有数据
  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = selectedClass ? { class_name: selectedClass } : {};
      
      const [statsRes, clusterRes, compositeRes, warningRes, configRes] = await Promise.all([
        api.algorithm.getStatistics(params).catch(() => null),
        api.algorithm.getClusters(params).catch(() => null),
        api.algorithm.getCompositeScores(params).catch(() => null),
        api.algorithm.getWarnings(params).catch(() => null),
        api.algorithm.getWarningConfig().catch(() => null),
      ]);
      
      setStatistics(statsRes?.data || null);
      setClusters(clusterRes?.data || null);
      setCompositeScores(compositeRes?.data || null);
      setWarnings(warningRes?.data || null);
      setWarningConfig(configRes?.data || null);
    } catch (err) {
      console.error('加载数据失败:', err);
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [selectedClass]);

  // 加载班级列表
  const loadClasses = useCallback(async () => {
    try {
      const res = await api.categories.getAll();
      // 从分类中提取班级信息，或使用空数组
      setClasses([]);
    } catch (err) {
      console.error('加载班级列表失败:', err);
      setClasses([]);
    }
  }, []);

  useEffect(() => {
    loadAllData();
    loadClasses();
  }, [loadAllData, loadClasses]);

  // 重新计算分群
  const handleRecalculateClusters = async () => {
    if (!confirm('确定要重新计算学生分群吗？')) return;
    
    setLoading(true);
    try {
      const res = await api.algorithm.recalculateClusters();
      if (res.code === 0) {
        await loadAllData();
      } else {
        throw new Error(res.message || '计算失败');
      }
    } catch (err) {
      setError(err.message || '计算失败');
    } finally {
      setLoading(false);
    }
  };

  // 重新计算综合评分
  const handleRecalculateScores = async () => {
    if (!confirm('确定要重新计算综合评分吗？')) return;
    
    setLoading(true);
    try {
      const res = await api.algorithm.recalculateCompositeScores();
      if (res.code === 0) {
        await loadAllData();
      } else {
        throw new Error(res.message || '计算失败');
      }
    } catch (err) {
      setError(err.message || '计算失败');
    } finally {
      setLoading(false);
    }
  };

  // 执行风险评估
  const handleRunEvaluation = async () => {
    if (!confirm('确定要执行风险评估吗？')) return;
    
    setLoading(true);
    try {
      const res = await api.algorithm.runWarningEvaluation();
      if (res.code === 0) {
        await loadAllData();
      } else {
        throw new Error(res.message || '评估失败');
      }
    } catch (err) {
      setError(err.message || '评估失败');
    } finally {
      setLoading(false);
    }
  };

  // 解决预警
  const handleResolveWarning = async (warningId) => {
    if (!confirm('确定要解决此预警吗？')) return;
    
    try {
      const res = await api.algorithm.resolveWarning(warningId);
      if (res.code === 0) {
        await loadAllData();
      } else {
        throw new Error(res.message || '解决失败');
      }
    } catch (err) {
      setError(err.message || '解决失败');
    }
  };

  // 更新预警配置
  const handleUpdateConfig = async (key, value) => {
    try {
      const res = await api.algorithm.updateWarningConfig({
        config_key: key,
        config_value: value,
      });
      if (res.code === 0) {
        await loadAllData();
      } else {
        throw new Error(res.message || '更新失败');
      }
    } catch (err) {
      setError(err.message || '更新失败');
    }
  };

  return (
    <div className='space-y-6'>
      {/* 页面标题和操作 */}
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
            算法分析
          </h1>
          <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
            学生行为与学业综合分析
          </p>
        </div>
        
        <div className='flex items-center gap-3'>
          {/* 班级筛选 */}
          <div className='relative'>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className='pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>全部班级</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.name}>{cls.name}</option>
              ))}
            </select>
            <ChevronDown className='absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' />
          </div>
          
          {/* 刷新按钮 */}
          <button
            onClick={loadAllData}
            disabled={loading}
            className='flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50'
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className='p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg'>
          <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
        </div>
      )}

      {/* 统计卡片 */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
        <StatCard
          title='学生总数'
          value={statistics?.student_count || 0}
          icon={Users}
          color='blue'
        />
        <StatCard
          title='分群数量'
          value={clusters?.n_clusters || 0}
          icon={Target}
          color='purple'
        />
        <StatCard
          title='预警学生'
          value={warnings?.total_risk_count || 0}
          icon={AlertTriangle}
          color={warnings?.total_risk_count > 0 ? 'red' : 'green'}
        />
        <StatCard
          title='行为-学业相关性'
          value={statistics?.correlation?.toFixed(2) || '0.00'}
          icon={TrendingUp}
          color='orange'
          suffix=''
        />
      </div>

      {/* Tab 切换 */}
      <div className='border-b border-gray-200 dark:border-slate-700'>
        <nav className='flex gap-4'>
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                <Icon className='w-4 h-4' />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab 内容 */}
      <div className='bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700'>
        {loading && (
          <div className='flex items-center justify-center py-12'>
            <div className='w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin' />
          </div>
        )}
        
        {!loading && activeTab === 'statistics' && (
          <StatisticsPanel data={statistics} />
        )}
        
        {!loading && activeTab === 'cluster' && (
          <ClusterPanel 
            data={clusters} 
            onRecalculate={handleRecalculateClusters}
            loading={loading}
          />
        )}
        
        {!loading && activeTab === 'composite' && (
          <CompositeScorePanel 
            data={compositeScores}
            onRecalculate={handleRecalculateScores}
            loading={loading}
          />
        )}
        
        {!loading && activeTab === 'warning' && (
          <WarningPanel 
            data={warnings}
            config={warningConfig}
            onRunEvaluation={handleRunEvaluation}
            onResolveWarning={handleResolveWarning}
            onUpdateConfig={handleUpdateConfig}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}

// 统计卡片组件
function StatCard({ title, value, icon: Icon, color, suffix = '人' }) {
  const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
    green: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400',
    orange: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  };
  
  return (
    <div className='bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4'>
      <div className='flex items-center gap-3'>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className='w-5 h-5' />
        </div>
        <div>
          <p className='text-sm text-gray-500 dark:text-slate-400'>{title}</p>
          <p className='text-2xl font-bold text-gray-900 dark:text-white'>
            {value}{suffix}
          </p>
        </div>
      </div>
    </div>
  );
}

// 统计分析面板
function StatisticsPanel({ data }) {
  if (!data) {
    return (
      <div className='p-8 text-center text-gray-500 dark:text-slate-400'>
        暂无统计数据
      </div>
    );
  }

  return (
    <div className='p-6 space-y-6'>
      <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
        描述性统计
      </h3>
      
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
        <div className='p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg'>
          <p className='text-sm text-gray-500 dark:text-slate-400'>平均行为积分</p>
          <p className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
            {data.avg_behavior_score?.toFixed(1) || 0}
          </p>
        </div>
        <div className='p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg'>
          <p className='text-sm text-gray-500 dark:text-slate-400'>平均学业成绩</p>
          <p className='text-2xl font-bold text-purple-600 dark:text-purple-400'>
            {data.avg_academic_score?.toFixed(1) || 0}
          </p>
        </div>
        <div className='p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg'>
          <p className='text-sm text-gray-500 dark:text-slate-400'>相关性系数</p>
          <p className={`text-2xl font-bold ${
            data.correlation > 0.5 ? 'text-green-600 dark:text-green-400' :
            data.correlation > 0 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-red-600 dark:text-red-400'
          }`}>
            {data.correlation?.toFixed(2) || 0}
          </p>
        </div>
        <div className='p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg'>
          <p className='text-sm text-gray-500 dark:text-slate-400'>及格率</p>
          <p className='text-2xl font-bold text-orange-600 dark:text-orange-400'>
            {((data.pass_rate || 0) * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <div>
        <h4 className='text-base font-medium text-gray-900 dark:text-white mb-4'>
          分组对比
        </h4>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-gray-200 dark:border-slate-700'>
                <th className='text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                  分组
                </th>
                <th className='text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                  人数
                </th>
                <th className='text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                  平均行为积分
                </th>
                <th className='text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                  平均学业成绩
                </th>
              </tr>
            </thead>
            <tbody>
              {data.group_comparison?.map((group, index) => (
                <tr 
                  key={index} 
                  className='border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30'
                >
                  <td className='py-3 px-4'>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                      group.group === '高分组' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                      group.group === '中分组' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                      'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                    }`}>
                      {group.group}
                    </span>
                  </td>
                  <td className='py-3 px-4 text-right text-gray-900 dark:text-white'>
                    {group.count}
                  </td>
                  <td className='py-3 px-4 text-right text-blue-600 dark:text-blue-400 font-medium'>
                    {group.avg_behavior?.toFixed(1) || 0}
                  </td>
                  <td className='py-3 px-4 text-right text-purple-600 dark:text-purple-400 font-medium'>
                    {group.avg_score?.toFixed(1) || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 学生分群面板
function ClusterPanel({ data, onRecalculate, loading }) {
  if (!data) {
    return (
      <div className='p-8 text-center text-gray-500 dark:text-slate-400'>
        暂无分群数据，请先执行分群计算
      </div>
    );
  }

  const clusterList = data.cluster_summary || [];

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
          学生分群分析
        </h3>
        <button
          onClick={onRecalculate}
          disabled={loading}
          className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50'
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          重新计算
        </button>
      </div>

      {/* 分群概览 */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
        {clusterList.map((cluster) => {
          const colors = CLUSTER_COLORS[cluster.label] || CLUSTER_COLORS['双困型'];
          return (
            <div 
              key={cluster.label}
              className={`p-4 rounded-xl ${colors.light} border border-gray-200 dark:border-slate-700`}
            >
              <div className='flex items-center gap-2 mb-2'>
                <div className={`w-3 h-3 rounded-full ${colors.bg}`} />
                <span className={`text-sm font-medium ${colors.text}`}>
                  {cluster.label}
                </span>
              </div>
              <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                {cluster.count}人
              </p>
              <div className='mt-2 text-xs text-gray-500 dark:text-slate-400'>
                <div>平均行为: <span className='font-medium text-blue-600'>{cluster.avg_behavior?.toFixed(1) || 0}</span></div>
                <div>平均成绩: <span className='font-medium text-purple-600'>{cluster.avg_score?.toFixed(1) || 0}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 学生列表 */}
      <div>
        <h4 className='text-base font-medium text-gray-900 dark:text-white mb-4'>
          学生分群详情
        </h4>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-gray-200 dark:border-slate-700'>
                <th className='text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                  学生姓名
                </th>
                <th className='text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                  班级
                </th>
                <th className='text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                  分群类型
                </th>
                <th className='text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                  行为积分
                </th>
                <th className='text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                  学业成绩
                </th>
              </tr>
            </thead>
            <tbody>
              {data.students?.slice(0, 20).map((student) => {
                const colors = CLUSTER_COLORS[student.cluster_name] || CLUSTER_COLORS['双困型'];
                return (
                  <tr 
                    key={student.user_id}
                    className='border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30'
                  >
                    <td className='py-3 px-4 font-medium text-gray-900 dark:text-white'>
                      {student.name}
                    </td>
                    <td className='py-3 px-4 text-gray-500 dark:text-slate-400'>
                      {student.class_name || '-'}
                    </td>
                    <td className='py-3 px-4'>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colors.light} ${colors.text}`}>
                        <div className={`w-2 h-2 rounded-full ${colors.bg}`} />
                        {student.cluster_name}
                      </span>
                    </td>
                    <td className='py-3 px-4 text-right text-blue-600 dark:text-blue-400'>
                      {student.behavior_score}
                    </td>
                    <td className='py-3 px-4 text-right text-purple-600 dark:text-purple-400'>
                      {student.academic_score?.toFixed(1) || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data.students?.length > 20 && (
          <p className='text-sm text-gray-500 dark:text-slate-400 text-center py-4'>
            显示前20条，共{data.students.length}条记录
          </p>
        )}
      </div>
    </div>
  );
}

// 综合评分面板
function CompositeScorePanel({ data, onRecalculate, loading }) {
  if (!data) {
    return (
      <div className='p-8 text-center text-gray-500 dark:text-slate-400'>
        暂无综合评分数据，请先执行评分计算
      </div>
    );
  }

  const weights = data.weights || {};

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
          综合评分排名
        </h3>
        <button
          onClick={onRecalculate}
          disabled={loading}
          className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50'
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          重新计算
        </button>
      </div>

      {/* 权重分布 */}
      <div className='p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-slate-300 mb-4'>
          熵权法权重分布
        </h4>
        <div className='flex gap-4'>
          <div className='flex-1'>
            <div className='flex items-center justify-between mb-1'>
              <span className='text-sm text-gray-600 dark:text-slate-400'>行为维度</span>
              <span className='text-sm font-medium text-blue-600 dark:text-blue-400'>
                {((weights.behavior || 0) * 100).toFixed(1)}%
              </span>
            </div>
            <div className='h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden'>
              <div 
                className='h-full bg-blue-500 rounded-full transition-all'
                style={{ width: `${(weights.behavior || 0) * 100}%` }}
              />
            </div>
          </div>
          <div className='flex-1'>
            <div className='flex items-center justify-between mb-1'>
              <span className='text-sm text-gray-600 dark:text-slate-400'>学业维度</span>
              <span className='text-sm font-medium text-purple-600 dark:text-purple-400'>
                {((weights.academic || 0) * 100).toFixed(1)}%
              </span>
            </div>
            <div className='h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden'>
              <div 
                className='h-full bg-purple-500 rounded-full transition-all'
                style={{ width: `${(weights.academic || 0) * 100}%` }}
              />
            </div>
          </div>
          <div className='flex-1'>
            <div className='flex items-center justify-between mb-1'>
              <span className='text-sm text-gray-600 dark:text-slate-400'>合规维度</span>
              <span className='text-sm font-medium text-green-600 dark:text-green-400'>
                {((weights.compliance || 0) * 100).toFixed(1)}%
              </span>
            </div>
            <div className='h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden'>
              <div 
                className='h-full bg-green-500 rounded-full transition-all'
                style={{ width: `${(weights.compliance || 0) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 排名列表 */}
      <div>
        <h4 className='text-base font-medium text-gray-900 dark:text-white mb-4'>
          综合评分排行榜
        </h4>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-gray-200 dark:border-slate-700'>
                <th className='text-center py-3 px-4 font-medium text-gray-500 dark:text-slate-400 w-16'>
                  排名
                </th>
                <th className='text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                  学生姓名
                </th>
                <th className='text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                  班级
                </th>
                <th className='text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                  综合得分
                </th>
                <th className='text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                  行为
                </th>
                <th className='text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                  学业
                </th>
                <th className='text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                  合规
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rankings?.slice(0, 20).map((item, index) => (
                <tr 
                  key={item.user_id}
                  className='border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30'
                >
                  <td className='py-3 px-4 text-center'>
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                      index === 1 ? 'bg-gray-200 text-gray-700 dark:bg-slate-600 dark:text-slate-300' :
                      index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' :
                      'bg-gray-50 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {item.ranking}
                    </span>
                  </td>
                  <td className='py-3 px-4 font-medium text-gray-900 dark:text-white'>
                    {item.name}
                  </td>
                  <td className='py-3 px-4 text-gray-500 dark:text-slate-400'>
                    {item.class_name || '-'}
                  </td>
                  <td className='py-3 px-4 text-right'>
                    <span className={`font-bold ${
                      item.composite_score >= 80 ? 'text-green-600 dark:text-green-400' :
                      item.composite_score >= 60 ? 'text-blue-600 dark:text-blue-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {item.composite_score?.toFixed(1) || 0}
                    </span>
                  </td>
                  <td className='py-3 px-4 text-right text-blue-600 dark:text-blue-400'>
                    {item.behavior_score}
                  </td>
                  <td className='py-3 px-4 text-right text-purple-600 dark:text-purple-400'>
                    {item.academic_score?.toFixed(1) || '-'}
                  </td>
                  <td className='py-3 px-4 text-right text-green-600 dark:text-green-400'>
                    {100 - (item.unlock_count || 0) * 10}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.rankings?.length > 20 && (
          <p className='text-sm text-gray-500 dark:text-slate-400 text-center py-4'>
            显示前20条，共{data.rankings.length}条记录
          </p>
        )}
      </div>
    </div>
  );
}

// 风险预警面板
function WarningPanel({ data, config, onRunEvaluation, onResolveWarning, onUpdateConfig, loading }) {
  const [editingConfig, setEditingConfig] = useState(null);
  const [configValue, setConfigValue] = useState('');

  if (!data) {
    return (
      <div className='p-8 text-center text-gray-500 dark:text-slate-400'>
        暂无预警数据，请先执行风险评估
      </div>
    );
  }

  const riskStudents = data.risk_students || [];
  const highRisk = riskStudents.filter(s => s.risk_level === 'high').length;
  const mediumRisk = riskStudents.filter(s => s.risk_level === 'medium').length;
  const lowRisk = riskStudents.filter(s => s.risk_level === 'low').length;

  const handleEditConfig = (key, value) => {
    setEditingConfig(key);
    setConfigValue(value);
  };

  const handleSaveConfig = (key) => {
    onUpdateConfig(key, configValue);
    setEditingConfig(null);
  };

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
          风险预警管理
        </h3>
        <button
          onClick={onRunEvaluation}
          disabled={loading}
          className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50'
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          执行评估
        </button>
      </div>

      {/* 预警概览 */}
      <div className='grid grid-cols-3 gap-4'>
        <div className='p-4 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/30'>
          <div className='flex items-center gap-2 mb-1'>
            <AlertTriangle className='w-4 h-4 text-red-500' />
            <span className='text-sm font-medium text-red-600 dark:text-red-400'>高风险</span>
          </div>
          <p className='text-2xl font-bold text-red-600 dark:text-red-400'>{highRisk}</p>
        </div>
        <div className='p-4 bg-yellow-50 dark:bg-yellow-500/10 rounded-xl border border-yellow-200 dark:border-yellow-500/30'>
          <div className='flex items-center gap-2 mb-1'>
            <AlertTriangle className='w-4 h-4 text-yellow-500' />
            <span className='text-sm font-medium text-yellow-600 dark:text-yellow-400'>中风险</span>
          </div>
          <p className='text-2xl font-bold text-yellow-600 dark:text-yellow-400'>{mediumRisk}</p>
        </div>
        <div className='p-4 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-200 dark:border-green-500/30'>
          <div className='flex items-center gap-2 mb-1'>
            <Shield className='w-4 h-4 text-green-500' />
            <span className='text-sm font-medium text-green-600 dark:text-green-400'>低风险</span>
          </div>
          <p className='text-2xl font-bold text-green-600 dark:text-green-400'>{lowRisk}</p>
        </div>
      </div>

      {/* 预警列表 */}
      <div>
        <h4 className='text-base font-medium text-gray-900 dark:text-white mb-4'>
          预警学生列表
        </h4>
        {riskStudents.length === 0 ? (
          <div className='text-center py-8 text-gray-500 dark:text-slate-400'>
            <Shield className='w-12 h-12 mx-auto mb-3 text-green-400' />
            <p>暂无预警学生</p>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-gray-200 dark:border-slate-700'>
                  <th className='text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                    学生姓名
                  </th>
                  <th className='text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                    班级
                  </th>
                  <th className='text-center py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                    风险等级
                  </th>
                  <th className='text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                    当前积分
                  </th>
                  <th className='text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                    预警原因
                  </th>
                  <th className='text-center py-3 px-4 font-medium text-gray-500 dark:text-slate-400'>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {riskStudents.map((student) => {
                  const colors = RISK_COLORS[student.risk_level] || RISK_COLORS.low;
                  const reasons = data.warning_reasons?.[student.user_id] || [];
                  return (
                    <tr 
                      key={student.user_id}
                      className='border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30'
                    >
                      <td className='py-3 px-4 font-medium text-gray-900 dark:text-white'>
                        {student.name}
                      </td>
                      <td className='py-3 px-4 text-gray-500 dark:text-slate-400'>
                        {student.class_name || '-'}
                      </td>
                      <td className='py-3 px-4 text-center'>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors.light} ${colors.text}`}>
                          {student.risk_level === 'high' ? '高风险' : 
                           student.risk_level === 'medium' ? '中风险' : '低风险'}
                        </span>
                      </td>
                      <td className='py-3 px-4 text-right'>
                        <span className={student.current_score < 30 ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                          {student.current_score}
                        </span>
                      </td>
                      <td className='py-3 px-4'>
                        <div className='flex flex-wrap gap-1'>
                          {reasons.slice(0, 2).map((reason, idx) => (
                            <span 
                              key={idx}
                              className='inline-block px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded text-xs'
                            >
                              {reason.length > 20 ? reason.slice(0, 20) + '...' : reason}
                            </span>
                          ))}
                          {reasons.length > 2 && (
                            <span className='text-xs text-gray-400'>+{reasons.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className='py-3 px-4 text-center'>
                        <button
                          onClick={() => onResolveWarning(student.user_id)}
                          className='inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 rounded transition-colors'
                        >
                          <CheckCircle className='w-3 h-3' />
                          解决
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 预警配置 */}
      <div>
        <h4 className='text-base font-medium text-gray-900 dark:text-white mb-4'>
          预警规则配置
        </h4>
        <div className='space-y-3'>
          {config && Object.entries(config).map(([key, value]) => (
            <div 
              key={key}
              className='flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg'
            >
              <div>
                <span className='text-sm font-medium text-gray-700 dark:text-slate-300'>
                  {key === 'score_threshold' ? '积分预警阈值' :
                   key === 'unlock_daily_limit' ? '每日开锁限制' :
                   key === 'no_positive_days' ? '无正向积分天数' :
                   key === 'low_score_threshold' ? '低分预警阈值' :
                   key === 'risk_score_threshold' ? '风险评分阈值' : key}
                </span>
                <p className='text-xs text-gray-500 dark:text-slate-400 mt-0.5'>
                  {key === 'score_threshold' ? '低于此分数将触发预警' :
                   key === 'unlock_daily_limit' ? '超过此次数将触发预警' :
                   key === 'no_positive_days' ? '超过此天数无正向积分将触发预警' :
                   key === 'low_score_threshold' ? '成绩低于此分数将触发预警' :
                   key === 'risk_score_threshold' ? '综合风险评分阈值' : ''}
                </p>
              </div>
              {editingConfig === key ? (
                <div className='flex items-center gap-2'>
                  <input
                    type='text'
                    value={configValue}
                    onChange={(e) => setConfigValue(e.target.value)}
                    className='w-20 px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-primary-500'
                  />
                  <button
                    onClick={() => handleSaveConfig(key)}
                    className='px-2 py-1 text-xs font-medium text-white bg-primary-500 rounded hover:bg-primary-600'
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingConfig(null)}
                    className='px-2 py-1 text-xs font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600 rounded'
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className='flex items-center gap-2'>
                  <span className='text-sm font-bold text-primary-600 dark:text-primary-400'>
                    {value}
                  </span>
                  <button
                    onClick={() => handleEditConfig(key, value)}
                    className='p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'
                  >
                    <Settings className='w-4 h-4' />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
