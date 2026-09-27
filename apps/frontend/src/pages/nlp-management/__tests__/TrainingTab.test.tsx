import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TrainingTab } from '../TrainingTab';
import { buildTrainingResultColumns } from '../columns';
import type {
  NLPDeps,
  MLAlgorithm,
  ModelEvaluation,
  MLTrainingResult,
  MLTrainAllResult,
  MLEvaluationAllResult,
  TrainingRecord,
} from '../types';

// 测试环境下 usePermissions 默认返回 loading/无权限 → PermissionButton 渲染 disabled 按钮，
// fireEvent.click 不触发 onClick。此处注入 isSuperAdmin:true 使按钮真实可点击。
vi.mock('../../../hooks', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    usePermissions: () => ({
      permissions: [],
      roles: [],
      isLoading: false,
      error: null,
      adminInfo: null,
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
      isSuperAdmin: true,
      isAdmin: false,
      reload: () => {},
    }),
  };
});

const noop = vi.fn();
const trainingResultColumns = [] as any;

const baseDeps: {
  handleEvaluateAllModels: typeof noop;
  isEvaluatingAll: boolean;
  handleTrainAllModels: typeof noop;
  isTraining: boolean;
  handleTrainModel: typeof noop;
  selectedAlgorithm: string;
  setSelectedAlgorithm: typeof noop;
  algorithms: MLAlgorithm[];
  useCrossValidation: boolean;
  setUseCrossValidation: typeof noop;
  modelEvaluation: ModelEvaluation | null;
  trainingResult: MLTrainingResult | null;
  trainAllResult: MLTrainAllResult | null;
  evaluationAllResult: MLEvaluationAllResult | null;
  trainingResultColumns: typeof trainingResultColumns;
  trainingHistory: TrainingRecord[];
} = {
  handleEvaluateAllModels: noop,
  isEvaluatingAll: false,
  handleTrainAllModels: noop,
  isTraining: false,
  handleTrainModel: noop,
  selectedAlgorithm: '',
  setSelectedAlgorithm: noop,
  algorithms: [],
  useCrossValidation: false,
  setUseCrossValidation: noop,
  modelEvaluation: null,
  trainingResult: null,
  trainAllResult: null,
  evaluationAllResult: null,
  trainingResultColumns,
  trainingHistory: [],
};

function renderWith(overrides: Partial<typeof baseDeps> = {}) {
  const deps = { ...baseDeps, ...overrides } as unknown as NLPDeps;
  return render(<TrainingTab deps={deps} />);
}

const algorithms: MLAlgorithm[] = [
  { value: 'svm', label: '支持向量机' },
  { value: 'xgb', label: 'XGBoost' },
];

const modelEval: ModelEvaluation = {
  accuracy_rate: 0.9,
  precision: null as any,
  recall: 0.8,
  f1_score: null as any,
  total_samples: 100,
  correct_count: 90,
  incorrect_count: 10,
};

const trainingResult: MLTrainingResult = {
  success: true,
  algorithm: 'svm',
  algorithm_name: 'SVM',
  training_data_count: 500,
  evaluation: { accuracy: 0.92, precision: 0.9, recall: 0.88, f1_score: 0.9 },
  message: 'ok',
};

const trainAllResult: MLTrainAllResult = {
  success: true,
  results: [
    {
      algorithm: 'svm',
      algorithm_name: 'SVM',
      evaluation: { accuracy: 0.92, precision: 0.9, recall: 0.88, f1_score: 0.9 },
      cross_validation: { mean_f1: 0.9, std_f1: 0.02, min_f1: 0.85, max_f1: 0.95 },
    },
    {
      algorithm: 'xgb',
      algorithm_name: 'XGBoost',
      evaluation: { accuracy: 0.88, precision: 0.85, recall: 0.82, f1_score: 0.84 },
      cross_validation: { mean_f1: 0.84, std_f1: 0.03, min_f1: 0.8, max_f1: 0.9 },
    },
  ],
  best_algorithm: 'svm',
  best_algorithm_name: 'SVM',
  best_f1: 0.9,
  training_data_count: 500,
  message: 'ok',
};

const evaluationAllResult: MLEvaluationAllResult = {
  success: true,
  results: [
    {
      algorithm: 'rf',
      algorithm_name: '随机森林',
      evaluation: { accuracy: 0.8, precision: 0.78, recall: 0.76, f1_score: 0.77 },
      cross_validation: { mean_f1: 0.77, std_f1: 0.01, min_f1: 0.75, max_f1: 0.8 },
    },
  ],
  total_data_count: 400,
};

const history: TrainingRecord[] = [
  {
    id: 1,
    training_version: 'v1.0',
    training_data_count: 500,
    accuracy_before: 0.7,
    accuracy_after: 0.9,
    accuracy: 0.9,
    precision: 0.88,
    recall: 0.85,
    f1_score: 0.86,
    training_status: 'completed',
    training_start_at: '2024-01-01',
    training_end_at: '2024-01-02',
    algorithm_type: 'auto_svm',
  },
  {
    id: 2,
    training_version: 'v1.1',
    training_data_count: 500,
    accuracy_before: 0.6,
    accuracy_after: 0.7,
    accuracy: 0.7,
    precision: 0.68,
    recall: 0.65,
    f1_score: 0.66,
    training_status: 'failed',
    training_start_at: '2024-01-03',
    training_end_at: '2024-01-04',
    algorithm_type: 'xgb',
  },
  {
    id: 3,
    training_version: 'v1.2',
    training_data_count: 500,
    accuracy_before: 0.5,
    accuracy_after: 0.6,
    accuracy: 0.6,
    precision: 0.58,
    recall: 0.55,
    f1_score: 0.56,
    training_status: 'running',
    training_start_at: '2024-01-05',
    training_end_at: '2024-01-06',
    algorithm_type: 'rf',
  },
  {
    id: 4,
    training_version: 'v1.3',
    training_data_count: 500,
    accuracy_before: 0.4,
    accuracy_after: 0.5,
    accuracy: null as any,
    precision: 0.48,
    recall: 0.45,
    f1_score: null as any,
    training_status: '',
    training_start_at: '2024-01-07',
    training_end_at: '2024-01-08',
    algorithm_type: undefined,
  },
];

