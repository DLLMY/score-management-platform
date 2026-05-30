import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import api from '../services/api';
import EmptyState from '../components/EmptyState';

function Analysis() {
  const [users, setUsers] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    const data = await api.users.getAll();
    setUsers(data.users || []);
    setIsLoading(false);
  };

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
      qualifiedRate:
        classUsers.length > 0 ? Math.round((qualifiedCount / classUsers.length) * 100) : 0,
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

  const topUsers = [...filteredUsers]
    .sort((a, b) => b.current_score - a.current_score)
    .slice(0, 10);

  const scores = filteredUsers.map((u) => u.current_score);
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
  const avgScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : 0;
  const variance =
    scores.length > 0
      ? scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length
      : 0;
  const stdDev = Math.round(Math.sqrt(variance));

  const needAttention = filteredUsers.filter((u) => u.current_score < 60);
  const excellentCount = filteredUsers.filter((u) => u.current_score >= 90).length;

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

  const stats = [
    {
      label: '学生总数',
      value: filteredUsers.length,
      icon: Users,
      bgColor: 'bg-primary-100',
      textColor: 'text-primary-600',
      trend: null,
    },
    {
      label: '平均积分',
      value: avgScore,
      icon: Award,
      bgColor: 'bg-success-100',
      textColor: 'text-success-600',
      trend: '+5%',
    },
    {
      label: '最高积分',
      value: maxScore,
      icon: TrendingUp,
      bgColor: 'bg-accent-100',
      textColor: 'text-accent-600',
      trend: '+8',
    },
    {
      label: '最低积分',
      value: minScore,
      icon: TrendingDown,
      bgColor: 'bg-danger-100',
      textColor: 'text-danger-600',
      trend: '-3',
    },
    {
      label: '标准差',
      value: stdDev,
      icon: Activity,
      bgColor: 'bg-info-100',
      textColor: 'text-info-600',
      trend: null,
    },
    {
      label: '优秀人数',
      value: excellentCount,
      icon: Zap,
      bgColor: 'bg-warning-100',
      textColor: 'text-warning-600',
      trend: '+12%',
    },
    {
      label: '手机箱权限',
      value: filteredUsers.filter((u) => u.current_score >= 60).length,
      icon: Target,
      bgColor: 'bg-primary-100',
      textColor: 'text-primary-600',
      trend: '+8%',
    },
    {
      label: '需关注',
      value: needAttention.length,
      icon: AlertTriangle,
      bgColor: 'bg-danger-100',
      textColor: 'text-danger-600',
      trend: needAttention.length > 0 ? '需关注' : null,
    },
  ];

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
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-7'>
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className='stats-card'>
                  <div className='flex items-start justify-between'>
                    <div>
                      <p className='text-xs text-gray-500 mb-1'>{stat.label}</p>
                      <p className='text-2xl font-bold text-gray-800'>{stat.value}</p>
                      {stat.trend && (
                        <div className='flex items-center gap-1 mt-1.5'>
                          <TrendingUp className='w-3 h-3 text-success-600' />
                          <span className='text-xs font-medium text-success-600'>{stat.trend}</span>
                        </div>
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

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-7'>
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
                <ResponsiveContainer width='100%' height={320}>
                  <BarChart data={scoreDistribution}>
                    <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                    <XAxis
                      dataKey='name'
                      tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip
                      formatter={(value) => [`${value} 人`, '人数']}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px -5px rgba(0, 0, 0, 0.1)',
                      }}
                    />
                    <Bar dataKey='count' radius={[10, 10, 0, 0]} barSize={60}>
                      {scoreDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className='card'>
              <div className='card-header'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-accent-100 rounded-xl flex items-center justify-center'>
                    <Award className='w-5 h-5 text-accent-600' />
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-gray-800'>积分等级占比</h3>
                    <p className='text-xs text-gray-500'>各等级学生占比分布</p>
                  </div>
                </div>
              </div>
              <div className='card-body'>
                <ResponsiveContainer width='100%' height={320}>
                  <PieChart>
                    <Pie
                      data={scoreDistribution}
                      cx='50%'
                      cy='50%'
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      innerRadius={60}
                      dataKey='count'
                    >
                      {scoreDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value} 人`, '人数']}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px -5px rgba(0, 0, 0, 0.1)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <div className='card'>
              <div className='card-header'>
                <h3 className='text-lg font-semibold text-gray-800'>班级统计</h3>
              </div>
              <div className='card-body'>
                <div className='space-y-5'>
                  {classStats.map((stats) => (
                    <div
                      key={stats.className}
                      className='bg-gradient-to-r from-gray-50 to-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-all'
                    >
                      <div className='flex justify-between items-center mb-4'>
                        <div className='flex items-center gap-4'>
                          <div className='w-12 h-12 bg-gradient-to-br from-primary-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-semibold shadow-lg'>
                            {stats.className.charAt(0)}
                          </div>
                          <div>
                            <h4 className='font-semibold text-gray-800 text-lg'>
                              {stats.className}
                            </h4>
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
                          <p className='text-xl font-bold text-primary-600'>
                            {stats.qualifiedCount}
                          </p>
                          <p className='text-xs text-primary-600'>达标人数</p>
                        </div>
                        <div className='text-center p-4 bg-success-50 rounded-xl'>
                          <p className='text-xl font-bold text-success-600'>
                            {stats.qualifiedRate}%
                          </p>
                          <p className='text-xs text-success-600'>达标率</p>
                        </div>
                        <div className='text-center p-4 bg-accent-50 rounded-xl'>
                          <p className='text-xl font-bold text-accent-600'>
                            {stats.count - stats.qualifiedCount}
                          </p>
                          <p className='text-xs text-accent-600'>未达标</p>
                        </div>
                      </div>
                      <div className='mt-4'>
                        <div className='flex justify-between text-xs text-gray-500 mb-1.5'>
                          <span>达标进度</span>
                          <span>
                            {stats.qualifiedCount}/{stats.count}
                          </span>
                        </div>
                        <div className='progress-bar'>
                          <div
                            className={`progress-fill ${
                              stats.qualifiedRate >= 80
                                ? 'bg-success-500'
                                : stats.qualifiedRate >= 50
                                  ? 'bg-warning-500'
                                  : 'bg-danger-500'
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
                  {topUsers.map((user, index) => (
                    <div
                      key={user.id}
                      className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                        index < 3
                          ? 'bg-gradient-to-r from-warning-50 to-orange-50 border border-warning-100'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                          index === 0
                            ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg'
                            : index === 1
                              ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
                              : index === 2
                                ? 'bg-gradient-to-br from-amber-600 to-orange-600 text-white'
                                : 'bg-gray-100 text-gray-600'
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
                            <p className='font-semibold text-gray-800'>{user.name}</p>
                            <p className='text-xs text-gray-500'>{user.class_name}</p>
                          </div>
                        </div>
                      </div>
                      <div
                        className={`text-right ${
                          user.current_score >= 80
                            ? 'text-success-600'
                            : user.current_score >= 60
                              ? 'text-primary-600'
                              : 'text-danger-600'
                        }`}
                      >
                        <p className='text-2xl font-bold'>{user.current_score}</p>
                        <p className='text-xs text-gray-500'>分</p>
                      </div>
                    </div>
                  ))}
                  {topUsers.length === 0 && (
                    <EmptyState
                      icon='users'
                      title='暂无数据'
                      description='当前筛选条件下没有学生数据'
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 mb-7'>
            <div className='card'>
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
                    <XAxis
                      dataKey='week'
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip
                      formatter={(value) => [`${value}分`, '平均分']}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                      }}
                    />
                    <Area
                      type='monotone'
                      dataKey='avg'
                      stroke='#22c55e'
                      fill='url(#colorAvg)'
                      strokeWidth={2}
                    />
                    <defs>
                      <linearGradient id='colorAvg' x1='0' y1='0' x2='0' y2='1'>
                        <stop offset='0%' stopColor='#22c55e' stopOpacity={0.3} />
                        <stop offset='100%' stopColor='#22c55e' stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className='card'>
              <div className='card-header'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-info-100 rounded-xl flex items-center justify-center'>
                    <Activity className='w-5 h-5 text-info-600' />
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-gray-800'>班级对比</h3>
                    <p className='text-xs text-gray-500'>多维指标雷达图</p>
                  </div>
                </div>
              </div>
              <div className='card-body'>
                <ResponsiveContainer width='100%' height={250}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke='#e2e8f0' />
                    <PolarAngleAxis dataKey='subject' tick={{ fontSize: 10, fill: '#64748b' }} />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fontSize: 9, fill: '#94a3b8' }}
                    />
                    <Radar
                      name='平均分'
                      dataKey='avgScore'
                      stroke='#3b82f6'
                      fill='#3b82f6'
                      fillOpacity={0.3}
                    />
                    <Radar
                      name='达标率'
                      dataKey='qualifiedRate'
                      stroke='#22c55e'
                      fill='#22c55e'
                      fillOpacity={0.3}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className='card'>
              <div className='card-header'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center'>
                    <Clock className='w-5 h-5 text-warning-600' />
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-gray-800'>周活跃度</h3>
                    <p className='text-xs text-gray-500'>近8周参与人数</p>
                  </div>
                </div>
              </div>
              <div className='card-body'>
                <ResponsiveContainer width='100%' height={250}>
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                    <XAxis
                      dataKey='week'
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip
                      formatter={(value) => [`${value}人`, '参与人数']}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                      }}
                    />
                    <Line
                      type='monotone'
                      dataKey='count'
                      stroke='#f59e0b'
                      strokeWidth={3}
                      dot={{ fill: '#f59e0b', strokeWidth: 2, r: 5 }}
                      activeDot={{ fill: '#f59e0b', strokeWidth: 2, r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className='card'>
            <div className='card-header'>
              <h3 className='text-lg font-semibold text-gray-800'>需关注学生</h3>
            </div>
            <div className='card-body'>
              {needAttention.length > 0 ? (
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                  {needAttention.map((user) => (
                    <div
                      key={user.id}
                      className='bg-gradient-to-r from-danger-50 to-orange-50 border border-danger-100 rounded-xl p-4'
                    >
                      <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 bg-gradient-to-br from-danger-500 to-orange-500 rounded-xl flex items-center justify-center text-white'>
                          <User className='w-5 h-5' />
                        </div>
                        <div className='flex-1'>
                          <p className='font-semibold text-gray-800'>{user.name}</p>
                          <p className='text-xs text-gray-500'>{user.class_name}</p>
                        </div>
                        <div className='text-right'>
                          <p className='text-xl font-bold text-danger-600'>{user.current_score}</p>
                          <p className='text-xs text-danger-500'>需提升</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-center py-12'>
                  <Target className='w-12 h-12 mx-auto mb-4 text-success-400' />
                  <p className='text-success-600 font-medium'>所有学生积分均达标</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Analysis;
