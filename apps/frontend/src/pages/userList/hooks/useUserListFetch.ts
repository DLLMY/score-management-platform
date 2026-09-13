/* eslint-disable react-hooks/exhaustive-deps */
/**
 * T12-9 拆分（2026-09-12）：数据拉取域（用户列表拉取 + 竞态 abort / 规则与排名规则 / 班级列表 /
 * 搜索防抖 / 分页与筛选触发 / ref 镜像同步）。自 useUserListLogic.ts 原样搬出。
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Dispatch } from 'react';
import api from '../../../services/api';
import logger from '../../../utils/logger';
import { useDebouncedValue, useStableToast } from '../../../hooks';
import type { SearchCondition } from '../../../components';
import type { User } from '../../../types';
import type { UserListAction } from '../reducer';
import type { PaginationState } from '../types';

export interface useUserListFetchParams {
  dispatch: Dispatch<UserListAction>;
  showToast: ReturnType<typeof useStableToast>['showToast'];
  /** 以下 5 项仅用于 ref 镜像同步 effect（与原实现一致） */
  advancedConditions: SearchCondition;
  selectedClass: string;
  searchTerm: string;
  showAdvancedSearch: boolean;
  pagination: PaginationState;
}

export interface useUserListFetchResult {
  classes: string[];
  classList: { id: number; name: string }[];
  fetchUsers: () => Promise<void>;
  handleSearch: (term: string) => void;
  handleClassChange: (className: string) => void;
  handleAdvancedSearch: () => void;
  handlePageChange: (page: number) => void;
  handleClearFilters: () => void;
  handleRetry: () => void;
}

