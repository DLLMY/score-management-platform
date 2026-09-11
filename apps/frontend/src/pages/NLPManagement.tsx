import { AlertTriangle } from 'lucide-react';
import { Sparkles, BookOpen, Train, BarChart3, Brain } from 'lucide-react';
/**
 * 智能评分规则管理（NLPManagement）
 * 装配层：状态 + 数据加载 + 列定义已抽到 ./nlp-management/useNLPManagementLogic，
 * 本文件仅负责 Tab/模态/列表分发渲染（T12 拆分 + E6a hook 抽取）。
 */
import { useNLPManagementLogic } from './nlp-management/useNLPManagementLogic';
import type { TabType } from './nlp-management/types';
import { ParseTab } from './nlp-management/ParseTab';
import { RulesTab } from './nlp-management/RulesTab';
import { TrainingTab } from './nlp-management/TrainingTab';
import { StatisticsTab } from './nlp-management/StatisticsTab';
import { AnalysisTab } from './nlp-management/AnalysisTab';
import { CorrectionModal } from './nlp-management/CorrectionModal';
import { RuleFormModal } from './nlp-management/RuleFormModal';
import { BatchImportModal } from './nlp-management/BatchImportModal';
import { CorrectionsList } from './nlp-management/CorrectionsList';

const NLPScoringManagement = () => {
  const deps = useNLPManagementLogic();
  const {
    activeTab,
    setActiveTab,
    loadError,
    showCorrectionModal,
    showRuleForm,
    showBatchImportModal,
    showCorrectionList,
  } = deps;

  return (
    <div className='space-y-6'>
      {loadError && (
        <div className='flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            算法/分析数据加载失败，部分功能可能不可用，请刷新重试
          </p>
        </div>
      )}
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <div className='w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center'>
            <Brain className='w-6 h-6 text-white' />
          </div>
          <div>
            <h1 className='text-xl font-bold text-gray-800'>智能评分规则管理</h1>
            <p className='text-sm text-gray-500'>基于自然语言处理的智能评分系统</p>
          </div>
        </div>
      </div>

      <div className='flex gap-2 mb-6'>
        {[
          { key: 'parse', label: '智能解析', icon: Sparkles },
          { key: 'rules', label: '规则管理', icon: BookOpen },
          { key: 'training', label: '模型训练', icon: Train },
          { key: 'statistics', label: '统计分析', icon: BarChart3 },
          { key: 'analysis', label: '算法分析', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon className='w-4 h-4' />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'parse' && <ParseTab deps={deps} />}
      {activeTab === 'rules' && <RulesTab deps={deps} />}
      {activeTab === 'training' && <TrainingTab deps={deps} />}
      {activeTab === 'statistics' && <StatisticsTab deps={deps} />}
      {activeTab === 'analysis' && <AnalysisTab deps={deps} />}

      {showCorrectionModal && <CorrectionModal deps={deps} />}
      {showRuleForm && <RuleFormModal deps={deps} />}
      {showBatchImportModal && <BatchImportModal deps={deps} />}
      {showCorrectionList && <CorrectionsList deps={deps} />}
    </div>
  );
};

export default NLPScoringManagement;
