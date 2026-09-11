import logger from '../../utils/logger';
/* eslint-disable react-hooks/exhaustive-deps */
/**
 * 仪表盘逻辑层（reducer + 数据加载 + handler + useMemo）
 *
 * 展示组件与纯函数 helper 见 ./DashboardView；页面装配层见 ../Dashboard。
 */

import { useState, useEffect, useMemo, useRef, useCallback, useReducer } from 'react';
import api from '../../services/api';
import type { User, Device, Notification, AlgorithmStatistics, WarningData } from '../../types';
import { useThrottledCallback } from '../../hooks';
import { useWebSocketStore } from '../../stores';
import type { DashboardViewProps } from './DashboardView';

export interface DashboardStatistics {
  totalUsers: number;
  totalRecords: number;
  totalScore: number;
  onlineDevices: number;
}

interface AlgorithmData {
  statistics: AlgorithmStatistics | null;
  clusters: ClusterData | null;
  warnings: WarningData | null;
}

export interface ClusterStudent {
  user_id: number;
  cluster_name: string;
}

export interface ClusterData {
  students?: ClusterStudent[];
}

export interface DashboardState {
  users: User[];
  records: unknown[];
  devices: Device[];
  notifications: Notification[];
  statistics: DashboardStatistics;
  algorithmData: AlgorithmData;
  loading: boolean;
  isRefreshing: boolean;
  lastUpdateTime: Date | null;
  showUpdateIndicator: boolean;
}

type DashboardAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'SET_RECORDS'; payload: unknown[] }
  | { type: 'SET_DEVICES'; payload: Device[] }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'SET_STATISTICS'; payload: Partial<DashboardStatistics> }
  | { type: 'SET_ALGORITHM_DATA'; payload: AlgorithmData }
  | { type: 'SET_LAST_UPDATE'; payload: Date }
  | { type: 'SET_UPDATE_INDICATOR'; payload: boolean };

const initialState: DashboardState = {
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
  algorithmData: {
    statistics: null,
    clusters: null,
    warnings: null,
  },
  loading: true,
  isRefreshing: false,
  lastUpdateTime: null,
  showUpdateIndicator: false,
};

function dataReducer(state: DashboardState, action: DashboardAction): DashboardState {
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
    case 'SET_ALGORITHM_DATA':
      return { ...state, algorithmData: action.payload };
    case 'SET_LAST_UPDATE':
      return { ...state, lastUpdateTime: action.payload };
    case 'SET_UPDATE_INDICATOR':
      return { ...state, showUpdateIndicator: action.payload };
    default:
      return state;
  }
}

