// T12-6 拆分（2026-09-12）：本文件退化为布局编排 View；区块组件见 ./components，
// 类型见 ./types；全部逻辑见 ../ruleList/useRuleListLogic，页面装配层见 ../RuleList。
import { AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { HeaderActions, RulesGrid, RuleModal, ImportModal, TemplateModal } from './components';
import type { RuleViewProps } from './types';

export type { RuleViewProps } from './types';

export default function RuleView(props: RuleViewProps) {
  const { loadError, error, setError, fetchRules } = props;

  return (
    <div className='max-w-7xl mx-auto'>
      {loadError && !error && (
        <div className='mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            分类/模板数据加载失败，部分功能可能不可用，请刷新重试
          </p>
        </div>
      )}
      <HeaderActions {...props} />
      <RulesGrid {...props} />

      {error && (
        <div className='mb-6 p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 flex items-center gap-3'>
          <AlertCircle className='w-5 h-5' />
          <span>{error}</span>
          <button
            onClick={() => {
              setError(null);
              fetchRules();
            }}
            className='ml-auto text-danger-600 hover:text-danger-800'
          >
            <RefreshCw className='w-4 h-4' />
          </button>
        </div>
      )}

      <RuleModal {...props} />
      <ImportModal {...props} />
      <TemplateModal {...props} />
    </div>
  );
}
