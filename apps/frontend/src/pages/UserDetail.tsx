import logger from '../utils/logger';
/**
 * 学生详情页面（逻辑层）。
 *
 * 主渲染 JSX 已拆到 ./userDetail/UserDetailView；加载态 / 错误态早退
 * 与数据获取、派生计算保留在本文件。
 */

import { useState, useEffect, useCallback, FormEvent, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import api, { ScoreRecordItem } from '../services/api';
import { User } from '../types';
import { useStableToast } from '../hooks';
import UserDetailView from './userDetail/UserDetailView';
import type { ScoreChange, RankInfo } from './userDetail/types';

function UserDetail() {
  const { showToast } = useStableToast();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [records, setRecords] = useState<ScoreRecordItem[]>([]);
  const [recordsError, setRecordsError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showScoreModal, setShowScoreModal] = useState<boolean>(false);
  const [scoreChange, setScoreChange] = useState<ScoreChange>({ score_change: 0, description: '' });

  const fetchUser = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.users.getById(Number(id));
      setUser(data);
    } catch (err: unknown) {
      setError('获取学生信息失败: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const fetchRecords = useCallback(async (): Promise<void> => {
    try {
      const data = await api.records.getByUser(Number(id));
      setRecords(data.reverse());
      setRecordsError(false);
    } catch (err: unknown) {
      logger.error('获取记录失败:', err);
      setRecordsError(true);
    }
  }, [id]);

  useEffect(() => {
    fetchUser();
    fetchRecords();
  }, [fetchUser, fetchRecords]);

  const handleScoreChange = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (scoreChange.score_change === 0) {
      showToast('error', '请输入积分变化值');
      return;
    }

    try {
      await api.records.create({
        user_id: Number(id),
        score_change: scoreChange.score_change,
        description:
          scoreChange.description || (scoreChange.score_change > 0 ? '手动加分' : '手动扣分'),
        operator: '管理员',
      });

      setUser((prev) => {
        if (prev) {
          return {
            ...prev,
            current_score: (prev.current_score || 0) + scoreChange.score_change,
          };
        }
        return prev;
      });

      // 后端仅返回 {record_id}，重新拉取记录列表以获取完整且 id 正确的新记录
      fetchRecords();

      showToast('success', scoreChange.score_change > 0 ? '加分成功' : '扣分成功');
      setShowScoreModal(false);
      setScoreChange({ score_change: 0, description: '' });
    } catch (err: unknown) {
      showToast('error', '操作失败: ' + (err as Error).message);
    }
  };

  const getRank = (score: number): RankInfo => {
    if (score >= 90) return { name: '卓越', color: 'text-success-600', bg: 'bg-success-50' };
    if (score >= 80) return { name: '优秀', color: 'text-primary-600', bg: 'bg-primary-50' };
    if (score >= 60) return { name: '合格', color: 'text-warning-600', bg: 'bg-warning-50' };
    return { name: '待达标', color: 'text-danger-600', bg: 'bg-danger-50' };
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-success-600';
    if (score >= 60) return 'text-primary-600';
    return 'text-danger-600';
  };

  const getScoreChangeColor = (change: number): string => {
    return change >= 0 ? 'text-success-500' : 'text-danger-500';
  };

  const getScoreChangeIcon = (change: number) => {
    return change >= 0 ? <TrendingUp className='w-4 h-4' /> : <TrendingDown className='w-4 h-4' />;
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 使用 useMemo 优化统计计算
  const { totalPositive, totalNegative } = useMemo(() => {
    const positive = records
      .filter((r) => r.score_change !== undefined && r.score_change > 0)
      .reduce((sum, r) => sum + (r.score_change || 0), 0);
    const negative = records
      .filter((r) => r.score_change !== undefined && r.score_change < 0)
      .reduce((sum, r) => sum + Math.abs(r.score_change || 0), 0);
    return { totalPositive: positive, totalNegative: negative };
  }, [records]);

  if (isLoading) {
    return (
      <div className='max-w-5xl mx-auto flex items-center justify-center py-24'>
        <div className='flex flex-col items-center'>
          <div className='w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4' />
          <span className='text-gray-500'>加载中...</span>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className='max-w-5xl mx-auto'>
        <div className='flex items-center gap-3 mb-6'>
          <button
            onClick={() => navigate('/users')}
            className='flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors'
          >
            <ArrowLeft className='w-5 h-5' />
            返回列表
          </button>
        </div>
        <div className='card p-8 text-center'>
          <AlertCircle className='w-16 h-16 text-danger-500 mx-auto mb-4' />
          <h3 className='text-xl font-semibold text-gray-600 mb-2'>获取学生信息失败</h3>
          <p className='text-gray-500 mb-6'>{error || '学生不存在'}</p>
          <button onClick={() => navigate('/users')} className='btn btn-primary'>
            返回学生列表
          </button>
        </div>
      </div>
    );
  }

  const rank = getRank(user.current_score || 0);
  return (
    <UserDetailView
      id={id}
      navigate={navigate}
      user={user}
      records={records}
      recordsError={recordsError}
      fetchUser={fetchUser}
      fetchRecords={fetchRecords}
      handleScoreChange={handleScoreChange}
      scoreChange={scoreChange}
      setScoreChange={setScoreChange}
      showScoreModal={showScoreModal}
      setShowScoreModal={setShowScoreModal}
      getScoreColor={getScoreColor}
      getScoreChangeColor={getScoreChangeColor}
      getScoreChangeIcon={getScoreChangeIcon}
      formatDate={formatDate}
      totalPositive={totalPositive}
      totalNegative={totalNegative}
      rank={rank}
    />
  );
}

export default UserDetail;
