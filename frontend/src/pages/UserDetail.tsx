import { useState, useEffect, useCallback, FormEvent, ChangeEvent, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User as UserIcon, Phone, BookOpen, CreditCard, Award, History, TrendingUp, TrendingDown, AlertCircle, RefreshCw, X, Plus, Minus, AlertTriangle } from 'lucide-react';
import api, { ScoreRecordItem } from '../services/api';
import { User } from '../types';
import { useStableToast } from '../hooks/useStableToast';
import { EmptyState, Button, PermissionButton } from '../components';

interface ScoreChange {
  amount: number;
  description: string;
}

interface RankInfo {
  name: string;
  color: string;
  bg: string;
}

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
  const [scoreChange, setScoreChange] = useState<ScoreChange>({ amount: 0, description: '' });

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
      console.error('获取记录失败:', err);
      setRecordsError(true);
    }
  }, [id]);

  useEffect(() => {
    fetchUser();
    fetchRecords();
  }, [fetchUser, fetchRecords]);

  const handleScoreChange = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (scoreChange.amount === 0) {
      showToast('error', '请输入积分变化值');
      return;
    }

    try {
      const result = await api.records.create({
        user_id: Number(id),
        score_change: scoreChange.amount,
        description: scoreChange.description || (scoreChange.amount > 0 ? '手动加分' : '手动扣分'),
        operator: '管理员',
      });

      setUser((prev) => {
        if (prev) {
          return {
            ...prev,
            current_score: (prev.current_score || 0) + scoreChange.amount,
          };
        }
        return prev;
      });

      // 后端仅返回 {record_id}，重新拉取记录列表以获取完整且 id 正确的新记录
      fetchRecords();

      showToast('success', scoreChange.amount > 0 ? '加分成功' : '扣分成功');
      setShowScoreModal(false);
      setScoreChange({ amount: 0, description: '' });
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
    <div className='max-w-5xl mx-auto'>
      <div className='flex items-center gap-3 mb-7'>
        <button
          onClick={() => navigate('/users')}
          className='flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors'
        >
          <ArrowLeft className='w-5 h-5' />
          返回列表
        </button>
        <button
          onClick={() => {
            fetchUser();
            fetchRecords();
          }}
          className='flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors'
        >
          <RefreshCw className='w-4 h-4' />
          刷新
        </button>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <div className='lg:col-span-1 space-y-6'>
          <div className='card p-6'>
            <div className='flex flex-col items-center text-center mb-6'>
              <div className='w-24 h-24 bg-gradient-to-br from-primary-500 to-accent-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-primary-500/30 mb-4'>
                <UserIcon className='w-12 h-12' />
              </div>
              <h2 className='text-2xl font-bold text-gray-800'>{user.name}</h2>
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${rank.bg} ${rank.color} mt-2`}
              >
                <Award className='w-4 h-4' />
                {rank.name}
              </div>
            </div>

            <div className='space-y-4'>
              <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-xl'>
                <div className='w-10 h-10 bg-info-100 rounded-xl flex items-center justify-center'>
                  <BookOpen className='w-5 h-5 text-info-600' />
                </div>
                <div>
                  <p className='text-xs text-gray-500'>班级</p>
                  <p className='font-semibold text-gray-800'>{user.class_name || '-'}</p>
                </div>
              </div>

              <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-xl'>
                <div className='w-10 h-10 bg-accent-100 rounded-xl flex items-center justify-center'>
                  <Phone className='w-5 h-5 text-accent-600' />
                </div>
                <div>
                  <p className='text-xs text-gray-500'>联系电话</p>
                  <p className='font-semibold text-gray-800'>{user.phone || '-'}</p>
                </div>
              </div>

              <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-xl'>
                <div className='w-10 h-10 bg-success-100 rounded-xl flex items-center justify-center'>
                  <CreditCard className='w-5 h-5 text-success-600' />
                </div>
                <div>
                  <p className='text-xs text-gray-500'>饭卡号</p>
                  <p className='font-mono font-semibold text-gray-800'>{user.card_id}</p>
                </div>
              </div>

              {(user.father_name ||
                user.father_phone ||
                user.mother_name ||
                user.mother_phone ||
                user.guardian_name) && (
                <div className='space-y-3'>
                  <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-xl'>
                    <div className='w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center flex-shrink-0'>
                      <UserIcon className='w-5 h-5 text-warning-600' />
                    </div>
                    <div className='flex-1'>
                      <p className='text-xs text-gray-500'>父亲信息</p>
                      <p className='font-semibold text-gray-800'>
                        {user.father_name || '-'}
                        {user.father_name && user.father_phone && ' / '}
                        {user.father_phone || ''}
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-xl'>
                    <div className='w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center flex-shrink-0'>
                      <UserIcon className='w-5 h-5 text-pink-600' />
                    </div>
                    <div className='flex-1'>
                      <p className='text-xs text-gray-500'>母亲信息</p>
                      <p className='font-semibold text-gray-800'>
                        {user.mother_name || '-'}
                        {user.mother_name && user.mother_phone && ' / '}
                        {user.mother_phone || ''}
                      </p>
                    </div>
                  </div>
                  {user.guardian_name && (
                    <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-xl'>
                      <div className='w-10 h-10 bg-info-100 rounded-xl flex items-center justify-center flex-shrink-0'>
                        <UserIcon className='w-5 h-5 text-info-600' />
                      </div>
                      <div className='flex-1'>
                        <p className='text-xs text-gray-500'>监护人</p>
                        <p className='font-semibold text-gray-800'>
                          {user.guardian_name}
                          {user.guardian_relation && ` (${user.guardian_relation})`}
                          {user.guardian_phone && ` / ${user.guardian_phone}`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className='card p-6'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='font-semibold text-gray-800'>当前积分</h3>
              <PermissionButton
                permission='score.edit'
                onClick={() => setShowScoreModal(true)}
                className='btn btn-primary flex items-center gap-2'
              >
                <Plus className='w-4 h-4' />
                调整积分
              </PermissionButton>
            </div>
            <div className='text-center py-6'>
              <div className={`text-5xl font-bold ${getScoreColor(user.current_score || 0)} mb-2`}>
                {user.current_score}
              </div>
              <p className='text-gray-500'>分</p>
            </div>

            <div className='grid grid-cols-2 gap-4 mt-4'>
              <div className='bg-success-50 rounded-xl p-4 text-center'>
                <p className='text-2xl font-bold text-success-600'>+{totalPositive}</p>
                <p className='text-xs text-success-700 mt-1'>累计加分</p>
              </div>
              <div className='bg-danger-50 rounded-xl p-4 text-center'>
                <p className='text-2xl font-bold text-danger-600'>-{totalNegative}</p>
                <p className='text-xs text-danger-700 mt-1'>累计扣分</p>
              </div>
            </div>
          </div>
        </div>

        <div className='lg:col-span-2'>
          <div className='card'>
            <div className='card-header'>
              <div className='flex items-center gap-3'>
                <History className='w-5 h-5 text-primary-600' />
                <h3 className='font-semibold text-gray-800'>积分变动记录</h3>
                <span className='text-sm text-gray-500'>({records.length} 条记录)</span>
              </div>
            </div>
            <div className='card-body'>
              {recordsError ? (
                <div className='flex items-center gap-2 p-4 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
                  <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
                  <p className='text-sm text-amber-700 dark:text-amber-300'>积分记录加载失败，请返回重试</p>
                </div>
              ) : records.length === 0 ? (
                <EmptyState
                  icon='file'
                  title='暂无积分变动记录'
                  description='该学生暂无积分变动记录'
                />
              ) : (
                <div className='space-y-3'>
                  {records.map((record) => {
                      const change = record.score_change || 0;
                      return (
                        <div
                          key={record.id}
                          className='flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors'
                        >
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              change >= 0 ? 'bg-success-100' : 'bg-danger-100'
                            }`}
                          >
                            {getScoreChangeIcon(change)}
                          </div>
                          <div className='flex-1'>
                            <p className='font-medium text-gray-800'>{record.description}</p>
                            <p className='text-xs text-gray-500'>{formatDate(record.created_at)}</p>
                          </div>
                          <div className='text-right'>
                            <p
                              className={`text-lg font-bold ${getScoreChangeColor(change)}`}
                            >
                              {change >= 0 ? '+' : ''}
                              {change}
                            </p>
                            <p className='text-xs text-gray-500'>分</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showScoreModal && (
        <div className='modal-overlay' onClick={() => setShowScoreModal(false)}>
          <div className='modal-content max-w-md' onClick={(e) => e.stopPropagation()}>
            <div className='modal-header'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center'>
                  <Plus className='w-5 h-5 text-white' />
                </div>
                <div>
                  <h3 className='text-lg font-semibold text-gray-800'>调整积分</h3>
                  <p className='text-xs text-gray-500'>为 {user.name} 添加或扣除积分</p>
                </div>
              </div>
              <button
                onClick={() => setShowScoreModal(false)}
                className='p-2.5 hover:bg-gray-100 rounded-xl transition-all'
              >
                <X className='w-5 h-5 text-gray-500' />
              </button>
            </div>
            <form onSubmit={handleScoreChange} className='modal-body'>
              <div className='form-group'>
                <label className='form-label'>积分变动</label>
                <div className='flex items-center gap-3'>
                  <div className='flex'>
                    <button
                      type='button'
                      onClick={() =>
                        setScoreChange({ ...scoreChange, amount: -Math.abs(scoreChange.amount) })
                      }
                      className='btn btn-outline h-12 w-12 rounded-l-xl'
                    >
                      <Minus className='w-5 h-5' />
                    </button>
                    <input
                      type='number'
                      value={scoreChange.amount}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setScoreChange({ ...scoreChange, amount: parseInt(e.target.value) || 0 })
                      }
                      className='form-input text-center w-32'
                      placeholder='0'
                    />
                    <button
                      type='button'
                      onClick={() =>
                        setScoreChange({ ...scoreChange, amount: Math.abs(scoreChange.amount) })
                      }
                      className='btn btn-outline h-12 w-12 rounded-r-xl'
                    >
                      <Plus className='w-5 h-5' />
                    </button>
                  </div>
                  <span className='text-gray-600 font-medium'>分</span>
                </div>
              </div>
              <div className='form-group'>
                <label className='form-label'>变动原因</label>
                <input
                  type='text'
                  value={scoreChange.description}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScoreChange({ ...scoreChange, description: e.target.value })
                  }
                  className='form-input'
                  placeholder='如：课堂表现优秀'
                />
              </div>
              <div className='modal-footer'>
                <Button variant='outline' onClick={() => setShowScoreModal(false)}>
                  取消
                </Button>
                <Button type='submit'>
                  {scoreChange.amount > 0
                    ? '确认加分'
                    : scoreChange.amount < 0
                      ? '确认扣分'
                      : '确认'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDetail;