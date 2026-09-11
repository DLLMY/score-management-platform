import React, { ChangeEvent } from 'react';
/**
 * 学生详情页视图层。
 *
 * 承接原 UserDetail.tsx 的主渲染 JSX（加载态 / 错误态早退仍留在逻辑层），
 * 全部数据经 UserDetailViewProps 注入。
 */

import {
  ArrowLeft,
  User as UserIcon,
  Phone,
  BookOpen,
  CreditCard,
  Award,
  History,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  X,
  Plus,
  Minus,
} from 'lucide-react';
import { EmptyState, Button, PermissionButton } from '../../components';
import type { UserDetailViewProps } from './types';

const UserDetailView: React.FC<UserDetailViewProps> = ({
  navigate,
  user,
  records,
  recordsError,
  fetchUser,
  fetchRecords,
  handleScoreChange,
  scoreChange,
  setScoreChange,
  showScoreModal,
  setShowScoreModal,
  getScoreColor,
  getScoreChangeColor,
  getScoreChangeIcon,
  formatDate,
  totalPositive,
  totalNegative,
  rank,
}) => {
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

              <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-xl'>
                <div className='w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center'>
                  <AlertCircle className='w-5 h-5 text-gray-600' />
                </div>
                <div>
                  <p className='text-xs text-gray-500'>账号状态</p>
                  <p className='font-semibold'>
                    {user.is_blacklisted ? (
                      <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800'>
                        黑名单
                      </span>
                    ) : user.is_active ? (
                      <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                        启用
                      </span>
                    ) : (
                      <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600'>
                        禁用
                      </span>
                    )}
                  </p>
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
              <div
                className={`text-5xl font-bold ${
                  user.current_score != null ? getScoreColor(user.current_score) : 'text-gray-400'
                } mb-2`}
              >
                {user.current_score != null ? user.current_score : '--'}
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
                <span className='text-sm text-gray-500'>
                  ({recordsError ? '--' : records.length} 条记录)
                </span>
              </div>
            </div>
            <div className='card-body'>
              {recordsError ? (
                <div className='flex items-center gap-2 p-4 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
                  <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
                  <p className='text-sm text-amber-700 dark:text-amber-300'>
                    积分记录加载失败，请返回重试
                  </p>
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
                          <p className={`text-lg font-bold ${getScoreChangeColor(change)}`}>
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
                        setScoreChange({
                          ...scoreChange,
                          score_change: -Math.abs(scoreChange.score_change),
                        })
                      }
                      className='btn btn-outline h-12 w-12 rounded-l-xl'
                    >
                      <Minus className='w-5 h-5' />
                    </button>
                    <input
                      type='number'
                      value={scoreChange.score_change}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setScoreChange({
                          ...scoreChange,
                          score_change: parseInt(e.target.value) || 0,
                        })
                      }
                      className='form-input text-center w-32'
                      placeholder='0'
                    />
                    <button
                      type='button'
                      onClick={() =>
                        setScoreChange({
                          ...scoreChange,
                          score_change: Math.abs(scoreChange.score_change),
                        })
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
                  {scoreChange.score_change > 0
                    ? '确认加分'
                    : scoreChange.score_change < 0
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
};

export default UserDetailView;
