import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModelManagerTab } from '../ModelManagerTab';
import type { AlgorithmAnalysisDeps } from '../types';

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

const baseDeps = {
  modelTrainingData: {} as Record<string, unknown>,
  modelEvaluationData: {} as Record<string, unknown>,
  trainingModel: null as string | null,
  evaluatingModel: null as string | null,
  trainRuleModel: noop,
  evaluateRuleModel: noop,
  trainScoreModel: noop,
  evaluateScoreModel: noop,
  trainRiskModel: noop,
  evaluateRiskModel: noop,
};

function renderWith(overrides: Partial<typeof baseDeps> = {}) {
  const deps = { ...baseDeps, ...overrides } as unknown as AlgorithmAnalysisDeps;
  return render(<ModelManagerTab deps={deps} />);
}

describe('ModelManagerTab', () => {
  it('三模型段标题 + 6 个按钮默认文本（训练模型 / 评估模型）', () => {
    renderWith();
    expect(screen.getByText('规则推荐模型')).toBeInTheDocument();
    expect(screen.getByText('成绩预测模型')).toBeInTheDocument();
    expect(screen.getByText('风险预测模型')).toBeInTheDocument();
    expect(screen.getAllByText('训练模型').length).toBe(3);
    expect(screen.getAllByText('评估模型').length).toBe(3);
  });

  it('训练规则模型按钮 → trainRuleModel(90)', () => {
    const trainRuleModel = vi.fn();
    renderWith({ trainRuleModel });
    const btns = screen.getAllByText('训练模型');
    fireEvent.click(btns[0]);
    expect(trainRuleModel).toHaveBeenCalledWith(90);
  });

  it('评估规则模型按钮 → evaluateRuleModel(30)', () => {
    const evaluateRuleModel = vi.fn();
    renderWith({ evaluateRuleModel });
    const btns = screen.getAllByText('评估模型');
    fireEvent.click(btns[0]);
    expect(evaluateRuleModel).toHaveBeenCalledWith(30);
  });

  it('训练成绩预测模型按钮 → trainScoreModel(90)', () => {
    const trainScoreModel = vi.fn();
    renderWith({ trainScoreModel });
    const btns = screen.getAllByText('训练模型');
    fireEvent.click(btns[1]);
    expect(trainScoreModel).toHaveBeenCalledWith(90);
  });

  it('训练风险预测模型按钮 → trainRiskModel(90)', () => {
    const trainRiskModel = vi.fn();
    renderWith({ trainRiskModel });
    const btns = screen.getAllByText('训练模型');
    fireEvent.click(btns[2]);
    expect(trainRiskModel).toHaveBeenCalledWith(90);
  });

  it('trainingModel=ruleRecommend：训练中... 且禁用', () => {
    renderWith({ trainingModel: 'ruleRecommend' });
    const trainingText = screen.getByText('训练中...');
    const btn = trainingText.closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getAllByText('训练模型').length).toBe(2);
  });

  it('evaluatingModel=scorePredict：评估中... 且禁用', () => {
    renderWith({ evaluatingModel: 'scorePredict' });
    const evaluatingText = screen.getByText('评估中...');
    const btn = evaluatingText.closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getAllByText('评估模型').length).toBe(2);
  });

  it('modelTrainingData 三模型 → 训练完成 + JSON', () => {
    const { container } = renderWith({
      modelTrainingData: {
        ruleRecommend: { status: 'success', message: 'ok' },
        scorePredict: { status: 'success', message: 'ok' },
        riskPredict: { status: 'success', message: 'ok' },
      },
    });
    expect(screen.getAllByText('训练完成').length).toBe(3);
    expect(container.textContent).toContain('"status": "success"');
  });

  it('modelEvaluationData 三模型 → 评估结果 + JSON', () => {
    renderWith({
      modelEvaluationData: {
        ruleRecommend: { accuracy: 0.9 },
        scorePredict: { accuracy: 0.8 },
        riskPredict: { accuracy: 0.7 },
      },
    });
    expect(screen.getAllByText('评估结果').length).toBe(3);
  });
});
