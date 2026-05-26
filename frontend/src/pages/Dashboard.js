import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Trophy, Smartphone, Bell, TrendingUp, TrendingDown, Clock, Users, ArrowUp, ArrowDown, Zap, Activity, Eye, RefreshCw, Wifi, ChevronDown, Building2 } from 'lucide-react';
import api from '../services/api';

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState([]);
  const [devices, setDevices] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [statistics, setStatistics] = useState({
    totalUsers: 0,
    totalRecords: 0,
    totalScore: 0,
    onlineDevices: 0
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const scrollContainerRef = useRef(null);
  const prevUsersRef = useRef([]);

  const filteredUsers = useMemo(() => {
    let result = [...users].sort((a, b) => (b.current_score || 0) - (a.current_score || 0));
    if (selectedClass) {
      result = result.filter(u => u.class_name === selectedClass);
    }
    return result;
  }, [users, selectedClass]);

  const classes = useMemo(() => {
    const classSet = new Set(users.map(u => u.class_name).filter(Boolean));
    return Array.from(classSet).sort();
  }, [users]);

  const classGroups = useMemo(() => {
    const groups = {};
    filteredUsers.forEach(user => {
      const className = user.class_name || '未分班';
      if (!groups[className]) {
        groups[className] = [];
      }
      groups[className].push(user);
    });
    return Object.entries(groups).map(([class_name, students]) => ({
      class_name,
      students
    })).sort((a, b) => a.class_name.localeCompare(b.class_name));
  }, [filteredUsers]);

  const [showUpdateIndicator, setShowUpdateIndicator] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData(true);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // 减少滑动频率，从5秒增加到15秒，每次滑动幅度减小
    const scrollInterval = setInterval(() => {
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      // 如果内容可以完全显示，不需要滑动
      if (scrollHeight <= clientHeight + 10) {
        return;
      }

      const scrollTop = container.scrollTop;

      if (scrollTop >= scrollHeight - clientHeight - 10) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // 减少每次滑动幅度，从50px减少到30px
        container.scrollBy({ top: 30, behavior: 'smooth' });
      }
    }, 15000);

    return () => clearInterval(scrollInterval);
  }, [filteredUsers]);

  const fetchData = async (manualRefresh = false) => {
    try {
      if (manualRefresh) {
        setIsRefreshing(true);
      }
      
      const usersData = await api.users.getAll({ per_page: 100 });
      const usersList = Array.isArray(usersData) ? usersData : usersData.users || [];
      const sortedUsers = [...usersList].sort((a, b) => (b.current_score || 0) - (a.current_score || 0));
      
      // 检测数据变化
      const prevUsers = prevUsersRef.current;
      const hasChanges = sortedUsers.some((user, index) => {
        const prevUser = prevUsers.find(u => u.id === user.id);
        if (!prevUser) return true;
        return prevUser.current_score !== user.current_score || prevUser.name !== user.name;
      });
      
      if (hasChanges && prevUsers.length > 0) {
        setShowUpdateIndicator(true);
        setTimeout(() => setShowUpdateIndicator(false), 2000);
      }
      
      prevUsersRef.current = sortedUsers;
      setUsers(prev => {
        // 平滑更新用户数据，保持排名变化的动画效果
        const updatedUsers = [...sortedUsers];
        updatedUsers.forEach((user, index) => {
          const prevUser = prev.find(u => u.id === user.id);
          if (prevUser && prevUser.current_score !== user.current_score) {
            user.scoreChanged = true;
            setTimeout(() => {
              setUsers(us => us.map(u => ({ ...u, scoreChanged: false })));
            }, 1000);
          }
        });
        return updatedUsers;
      });
      
      const recordsData = await api.records.getAll({ per_page: 20 });
      const recordsList = Array.isArray(recordsData) ? recordsData : recordsData.records || [];
      
      // 只在有新记录时更新
      if (records.length === 0 || recordsList[0]?.id !== records[0]?.id) {
        setRecords(recordsList);
      }
      
      try {
        const deviceData = await api.devices.getAll();
        const deviceList = Array.isArray(deviceData) ? deviceData : [];
        
        // 只在设备状态变化时更新
        const hasDeviceChanges = devices.some((d, i) => {
          const newDevice = deviceList.find(dev => dev.id === d.id);
          return !newDevice || newDevice.status !== d.status;
        }) || deviceList.length !== devices.length;
        
        if (hasDeviceChanges) {
          setDevices(deviceList);
          setStatistics(prev => ({
            ...prev,
            onlineDevices: deviceList.filter(d => d.status === 'online').length
          }));
        }
      } catch (e) {
        if (devices.length === 0) {
          const mockDevices = [
            { id: 1, device_id: 'phonebox_001', status: 'online', last_heartbeat: new Date().toISOString(), wifi_signal: -45, uptime: 9651 },
            { id: 2, device_id: 'phonebox_002', status: 'online', last_heartbeat: new Date().toISOString(), wifi_signal: -52, uptime: 8234 },
            { id: 3, device_id: 'phonebox_003', status: 'offline', last_heartbeat: new Date(Date.now() - 3600000).toISOString(), wifi_signal: -80, uptime: 0 }
          ];
          setDevices(mockDevices);
          setStatistics(prev => ({
            ...prev,
            onlineDevices: mockDevices.filter(d => d.status === 'online').length
          }));
        }
      }
      
      try {
        const notificationsData = await api.notifications.getAll({ per_page: 5 });
        const notificationsList = Array.isArray(notificationsData) ? notificationsData : notificationsData.notifications || [];
        
        // 只在有新通知时更新
        if (notifications.length === 0 || notificationsList.some(n => !notifications.find(on => on.id === n.id))) {
          setNotifications(notificationsList);
        }
      } catch (e) {
        if (notifications.length === 0) {
          setNotifications([
            { id: 1, title: '系统通知', message: '积分管理系统更新完成', created_at: new Date().toISOString(), read: false },
            { id: 2, title: '提醒', message: '请及时审核学生加分申请', created_at: new Date(Date.now() - 3600000).toISOString(), read: false },
            { id: 3, title: '设备告警', message: '设备phonebox_003离线超过1小时', created_at: new Date(Date.now() - 7200000).toISOString(), read: false }
          ]);
        }
      }
      
      setStatistics(prev => ({
        ...prev,
        totalUsers: usersList.length,
        totalRecords: recordsList.length,
        totalScore: usersList.reduce((sum, u) => sum + (u.current_score || 0), 0)
      }));
      
      setLastUpdateTime(new Date());
      
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    return `${hours}小时前`;
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDateFull = (date) => {
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  };

  const getRankColor = (index) => {
    const colors = [
      'from-yellow-400 via-yellow-500 to-amber-600',
      'from-gray-300 via-gray-400 to-gray-500',
      'from-amber-600 via-orange-600 to-amber-800',
      'from-green-400 via-emerald-500 to-green-600',
      'from-blue-400 via-blue-500 to-blue-600',
      'from-purple-400 via-purple-500 to-purple-600',
      'from-pink-400 via-pink-500 to-pink-600',
      'from-cyan-400 via-cyan-500 to-cyan-600',
      'from-red-400 via-red-500 to-red-600',
      'from-indigo-400 via-indigo-500 to-indigo-600',
      'from-amber-400 via-amber-500 to-amber-600',
      'from-rose-400 via-rose-500 to-rose-600',
      'from-teal-400 via-teal-500 to-teal-600',
      'from-violet-400 via-violet-500 to-violet-600',
      'from-lime-400 via-lime-500 to-lime-600',
      'from-fuchsia-400 via-fuchsia-500 to-fuchsia-600',
    ];
    return colors[index] || 'from-slate-500 via-slate-600 to-slate-700';
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getLevel = (score) => {
    if (score >= 95) return '🏆 领航者';
    if (score >= 85) return '⭐ 自律星';
    if (score >= 75) return '🚀 进取者';
    if (score >= 65) return '📊 稳定区';
    if (score >= 60) return '✅ 安全基准';
    if (score >= 50) return '⚠️ 浅观察区';
    if (score >= 40) return '🔴 深观察区';
    if (score >= 30) return '🚨 限行观察区';
    if (score >= 20) return '🔄 重启预备';
    if (score >= 10) return '🛡️ 护航区';
    return '💀 重生点';
  };

  const getLevelColor = (score) => {
    if (score >= 95) return 'bg-gradient-to-r from-yellow-500/30 to-amber-500/20 text-yellow-400 border border-yellow-500/40 font-medium';
    if (score >= 85) return 'bg-gradient-to-r from-blue-500/30 to-cyan-500/20 text-blue-400 border border-blue-500/40 font-medium';
    if (score >= 75) return 'bg-gradient-to-r from-green-500/30 to-emerald-500/20 text-green-400 border border-green-500/40 font-medium';
    if (score >= 65) return 'bg-gradient-to-r from-teal-500/30 to-cyan-500/20 text-teal-400 border border-teal-500/40 font-medium';
    if (score >= 60) return 'bg-gradient-to-r from-cyan-500/30 to-blue-500/20 text-cyan-400 border border-cyan-500/40 font-medium';
    if (score >= 50) return 'bg-gradient-to-r from-orange-500/30 to-amber-500/20 text-orange-400 border border-orange-500/40 font-medium';
    if (score >= 40) return 'bg-gradient-to-r from-red-500/30 to-rose-500/20 text-red-400 border border-red-500/40 font-medium';
    if (score >= 30) return 'bg-gradient-to-r from-pink-500/30 to-rose-500/20 text-pink-400 border border-pink-500/40 font-medium';
    if (score >= 20) return 'bg-gradient-to-r from-purple-500/30 to-violet-500/20 text-purple-400 border border-purple-500/40 font-medium';
    if (score >= 10) return 'bg-gradient-to-r from-indigo-500/30 to-purple-500/20 text-indigo-400 border border-indigo-500/40 font-medium';
    return 'bg-gradient-to-r from-gray-500/30 to-slate-500/20 text-gray-400 border border-gray-500/40 font-medium';
  };

  const AnimatedNumber = ({ value }) => {
    return <span>{value.toLocaleString()}</span>;
  };

  return (
    <div className="min-h-screen p-4">
      {/* 背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>
      
      {/* 头部 */}
      <div className="relative z-10 flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 transition-transform hover:scale-105">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">积分管理平台</h1>
            <p className="text-slate-400 text-xs">实时数据监控中心</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-bold text-white font-mono tracking-wider">{formatTime(currentTime)}</p>
            <p className="text-slate-400 text-xs flex items-center justify-end gap-1">
              {formatDateFull(currentTime)}
              {lastUpdateTime && (
                <span className="text-slate-500">| 最后更新: {formatTime(lastUpdateTime)}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showUpdateIndicator && (
              <div className="px-2 py-1 bg-green-500/20 border border-green-500/40 rounded-lg flex items-center gap-1 animate-pulse">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                <span className="text-green-400 text-xs">数据已更新</span>
              </div>
            )}
            <button
              onClick={handleRefresh}
              className="px-3 py-1.5 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-400 rounded-lg hover:from-blue-600/30 hover:to-purple-600/30 hover:border-blue-500/50 transition-all flex items-center gap-1.5 text-sm backdrop-blur-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              刷新数据
            </button>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center">
              <Users className="w-3 h-3 text-blue-400" />
            </div>
            <span className="text-blue-400 text-xs">学生总数</span>
          </div>
          <p className="text-xl font-bold text-white mt-1">
            <AnimatedNumber value={statistics.totalUsers} />
          </p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-green-500/20 rounded flex items-center justify-center">
              <TrendingUp className="w-3 h-3 text-green-400" />
            </div>
            <span className="text-green-400 text-xs">总积分</span>
          </div>
          <p className="text-xl font-bold text-white mt-1">
            <AnimatedNumber value={statistics.totalScore} />
          </p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-purple-500/20 rounded flex items-center justify-center">
              <TrendingDown className="w-3 h-3 text-purple-400" />
            </div>
            <span className="text-purple-400 text-xs">积分记录</span>
          </div>
          <p className="text-xl font-bold text-white mt-1">
            <AnimatedNumber value={statistics.totalRecords} />
          </p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-cyan-500/20 rounded flex items-center justify-center">
              <Smartphone className="w-3 h-3 text-cyan-400" />
            </div>
            <span className="text-cyan-400 text-xs">在线设备</span>
          </div>
          <p className="text-xl font-bold text-white mt-1 flex items-center gap-0.5">
            <span className="text-green-400">{statistics.onlineDevices}</span>
            <span className="text-slate-500">/</span>
            <span className="text-white/70">{devices.length}</span>
          </p>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="relative z-10 flex flex-col lg:flex-row gap-4">
        {/* 积分排名 - 3/4宽度 */}
        <div className="lg:col-span-3 bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-sm flex-1">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Trophy className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white tracking-wide">积分排名</h2>
                <p className="text-slate-400 text-xs">TOP {filteredUsers.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select 
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 cursor-pointer appearance-none pr-8"
                >
                  <option value="">全部班级</option>
                  {classes.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <button 
                onClick={handleRefresh}
                className={`p-1.5 rounded-lg transition-all duration-300 ${
                  isRefreshing ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-white'
                }`}
                title="刷新数据"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          
          <div ref={scrollContainerRef} className="overflow-y-auto rounded-xl" style={{ maxHeight: '550px', scrollbarWidth: 'thin', scrollbarColor: '#475569 #1e293b' }}>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-500" />
              </div>
            ) : classGroups.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">暂无学生数据</p>
              </div>
            ) : (
              <div className="space-y-3 p-1 pt-1">
                {classGroups.map((group, groupIndex) => (
                  <div key={group.class_name} className="space-y-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/90 rounded-lg border-l-4 border-yellow-500 sticky top-0 z-10 shadow-md backdrop-blur-sm">
                      <Building2 className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm font-medium text-white">{group.class_name}</span>
                      <span className="text-xs text-slate-400 ml-auto">{group.students.length}人</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 mt-1">
                      {group.students.map((user) => {
                        const globalIndex = filteredUsers.findIndex(u => u.id === user.id);
                        return (
                          <div 
                            key={user.id} 
                            className={`flex items-center gap-2 p-2 rounded-lg transition-all duration-500 cursor-default ${
                              globalIndex < 3 ? 'bg-gradient-to-r from-slate-700/60 via-slate-700/40 to-slate-800/60 border border-slate-600/50 shadow-sm' : 'bg-slate-700/30 hover:bg-slate-700/40'
                            } ${user.scoreChanged ? 'scale-105 ring-2 ring-green-500/50' : ''}`}
                          >
                            <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white shadow-md bg-gradient-to-br ${getRankColor(globalIndex)}`}>
                              {globalIndex === 0 ? '🥇' : globalIndex === 1 ? '🥈' : globalIndex === 2 ? '🥉' : globalIndex + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-white text-xs truncate">{user.name}</p>
                                <span className={`text-sm font-bold transition-all duration-500 ${
                                  (user.current_score || 0) >= 60 ? 'text-green-400' :
                                  (user.current_score || 0) >= 30 ? 'text-yellow-400' : 'text-red-400'
                                } ${user.scoreChanged ? 'animate-pulse' : ''}`}>
                                  {(user.current_score || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center justify-end mt-0.5">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${getLevelColor(user.current_score || 0)}`}>
                                  {getLevel(user.current_score || 0)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {groupIndex < classGroups.length - 1 && (
                      <div className="h-px bg-gradient-to-r from-transparent via-slate-600/50 to-transparent mx-4" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧 - 设备状态 + 积分记录 */}
        <div className="flex flex-col gap-2 lg:w-80">
          {/* 设备状态 */}
          <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-sm flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <Smartphone className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-wide">设备状态</h2>
                  <p className="text-slate-400 text-xs">实时监控</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-500" />
                </div>
              ) : devices.map((device) => (
                <div key={device.id} className="bg-slate-700/40 rounded-xl p-3 hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${device.status === 'online' ? 'bg-green-400 animate-pulse shadow-lg shadow-green-400/50' : 'bg-red-400'}`} />
                      <span className="font-medium text-white text-sm truncate">{device.device_id || device.name || `设备 ${device.id}`}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${device.status === 'online' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {device.status === 'online' ? '在线' : '离线'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-1.5">
                    <span className="flex items-center gap-1">
                      <Wifi className="w-3 h-3" />
                      {device.wifi_signal ? `${device.wifi_signal}dBm` : '信号未知'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(device.last_heartbeat)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 积分记录 */}
          <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-sm flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-green-500/20">
                  <Eye className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-wide">积分记录</h2>
                  <p className="text-slate-400 text-xs">最新变动</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500" />
                </div>
              ) : records.length > 0 ? (
                records.slice(0, 6).map((record) => (
                  <div key={record.id} className="flex items-center gap-3 p-3 bg-slate-700/40 rounded-xl hover:bg-slate-700/50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${(record.score_change || 0) > 0 ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/20' : 'bg-gradient-to-br from-red-500/30 to-rose-500/20'}`}>
                      {(record.score_change || 0) > 0 ? (
                        <ArrowUp className="w-4 h-4 text-green-400" />
                      ) : (
                        <ArrowDown className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm truncate">{record.user_name || record.student_name || '-'}</p>
                      <p className="text-xs text-slate-400 truncate">{record.description || record.rule_name || '-'}</p>
                    </div>
                    <span className={`text-base font-bold ${(record.score_change || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(record.score_change || 0) > 0 ? '+' : ''}{record.score_change || 0}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <TrendingUp className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">暂无积分记录</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 最新通知 - 占满整行 */}
      <div className="relative z-10 mt-4">
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-sm h-full">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-pink-500 via-purple-500 to-violet-500 rounded-lg flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">最新通知</h2>
              <p className="text-slate-400 text-xs">消息提醒</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-pink-500" />
              </div>
            ) : notifications.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {notifications.slice(0, 4).map((notification) => (
                  <div key={notification.id} className={`p-3 rounded-xl transition-all duration-300 hover:scale-[1.01] cursor-pointer h-full ${notification.read ? 'bg-slate-700/40' : 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30'}`}>
                    <div className="flex items-start gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${notification.read ? 'bg-slate-600/50' : 'bg-gradient-to-br from-blue-500 to-purple-500'}`}>
                        <Bell className={`w-3.5 h-3.5 ${notification.read ? 'text-slate-400' : 'text-white'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-white text-sm">{notification.title}</p>
                          {!notification.read && <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />}
                        </div>
                        <p className="text-slate-400 text-xs mt-1 truncate">{notification.message}</p>
                        <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">暂无通知</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