describe('TrainingTab', () => {
  it('isEvaluatingAll=true：评估按钮显示评估中...', () => {
    renderWith({ isEvaluatingAll: true });
    expect(screen.getByText('评估中...')).toBeInTheDocument();
    expect(screen.queryByText('评估所有算法')).toBeNull();
  });

  it('isTraining=true：两个训练按钮均显示训练中...', () => {
    const { container } = renderWith({ isTraining: true });
    const spins = container.querySelectorAll('.animate-spin');
    expect(spins.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('开始训练')).toBeNull();
    expect(screen.queryByText('自动选择最佳算法')).toBeNull();
  });

  it('algorithms：渲染下拉选项', () => {
    renderWith({ algorithms });
    expect(screen.getByText('支持向量机')).toBeInTheDocument();
    expect(screen.getByText('XGBoost')).toBeInTheDocument();
    expect(screen.getByText('自动选择')).toBeInTheDocument();
  });

  it('完整渲染：评估/训练/对比表/历史全部区块', () => {
    const { container } = renderWith({
      algorithms,
      modelEvaluation: modelEval,
      trainingResult,
      trainAllResult,
      trainingHistory: history,
    });
    // 模型评估（precision/f1 为 null → --）
    expect(screen.getByText('模型训练')).toBeInTheDocument();
    expect(container.textContent).toContain('90.0%'); // accuracy_rate
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(2);
    // 训练结果
    expect(screen.getByText('训练结果')).toBeInTheDocument();
    expect(screen.getByText('SVM')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument(); // training_data_count
    expect(container.textContent).toContain('92.0%'); // evaluation.accuracy
    expect(container.textContent).toContain('90.0%'); // evaluation.f1_score
    // 算法对比表（best_algorithm=svm 高亮）
    expect(screen.getByText('算法对比')).toBeInTheDocument();
    expect(container.querySelector('.bg-green-50')).toBeTruthy();
    // 训练历史：四态
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('失败')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.getByText('未知')).toBeInTheDocument();
    // 算法类型 badge（auto_ 前缀 stripped）
    expect(screen.getByText('svm')).toBeInTheDocument();
    expect(screen.getByText('xgb')).toBeInTheDocument();
    expect(screen.getByText('rf')).toBeInTheDocument();
    // 无算法类型 → 无 badge（仅文本）
    expect(screen.queryByText('auto_')).toBeNull();
    // accuracy/f1 null → N/A
    expect(container.textContent).toContain('N/A');
    // 无 training_data_size → --
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(1);
  });

  it('仅 evaluationAllResult：对比表使用评估数据', () => {
    const { container } = renderWith({
      evaluationAllResult,
      trainingResultColumns: buildTrainingResultColumns(null),
    });
    expect(screen.getByText('算法对比')).toBeInTheDocument();
    expect(screen.getByText('随机森林')).toBeInTheDocument();
    expect(container.querySelector('.bg-green-50')).toBeNull(); // 无 trainAllResult 不高亮
  });

  it('modelEvaluation=null：不渲染评估指标块', () => {
    renderWith({ modelEvaluation: null });
    expect(screen.queryByText('准确率')).toBeNull();
  });

  it('trainingResult=null：不渲染训练结果块', () => {
    renderWith({ trainingResult: null });
    expect(screen.queryByText('训练结果')).toBeNull();
  });

  it('trainAllResult 与 evaluationAllResult 均为 null：不渲染对比表', () => {
    renderWith({ trainAllResult: null, evaluationAllResult: null });
    expect(screen.queryByText('算法对比')).toBeNull();
  });

  it('操作回调：评估/训练全部/开始训练 各自触发', () => {
    const evalAll = vi.fn();
    const trainAll = vi.fn();
    const trainModel = vi.fn();
    renderWith({
      handleEvaluateAllModels: evalAll,
      handleTrainAllModels: trainAll,
      handleTrainModel: trainModel,
    });
    fireEvent.click(screen.getByText('评估所有算法'));
    expect(evalAll).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('自动选择最佳算法'));
    expect(trainAll).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('开始训练'));
    expect(trainModel).toHaveBeenCalledTimes(1);
  });

  it('选择算法下拉变更 / 交叉验证勾选：触发对应 setter', () => {
    const setAlgo = vi.fn();
    const setCv = vi.fn();
    renderWith({
      algorithms,
      selectedAlgorithm: 'svm',
      useCrossValidation: false,
      setSelectedAlgorithm: setAlgo,
      setUseCrossValidation: setCv,
    });
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'xgb' } });
    expect(setAlgo).toHaveBeenCalledWith('xgb');
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(setCv).toHaveBeenCalledWith(true);
  });
});
