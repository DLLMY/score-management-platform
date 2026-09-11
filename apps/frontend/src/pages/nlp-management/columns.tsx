import type { ColumnType } from '../../components';
import type {
  Rule,
  MLAlgorithmResult,
  MLTrainAllResult,
  PerformanceRow,
  NlpCorrection,
} from './types';

/**
 * NLPManagement 表格列定义（E6a 抽取：纯渲染配置，无业务逻辑）。
 * 原为 NLPScoringManagement 内的 4 个 useMemo，行为完全一致；
 * 仅 `trainingResultColumns` 依赖 trainAllResult（用于高亮「最佳」算法），
 * 故以工厂函数参数传入，调用方仍用 useMemo 包裹以保持引用稳定。
 */

// —— 规则表格列定义 ——
export function buildRuleColumns(): ColumnType<Rule>[] {
  return [
    {
      title: '关键词',
      key: 'behavior_keyword',
      dataIndex: 'behavior_keyword',
      render: (value) => (
        <span className='text-sm font-medium text-gray-800'>{String(value ?? '')}</span>
      ),
    },
    {
      title: '描述',
      key: 'behavior_description',
      dataIndex: 'behavior_description',
      render: (value) => <span className='text-sm text-gray-600'>{String(value ?? '')}</span>,
    },
    {
      title: '分数',
      key: 'score_value',
      dataIndex: 'score_value',
      render: (_, rule) => (
        <span
          className={`text-sm font-semibold ${
            rule.score_type === 'add' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {rule.score_type === 'add' ? '+' : ''}
          {rule.score_value}
        </span>
      ),
    },
    {
      title: '类型',
      key: 'score_type',
      dataIndex: 'score_type',
      render: (value) => {
        const scoreType = String(value ?? '');
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs ${
              scoreType === 'add' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}
          >
            {scoreType === 'add' ? '加分' : '扣分'}
          </span>
        );
      },
    },
    {
      title: '标签',
      key: 'behavior_tags',
      dataIndex: 'behavior_tags',
      render: (value) => (
        <>
          {(value as string[])?.map((tag, i) => (
            <span key={i} className='px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs mr-1'>
              {tag}
            </span>
          ))}
        </>
      ),
    },
    {
      title: '使用次数',
      key: 'usage_count',
      dataIndex: 'usage_count',
      render: (value) => <span className='text-sm text-gray-600'>{String(value ?? '')}</span>,
    },
    {
      title: '准确率',
      key: 'accuracy_rate',
      dataIndex: 'accuracy_rate',
      render: (value) => (
        <span className='text-sm text-gray-600'>
          {value != null ? `${(Number(value) * 100).toFixed(1)}%` : '--'}
        </span>
      ),
    },
  ];
}

// —— 训练对比表格列定义 ——
export function buildTrainingResultColumns(
  trainAllResult: MLTrainAllResult | null
): ColumnType<MLAlgorithmResult>[] {
  return [
    {
      title: '算法',
      key: 'algorithm',
      dataIndex: 'algorithm_name',
      render: (value, result) => (
        <>
          <span className='font-medium'>{String(value)}</span>
          {trainAllResult?.best_algorithm === result.algorithm && (
            <span className='ml-2 px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded'>
              最佳
            </span>
          )}
        </>
      ),
    },
    {
      title: '准确率',
      key: 'accuracy',
      align: 'right',
      render: (_, result) => (
        <span>{result.evaluation ? `${(result.evaluation.accuracy * 100).toFixed(1)}%` : '-'}</span>
      ),
    },
    {
      title: '精确率',
      key: 'precision',
      align: 'right',
      render: (_, result) => (
        <span>
          {result.evaluation ? `${(result.evaluation.precision * 100).toFixed(1)}%` : '-'}
        </span>
      ),
    },
    {
      title: '召回率',
      key: 'recall',
      align: 'right',
      render: (_, result) => (
        <span>{result.evaluation ? `${(result.evaluation.recall * 100).toFixed(1)}%` : '-'}</span>
      ),
    },
    {
      title: 'F1分数',
      key: 'f1_score',
      align: 'right',
      render: (_, result) => (
        <span className='font-medium'>
          {result.evaluation ? `${(result.evaluation.f1_score * 100).toFixed(1)}%` : '-'}
        </span>
      ),
    },
    {
      title: '交叉验证F1',
      key: 'cross_validation',
      align: 'right',
      render: (_, result) => (
        <span>
          {result.cross_validation ? `${(result.cross_validation.mean_f1 * 100).toFixed(1)}%` : '-'}
        </span>
      ),
    },
  ];
}

// —— 组件性能表格列定义 ——
export function buildPerformanceColumns(): ColumnType<PerformanceRow>[] {
  return [
    {
      title: '组件',
      key: 'name',
      dataIndex: 'name',
      render: (value) => <span className='text-sm font-medium text-gray-800'>{String(value)}</span>,
    },
    {
      title: '调用次数',
      key: 'calls',
      align: 'right',
      render: (_, record) => (
        <span className='text-sm text-gray-600'>{record.stats.calls ?? '--'}</span>
      ),
    },
    {
      title: '平均耗时',
      key: 'avg_time',
      align: 'right',
      render: (_, record) => (
        <span
          className={`text-sm ${
            record.stats.avg_time != null && record.stats.avg_time > 0.1
              ? 'text-red-600'
              : 'text-gray-600'
          }`}
        >
          {record.stats.avg_time != null ? `${(record.stats.avg_time * 1000).toFixed(2)}ms` : '--'}
        </span>
      ),
    },
    {
      title: '错误率',
      key: 'error_rate',
      align: 'right',
      render: (_, record) => (
        <span
          className={`text-sm ${
            record.stats.error_rate != null && record.stats.error_rate > 0.05
              ? 'text-red-600'
              : 'text-gray-600'
          }`}
        >
          {record.stats.error_rate != null
            ? `${(record.stats.error_rate * 100).toFixed(2)}%`
            : '--'}
        </span>
      ),
    },
  ];
}

// —— 纠正记录表格列定义 ——
export function buildCorrectionColumns(): ColumnType<NlpCorrection>[] {
  return [
    {
      title: '原文',
      key: 'original_text',
      dataIndex: 'original_text',
      width: 200,
      ellipsis: true,
      render: (value) => (
        <span title={value ? String(value) : undefined} className='text-sm text-gray-800'>
          {String(value ?? '')}
        </span>
      ),
    },
    {
      title: '字段',
      key: 'field_type',
      dataIndex: 'field_type',
      render: (value) => {
        const fieldType = String(value ?? '');
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs ${
              fieldType === 'name'
                ? 'bg-blue-100 text-blue-600'
                : fieldType === 'intent'
                ? 'bg-green-100 text-green-600'
                : fieldType === 'score'
                ? 'bg-yellow-100 text-yellow-600'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {fieldType === 'name'
              ? '姓名'
              : fieldType === 'intent'
              ? '意图'
              : fieldType === 'score'
              ? '分数'
              : fieldType}
          </span>
        );
      },
    },
    {
      title: '原值',
      key: 'original_value',
      dataIndex: 'original_value',
      render: (value) => (
        <span className='text-sm text-gray-600'>{value ? String(value) : '-'}</span>
      ),
    },
    {
      title: '纠正值',
      key: 'corrected_value',
      dataIndex: 'corrected_value',
      render: (value) => (
        <span className='text-sm font-medium text-blue-600'>{value ? String(value) : '-'}</span>
      ),
    },
    {
      title: '状态',
      key: 'status',
      dataIndex: 'status',
      render: (value) => {
        const status = String(value ?? '');
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs ${
              status === 'pending'
                ? 'bg-yellow-100 text-yellow-600'
                : status === 'verified'
                ? 'bg-green-100 text-green-600'
                : status === 'learned'
                ? 'bg-purple-100 text-purple-600'
                : status === 'rejected'
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {status === 'pending'
              ? '待验证'
              : status === 'verified'
              ? '已验证'
              : status === 'learned'
              ? '已学习'
              : status === 'rejected'
              ? '已拒绝'
              : status}
          </span>
        );
      },
    },
    {
      title: '学习次数',
      key: 'learn_count',
      dataIndex: 'learn_count',
      render: (value) => <span className='text-sm text-gray-600'>{value ? Number(value) : 0}</span>,
    },
  ];
}
