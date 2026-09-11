import { ChangeEvent } from 'react';
import { BarChart3, AlertTriangle, Filter, RefreshCw, Download } from 'lucide-react';
import { PermissionButton } from '../components';
import {
  BasicStatsGrid,
  AlgorithmInsightCards,
  ScoreDistributionPanel,
  ClusterDistributionPanel,
  RiskWarningPanel,
  TopUsersRanking,
  ScoreTrendPanel,
  CorrelationPanel,
  NeedAttentionPanel,
} from './analysis/AnalysisSections';
import { useAnalysisLogic } from './analysis/useAnalysisLogic';

/**
 * 数据分析页面（装配层）：持有主渲染结构，数据与派生逻辑见 ./analysis/useAnalysisLogic。
 */
function Analysis() {
  const {
    loadWarn,
    selectedClass,
    setSelectedClass,
    classList,
    handleRefresh,
    isLoading,
    basicStats,
    algorithmStats,
    riskStudents,
    correlation,
    scoreDistribution,
    clusterSummary,
    clusterPieData,
    topUsers,
    weeklyData,
    statistics,
    needAttention,
    usersWithCluster,
    handleExport,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
  } = useAnalysisLogic();

  return (
    <div className='max-w-7xl mx-auto'>
      {loadWarn && (
        <div className='mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            部分数据加载失败（用户/班级/算法），当前展示可能不完整，请刷新重试
          </p>
        </div>
      )}
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
        <div className='flex items-center gap-3'>
          <div className='flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5'>
            <Filter className='w-5 h-5 text-gray-500' />
            <select
              value={selectedClass}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setSelectedClass(e.target.value ? Number(e.target.value) : '')
              }
              className='bg-transparent border-none text-sm font-medium text-gray-700 focus:outline-none cursor-pointer'
            >
              <option value=''>全部班级</option>
              {classList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className='flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <PermissionButton
            permission='report.export'
            onClick={handleExport}
            className='flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-500 rounded-xl hover:bg-primary-600 transition-colors'
          >
            <Download className='w-4 h-4' />
            导出报告
          </PermissionButton>
        </div>
      </div>

      {isLoading ? (
        <div className='flex items-center justify-center py-20'>
          <div className='w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin' />
        </div>
      ) : (
        <>
          <BasicStatsGrid stats={basicStats} />
          <AlgorithmInsightCards
            stats={algorithmStats}
            riskStudents={riskStudents}
            correlation={correlation}
          />
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3'>
            <ScoreDistributionPanel data={scoreDistribution} />
            <ClusterDistributionPanel summary={clusterSummary} pieData={clusterPieData} />
          </div>
          {riskStudents.length > 0 && (
            <RiskWarningPanel
              riskStudents={riskStudents}
              highRiskCount={highRiskCount}
              mediumRiskCount={mediumRiskCount}
              lowRiskCount={lowRiskCount}
            />
          )}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
            <div className='space-y-4'>
              <TopUsersRanking users={topUsers} />
            </div>
            <div className='space-y-4'>
              <ScoreTrendPanel weeklyData={weeklyData} />
              <CorrelationPanel statistics={statistics} />
            </div>
          </div>
          {needAttention.length > 0 && (
            <NeedAttentionPanel users={needAttention} usersWithCluster={usersWithCluster} />
          )}
        </>
      )}
    </div>
  );
}

export default Analysis;