export function useUserListFetch(params: useUserListFetchParams): useUserListFetchResult {
  const {
    dispatch,
    showToast,
    advancedConditions,
    selectedClass,
    searchTerm,
    showAdvancedSearch,
    pagination,
  } = params;

  const [classList, setClassList] = useState<{ id: number; name: string }[]>([]);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [searchTermInput, setSearchTermInput] = useState('');
  const advancedConditionsRef = useRef(advancedConditions);
  const selectedClassRef = useRef(selectedClass);
  const searchTermRef = useRef(searchTerm);
  const showAdvancedSearchRef = useRef(showAdvancedSearch);
  const paginationRef = useRef(pagination);
  const abortControllerRef = useRef<AbortController | null>(null);

  const debouncedSearchTerm = useDebouncedValue(searchTermInput, 300);

  useEffect(() => {
    if (debouncedSearchTerm !== searchTermRef.current) {
      searchTermRef.current = debouncedSearchTerm;
      dispatch({ type: 'SET_SEARCH_TERM', payload: debouncedSearchTerm });
      dispatch({ type: 'SET_PAGINATION', payload: { ...paginationRef.current, page: 1 } });
      setFetchTrigger((prev) => prev + 1);
    }
  }, [debouncedSearchTerm]);

  useEffect(() => {
    advancedConditionsRef.current = advancedConditions;
  }, [advancedConditions]);

  useEffect(() => {
    selectedClassRef.current = selectedClass;
  }, [selectedClass]);

  useEffect(() => {
    searchTermRef.current = searchTerm;
  }, [searchTerm]);

  useEffect(() => {
    showAdvancedSearchRef.current = showAdvancedSearch;
  }, [showAdvancedSearch]);

  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const data = (await api.classes.getAll()) as unknown;
        const classesData = Array.isArray(data)
          ? data
          : (data as { classes?: { id: number; name: string }[] }).classes || [];
        setClassList(classesData);
      } catch (error) {
        logger.error('Error fetching classes:', error);
        showToast('error', '班级列表加载失败，筛选器可能不可用');
      }
    };
    fetchClasses();
  }, []);

  const classes = useMemo(() => {
    return classList.map((c) => c.name).sort();
  }, [classList]);

  const handleSearch = useCallback((term: string) => {
    setSearchTermInput(term);
  }, []);

  const handleClassChange = useCallback((className: string) => {
    selectedClassRef.current = className;
    dispatch({ type: 'SET_SELECTED_CLASS', payload: className });
    dispatch({ type: 'SET_PAGINATION', payload: { ...paginationRef.current, page: 1 } });
    setFetchTrigger((prev) => prev + 1);
  }, []);

  const handleAdvancedSearch = useCallback(() => {
    dispatch({ type: 'SET_PAGINATION', payload: { ...paginationRef.current, page: 1 } });
    setFetchTrigger((prev) => prev + 1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGINATION', payload: { ...paginationRef.current, page } });
    setFetchTrigger((prev) => prev + 1);
  }, []);

  const fetchUsers = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    dispatch({ type: 'SET_FETCHING', payload: true });

    try {
      const { page, per_page } = paginationRef.current;

      const apiParams: Record<string, unknown> = {
        page,
        per_page,
        skipCache: true,
        signal: controller.signal,
      };

      if (!showAdvancedSearchRef.current) {
        apiParams.class_id =
          selectedClassRef.current && selectedClassRef.current !== ''
            ? Number(selectedClassRef.current)
            : undefined;
        apiParams.search =
          searchTermRef.current && searchTermRef.current !== '' ? searchTermRef.current : undefined;
      } else {
        const { keyword, classId, minScore, maxScore, sortBy, sortOrder } =
          advancedConditionsRef.current;
        apiParams.class_id = classId ? Number(classId) : undefined;
        apiParams.keyword = keyword || undefined;
        apiParams.min_score = minScore;
        apiParams.max_score = maxScore;
        apiParams.sort_by = sortBy || 'name';
        apiParams.sort_order = sortOrder || 'asc';
      }

      const response = await api.users.getAll(apiParams);

      if (response !== null) {
        const data = response as { users?: User[]; total?: number; pages?: number; page?: number };

        if (Array.isArray(response)) {
          // 防御分支：后端异常时兜底，非真实总数
          dispatch({ type: 'SET_USERS', payload: response });
          dispatch({
            type: 'SET_PAGINATION',
            payload: {
              ...paginationRef.current,
              total: response.length,
              pages: Math.ceil(response.length / per_page),
            },
          });
        } else {
          dispatch({ type: 'SET_USERS', payload: data.users || [] });
          dispatch({
            type: 'SET_PAGINATION',
            payload: {
              ...paginationRef.current,
              total: data.total || 0,
              pages: data.pages || 1,
              page: data.page || page,
            },
          });
        }
      }
    } catch (error) {
      if ((error as { name?: string }).name !== 'AbortError') {
        dispatch({ type: 'SET_ERROR', payload: '加载用户列表失败' });
        logger.error('Error fetching users:', error);
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_FETCHING', payload: false });
      abortControllerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTrigger]);

  const fetchRules = useCallback(async () => {
    try {
      const data = await api.rules.getAll();
      dispatch({ type: 'SET_RULES', payload: Array.isArray(data) ? data : data.rules || [] });
    } catch (error) {
      logger.error('Error fetching rules:', error);
      showToast('error', '积分规则加载失败，快捷评分可能不可用');
    }
  }, [showToast]);

  const fetchRankRules = useCallback(async () => {
    try {
      const data = await api.rankRules.getAll();
      dispatch({ type: 'SET_RANK_RULES', payload: data });
    } catch (error) {
      logger.error('Error fetching rank rules:', error);
      showToast('error', '排名规则加载失败，排名规则可能不可用');
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchRules();
    fetchRankRules();
  }, [fetchRules, fetchRankRules]);

  const handleClearFilters = useCallback(() => {
    setSearchTermInput('');
    dispatch({ type: 'SET_SELECTED_CLASS', payload: '' });
    dispatch({ type: 'SET_ADVANCED_CONDITIONS', payload: {} });
  }, []);

  const handleRetry = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
    setFetchTrigger((prev) => prev + 1);
  }, []);

  return {
    classes,
    classList,
    fetchUsers,
    handleSearch,
    handleClassChange,
    handleAdvancedSearch,
    handlePageChange,
    handleClearFilters,
    handleRetry,
  };
}
