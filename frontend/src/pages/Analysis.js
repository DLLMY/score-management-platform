import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Users,
  Award,
  TrendingUp,
  Medal,
  Target,
  Filter,
  User,
  TrendingDown,
  Clock,
  Activity,
  Zap,
  AlertTriangle,
  Sparkles,
  Shield,
  GitBranch,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import api from '../services/api';
import EmptyState from '../components/EmptyState';

// 分群配色
const CLUSTER_COLORS = {
  '全面优秀型': { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30' },
  '遵纪但学业吃力型': { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50 dark:bg-yellow-500/10', border: 'border-yellow-200 dark:border-yellow-500/30' },
  '聪明但散漫型': { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/30' },
  '双困型': { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30' },
};

// 风险配色
const RISK_COLORS = {
  high: { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50 dark:bg-red-500/10' },
  medium: { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50 dark:bg-yellow-500/10' },
  low: { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50 dark:bg-green-500/10' },
};

function Analysis() {
  const [users, setUsers] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // 算法数据
  const [algorithmData, setAlgorithmData] = useState({
    statistics: null,
    clusters: null,
    warnings: null,
  });

  useEffect(() => {
    fetchUsers();
    fetchAlgorithmData();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api.users.getAll();
      setUsers(data.users || []);
    } catch (error) {
      console.error('获取用户数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 获取算法数据
  const fetchAlgorithmData = useCallback(async () => {
    try {
      const params = selectedClass ? { class_name: selectedClass } : {};
      
      const [statsRes, clusterRes, warningRes] = await Promise.all([
        api.algorithm.getStatistics(params).catch(() => null),
        api.algorithm.getClusters(params).catch(() => null),
        api.algorithm.getWarnings(params).catch(() => null),
      ]);
      
      setAlgorithmData({
        statistics: statsRes?.data || null,
        clusters: clusterRes?.data || null,
        warnings: warningRes?.data || null,
      });
    } catch (error) {
      console.error('获取算法数据失败:', error);
    }
  }, [selectedClass]);

  useEffect(() => {
    fetchAlgorithmData();
  }, [fetchAlgorithmData]);

  const classes = [...new Set(users.map((u) => u.class_name))];
  const filteredUsers = selectedClass ? users.filter((u) => u.class_name === selectedClass) : users;

  const classStats = classes.map((className) => {
    const classUsers = users.filter((u) => u.class_name === className);
    const totalScore = classUsers.reduce((sum, u) => sum + u.current_score, 0);
    const avgScore = classUsers.length > 0 ? Math.round(totalScore / classUsers.length) : 0;
    const qualifiedCount = classUsers.filter((u) => u.current_score >= 60).length;
    return {
      className,
      count: classUsers.length,
      avgScore,
      qualifiedCount,
      qualifiedRate: classUsers.length > 0 ? Math.round((qualifiedCount / classUsers.length) * 100) : 0,
    };
  });

  const scoreDistribution = [
    {
      name: '0-59',
      count: filteredUsers.filter((u) => u.current_score < 60).length,
      color: '#ef4444',
    },
    {
      name: '60-79',
      count: filteredUsers.filter((u) => u.current_score >= 60 && u.current_score < 80).length,
      color: '#f59e0b',
    },
    {
      name: '80-100',
      count: filteredUsers.filter((u) => u.current_score >= 80).length,
      color: '#22c55e',
    },
  ];

  // 获取带分群信息的用户
  const getUsersWithCluster = (userList) => {
    if (!algorithmData.clusters?.students) return userList;
    
    const clusterMap = new Map(
      algorithmData.clusters.students.map(s => [s.user_id, s])
    );
    
    return userList.map(user => ({
      ...user,
      cluster: clusterMap.get(user.id) || null,
    }));
  };

  const usersWithCluster = getUsersWithCluster(filteredUsers);
  const topUsers = [...usersWithCluster]
    .sort((a, b) => b.current_score - a.current_score)
    .slice(0, 10);

  const scores = filteredUsers.map((u) => u.current_score);
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : 0;
  const variance = scores.length > 0 ? scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length : 0;
  const stdDev = Math.round(Math.sqrt(variance));

  const needAttention = filteredUsers.filter((u) => u.current_score < 60);
  const excellentCount = filteredUsers.filter((u) => u.current_score >= 90).length;

  // 算法洞察数据
  const { statistics, clusters, warnings } = algorithmData;
  
  // 风险统计
  const riskStudents = warnings?.risk_students || [];
  const highRiskCount = riskStudents.filter(s => s.risk_level === 'high').length;
  const mediumRiskCount = riskStudents.filter(s => s.risk_level === 'medium').length;
  const lowRiskCount = riskStudents.filter(s => s.risk_level === 'low').length;
  
  // 分群统计
  const clusterSummary = clusters?.cluster_summary || [];
  
  // 分群饼图数据
  const clusterPieData = clusterSummary.map(cluster => ({
    name: cluster.label,
    value: cluster.count,
    color: CLUSTER_COLORS[cluster.label]?.bg.replace('bg-', '#').replace('-500', '') || '#6b7280',
  }));

  const weeklyData = [
    { week: '第1周', avg: 72, count: 120 },
    { week: '第2周', avg: 75, count: 125 },
    { week: '第3周', avg: 78, count: 118 },
    { week: '第4周', avg: 74, count: 122 },
    { week: '第5周', avg: 80, count: 128 },
    { week: '第6周', avg: 79, count: 130 },
    { week: '第7周', avg: 82, count: 126 },
    { week: '第8周', avg: 85, count: 132 },
  ];

  const radarData = classStats.map((c) => ({
    subject: c.className,
    avgScore: c.avgScore,
    qualifiedRate: c.qualifiedRate,
    count: Math.round((c.count / Math.max(...classStats.map((s) => s.count))) * 100),
  }));

  // 基础统计卡片
  const basicStats = [
    { label: '学生总数', value: filteredUsers.length, icon: Users, bgColor: 'bg-primary-100', textColor: 'text-primary-600' },
    { label: '平均积分', value: avgScore, icon: Award, bgColor: 'bg-success-100', textColor: 'text-success-600' },
    { label: '最高积分', value: maxScore, icon: TrendingUp, bgColor: 'bg-accent-100', textColor: 'text-accent-600' },
    { label: '最低积分', value: minScore, icon: TrendingDown, bgColor: 'bg-danger-100', textColor: 'text-danger-600' },
    { label: '标准差', value: stdDev, icon: Activity, bgColor: 'bg-info-100', textColor: 'text-info-600' },
    { label: '优秀人数', value: excellentCount, icon: Zap, bgColor: 'bg-warning-100', textColor: 'text-warning-600' },
  ];

  // 算法洞察统计卡片
  const algorithmStats = [
    {
      label: '行为-学业相关性',
      value: statistics?.correlation?.toFixed(2) || '—',
      icon: TrendingUp,
      bgColor: statistics?.correlation > 0.5 ? 'bg-green-100' : 'bg-yellow-100',
      textColor: statistics?.correlation > 0.5 ? 'text-green-600' : 'text-yellow-600',
      trend: statistics?.correlation > 0.5 ? '正相关' : statistics?.correlation > 0 ? '弱相关' : '负相关',
      description: '积分与成绩关联度',
    },
    {
      label: '学生分群',
      value: clusters?.n_clusters || '—',
      icon: GitBranch,
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-600',
      trend: `${clusters?.students?.length || 0}名学生`,
      description: '已分群学生数量',
    },
    {
      label: '风险预警',
      value: riskStudents.length,
      icon: Shield,
      bgColor: riskStudents.length > 0 ? 'bg-red-100' : 'bg-green-100',
      textColor: riskStudents.length > 0 ? 'text-red-600' : 'text-green-600',
      trend: riskStudents.length > 0 ? '需关注' : '无预警',
      description: '高/中/低风险学生',
    },
  ];

  // 分群颜色映射
  const getClusterColor = (label) => {
    const colorMap = {
      '全面优秀型': '#3b82f6',
      '遵纪但学业吃力型': '#eab308',
      '聪明但散漫型': '#f97316',
      '双困型': '#ef4444',
    };
    return colorMap[label] || '#6b7280';
  };

  return (
    <div className='max-w-7xl mx-auto'>
      <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-7'>
        <div className='flex items-center gap-4'>
          <div className='w-12 h-12 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30'>
            <BarChart3 className='w-6 h-6 text-white' />
          </div>
          <div>
            <h2 className='page-title'>数据分析</h2>
            <p className='page-subtitle'>学生积分数据统计与分析</p>
          </div>
        </div>
        <div className='flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5'>
          <Filter className='w-5 h-5 text-gray-500' />
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className='bg-transparent border-none text-sm font-medium text-gray-700 focus:outline-none cursor-pointer'
          >
            <option value=''>全部班级</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className='flex items-center justify-center py-20'>
          <div className='w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin' />
        </div>
      ) : (
        <>
          {/* 基础统计卡片 */}
          <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-7'>
            {basicStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className='stats-card'>
                  <div className='flex items-start justify-between'>
                    <div>
                      <p className='text-xs text-gray-500 mb-1'>{stat.label}</p>
                      <p className='text-2xl font-bold text-gray-800'>{stat.value}</p>
                    </div>
                    <div className={`${stat.bgColor} ${stat.textColor} stats-icon`}>
                      <Icon className='w-7 h-7' />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 算法洞察统计卡片 */}
          <div className='mb-7'>
            <div className='flex items-center gap-2 mb-4'>
              <Sparkles className='w-5 h-5 text-purple-500' />
              <h3 className='text-lg font-semibold text-gray-800'>算法洞察</h3>
              <span className='text-xs text-gray-500 px-2 py-0.5 bg-purple-50 dark:bg-purple-500/10 rounded-full'>
                基于行为与学业数据
              </span>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              {algorithmStats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div key={index} className='stats-card border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-500/5'>
                    <div className='flex items-start justify-between'>
                      <div>
                        <p className='text-xs text-gray-500 mb-0.5'>{stat.label}</p>
                        <p className={`text-2xl font-bold ${stat.textColor}`}>{stat.value}</p>
                        <p className='text-xs text-gray-400 mt-1'>{stat.description}</p>
                        {stat.trend && (
                          <span className={`inline-flex items-center gap-0.5 text-xs font-medium mt-1.5 ${
                            stat.label === '风险预警' && riskStudents.length > 0 ? 'text-red-500' : 'text-gray-500'
                          }`}>
                            {stat.label === '行为-学业相关性' && (statistics?.correlation > 0.5 ? (
                              <ArrowUpRight className='w-3 h-3' />
                            ) : statistics?.correlation > 0 ? (
                              <ArrowDownRight className='w-3 h-3' />
                            ) : null)}
                            {stat.trend}
                          </span>
                        )}
                      </div>
                      <div className={`${stat.bgColor} ${stat.textColor} stats-icon`}>
                        <Icon className='w-7 h-7' />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-7'>
            {/* 积分分布 */}
            <div className='card'>
              <div className='card-header'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center'>
                    <BarChart3 className='w-5 h-5 text-primary-600' />
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-gray-800'>积分分布</h3>
                    <p className='text-xs text-gray-500'>各分数段学生人数统计</p>
                  </div>
                </div>
              </div>
              <div className='card-body'>
                <ResponsiveContainer width='100%' height={280}>
                  <BarChart data={scoreDistribution}>
                    <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                    <XAxis dataKey='name' tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                    <Tooltip formatter={(value) => [`${value} 人`, '人数']} contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px' }} />
                    <Bar dataKey='count' radius={[10, 10, 0, 0]} barSize={60}>
                      {scoreDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 学生分群分布 */}
            <div className='card'>
              <div className='card-header'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center'>
                    <GitBranch className='w-5 h-5 text-purple-600' />
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-gray-800'>学生分群分布</h3>
                    <p className='text-xs text-gray-500'>基于行为与学业聚类分析</p>
                  </div>
                </div>
              </div>
              <div className='card-body'>
                {clusterSummary.length > 0 ? (
                  <div className='flex items-center gap-6'>
                    <ResponsiveContainer width='50%' height={200}>
                      <PieChart>
                        <Pie
                          data={clusterPieData}
                          cx='50%'
                          cy='50%'
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey='value'
                        >
                          {clusterPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getClusterColor(entry.name)} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} 人`, '人数']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className='flex-1 space-y-2'>
                      {clusterSummary.map((cluster) => {
                        const colors = CLUSTER_COLORS[cluster.label] || CLUSTER_COLORS['双困型'];
                        return (
                          <div key={cluster.label} className='flex items-center justify-between'>
                            <div className='flex items-center gap-2'>
                              <div className={`w-3 h-3 rounded-full ${colors.bg}`} />
                              <span className='text-sm text-gray-700 dark:text-slate-300'>{cluster.label}</span>
                            </div>
                            <span className={`text-sm font-semibold ${colors.text}`}>{cluster.count}人</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className='flex flex-col items-center justify-center h-[200px] text-center'>
                    <GitBranch className='w-12 h-12 text-gray-300 mb-3' />
                    <p className='text-gray-500'>暂无分群数据</p>
                    <p className='text-xs text-gray-400 mt-1'>前往「算法分析」页面执行分群计算</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 风险预警概览 */}
          {riskStudents.length > 0 && (
            <div className='card mb-7 border-l-4 border-l-red-400'>
              <div className='card-header'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center'>
                    <AlertTriangle className='w-5 h-5 text-red-600' />
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-gray-800'>风险预警</h3>
                    <p className='text-xs text-gray-500'>需要关注的学生</p>
                  </div>
                </div>
              </div>
              <div className='card-body'>
                <div className='grid grid-cols-3 gap-4 mb-4'>
                  <div className='text-center p-3 bg-red-50 dark:bg-red-500/10 rounded-xl'>
                    <p className='text-2xl font-bold text-red-600'>{highRiskCount}</p>
                    <p className='text-xs text-red-600 font-medium'>高风险</p>
                  </div>
                  <div className='text-center p-3 bg-yellow-50 dark:bg-yellow-500/10 rounded-xl'>
                    <p className='text-2xl font-bold text-yellow-600'>{mediumRiskCount}</p>
                    <p className='text-xs text-yellow-600 font-medium'>中风险</p>
                  </div>
                  <div className='text-center p-3 bg-green-50 dark:bg-green-500/10 rounded-xl'>
                    <p className='text-2xl font-bold text-green-600'>{lowRiskCount}</p>
                    <p className='text-xs text-green-600 font-medium'>低风险</p>
                  </div>
                </div>
                <div className='space-y-2'>
                  {riskStudents.slice(0, 5).map((student) => {
                    const colors = RISK_COLORS[student.risk_level] || RISK_COLORS.low;
                    const reasons = warnings?.warning_reasons?.[student.user_id] || [];
                    return (
                      <div key={student.user_id} className={`flex items-center justify-between p-3 rounded-lg ${colors.light}`}>
                        <div className='flex items-center gap-3'>
                          <AlertTriangle className={`w-4 h-4 ${colors.text}`} />
                          <div>
                            <p className='font-medium text-gray-800 dark:text-slate-200'>{student.name}</p>
                            <p className='text-xs text-gray-500'>{student.class_name} · 积分: {student.current_score}</p>
                          </div>
                        </div>
                        <div className='text-right'>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors.light} ${colors.text}`}>
                            {student.risk_level === 'high' ? '高风险' : student.risk_level === 'medium' ? '中风险' : '低风险'}
                          </span>
                          <p className='text-xs text-gray-500 mt-1'>{reasons[0]?.slice(0, 15)}...</p>
                        </div>
                      </div>
                    );
                  })}
                  {riskStudents.length > 5 && (
                    <p className='text-center text-xs text-gray-500 py-2'>
                      还有 {riskStudents.length - 5} 名预警学生...
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* 班级统计 */}
            <div className='card'>
              <div className='card-header'>
                <h3 className='text-lg font-semibold text-gray-800'>班级统计</h3>
              </div>
              <div className='card-body'>
                <div className='space-y-5'>
                  {classStats.map((stats) => (
                    <div key={stats.className} className='bg-gradient-to-r from-gray-50 to-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-all'>
                      <div className='flex justify-between items-center mb-4'>
                        <div className='flex items-center gap-4'>
                          <div className='w-12 h-12 bg-gradient-to-br from-primary-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-semibold shadow-lg'>
                            {stats.className.charAt(0)}
                          </div>
                          <div>
                            <h4 className='font-semibold text-gray-800 text-lg'>{stats.className}</h4>
                            <p className='text-sm text-gray-500'>{stats.count} 名学生</p>
                          </div>
                        </div>
                        <div className='text-right'>
                          <p className='text-2xl font-bold text-primary-600'>{stats.avgScore}</p>
                          <p className='text-xs text-gray-500'>平均分</p>
                        </div>
                      </div>
                      <div className='grid grid-cols-3 gap-3'>
                        <div className='text-center p-4 bg-primary-50 rounded-xl'>
                          <p className='text-xl font-bold text-primary-600'>{stats.qualifiedCount}</p>
                          <p className='text-xs text-primary-600'>达标人数</p>
                        </div>
                        <div className='text-center p-4 bg-success-50 rounded-xl'>
                          <p className='text-xl font-bold text-success-600'>{stats.qualifiedRate}%</p>
                          <p className='text-xs text-success-600'>达标率</p>
                        </div>
                        <div className='text-center p-4 bg-accent-50 rounded-xl'>
                          <p className='text-xl font-bold text-accent-600'>{stats.count - stats.qualifiedCount}</p>
                          <p className='text-xs text-accent-600'>未达标</p>
                        </div>
                      </div>
                      <div className='mt-4'>
                        <div className='flex justify-between text-xs text-gray-500 mb-1.5'>
                          <span>达标进度</span>
                          <span>{stats.qualifiedCount}/{stats.count}</span>
                        </div>
                        <div className='progress-bar'>
                          <div
                            className={`progress-fill ${
                              stats.qualifiedRate >= 80 ? 'bg-success-500' : stats.qualifiedRate >= 50 ? 'bg-warning-500' : 'bg-danger-500'
                            }`}
                            style={{ width: `${stats.qualifiedRate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 积分排行榜（带分群标签） */}
            <div className='card'>
              <div className='card-header'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center'>
                    <Medal className='w-5 h-5 text-warning-600' />
                  </div>
                  <h3 className='text-lg font-semibold text-gray-800'>积分排行榜</h3>
                </div>
              </div>
              <div className='card-body'>
                <div className='space-y-4'>
                  {topUsers.map((user, index) => {
                    const clusterColors = user.cluster ? CLUSTER_COLORS[user.cluster.cluster_name] : null;
                    return (
                      <div
                        key={user.id}
                        className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                          index < 3 ? 'bg-gradient-to-r from-warning-50 to-orange-50 border border-warning-100' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                            index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg' :
                            index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                            index === 2 ? 'bg-gradient-to-br from-amber-600 to-orange-600 text-white' :
                            'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className='flex-1'>
                          <div className='flex items-center gap-3'>
                            <div className='w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-600 rounded-xl flex items-center justify-center text-white font-semibold'>
                              <User className='w-5 h-5' />
                            </div>
                            <div>
                              <p className='font-semibold text-gray-800 flex items-center gap-2'>
                                {user.name}
                                {clusterColors && (
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${clusterColors.light} ${clusterColors.text}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${clusterColors.bg}`} />
                                    {user.cluster.cluster_name}
                                  </span>
                                )}
                              </p>
                              <p className='text-xs text-gray-500'>{user.class_name}</p>
                            </div>
                          </div>
                        </div>
                        <div className={`text-right ${user.current_score >= 80 ? 'text-success-600' : user.current_score >= 60 ? 'text-primary-600' : 'text-danger-600'}`}>
                          <p className='text-2xl font-bold'>{user.current_score}</p>
                          <p className='text-xs text-gray-500'>分</p>
                        </div>
                      </div>
                    );
                  })}
                  {topUsers.length === 0 && (
                    <EmptyState icon='users' title='暂无数据' description='当前筛选条件下没有学生数据' />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 积分趋势图和雷达图 */}
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 mb-7 mt-6'>
            {/* 积分趋势 */}
            <div className='card lg:col-span-2'>
              <div className='card-header'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-success-100 rounded-xl flex items-center justify-center'>
                    <TrendingUp className='w-5 h-5 text-success-600' />
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-gray-800'>积分趋势</h3>
                    <p className='text-xs text-gray-500'>近8周平均积分变化</p>
                  </div>
                </div>
              </div>
              <div className='card-body'>
                <ResponsiveContainer width='100%' height={250}>
                  <AreaChart data={weeklyData}>
                    <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                    <XAxis dataKey='week' tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} domain={[60, 100]} />
                    <Tooltip formatter={(value) => [`${value}分`, '平均分']} contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px' }} />
                    <defs>
                      <linearGradient id='colorAvg' x1='0' y1='0' x2='0' y2='1'>
                        <stop offset='5%' stopColor='#22c55e' stopOpacity={0.3} />
                        <stop offset='95%' stopColor='#22c55e' stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type='monotone' dataKey='avg' stroke='#22c55e' strokeWidth={3} fillOpacity={1} fill='url(#colorAvg)' />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 相关性分析 */}
            <div className='card'>
              <div className='card-header'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center'>
                    <Sparkles className='w-5 h-5 text-purple-600' />
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-gray-800'>相关性分析</h3>
                    <p className='text-xs text-gray-500'>行为与学业关联度</p>
                  </div>
                </div>
              </div>
              <div className='card-body'>
                {statistics ? (
                  <div className='flex flex-col items-center justify-center h-[180px]'>
                    <div className={`text-5xl font-bold ${
                      statistics.correlation > 0.5 ? 'text-green-600' :
                      statistics.correlation > 0 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {statistics.correlation?.toFixed(2) || '—'}
                    </div>
                    <p className='text-sm text-gray-500 mt-2'>Pearson相关系数</p>
                    <div className='mt-4 flex items-center gap-2'>
                      {statistics.correlation > 0.5 ? (
                        <>
                          <TrendingUp className='w-4 h-4 text-green-500' />
                          <span className='text-xs text-green-600 font-medium'>强正相关</span>
                        </>
                      ) : statistics.correlation > 0 ? (
                        <>
                          <TrendingUp className='w-4 h-4 text-yellow-500' />
                          <span className='text-xs text-yellow-600 font-medium'>弱正相关</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className='w-4 h-4 text-red-500' />
                          <span className='text-xs text-red-600 font-medium'>负相关</span>
                        </>
                      )}
                    </div>
                    <div className='mt-4 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg w-full'>
                      <p className='text-xs text-gray-500 text-center'>
                        积分与成绩呈{
                          statistics.correlation > 0.5 ? '强正向关联' :
                          statistics.correlation > 0 ? '一定正向关联' :
                          '负向关联'
                        }，
                        {statistics.correlation > 0.5 ? '行为积分高的学生学业成绩普遍较好' : 
                         statistics.correlation > 0 ? '两者存在一定关联' : 
                         '两者可能无明显关联或呈反向趋势'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className='flex flex-col items-center justify-center h-[180px] text-center'>
                    <TrendingUp className='w-12 h-12 text-gray-300 mb-3' />
                    <p className='text-gray-500'>暂无相关数据</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 需要关注的学生 */}
          {needAttention.length > 0 && (
            <div className='card mb-7 border-l-4 border-l-amber-400'>
              <div className='card-header'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center'>
                    <AlertTriangle className='w-5 h-5 text-amber-600' />
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-gray-800'>需关注学生</h3>
                    <p className='text-xs text-gray-500'>积分低于60分的学生</p>
                  </div>
                </div>
              </div>
              <div className='card-body'>
                <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3'>
                  {needAttention.slice(0, 12).map((user) => {
                    const userCluster = usersWithCluster.find(u => u.id === user.id)?.cluster;
                    const clusterColors = userCluster ? CLUSTER_COLORS[userCluster.cluster_name] : null;
                    return (
                      <div key={user.id} className='p-3 bg-red-50 dark:bg-red-500/10 rounded-xl text-center'>
                        <p className='font-semibold text-gray-800 dark:text-slate-200 truncate'>{user.name}</p>
                        <p className='text-xs text-gray-500'>{user.class_name}</p>
                        <p className='text-lg font-bold text-red-600'>{user.current_score}</p>
                        {clusterColors && (
                          <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-xs ${clusterColors.light} ${clusterColors.text}`}>
                            {userCluster.cluster_name}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {needAttention.length > 12 && (
                  <p className='text-center text-xs text-gray-500 mt-3'>
                    还有 {needAttention.length - 12} 名学生积分低于60分...
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Analysis;
