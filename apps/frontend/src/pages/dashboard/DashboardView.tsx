/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import {
  Users,
  Activity,
  Trophy,
  Smartphone,
  Clock,
  Radio,
  RefreshCw,
  AlertTriangle,
  Flame,
  Target,
  CheckCircle,
  Building2,
  Bell,
} from 'lucide-react';
import { DashboardSkeleton } from '../../components';
import { formatDate, formatRelativeTime } from '../../utils/format';
import type { ClusterData } from './useDashboardLogic';
import type { DashboardViewProps } from './types';
import { StatCard, UserCard, DeviceCard, LiveClock } from './components';

export default function DashboardView({
  state,
  selectedClass,
  setSelectedClass,
  classes,
  isConnected,
  handleRefresh,
  dashboardError,
  filteredUsers,
  classGroups,
}: DashboardViewProps): React.ReactElement {
  if (state.loading) return <DashboardSkeleton />;

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>仪表盘</h1>
          <p className='text-gray-500 mt-1'>实时监控系统状态和用户数据</p>
        </div>
        <div className='flex items-center gap-4'>
          <div className='flex items-center gap-2 text-sm text-gray-500'>
            <Clock className='w-4 h-4' />
            <span>{state.lastUpdateTime ? formatDate(state.lastUpdateTime, true) : '—'}</span>
            {/* M1: 实时时钟（独立组件，不拖垮整页重渲染） */}
            <LiveClock />
          </div>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            <Radio className={`w-4 h-4 ${isConnected ? 'animate-pulse' : ''}`} />
            {isConnected ? '实时连接' : '连接断开'}
          </div>
          <button
            onClick={handleRefresh}
            disabled={state.isRefreshing}
            aria-label='刷新数据'
            aria-busy={state.isRefreshing}
            className='flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50'
          >
            <RefreshCw
              className={`w-4 h-4 ${state.isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden='true'
            />
            刷新
          </button>
        </div>
      </div>

      {dashboardError && (
        <div
          role='alert'
          className='flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700'
        >
          <AlertTriangle className='w-4 h-4 flex-shrink-0' />
          部分统计数据加载失败，当前数值可能不完整，请点击「刷新」重试
        </div>
      )}

      <div
        className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'
        role='list'
        aria-label='统计数据卡片'
      >
        <StatCard
          icon={Users}
          label='总用户数'
          value={state.statistics.totalUsers}
          gradient='from-blue-400 via-blue-500 to-blue-600'
          subValue='名学生'
          aria-label={`总用户数 ${state.statistics.totalUsers}`}
        />
        <StatCard
          icon={Activity}
          label='今日记录'
          value={state.statistics.totalRecords}
          gradient='from-green-400 via-emerald-500 to-green-600'
          subValue='条记录'
          aria-label={`今日记录 ${state.statistics.totalRecords}`}
        />
        <StatCard
          icon={Trophy}
          label='总积分'
          value={state.statistics.totalScore}
          gradient='from-amber-400 via-yellow-500 to-orange-500'
          subValue='积分'
          aria-label={`总积分 ${state.statistics.totalScore}`}
        />
        <StatCard
          icon={Smartphone}
          label='在线设备'
          value={state.statistics.onlineDevices}
          gradient='from-cyan-400 via-teal-500 to-cyan-600'
          subValue={`${state.devices.length} 台设备`}
          aria-label={`在线设备 ${state.statistics.onlineDevices}`}
        />
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <div className='lg:col-span-2'>
          <div className='bg-white rounded-xl border border-gray-200/60 shadow-sm'>
            <div className='p-4 border-b border-gray-100 flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Flame className='w-5 h-5 text-orange-500' />
                <h2 className='font-semibold text-gray-900'>积分排行榜</h2>
              </div>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                aria-label='筛选班级'
                className='px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>全部班级</option>
                {classes.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
            <div className='p-4 space-y-2.5'>
              {filteredUsers.slice(0, 10).map((user, index) => (
                <UserCard
                  key={user.id}
                  user={user}
                  globalIndex={index}
                  clusters={state.algorithmData.clusters as ClusterData}
                />
              ))}
              {filteredUsers.length === 0 && (
                <div
                  className='text-center py-12 text-gray-500'
                  role='status'
                  aria-label='空列表状态'
                >
                  <Users className='w-12 h-12 mx-auto mb-3 text-gray-300' aria-hidden='true' />
                  <p>暂无用户数据</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className='space-y-6'>
          <div className='bg-white rounded-xl border border-gray-200/60 shadow-sm'>
            <div className='p-4 border-b border-gray-100'>
              <div className='flex items-center gap-2'>
                <Smartphone className='w-5 h-5 text-cyan-500' />
                <h2 className='font-semibold text-gray-900'>设备状态</h2>
              </div>
            </div>
            <div className='p-4 space-y-2 max-h-64 overflow-y-auto'>
              {state.devices.slice(0, 5).map((device) => (
                <DeviceCard key={device.id} device={device} />
              ))}
              {state.devices.length === 0 && (
                <div className='text-center py-8 text-gray-500'>
                  <Smartphone className='w-8 h-8 mx-auto mb-2 text-gray-300' />
                  <p className='text-sm'>暂无设备</p>
                </div>
              )}
            </div>
          </div>

          <div className='bg-white rounded-xl border border-gray-200/60 shadow-sm'>
            <div className='p-4 border-b border-gray-100'>
              <div className='flex items-center gap-2'>
                <Bell className='w-5 h-5 text-amber-500' />
                <h2 className='font-semibold text-gray-900'>最新通知</h2>
              </div>
            </div>
            <div className='p-4 space-y-3 max-h-72 overflow-y-auto'>
              {state.notifications.slice(0, 5).map((notification) => (
                <div
                  key={notification.id}
                  className='p-3 bg-gray-50/50 rounded-lg hover:bg-gray-50 transition-colors'
                >
                  <div className='flex items-start gap-2'>
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 ${
                        notification.priority === 'high' || notification.priority === 'urgent'
                          ? 'bg-red-500'
                          : notification.priority === 'medium'
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                    />
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-gray-900 truncate'>
                        {notification.title}
                      </p>
                      <p className='text-xs text-gray-500 mt-0.5'>{notification.content}</p>
                      <p className='text-xs text-gray-400 mt-1'>
                        {formatRelativeTime(notification.created_at as string)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {state.notifications.length === 0 && (
                <div className='text-center py-8 text-gray-500'>
                  <Bell className='w-8 h-8 mx-auto mb-2 text-gray-300' />
                  <p className='text-sm'>暂无通知</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div className='bg-white rounded-xl border border-gray-200/60 shadow-sm'>
          <div className='p-4 border-b border-gray-100'>
            <div className='flex items-center gap-2'>
              <Target className='w-5 h-5 text-purple-500' />
              <h2 className='font-semibold text-gray-900'>算法分析</h2>
              {state.algorithmData.statistics !== null && (
                <span className='ml-auto text-xs text-green-500 flex items-center gap-1'>
                  <CheckCircle className='w-3.5 h-3.5' />
                  数据已更新
                </span>
              )}
            </div>
          </div>
          <div className='p-4'>
            {state.algorithmData.statistics ? (
              <div className='grid grid-cols-3 gap-4'>
                <div className='text-center p-4 bg-purple-50/50 rounded-lg'>
                  <div className='text-2xl font-bold text-purple-600'>
                    {state.algorithmData.statistics?.student_count || 0}
                  </div>
                  <div className='text-xs text-gray-500 mt-1'>分析学生</div>
                </div>
                <div className='text-center p-4 bg-blue-50/50 rounded-lg'>
                  <div className='text-2xl font-bold text-blue-600'>
                    {state.algorithmData.statistics?.cluster_count || 0}
                  </div>
                  <div className='text-xs text-gray-500 mt-1'>聚类数量</div>
                </div>
                <div className='text-center p-4 bg-orange-50/50 rounded-lg'>
                  <div className='text-2xl font-bold text-orange-600'>
                    {state.algorithmData.warnings
                      ? state.algorithmData.warnings.total_risk_count
                      : '—'}
                  </div>
                  <div className='text-xs text-gray-500 mt-1'>风险预警</div>
                </div>
              </div>
            ) : (
              <div className='text-center py-8 text-gray-500'>
                <Target className='w-12 h-12 mx-auto mb-3 text-gray-300' />
                <p>暂无算法数据（统计接口未返回结果）</p>
              </div>
            )}
          </div>
        </div>

        <div className='bg-white rounded-xl border border-gray-200/60 shadow-sm'>
          <div className='p-4 border-b border-gray-100'>
            <div className='flex items-center gap-2'>
              <Building2 className='w-5 h-5 text-indigo-500' />
              <h2 className='font-semibold text-gray-900'>班级分布</h2>
            </div>
          </div>
          <div className='p-4'>
            {classGroups.length > 0 ? (
              <div className='space-y-3'>
                {classGroups.map((group) => (
                  <div
                    key={group.class_name}
                    className='flex items-center justify-between p-3 bg-gray-50/50 rounded-lg'
                  >
                    <div className='flex items-center gap-2'>
                      <Building2 className='w-4 h-4 text-indigo-400' />
                      <span className='text-sm font-medium text-gray-900'>{group.class_name}</span>
                    </div>
                    <span className='text-sm font-bold text-indigo-600'>
                      {group.students.length} 人
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-center py-8 text-gray-500'>
                <Building2 className='w-12 h-12 mx-auto mb-3 text-gray-300' />
                <p>暂无班级数据</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
