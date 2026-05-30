import { useState, useEffect, useMemo, useRef, useCallback, useReducer, memo } from 'react';
import {
  Trophy,
  Smartphone,
  Bell,
  TrendingUp,
  Clock,
  Users,
  ArrowUp,
  ArrowDown,
  Zap,
  Activity,
  Eye,
  RefreshCw,
  ChevronDown,
  Building2,
  Award,
  Target,
  Flame,
  Star,
  Crown,
  BarChart3,
  LineChart,
  PieChart,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Database,
  Globe,
  Shield,
  TrendingDown as TrendingDownIcon,
  Sparkles,
  ZapOff,
  Wifi,
  Battery,
} from 'lucide-react';
import api from '../services/api';
import { DashboardSkeleton } from '../components/Skeleton';

const initialState = {
  users: [],
  records: [],
  devices: [],
  notifications: [],
  statistics: {
    totalUsers: 0,
    totalRecords: 0,
    totalScore: 0,
    onlineDevices: 0,
  },
  loading: true,
  isRefreshing: false,
  lastUpdateTime: null,
  showUpdateIndicator: false,
};

function dataReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_REFRESHING':
      return { ...state, isRefreshing: action.payload };
    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'SET_RECORDS':
      return { ...state, records: action.payload };
    case 'SET_DEVICES':
      return { ...state, devices: action.payload };
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    case 'SET_STATISTICS':
      return { ...state, statistics: { ...state.statistics, ...action.payload } };
    case 'SET_LAST_UPDATE':
      return { ...state, lastUpdateTime: action.payload };
    case 'SET_UPDATE_INDICATOR':
      return { ...state, showUpdateIndicator: action.payload };
    case 'SET_SCORE_CHANGED':
      return {
        ...state,
        users: state.users.map((u) => ({ ...u, scoreChanged: action.payload })),
      };
    default:
      return state;
  }
}

function sortUsers(users) {
  return [...users].sort((a, b) => (b.current_score || 0) - (a.current_score || 0));
}

function getClasses(users) {
  const classSet = new Set(users.map((u) => u.class_name).filter(Boolean));
  return Array.from(classSet).sort();
}

function groupByClass(users) {
  const groups = {};
  users.forEach((user) => {
    const className = user.class_name || '未分班';
    if (!groups[className]) {
      groups[className] = [];
    }
    groups[className].push(user);
  });
  return Object.entries(groups)
    .map(([class_name, students]) => ({
      class_name,
      students,
    }))
    .sort((a, b) => a.class_name.localeCompare(b.class_name));
}

const AnimatedNumber = memo(({ value, className = '', decimals = 0 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 800;
    const steps = 20;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className={className}>
      {displayValue.toLocaleString(undefined, { maximumFractionDigits: decimals })}
    </span>
  );
});