export function useDashboardLogic(): DashboardViewProps {
  const [state, dispatch] = useReducer(dataReducer, initialState);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [classList, setClassList] = useState<{ id: number; name: string }[]>([]);
  const [dashboardError, setDashboardError] = useState(false);
  const stateRef = useRef(state);

  const { initSocket, isConnected, deviceStatuses, scoreUpdates, subscribe } = useWebSocketStore();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    initSocket();
    subscribe('dashboard');
  }, [initSocket, subscribe]);

  useEffect(() => {
    if (Object.keys(deviceStatuses).length > 0) {
      // M2: 读 stateRef 最新 state，避免闭包过期（依赖仅 deviceStatuses）
      dispatch({
        type: 'SET_DEVICES',
        payload: stateRef.current.devices.map((device) => {
          const updatedStatus = deviceStatuses[device.device_id];
          if (updatedStatus) {
            return { ...device, is_online: updatedStatus === 'online' };
          }
          return device;
        }),
      });
    }
  }, [deviceStatuses]);

  useEffect(() => {
    if (scoreUpdates.length > 0) {
      const latestUpdate = scoreUpdates[0];
      dispatch({
        type: 'SET_USERS',
        payload: stateRef.current.users.map((user) => {
          if (Number(user.id) === latestUpdate.user_id) {
            return {
              ...user,
              current_score: (user.current_score || 0) + latestUpdate.score_change,
            };
          }
          return user;
        }),
      });
      dispatch({
        type: 'SET_STATISTICS',
        payload: {
          totalScore: stateRef.current.statistics.totalScore + latestUpdate.score_change,
        },
      });
    }
  }, [scoreUpdates]);

  // M1: 时钟改为独立 LiveClock 组件（memo + 每秒只重渲染自身），避免整页每秒 setState
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const data = (await api.classes.getAll()) as unknown;
        const classesData = Array.isArray(data)
          ? data
          : (data as { classes?: { id: number; name: string }[] }).classes || [];
        setClassList(classesData);
      } catch (error) {
        logger.error('获取班级列表失败:', error);
        setDashboardError(true);
      }
    };
    fetchClasses();
  }, []);

  const filteredUsers = useMemo(() => {
    if (selectedClass) {
      return state.users
        .filter((u) => u.class_name === selectedClass)
        .sort((a, b) => (b.current_score || 0) - (a.current_score || 0));
    }
    return [...state.users].sort((a, b) => (b.current_score || 0) - (a.current_score || 0));
  }, [state.users, selectedClass]);

  const classes = useMemo(() => {
    return classList.map((c) => c.name).sort();
  }, [classList]);

  const classGroups = useMemo(() => {
    const groups: Record<string, User[]> = {};
    state.users.forEach((user) => {
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
  }, [state.users]);

  const REFRESH_INTERVAL = 600000;

  const fetchUsers = useCallback(async (): Promise<User[] | null> => {
    try {
      const usersData = await api.users.getAll({ per_page: 100 });
      return Array.isArray(usersData) ? usersData : (usersData as { users?: User[] })?.users || [];
    } catch (e) {
      logger.error('获取用户数据失败:', e);
      return null; // 失败返回 null，调用方保留旧数据而非用空数组覆盖
    }
  }, []);

  const fetchRecords = useCallback(async (): Promise<unknown[] | null> => {
    try {
      const recordsData = await api.records.getAll({ per_page: 20 });
      return Array.isArray(recordsData)
        ? recordsData
        : (recordsData as { records?: unknown[] })?.records || [];
    } catch (e) {
      logger.error('获取记录数据失败:', e);
      return null; // 失败返回 null，调用方保留旧数据而非用空数组覆盖
    }
  }, []);

  const fetchDevices = useCallback(async (): Promise<Device[] | null> => {
    try {
      const deviceData = await api.devices.getAll();
      const devices = (deviceData as { devices?: Device[] }).devices || deviceData;
      return Array.isArray(devices) ? devices : [];
    } catch (e) {
      logger.error('获取设备数据失败:', e);
      return null;
    }
  }, []);

  const fetchNotifications = useCallback(async (): Promise<Notification[] | null> => {
    try {
      const notificationsData = await api.notifications.getAll({ per_page: 5 });
      return Array.isArray(notificationsData)
        ? notificationsData
        : (notificationsData as { notifications?: Notification[] })?.notifications || [];
    } catch (e) {
      logger.error('获取通知数据失败:', e);
      return null;
    }
  }, []);

  const fetchAlgorithmData = useCallback(async (): Promise<AlgorithmData> => {
    try {
      const params = selectedClass ? { class_name: selectedClass } : {};
      const [statsRes, clusterRes, warningRes] = await Promise.all([
        api.algorithm.getStatistics(params).catch((): null => null),
        api.algorithm.getClusters(params).catch((): null => null),
        api.algorithm.getWarnings(params).catch((): null => null),
      ]);

      return {
        statistics: statsRes || null,
        clusters: clusterRes || null,
        warnings: warningRes || null,
      };
    } catch (error) {
      logger.error('获取算法数据失败:', error);
      setDashboardError(true);
      return { statistics: null, clusters: null, warnings: null };
    }
  }, [selectedClass]);

  const fetchDataRef = useRef<((manualRefresh?: boolean) => Promise<void>) | null>(null);
  const lastFetchTimeRef = useRef(0);
  const timeoutIdsRef = useRef<number[]>([]);
  const mountedRef = useRef(true);

  // 使用节流限制刷新频率（最少间隔 1 秒）
  const throttledRefresh = useThrottledCallback(async () => {
    if (fetchDataRef.current) {
      await fetchDataRef.current(true);
    }
  }, 1000);

  const getOnlineCount = useCallback((devices: Device[] | null): number => {
    if (!devices || !Array.isArray(devices)) {
      return 0;
    }
    // is_online 由后端按 last_heartbeat 时效判定（单点真理），不再叠加陈旧的 status 字段
    return devices.filter((d) => d.is_online).length;
  }, []);

  const fetchHighPriorityData = useCallback(async (): Promise<void> => {
    try {
      const [dashboardData, usersList, deviceList] = await Promise.all([
        api.dashboard.getData().catch((): null => null),
        fetchUsers(),
        fetchDevices(),
      ]);

      const sortedUsers =
        usersList !== null
          ? [...usersList].sort((a, b) => (b.current_score || 0) - (a.current_score || 0))
          : null;
      if (sortedUsers !== null) {
        dispatch({ type: 'SET_USERS', payload: sortedUsers });
      }

      if (deviceList !== null) {
        dispatch({ type: 'SET_DEVICES', payload: deviceList });
      }

      if (dashboardData) {
        setDashboardError(false);
        dispatch({
          type: 'SET_STATISTICS',
          payload: {
            totalUsers: dashboardData.total_users,
            totalRecords: dashboardData.today_records,
            totalScore: Math.round(dashboardData.avg_score * dashboardData.total_users),
            onlineDevices: dashboardData.online_devices,
          },
        });
      } else {
        setDashboardError(true); // 接口失败：数值可能不完整，显示警示条而非伪装
        dispatch({
          type: 'SET_STATISTICS',
          payload: {
            totalUsers: (usersList ?? []).length,
            totalRecords: 0,
            totalScore: (usersList ?? []).reduce((sum, u) => sum + (u.current_score || 0), 0),
            onlineDevices: deviceList !== null ? getOnlineCount(deviceList) : 0,
          },
        });
      }

      dispatch({ type: 'SET_LOADING', payload: false });
      // 仅接口成功才记录"最后更新"，失败时保持 null（显示 —）
      if (dashboardData) {
        dispatch({ type: 'SET_LAST_UPDATE', payload: new Date() });
      }
    } catch (error) {
      logger.error('获取高优先级数据失败:', error);
      setDashboardError(true);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [fetchUsers, fetchDevices, getOnlineCount]);

  const fetchMediumPriorityData = useCallback(async (): Promise<void> => {
    try {
      const [recordsList, notificationsList] = await Promise.all([
        fetchRecords(),
        fetchNotifications(),
      ]);

      if (recordsList !== null) {
        dispatch({ type: 'SET_RECORDS', payload: recordsList });
      }

      if (notificationsList !== null) {
        dispatch({ type: 'SET_NOTIFICATIONS', payload: notificationsList });
      }
    } catch (error) {
      logger.error('获取中优先级数据失败:', error);
      setDashboardError(true);
    }
  }, [fetchRecords, fetchNotifications]);

  const fetchLowPriorityData = useCallback(async (): Promise<void> => {
    try {
      const algorithmData = await fetchAlgorithmData();
      dispatch({ type: 'SET_ALGORITHM_DATA', payload: algorithmData });
    } catch (error) {
      logger.error('获取低优先级数据失败:', error);
      setDashboardError(true);
    }
  }, [fetchAlgorithmData]);

  const clearTimeouts = useCallback(() => {
    timeoutIdsRef.current.forEach((id) => clearTimeout(id));
    timeoutIdsRef.current = [];
  }, []);

  const fetchData = useCallback(
    async (manualRefresh = false) => {
      const now = Date.now();
      if (!manualRefresh && now - lastFetchTimeRef.current < REFRESH_INTERVAL) {
        return;
      }
      lastFetchTimeRef.current = now;

      clearTimeouts();

      if (manualRefresh) {
        dispatch({ type: 'SET_REFRESHING', payload: true });
      }

      try {
        await Promise.all([fetchHighPriorityData(), fetchMediumPriorityData()]);

        if (mountedRef.current) {
          const lowTimeout = window.setTimeout(() => {
            if (mountedRef.current) {
              fetchLowPriorityData();
            }
          }, 300);
          timeoutIdsRef.current.push(lowTimeout);
        }
      } catch (error) {
        logger.error('获取数据失败:', error);
        setDashboardError(true);
      } finally {
        if (mountedRef.current) {
          dispatch({ type: 'SET_REFRESHING', payload: false });
        }
      }
    },
    [fetchHighPriorityData, fetchMediumPriorityData, fetchLowPriorityData, clearTimeouts]
  );

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // 使用节流刷新，避免频繁点击
  const handleRefresh = useCallback(() => {
    throttledRefresh();
  }, [throttledRefresh]);

  useEffect(() => {
    mountedRef.current = true;

    const doFetch = async () => {
      if (fetchDataRef.current) {
        await fetchDataRef.current();
      }
    };

    doFetch();
    const interval = setInterval(doFetch, REFRESH_INTERVAL);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      clearTimeouts();
    };
  }, [clearTimeouts]);

  return {
    state,
    selectedClass,
    setSelectedClass,
    classes,
    isConnected,
    handleRefresh,
    dashboardError,
    filteredUsers,
    classGroups,
  };
}