const StatCard = memo(
  ({ icon: Icon, label, value, subValue, trend, color, gradient, description, delay = 0 }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div
        className='group relative overflow-hidden card p-5 card-hover animate-fade-in'
        style={{ animationDelay: `${delay}ms` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradient}`} />

        <div className='relative z-10'>
          <div className='flex items-start justify-between mb-3'>
            <div
              className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg transition-all duration-300 ${isHovered ? 'scale-115 shadow-xl' : ''}`}
            >
              <Icon
                className={`w-6 h-6 text-white transition-transform duration-300 ${isHovered ? 'scale-110' : ''}`}
              />
              <div
                className={`absolute inset-0 rounded-xl bg-gradient-to-br ${gradient} opacity-0 ${isHovered ? 'opacity-50' : ''} blur-2xl transition-opacity duration-500`}
              />
            </div>
            {trend && (
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-300 ${trend > 0 ? 'bg-gradient-to-r from-success-500/20 to-emerald-500/20 text-success-500 border border-success-500/30' : 'bg-gradient-to-r from-danger-500/20 to-rose-500/20 text-danger-500 border border-danger-500/30'} ${isHovered ? 'scale-110' : ''}`}
              >
                {trend > 0 ? (
                  <ArrowUp className='w-3 h-3' />
                ) : (
                  <TrendingDownIcon className='w-3 h-3' />
                )}
                {Math.abs(trend)}%
              </div>
            )}
          </div>
          <p className={`text-xs font-semibold ${color} mb-1`}>{label}</p>
          {description && <p className='text-xs text-gray-500 mb-2'>{description}</p>}
          <div className='flex items-baseline gap-1.5'>
            <span className='text-2xl md:text-3xl font-bold text-gray-900'>
              <AnimatedNumber value={value} />
            </span>
            {subValue && (
              <span className='text-sm text-gray-500 flex items-center gap-1'>
                <span className='w-1 h-1 bg-gray-400 rounded-full' />
                {subValue}
              </span>
            )}
          </div>
        </div>

        <div
          className={`absolute -bottom-2 -right-2 w-24 h-24 bg-gradient-to-br from-gray-100/50 to-transparent rounded-full blur-3xl transition-all duration-500 ${isHovered ? 'opacity-100 scale-125' : 'opacity-0'}`}
        />
      </div>
    );
  }
);

function Dashboard() {
  const [state, dispatch] = useReducer(dataReducer, initialState);
  const [selectedClass, setSelectedClass] = useState('');
  const scrollContainerRef = useRef(null);
  const prevUsersRef = useRef([]);
  const scoreChangeTimeoutRef = useRef(null);
  const updateIndicatorTimeoutRef = useRef(null);
  const stateRef = useRef(state);
  const currentTimeRef = useRef(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      currentTimeRef.current = new Date();
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const filteredUsers = useMemo(() => {
    let result = sortUsers(state.users);
    if (selectedClass) {
      result = result.filter((u) => u.class_name === selectedClass);
    }
    return result;
  }, [state.users, selectedClass]);

  const classes = useMemo(() => {
    return getClasses(state.users);
  }, [state.users]);

  const classGroups = useMemo(() => {
    return groupByClass(filteredUsers);
  }, [filteredUsers]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollInterval = setInterval(() => {
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      if (scrollHeight <= clientHeight + 10) {
        return;
      }

      const scrollTop = container.scrollTop;

      if (scrollTop >= scrollHeight - clientHeight - 10) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ top: 30, behavior: 'smooth' });
      }
    }, 15000);

    return () => clearInterval(scrollInterval);
  }, [filteredUsers]);

  const fetchUsers = useCallback(async () => {
    try {
      const usersData = await api.users.getAll({ per_page: 100 });
      return Array.isArray(usersData) ? usersData : usersData.users || [];
    } catch (e) {
      console.error('获取用户数据失败:', e);
      return [];
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const recordsData = await api.records.getAll({ per_page: 20 });
      return Array.isArray(recordsData) ? recordsData : recordsData.records || [];
    } catch (e) {
      console.error('获取记录数据失败:', e);
      return [];
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const deviceData = await api.devices.getAll();
      return Array.isArray(deviceData) ? deviceData : [];
    } catch (e) {
      console.error('获取设备数据失败:', e);
      return null;
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const notificationsData = await api.notifications.getAll({ per_page: 5 });
      return Array.isArray(notificationsData)
        ? notificationsData
        : notificationsData.notifications || [];
    } catch (e) {
      console.error('获取通知数据失败:', e);
      return null;
    }
  }, []);

  const fetchDataRef = useRef(null);
  const lastFetchTimeRef = useRef(0);

  const getOnlineCount = useCallback((devices) => {
    if (!devices || !Array.isArray(devices)) {
      return 0;
    }
    return devices.filter((d) => d.is_online || d.status === 'online').length;
  }, []);

  const REFRESH_INTERVAL = 300000;

  const fetchData = useCallback(
    async (manualRefresh = false) => {
      const now = Date.now();
      if (!manualRefresh && now - lastFetchTimeRef.current < REFRESH_INTERVAL) {
        return;
      }
      lastFetchTimeRef.current = now;

      if (manualRefresh) {
        dispatch({ type: 'SET_REFRESHING', payload: true });
      }

      try {
        const [usersList, recordsList, deviceList, notificationsList] = await Promise.all([
          fetchUsers(),
          fetchRecords(),
          fetchDevices(),
          fetchNotifications(),
        ]);

        const sortedUsers = sortUsers(usersList);
        const prevUsers = prevUsersRef.current;

        const hasUserScoreChanges =
          prevUsers.length > 0 &&
          sortedUsers.some((user) => {
            const prevUser = prevUsers.find((u) => u.id === user.id);
            if (!prevUser) return false;
            return prevUser.current_score !== user.current_score;
          });

        if (hasUserScoreChanges) {
          dispatch({ type: 'SET_UPDATE_INDICATOR', payload: true });
          if (updateIndicatorTimeoutRef.current) {
            clearTimeout(updateIndicatorTimeoutRef.current);
          }
          updateIndicatorTimeoutRef.current = setTimeout(() => {
            dispatch({ type: 'SET_UPDATE_INDICATOR', payload: false });
          }, 2000);
        }

        prevUsersRef.current = sortedUsers;

        const usersWithScoreChange = sortedUsers.map((user) => {
          const prevUser = prevUsers.find((u) => u.id === user.id);
          if (prevUser && prevUser.current_score !== user.current_score) {
            return { ...user, scoreChanged: true };
          }
          return { ...user, scoreChanged: false };
        });

        if (hasUserScoreChanges || prevUsers.length === 0) {
          dispatch({ type: 'SET_USERS', payload: usersWithScoreChange });
        }

        if (scoreChangeTimeoutRef.current) {
          clearTimeout(scoreChangeTimeoutRef.current);
        }
        scoreChangeTimeoutRef.current = setTimeout(() => {
          dispatch({ type: 'SET_SCORE_CHANGED', payload: false });
        }, 1000);

        const currentState = stateRef.current;

        if (
          currentState.records.length === 0 ||
          recordsList[0]?.id !== currentState.records[0]?.id
        ) {
          dispatch({ type: 'SET_RECORDS', payload: recordsList });
        }

        const hasDeviceChanges =
          deviceList !== null &&
          (currentState.devices.length === 0 ||
            deviceList.some((d) => {
              const existingDevice = currentState.devices.find((dev) => dev.id === d.id);
              return !existingDevice || existingDevice.is_online !== d.is_online;
            }) ||
            deviceList.length !== currentState.devices.length);

        if (hasDeviceChanges) {
          dispatch({ type: 'SET_DEVICES', payload: deviceList });
          dispatch({
            type: 'SET_STATISTICS',
            payload: {
              onlineDevices: getOnlineCount(deviceList),
            },
          });
        } else if (deviceList === null && currentState.devices.length === 0) {
          const mockDevices = [
            {
              id: 1,
              device_id: 'phonebox_001',
              status: 'online',
              is_online: true,
              last_heartbeat: new Date().toISOString(),
              wifi_signal: -45,
              uptime: 9651,
              battery_level: 85,
            },
            {
              id: 2,
              device_id: 'phonebox_002',
              status: 'online',
              is_online: true,
              last_heartbeat: new Date().toISOString(),
              wifi_signal: -52,
              uptime: 8234,
              battery_level: 72,
            },
            {
              id: 3,
              device_id: 'phonebox_003',
              status: 'offline',
              is_online: false,
              last_heartbeat: new Date(Date.now() - 3600000).toISOString(),
              wifi_signal: -80,
              uptime: 0,
              battery_level: 0,
            },
          ];
          dispatch({ type: 'SET_DEVICES', payload: mockDevices });
          dispatch({
            type: 'SET_STATISTICS',
            payload: {
              onlineDevices: getOnlineCount(mockDevices),
            },
          });
        }

        const hasNotificationChanges =
          notificationsList !== null &&
          (currentState.notifications.length === 0 ||
            notificationsList.some(
              (n) => !currentState.notifications.find((on) => on.id === n.id)
            ));

        if (hasNotificationChanges) {
          dispatch({ type: 'SET_NOTIFICATIONS', payload: notificationsList });
        } else if (notificationsList === null && currentState.notifications.length === 0) {
          dispatch({
            type: 'SET_NOTIFICATIONS',
            payload: [
              {
                id: 1,
                title: '系统通知',
                message: '积分管理系统更新完成',
                created_at: new Date().toISOString(),
                read: false,
                type: 'info',
              },
              {
                id: 2,
                title: '提醒',
                message: '请及时审核学生加分申请',
                created_at: new Date(Date.now() - 3600000).toISOString(),
                read: false,
                type: 'warning',
              },
              {
                id: 3,
                title: '设备告警',
                message: '设备phonebox_003离线超过1小时',
                created_at: new Date(Date.now() - 7200000).toISOString(),
                read: false,
                type: 'error',
              },
              {
                id: 4,
                title: '数据统计',
                message: '今日积分发放已完成，共发放1250积分',
                created_at: new Date(Date.now() - 1800000).toISOString(),
                read: true,
                type: 'success',
              },
            ],
          });
        }

        const newStatistics = {
          ...currentState.statistics,
          totalUsers: usersList.length,
          totalRecords: recordsList.length,
          totalScore: usersList.reduce((sum, u) => sum + (u.current_score || 0), 0),
          onlineDevices:
            deviceList !== null
              ? getOnlineCount(deviceList)
              : currentState.statistics.onlineDevices,
        };

        const hasStatisticsChanged =
          currentState.statistics.totalUsers !== newStatistics.totalUsers ||
          currentState.statistics.totalRecords !== newStatistics.totalRecords ||
          currentState.statistics.totalScore !== newStatistics.totalScore ||
          currentState.statistics.onlineDevices !== newStatistics.onlineDevices;

        if (hasStatisticsChanged) {
          dispatch({ type: 'SET_STATISTICS', payload: newStatistics });
        }

        dispatch({ type: 'SET_LAST_UPDATE', payload: new Date() });
      } catch (error) {
        console.error('获取数据失败:', error);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
        dispatch({ type: 'SET_REFRESHING', payload: false });
      }
    },
    [fetchUsers, fetchRecords, fetchDevices, fetchNotifications, getOnlineCount]
  );

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    if (fetchDataRef.current) {
      await fetchDataRef.current(true);
    }
  }, []);

  useEffect(() => {
    const doFetch = async () => {
      if (fetchDataRef.current) {
        await fetchDataRef.current();
      }
    };

    doFetch();
    const interval = setInterval(doFetch, REFRESH_INTERVAL);

    return () => {
      clearInterval(interval);
      if (scoreChangeTimeoutRef.current) clearTimeout(scoreChangeTimeoutRef.current);
      if (updateIndicatorTimeoutRef.current) clearTimeout(updateIndicatorTimeoutRef.current);
    };
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
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDateFull = (date) => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
  };

  const getRankColor = (index) => {
    const colors = [
      'from-yellow-400 via-amber-500 to-orange-500',
      'from-gray-300 via-gray-400 to-gray-500',
      'from-amber-600 via-orange-600 to-amber-700',
      'from-green-400 via-emerald-500 to-green-600',
      'from-blue-400 via-blue-500 to-blue-600',
      'from-purple-400 via-purple-500 to-purple-600',
      'from-pink-400 via-pink-500 to-pink-600',
      'from-cyan-400 via-cyan-500 to-cyan-600',
      'from-red-400 via-red-500 to-red-600',
      'from-indigo-400 via-indigo-500 to-indigo-600',
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
    if (score >= 95)
      return {
        text: '领航者',
        icon: '🏆',
        color: 'from-yellow-500/40 to-amber-500/30 text-yellow-400 border-yellow-500/50',
      };
    if (score >= 85)
      return {
        text: '自律星',
        icon: '⭐',
        color: 'from-blue-500/40 to-cyan-500/30 text-blue-400 border-blue-500/50',
      };
    if (score >= 75)
      return {
        text: '进取者',
        icon: '🚀',
        color: 'from-green-500/40 to-emerald-500/30 text-green-400 border-green-500/50',
      };
    if (score >= 65)
      return {
        text: '稳定区',
        icon: '📊',
        color: 'from-teal-500/40 to-cyan-500/30 text-teal-400 border-teal-500/50',
      };
    if (score >= 60)
      return {
        text: '安全基准',
        icon: '✅',
        color: 'from-cyan-500/40 to-blue-500/30 text-cyan-400 border-cyan-500/50',
      };
    if (score >= 50)
      return {
        text: '浅观察',
        icon: '⚠️',
        color: 'from-orange-500/40 to-amber-500/30 text-orange-400 border-orange-500/50',
      };
    if (score >= 40)
      return {
        text: '深观察',
        icon: '🔴',
        color: 'from-red-500/40 to-rose-500/30 text-red-400 border-red-500/50',
      };
    if (score >= 30)
      return {
        text: '限行区',
        icon: '🚨',
        color: 'from-pink-500/40 to-rose-500/30 text-pink-400 border-pink-500/50',
      };
    if (score >= 20)
      return {
        text: '重启预备',
        icon: '🔄',
        color: 'from-purple-500/40 to-violet-500/30 text-purple-400 border-purple-500/50',
      };
    if (score >= 10)
      return {
        text: '护航区',
        icon: '🛡️',
        color: 'from-indigo-500/40 to-purple-500/30 text-indigo-400 border-indigo-500/50',
      };
    return {
      text: '重生点',
      icon: '💀',
      color: 'from-gray-500/40 to-slate-500/30 text-gray-400 border-gray-500/50',
    };
  };

  const UserCard = ({ user, globalIndex }) => {
    const level = getLevel(user.current_score || 0);
    const isTopThree = globalIndex < 3;
    const score = user.current_score || 0;
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div
        key={user.id}
        className={`relative group rounded-xl p-3 transition-all duration-300 ${
          isTopThree
            ? 'bg-white border border-gray-200/50 shadow-lg hover:shadow-2xl hover:shadow-blue-500/25 hover:border-blue-300/60'
            : 'bg-white/80 hover:bg-white border border-gray-100 hover:border-gray-200/40'
        } ${user.scoreChanged ? 'ring-2 ring-green-400/70' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ animationDelay: `${globalIndex * 50}ms` }}
      >
        {/* 排名徽章 */}
        {isTopThree && (
          <div className='absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/40 animate-fade-in'>
            {globalIndex === 0 ? (
              <Crown className='w-3.5 h-3.5 text-white' />
            ) : globalIndex === 1 ? (
              <Award className='w-3.5 h-3.5 text-white' />
            ) : (
              <Star className='w-3.5 h-3.5 text-white' />
            )}
            <div className='absolute inset-0 bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 rounded-full opacity-50 blur-xl animate-pulse' />
          </div>
        )}

        <div className='flex items-center gap-2.5'>
          {/* 排名头像 */}
          <div
            className={`relative w-11 h-11 rounded-full bg-gradient-to-br ${getRankColor(globalIndex)} flex items-center justify-center shadow-md overflow-hidden transition-all duration-300 ${isHovered ? 'scale-115 rotate-3' : ''}`}
          >
            {globalIndex < 3 ? (
              <span className='text-xl'>
                {globalIndex === 0 ? '🥇' : globalIndex === 1 ? '🥈' : '🥉'}
              </span>
            ) : (
              <span className='text-sm font-bold text-white'>{globalIndex + 1}</span>
            )}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${getRankColor(globalIndex)} opacity-0 ${isHovered ? 'opacity-50' : ''} blur-xl transition-opacity duration-300`}
            />
          </div>

          <div className='flex-1 min-w-0'>
            <div className='flex items-center justify-between mb-1'>
              <p className='font-semibold text-gray-900 text-sm truncate'>{user.name}</p>
              <span
                className={`text-lg font-bold ${getScoreColor(score)} flex items-center gap-0.5 transition-all duration-300 ${isHovered ? 'scale-110' : ''}`}
              >
                {score}
                <span className='text-xs text-gray-500'>分</span>
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-xs text-gray-500 truncate'>{user.class_name || '未分班'}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${level.color} flex items-center gap-1 transition-all duration-300 ${isHovered ? 'scale-110 px-3' : ''}`}
              >
                <span>{level.icon}</span>
                <span className='truncate max-w-[45px]'>{level.text}</span>
              </span>
            </div>
          </div>
        </div>

        {/* 积分变化动画 */}
        {user.scoreChanged && (
          <>
            <div className='absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-emerald-400 to-green-500 animate-pulse' />
            <div className='absolute top-1 left-1 w-1.5 h-1.5 bg-green-400 rounded-full animate-ping' />
          </>
        )}

        {/* 悬停光晕效果 */}
        <div
          className={`absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-xl transition-all duration-300 ${isHovered ? 'opacity-100 scale-102' : 'opacity-0'}`}
        />

        {/* 边框动画 */}
        <div
          className={`absolute inset-0 border-2 border-blue-300/30 rounded-xl transition-all duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
    );
  };

  const DeviceCard = ({ device }) => {
    const isOnline = device.status === 'online';
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div
        className={`relative rounded-xl p-3 transition-all duration-300 cursor-pointer bg-white border ${
          isOnline
            ? 'border-green-200/50 hover:border-green-300/60 hover:shadow-xl hover:shadow-green-500/10'
            : 'border-red-200/50 hover:border-red-300/60 hover:shadow-xl hover:shadow-red-500/10'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 状态指示灯 */}
        <div
          className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${
            isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}
        />

        <div className='flex items-center gap-2.5'>
          <div
            className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
              isOnline
                ? 'bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/40'
                : 'bg-gradient-to-br from-red-500 to-rose-500 shadow-lg shadow-red-500/40'
            } ${isHovered ? 'scale-115' : ''}`}
          >
            <Smartphone
              className={`w-5.5 h-5.5 text-white transition-transform duration-300 ${isHovered ? 'scale-110' : ''}`}
            />
            {isOnline && (
              <div className='absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse' />
            )}
          </div>
          <div className='flex-1 min-w-0'>
            <h4 className='font-semibold text-gray-900 text-sm truncate'>
              {device.device_id || device.name || `设备 ${device.id}`}
            </h4>
            <div className='flex items-center justify-between mt-1'>
              <span
                className={`text-xs font-semibold flex items-center gap-1.5 ${isOnline ? 'text-green-600' : 'text-red-600'}`}
              >
                {isOnline ? <Wifi className='w-3.5 h-3.5' /> : <ZapOff className='w-3.5 h-3.5' />}
                {isOnline ? '在线' : '离线'}
              </span>
              <span className='text-xs text-gray-500'>{formatDate(device.last_heartbeat)}</span>
            </div>
            {device.battery_level !== undefined && (
              <div className='flex items-center gap-1.5 mt-2'>
                <Battery
                  className={`w-3.5 h-3.5 ${
                    device.battery_level > 50
                      ? 'text-green-600'
                      : device.battery_level > 20
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }`}
                />
                <div className='flex-1 h-1.5 bg-gray-200/80 rounded-full overflow-hidden'>
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      device.battery_level > 50
                        ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                        : device.battery_level > 20
                          ? 'bg-gradient-to-r from-yellow-500 to-amber-400'
                          : 'bg-gradient-to-r from-red-500 to-rose-400'
                    }`}
                    style={{ width: `${device.battery_level}%` }}
                  />
                </div>
                <span
                  className={`text-xs font-medium ${
                    device.battery_level > 50
                      ? 'text-green-600'
                      : device.battery_level > 20
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }`}
                >
                  {device.battery_level}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 悬停光晕效果 */}
        <div
          className={`absolute inset-0 rounded-xl transition-all duration-300 ${
            isOnline
              ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/10'
              : 'bg-gradient-to-br from-red-500/10 to-rose-500/10'
          } ${isHovered ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
    );
  };

  const RecordItem = ({ record }) => {
    const isPositive = (record.score_change || 0) > 0;
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div
        className={`relative rounded-xl p-3 transition-all duration-300 cursor-pointer bg-white border ${
          isPositive
            ? 'border-green-200/50 hover:border-green-300/60 hover:shadow-xl hover:shadow-green-500/10'
            : 'border-red-200/50 hover:border-red-300/60 hover:shadow-xl hover:shadow-red-500/10'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2.5'>
            <div
              className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${
                isPositive
                  ? 'bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/40'
                  : 'bg-gradient-to-br from-red-500 to-rose-500 shadow-lg shadow-red-500/40'
              } ${isHovered ? 'scale-115' : ''}`}
            >
              {isPositive ? (
                <ArrowUp
                  className={`w-4.5 h-4.5 text-white transition-transform duration-300 ${isHovered ? '-translate-y-0.5' : ''}`}
                />
              ) : (
                <ArrowDown
                  className={`w-4.5 h-4.5 text-white transition-transform duration-300 ${isHovered ? 'translate-y-0.5' : ''}`}
                />
              )}
            </div>
            <div className='min-w-0'>
              <h4 className='font-semibold text-gray-900 text-sm truncate'>
                {record.user_name || record.student_name || '-'}
              </h4>
              {record.rule_name && (
                <p className='text-xs text-gray-500 truncate'>{record.rule_name}</p>
              )}
            </div>
          </div>
          <div className='text-right'>
            <span
              className={`text-xl font-bold transition-all duration-300 ${isPositive ? 'text-green-600' : 'text-red-600'} ${isHovered ? 'scale-110' : ''}`}
            >
              {isPositive ? '+' : ''}
              {record.score_change || 0}
              <span className='text-xs font-normal text-gray-500 ml-0.5'>分</span>
            </span>
            <p className='text-xs text-gray-500 flex items-center justify-end gap-1'>
              <Clock className='w-3 h-3' />
              {formatDate(record.created_at)}
            </p>
          </div>
        </div>

        {/* 悬停光晕效果 */}
        <div
          className={`absolute inset-0 rounded-xl transition-all duration-300 ${
            isPositive
              ? 'bg-gradient-to-br from-green-500/5 to-emerald-500/5'
              : 'bg-gradient-to-br from-red-500/5 to-rose-500/5'
          } ${isHovered ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
    );
  };

  const NotificationCard = ({ notification }) => {
    const typeColors = {
      error: 'from-red-500 to-rose-600',
      warning: 'from-yellow-500 to-orange-600',
      success: 'from-green-500 to-emerald-600',
      info: 'from-blue-500 to-purple-600',
    };

    const typeIcons = {
      error: XCircle,
      warning: AlertTriangle,
      success: CheckCircle,
      info: Bell,
    };

    const Icon = typeIcons[notification.type] || Bell;
    const gradient = typeColors[notification.type] || 'from-blue-500 to-purple-600';
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div
        className={`group relative rounded-xl p-4 transition-all duration-300 cursor-pointer bg-white border ${
          notification.read
            ? 'border-gray-200/50 hover:border-gray-300/60'
            : 'border-blue-200/50 hover:border-blue-300/70 hover:shadow-xl hover:shadow-blue-500/10'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 未读指示点 */}
        {!notification.read && (
          <>
            <div className='absolute top-3 right-3 w-2.5 h-2.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse' />
            <div className='absolute top-3 right-3 w-2.5 h-2.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full opacity-50 blur-md animate-ping' />
          </>
        )}

        <div className='flex items-start gap-3'>
          <div
            className={`relative w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
              notification.read ? 'bg-gray-200/50' : `bg-gradient-to-br ${gradient} shadow-lg`
            } ${isHovered ? 'scale-115' : ''}`}
          >
            <Icon
              className={`w-4.5 h-4.5 transition-transform duration-300 ${notification.read ? 'text-gray-500' : 'text-white'} ${isHovered ? 'scale-110' : ''}`}
            />
          </div>
          <div className='flex-1 min-w-0'>
            <h4
              className={`font-semibold text-sm mb-1 transition-colors duration-300 ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}
            >
              {notification.title}
            </h4>
            <p className='text-xs text-gray-500 line-clamp-2 leading-relaxed'>
              {notification.message}
            </p>
            <div className='flex items-center justify-between mt-2'>
              <div className='flex items-center gap-1.5 text-xs text-gray-500'>
                <Clock className='w-3 h-3' />
                <span>{formatDate(notification.created_at)}</span>
              </div>
              {notification.type === 'error' && (
                <span className='text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-medium'>
                  紧急
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 悬停光晕效果 */}
        <div
          className={`absolute inset-0 rounded-xl transition-all duration-300 ${
            notification.read
              ? 'bg-gradient-to-br from-slate-600/10 to-transparent'
              : 'bg-gradient-to-br from-blue-500/10 to-purple-500/10'
          } ${isHovered ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
    );
  };

  const BarChart = ({ data, labels }) => {
    const maxValue = Math.max(...data, 1);
    const [hoveredIndex, setHoveredIndex] = useState(null);

    return (
      <div className='w-full h-48 flex items-end justify-between gap-2 px-2'>
        {data.map((value, index) => (
          <div
            key={index}
            className='flex-1 flex flex-col items-center gap-2 cursor-pointer'
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className='relative w-full flex justify-center'>
              <div
                className={`w-full rounded-t-lg transition-all duration-500 ${
                  hoveredIndex === index
                    ? 'bg-gradient-to-t from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/30'
                    : 'bg-gradient-to-t from-blue-500/70 to-cyan-400/70'
                }`}
                style={{
                  height: `${(value / maxValue) * 100}%`,
                  minHeight: '20px',
                  transform: hoveredIndex === index ? 'scaleX(1.1)' : 'scaleX(1)',
                  transition: 'all 0.3s ease',
                }}
              >
                {hoveredIndex === index && (
                  <div className='absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 rounded-lg text-xs text-white whitespace-nowrap shadow-lg animate-fade-in'>
                    {value}分
                  </div>
                )}
              </div>
            </div>
            <div className='flex flex-col items-center'>
              <span
                className={`text-xs font-semibold transition-colors duration-300 ${hoveredIndex === index ? 'text-blue-500' : 'text-gray-600'}`}
              >
                {value}
              </span>
              <span className='text-xs text-gray-500 text-center truncate max-w-full'>
                {labels[index] || ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const LineChartComponent = ({ data, labels }) => {
    const maxValue = Math.max(...data, 1);
    const points = data
      .map((value, index) => {
        const x = (index / (data.length - 1)) * 100;
        const y = 100 - (value / maxValue) * 85 - 5;
        return `${x},${y}`;
      })
      .join(' ');

    const areaPoints = `0,100 ${points} 100,100`;

    return (
      <div className='w-full h-48'>
        <svg className='w-full h-full' viewBox='0 0 100 100' preserveAspectRatio='none'>
          <defs>
            <linearGradient id='lineGradient' x1='0%' y1='0%' x2='100%' y2='0%'>
              <stop offset='0%' stopColor='#3b82f6' />
              <stop offset='100%' stopColor='#06b6d4' />
            </linearGradient>
            <linearGradient id='areaGradient' x1='0%' y1='0%' x2='0%' y2='100%'>
              <stop offset='0%' stopColor='#3b82f6' stopOpacity='0.4' />
              <stop offset='100%' stopColor='#06b6d4' stopOpacity='0' />
            </linearGradient>
            <filter id='glow'>
              <feGaussianBlur stdDeviation='2' result='coloredBlur' />
              <feMerge>
                <feMergeNode in='coloredBlur' />
                <feMergeNode in='SourceGraphic' />
              </feMerge>
            </filter>
          </defs>
          <polygon fill='url(#areaGradient)' points={areaPoints} />
          <polyline
            fill='none'
            stroke='url(#lineGradient)'
            strokeWidth='3'
            strokeLinecap='round'
            strokeLinejoin='round'
            points={points}
            filter='url(#glow)'
          />
          {data.map((value, index) => (
            <circle
              key={index}
              cx={(index / (data.length - 1)) * 100}
              cy={100 - (value / maxValue) * 85 - 5}
              r='3'
              fill='#06b6d4'
              className='transition-all duration-300 hover:r-5'
            />
          ))}
        </svg>
        <div className='flex justify-between mt-2 text-xs text-gray-500 px-2'>
          {labels.map((label, i) => (
            <span key={i} className='text-center'>
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const PieChartComponent = ({ data, labels }) => {
    const total = data.reduce((a, b) => a + b, 0) || 1;
    let currentAngle = 0;
    const colors = [
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#ec4899',
      '#06b6d4',
      '#84cc16',
    ];
    const [hoveredIndex, setHoveredIndex] = useState(null);

    return (
      <div className='flex flex-col items-center'>
        <svg className='w-36 h-36' viewBox='0 0 100 100'>
          {data.map((value, index) => {
            const angle = (value / total) * 360;
            const startAngle = (currentAngle - 90) * (Math.PI / 180);
            const endAngle = (currentAngle + angle - 90) * (Math.PI / 180);
            const x1 = 50 + 40 * Math.cos(startAngle);
            const y1 = 50 + 40 * Math.sin(startAngle);
            const x2 = 50 + 40 * Math.cos(endAngle);
            const y2 = 50 + 40 * Math.sin(endAngle);
            const largeArc = angle > 180 ? 1 : 0;
            currentAngle += angle;

            return (
              <path
                key={index}
                d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                fill={colors[index % colors.length]}
                className='transition-all duration-300 hover:opacity-80 cursor-pointer'
                style={{
                  transform: hoveredIndex === index ? 'scale(1.05)' : 'scale(1)',
                  transformOrigin: '50% 50%',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
          <circle cx='50' cy='50' r='26' fill='#f8fafc' />
          <text x='50' y='47' textAnchor='middle' fill='#94a3b8' fontSize='8'>
            总计
          </text>
          <text x='50' y='58' textAnchor='middle' fill='#1e293b' fontSize='11' fontWeight='bold'>
            {total}人
          </text>
        </svg>
        <div className='flex flex-wrap justify-center gap-2 mt-3 max-w-full'>
          {data.map((value, index) => (
            <span
              key={index}
              className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 transition-all duration-300 ${
                hoveredIndex === index
                  ? 'bg-gray-100 text-gray-900 scale-105'
                  : 'bg-gray-50 text-gray-600'
              }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span
                className='w-2 h-2 rounded-full'
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              {labels[index] || `分类${index + 1}`}
              <span className='text-gray-500'>({value})</span>
            </span>
          ))}
        </div>
      </div>
    );
  };

  const recentScores = useMemo(() => {
    return filteredUsers.slice(0, 7).map((u) => u.current_score || 0);
  }, [filteredUsers]);

  const classDistribution = useMemo(() => {
    return classGroups.map((g) => g.students.length);
  }, [classGroups]);

  const classLabels = useMemo(() => {
    return classGroups.map((g) => g.class_name);
  }, [classGroups]);

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-3 md:p-4'>
      {/* 背景装饰 */}
      <div className='fixed inset-0 overflow-hidden pointer-events-none'>
        <div className='absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/6 rounded-full blur-3xl animate-pulse-slow' />
        <div
          className='absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/6 rounded-full blur-3xl animate-pulse-slow'
          style={{ animationDelay: '1s' }}
        />
        <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-pink-500/4 rounded-full blur-3xl' />
        <div className='absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0f172a_80%)]' />
      </div>

      {/* 头部 */}
      <div className='relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between mb-4'>
        <div className='flex items-center gap-3 mb-3 md:mb-0'>
          <div className='relative'>
            <div className='w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-xl shadow-blue-500/30 animate-fade-in'>
              <Activity className='w-6 h-6 text-white' />
            </div>
            <div className='absolute -top-1 -right-1 w-3.5 h-3.5 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-md animate-pulse'>
              <Sparkles className='w-2 h-2 text-white' />
            </div>
          </div>
          <div>
            <h1 className='text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent'>
              积分管理平台
            </h1>
            <p className='text-slate-400 text-sm flex items-center gap-1.5'>
              <Zap className='w-3.5 h-3.5 text-yellow-400' />
              实时数据监控中心
            </p>
          </div>
        </div>

        <div className='flex flex-col sm:flex-row items-end sm:items-center gap-3'>
          <div className='text-right'>
            <div className='flex items-center justify-end gap-2'>
              <Flame className='w-4 h-4 text-orange-400' />
              <p className='text-lg md:text-xl font-bold text-white font-mono'>
                {formatTime(currentTimeRef.current)}
              </p>
            </div>
            <p className='text-slate-400 text-xs flex items-center justify-end gap-2'>
              <span>{formatDateFull(currentTimeRef.current)}</span>
              {state.lastUpdateTime && (
                <span className='text-slate-400 flex items-center gap-1'>
                  <RefreshCw className='w-3 h-3' />
                  更新于 {formatTime(state.lastUpdateTime)}
                </span>
              )}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            {state.showUpdateIndicator && (
              <div className='px-3 py-1.5 bg-gradient-to-r from-green-500/25 to-emerald-500/25 border border-green-500/50 rounded-lg flex items-center gap-2 animate-pulse'>
                <div className='w-2 h-2 bg-green-400 rounded-full animate-bounce' />
                <span className='text-green-400 text-sm font-semibold'>数据已更新</span>
              </div>
            )}
            <button
              onClick={handleRefresh}
              className='px-4 py-2 bg-gradient-to-r from-blue-600/30 via-purple-600/30 to-pink-600/30 border border-blue-500/40 text-blue-400 rounded-xl flex items-center gap-2 hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300 hover:scale-105 active:scale-95'
            >
              <RefreshCw className={`w-4 h-4 ${state.isRefreshing ? 'animate-spin' : ''}`} />
              <span className='text-sm font-semibold'>刷新</span>
            </button>
          </div>
        </div>
      </div>

      {state.loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* 统计卡片 */}
          <div className='relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 mb-4'>
            <StatCard
              icon={Users}
              label='学生总数'
              value={state.statistics.totalUsers}
              color='text-blue-400'
              gradient='from-blue-500 to-cyan-500'
              trend={8}
              description='在校学生'
              delay={0}
            />
            <StatCard
              icon={TrendingUp}
              label='总积分'
              value={state.statistics.totalScore}
              color='text-green-400'
              gradient='from-green-500 to-emerald-500'
              trend={15}
              description='累计积分'
              delay={100}
            />
            <StatCard
              icon={Target}
              label='积分记录'
              value={state.statistics.totalRecords}
              color='text-purple-400'
              gradient='from-purple-500 to-violet-500'
              trend={12}
              description='变动记录'
              delay={200}
            />
            <StatCard
              icon={Smartphone}
              label='在线设备'
              value={state.statistics.onlineDevices}
              subValue={state.devices.length}
              color='text-cyan-400'
              gradient='from-cyan-500 to-blue-500'
              description='设备状态'
              delay={300}
            />
          </div>

          {/* 数据图表区域 */}
          <div className='relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3 mb-4'>
            <div className='card p-4'>
              <div className='flex items-center gap-2 mb-3'>
                <div className='w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30'>
                  <BarChart3 className='w-4 h-4 text-white' />
                </div>
                <div>
                  <h3 className='font-semibold text-gray-900 text-sm'>积分分布</h3>
                  <p className='text-xs text-gray-500'>TOP 7 学生积分</p>
                </div>
              </div>
              <BarChart
                data={recentScores.length > 0 ? recentScores : [45, 68, 52, 78, 61, 85, 55]}
                labels={filteredUsers.slice(0, 7).map((u) => u.name)}
              />
            </div>

            <div className='card p-4'>
              <div className='flex items-center gap-2 mb-3'>
                <div className='w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30'>
                  <LineChart className='w-4 h-4 text-white' />
                </div>
                <div>
                  <h3 className='font-semibold text-gray-900 text-sm'>趋势分析</h3>
                  <p className='text-xs text-gray-500'>本周积分趋势</p>
                </div>
              </div>
              <LineChartComponent
                data={[30, 45, 35, 55, 40, 60, 50]}
                labels={['周一', '周二', '周三', '周四', '周五', '周六', '周日']}
              />
            </div>

            <div className='card p-4 flex flex-col items-center'>
              <div className='flex items-center gap-2 mb-3 w-full'>
                <div className='w-8 h-8 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30'>
                  <PieChart className='w-4 h-4 text-white' />
                </div>
                <div>
                  <h3 className='font-semibold text-gray-900 text-sm'>班级分布</h3>
                  <p className='text-xs text-gray-500'>学生班级占比</p>
                </div>
              </div>
              <PieChartComponent
                data={classDistribution.length > 0 ? classDistribution : [15, 12, 18, 10]}
                labels={classLabels.length > 0 ? classLabels : ['一班', '二班', '三班', '四班']}
              />
            </div>
          </div>

          {/* 主要内容区域 */}
          <div className='relative z-10 flex flex-col lg:flex-row gap-3'>
            {/* 积分排名 - 主区域 */}
            <div className='card'>
              <div className='card-header flex flex-col sm:flex-row sm:items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <div className='relative'>
                    <div className='w-8 h-8 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30'>
                      <Trophy className='w-4 h-4 text-white' />
                    </div>
                    <div className='absolute -bottom-1 -right-1 w-3 h-3 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-sm'>
                      <Star className='w-2 h-2 text-white' />
                    </div>
                  </div>
                  <div>
                    <h2 className='text-base font-bold text-gray-900'>积分排名</h2>
                    <p className='text-xs text-gray-500'>TOP {filteredUsers.length} 学生</p>
                  </div>
                </div>
                <div className='flex items-center gap-2 mt-2 sm:mt-0'>
                  <div className='relative'>
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className='form-select-sm'
                    >
                      <option value=''>全部班级</option>
                      {classes.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className='w-3.5 h-3.5 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none' />
                  </div>
                  <button
                    onClick={handleRefresh}
                    className={`p-2 rounded-lg transition-all duration-300 ${
                      state.isRefreshing
                        ? 'bg-yellow-500/20 text-yellow-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                    }`}
                    title='刷新数据'
                  >
                    <RefreshCw className={`w-4 h-4 ${state.isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className='card-body'>
                <div
                  ref={scrollContainerRef}
                  className='overflow-y-auto rounded-xl'
                  style={{
                    maxHeight: '400px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#94a3b8 #e2e8f0',
                  }}
                >
                  {state.loading ? (
                    <div className='flex flex-col items-center justify-center py-12'>
                      <div className='w-8 h-8 border-3 border-gray-300 rounded-full animate-spin border-t-yellow-500' />
                      <p className='text-gray-500 text-sm mt-2'>加载中...</p>
                    </div>
                  ) : classGroups.length === 0 ? (
                    <div className='text-center py-12'>
                      <Users className='w-12 h-12 text-gray-400 mx-auto mb-3' />
                      <p className='text-gray-500 text-base'>暂无学生数据</p>
                      <p className='text-gray-400 text-sm'>请添加学生信息</p>
                    </div>
                  ) : (
                    <div className='space-y-3'>
                      {classGroups.map((group, groupIndex) => (
                        <div key={group.class_name} className='space-y-2'>
                          <div className='flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 rounded-xl border border-gray-200/50 sticky top-0 z-10'>
                            <div className='w-6 h-6 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center'>
                              <Building2 className='w-3 h-3 text-white' />
                            </div>
                            <span className='text-sm font-semibold text-gray-900'>
                              {group.class_name}
                            </span>
                            <span className='text-xs text-gray-500 ml-auto flex items-center gap-1'>
                              <Users className='w-3 h-3' />
                              {group.students.length}人
                            </span>
                          </div>
                          <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2'>
                            {group.students.map((user) => {
                              const globalIndex = filteredUsers.findIndex((u) => u.id === user.id);
                              return (
                                <UserCard key={user.id} user={user} globalIndex={globalIndex} />
                              );
                            })}
                          </div>
                          {groupIndex < classGroups.length - 1 && (
                            <div className='h-px bg-gradient-to-r from-transparent via-gray-300/30 to-transparent' />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 右侧 - 设备状态 + 积分记录 */}
            <div className='flex flex-col gap-3 lg:w-72'>
              {/* 设备状态 */}
              <div className='card flex-1'>
                <div className='card-header pb-2'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <div className='w-7 h-7 bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/30'>
                        <Smartphone className='w-3.5 h-3.5 text-white' />
                      </div>
                      <div>
                        <h2 className='text-sm font-bold text-gray-900'>设备状态</h2>
                      </div>
                    </div>
                    <div className='flex items-center gap-1.5'>
                      <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse' />
                      <span className='text-xs text-gray-500'>实时</span>
                    </div>
                  </div>
                </div>

                <div className='card-body p-3 space-y-2'>
                  {state.loading ? (
                    <div className='flex items-center justify-center py-4'>
                      <div className='w-4 h-4 border-2 border-slate-700 rounded-full animate-spin border-t-cyan-500' />
                    </div>
                  ) : state.devices.length > 0 ? (
                    state.devices
                      .slice(0, 3)
                      .map((device) => <DeviceCard key={device.id} device={device} />)
                  ) : (
                    <div className='text-center py-4'>
                      <Smartphone className='w-8 h-8 text-slate-600 mx-auto mb-2' />
                      <p className='text-slate-400 text-sm'>暂无设备</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 积分记录 */}
              <div className='card flex-1'>
                <div className='card-header pb-2'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <div className='w-7 h-7 bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-green-500/30'>
                        <Eye className='w-3.5 h-3.5 text-white' />
                      </div>
                      <div>
                        <h2 className='text-sm font-bold text-gray-900'>积分记录</h2>
                      </div>
                    </div>
                    <span className='text-xs text-gray-500'>{state.records.length}条</span>
                  </div>
                </div>

                <div className='card-body p-3 space-y-2'>
                  {state.loading ? (
                    <div className='flex items-center justify-center py-4'>
                      <div className='w-4 h-4 border-2 border-gray-300 rounded-full animate-spin border-t-green-500' />
                    </div>
                  ) : state.records.length > 0 ? (
                    state.records
                      .slice(0, 4)
                      .map((record) => <RecordItem key={record.id} record={record} />)
                  ) : (
                    <div className='text-center py-4'>
                      <TrendingUp className='w-8 h-8 text-gray-400 mx-auto mb-2' />
                      <p className='text-gray-500 text-sm'>暂无记录</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 最新通知 */}
          <div className='relative z-10 mt-3'>
            <div className='card'>
              <div className='card-header'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <div className='w-8 h-8 bg-gradient-to-br from-pink-500 via-purple-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/30'>
                      <Bell className='w-4 h-4 text-white' />
                    </div>
                    <div>
                      <h2 className='text-base font-bold text-gray-900'>最新通知</h2>
                      <p className='text-xs text-gray-500'>消息提醒</p>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    {state.notifications.filter((n) => !n.read).length > 0 && (
                      <span className='px-2 py-1 bg-red-100 text-red-600 text-xs font-semibold rounded-full flex items-center gap-1'>
                        <AlertTriangle className='w-3 h-3' />
                        {state.notifications.filter((n) => !n.read).length} 条未读
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className='card-body'>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2'>
                  {state.loading ? (
                    <div className='col-span-full flex items-center justify-center py-4'>
                      <div className='w-4 h-4 border-2 border-gray-300 rounded-full animate-spin border-t-pink-500' />
                    </div>
                  ) : state.notifications.length > 0 ? (
                    state.notifications
                      .slice(0, 4)
                      .map((notification) => (
                        <NotificationCard key={notification.id} notification={notification} />
                      ))
                  ) : (
                    <div className='col-span-full text-center py-4'>
                      <Bell className='w-10 h-10 text-slate-600 mx-auto mb-2' />
                      <p className='text-slate-400 text-sm'>暂无通知</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 底部信息 */}
          <div className='relative z-10 mt-4 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-slate-400'>
            <div className='flex items-center gap-3'>
              <div className='flex items-center gap-1.5'>
                <Globe className='w-3 h-3' />
                <span>积分管理系统 v1.0</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <Database className='w-3 h-3' />
                <span>实时同步</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <Shield className='w-3 h-3' />
                <span>数据加密</span>
              </div>
            </div>
            <p>© 2024 积分管理平台</p>
          </div>
        </>
      )}
    </div>
  );
}

export default memo(Dashboard);
