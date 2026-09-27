import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StudentProfileTab } from '../StudentProfileTab';
import type { AlgorithmAnalysisDeps, StudentProfileState, StudentOption } from '../types';
import type {
  PredictionResult,
  ScorePredictResult,
  AnomalyResult,
  RiskPredictResult,
  ScoreAttributionResult,
  EngagementResult,
} from '../../../types';

const noop = vi.fn();

const baseDeps: {
  students: StudentOption[];
  selectedProfileUserId: number | null;
  setSelectedProfileUserId: typeof noop;
  studentProfile: StudentProfileState | null;
  setStudentProfile: typeof noop;
  loadStudentProfile: typeof noop;
  profileLoading: boolean;
  profileError: string | null;
} = {
  students: [
    { id: 1, name: '张三', class_name: '一班' },
    { id: 2, name: '李四' },
  ],
  selectedProfileUserId: null,
  setSelectedProfileUserId: noop,
  studentProfile: null,
  setStudentProfile: noop,
  loadStudentProfile: noop,
  profileLoading: false,
  profileError: null,
};

function renderWith(overrides: Partial<typeof baseDeps> = {}) {
  const deps = { ...baseDeps, ...overrides } as unknown as AlgorithmAnalysisDeps;
  return render(<StudentProfileTab deps={deps} />);
}

// ── 各子结果 fixture ──
const prediction: PredictionResult = {
  name: '张三',
  current_score: 85,
  predicted_score: 90,
  trend: 'up',
  confidence: 0.8,
  confidence_interval: [80, 95],
};

const scorePredict: ScorePredictResult = {
  name: '张三',
  subject: '数学',
  current_score: 70,
  predicted_score: 60,
  trend: 'down',
  confidence: 0.6,
};

const riskHigh: RiskPredictResult = {
  name: '张三',
  risk_level: 'high',
  risk_score: 82,
  contributing_factors: ['逃课', '成绩下滑'],
  recommended_actions: ['约谈家长', '制定帮扶计划'],
  sub_risks: [
    { key: 'academic', name: '学业', level: 'high', score: 0.9, factors: ['数学不及格'] },
    { key: 'behavior', name: '行为', level: 'medium', score: 0.5, factors: ['迟到'] },
  ],
};

const riskLow: RiskPredictResult = {
  name: '张三',
  risk_level: 'low',
  risk_score: 12,
  contributing_factors: [],
  recommended_actions: [],
};

const anomalyHigh: AnomalyResult = {
  name: '综合异常',
  anomaly_type: 'overall',
  severity: 'high',
  description: '综合指标显著偏离',
  score_change: 5,
  detected_at: '2026-09-20',
};

const anomalyLowNoChange: AnomalyResult = {
  name: '低危无变化',
  anomaly_type: 'x',
  severity: 'low',
  description: '',
  score_change: 0,
  detected_at: '',
};

const engagementHigh: EngagementResult = {
  user_id: 1,
  days: 30,
  engagement_score: 88,
  level: 'high',
  factors: [],
  components: {
    attendance_rate: 0.95,
    homework_rate: 0.8,
    activity_rate: 0.7,
    leave_days: 3,
  },
  description: '',
  has_data: true,
};

const engagementNoData: EngagementResult = {
  user_id: 1,
  days: 30,
  engagement_score: 0,
  level: 'low',
  factors: [],
  components: {
    attendance_rate: null,
    homework_rate: null,
    activity_rate: 0,
    leave_days: 0,
  },
  description: '参与度数据缺失',
  has_data: false,
};

const attribution: ScoreAttributionResult = {
  name: '张三',
  has_data: true,
  total_change: 15,
  score_before: 70,
  score_after: 85,
  confidence: 0.7,
  summary: '成绩显著上升',
  factors: [
    {
      key: 'k1',
      name: '作业',
      contribution: 8,
      direction: 'positive',
      delta: 8,
      detail: '作业质量提升',
    },
    { key: 'k2', name: '出勤', contribution: -5, direction: 'negative', delta: -5, detail: '' },
    { key: 'k3', name: '课堂', contribution: 0, direction: 'neutral', delta: 0, detail: '' },
  ],
};

function profile(p: Partial<StudentProfileState>): StudentProfileState {
  return p as StudentProfileState;
}

describe('StudentProfileTab', () => {
  // ── 选择器 / 空态 / 错误态 ──
  it('空学生 + 无选择：渲染引导文案与默认选项', () => {
    renderWith({ students: [] });
    expect(screen.getByText('请选择一名学生查看其算法画像')).toBeInTheDocument();
    expect(screen.getByText('请选择学生...')).toBeInTheDocument();
  });

  it('profileError 显示错误信息', () => {
    renderWith({ profileError: '加载失败' });
    expect(screen.getByText('加载失败')).toBeInTheDocument();
  });

  it('selectedProfileUserId 存在但 profileLoading：显示加载态', () => {
    renderWith({ selectedProfileUserId: 1, profileLoading: true });
    expect(screen.getByText('加载学生画像中...')).toBeInTheDocument();
  });

  it('selectedProfileUserId 存在但 studentProfile 为空：仅渲染选择器', () => {
    const { container } = renderWith({ selectedProfileUserId: 1 });
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('1');
  });

  it('选择学生触发 setSelectedProfileUserId + setStudentProfile(null) + loadStudentProfile', () => {
    const setSelectedProfileUserId = vi.fn();
    const setStudentProfile = vi.fn();
    const loadStudentProfile = vi.fn();
    const { container } = renderWith({
      setSelectedProfileUserId,
      setStudentProfile,
      loadStudentProfile,
    });
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '1' } });
    expect(setSelectedProfileUserId).toHaveBeenCalledWith(1);
    expect(setStudentProfile).toHaveBeenCalledWith(null);
    expect(loadStudentProfile).toHaveBeenCalledWith(1);
  });

  it('选择「请选择学生」：id 为 null 不触发加载', () => {
    const setSelectedProfileUserId = vi.fn();
    const setStudentProfile = vi.fn();
    const loadStudentProfile = vi.fn();
    const { container } = renderWith({
      selectedProfileUserId: 1,
      setSelectedProfileUserId,
      setStudentProfile,
      loadStudentProfile,
    });
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '' } });
    expect(setSelectedProfileUserId).toHaveBeenCalledWith(null);
    expect(setStudentProfile).toHaveBeenCalledWith(null);
    expect(loadStudentProfile).not.toHaveBeenCalled();
  });

  it('学生选项含 class_name 括注', () => {
    renderWith();
    expect(screen.getByText('张三（一班）')).toBeInTheDocument();
    expect(screen.getByText('李四')).toBeInTheDocument();
  });

  // ── 积分 / 成绩预测卡片（renderScoreCard）──
  it('predict 全字段：趋势上升 + 区间 + 置信度', () => {
    const { container } = renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({ prediction }),
    });
    expect(screen.getByText('积分预测')).toBeInTheDocument();
    expect(container.textContent).toContain('85.0');
    expect(container.textContent).toContain('+5.0');
    expect(screen.getByText('上升')).toBeInTheDocument();
    expect(container.textContent).toContain('置信度 80%');
    expect(container.textContent).toContain('80.0 ~ 95.0');
    expect(container.querySelector('.text-green-600')).toBeTruthy();
  });

  it('predict 缺字段：current/predicted/confidence 兜底 0，trend 缺省显示 --', () => {
    const partial = {
      name: 'x',
      current_score: undefined as unknown as number,
      predicted_score: undefined as unknown as number,
      trend: undefined as unknown as 'up',
      confidence: undefined as unknown as number,
    };
    const { container } = renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({ prediction: partial as PredictionResult }),
    });
    expect(container.textContent).toContain('0.0');
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain('置信度 0%');
  });

  it('predict trend=up 但 predicted<cur：差值显示为负并红色', () => {
    const p = { ...prediction, current_score: 95, predicted_score: 90, trend: 'up' as const };
    const { container } = renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({ prediction: p }),
    });
    expect(container.textContent).toContain('-5.0');
    expect(container.querySelector('.text-red-600')).toBeTruthy();
  });

  it('scorePredict 下降趋势 + 缺省 stable', () => {
    const { container } = renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({ scorePredict }),
    });
    expect(screen.getByText('成绩预测')).toBeInTheDocument();
    expect(screen.getByText('下降')).toBeInTheDocument();
    expect(container.textContent).toContain('-10.0');
    expect(container.querySelector('.text-red-600')).toBeTruthy();

    const stable = { ...scorePredict, trend: 'stable' as const };
    const { unmount, container: c2 } = renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({ scorePredict: stable }),
    });
    expect(screen.getByText('稳定')).toBeInTheDocument();
    unmount();
    void c2;
  });

  // ── 风险评估 ──
  it('riskPredict high + sub_risks/factors/actions 全有', () => {
    const { container } = renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({ riskPredict: riskHigh }),
    });
    expect(screen.getByText('高风险')).toBeInTheDocument();
    expect(container.textContent).toContain('风险分 82.0');
    expect(screen.getByText('多维风险分')).toBeInTheDocument();
    expect(screen.getByText('学业')).toBeInTheDocument();
    expect(screen.getByText('行为')).toBeInTheDocument();
    expect(screen.getByText('风险因子')).toBeInTheDocument();
    expect(screen.getByText('逃课')).toBeInTheDocument();
    expect(screen.getByText('建议措施')).toBeInTheDocument();
    expect(screen.getByText('约谈家长')).toBeInTheDocument();
  });

  it('riskPredict low + 空 sub_risks/factors/actions：不渲染扩展块', () => {
    const { container } = renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({ riskPredict: riskLow }),
    });
    expect(screen.getByText('低风险')).toBeInTheDocument();
    expect(screen.queryByText('多维风险分')).toBeNull();
    expect(screen.queryByText('风险因子')).toBeNull();
    expect(screen.queryByText('建议措施')).toBeNull();
    expect(container.textContent).toContain('风险分 12.0');
  });

  it('riskPredict 缺省：显示暂无数据', () => {
    renderWith({ selectedProfileUserId: 1, studentProfile: profile({}) });
    expect(screen.getByText('暂无风险评估数据')).toBeInTheDocument();
  });

  // ── 参与度 ──
  it('engagement has_data + high + leave_days>0 + 三率', () => {
    const { container } = renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({ engagement: engagementHigh }),
    });
    expect(screen.getByText('高参与度')).toBeInTheDocument();
    expect(container.textContent).toContain('参与度分 88.0');
    expect(container.textContent).toContain('近 30 天请假 3 天');
    expect(screen.getByText('出勤率')).toBeInTheDocument();
    expect(screen.getByText('作业提交率')).toBeInTheDocument();
    expect(screen.getByText('积分活跃度')).toBeInTheDocument();
  });

  it('engagement has_data + attendance_rate=null：出勤率被过滤不渲染', () => {
    const eng = {
      ...engagementHigh,
      level: 'medium' as const,
      components: { attendance_rate: null, homework_rate: 0.8, activity_rate: 0.7, leave_days: 0 },
    };
    renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({ engagement: eng }),
    });
    expect(screen.getByText('中参与度')).toBeInTheDocument();
    expect(screen.queryByText('出勤率')).toBeNull();
    expect(screen.getByText('作业提交率')).toBeInTheDocument();
  });

  it('engagement has_data=false + description：显示 description', () => {
    renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({ engagement: engagementNoData }),
    });
    expect(screen.getByText('参与度数据缺失')).toBeInTheDocument();
  });

  it('engagement has_data=false 无 description：默认文案', () => {
    const eng = { ...engagementNoData, description: '' };
    renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({ engagement: eng }),
    });
    expect(screen.getByText('暂无参与度数据')).toBeInTheDocument();
  });

  it('engagement 缺省：默认文案', () => {
    renderWith({ selectedProfileUserId: 1, studentProfile: profile({}) });
    expect(screen.getByText('暂无参与度数据')).toBeInTheDocument();
  });

  // ── 异常检测（4 张卡片，renderAnomalyCard）──
  it('anomaly 完整 high + sudden medium + trend 缺失 + group low 无变化', () => {
    const { container } = renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({
        anomaly: anomalyHigh,
        sudden: {
          ...anomalyHigh,
          severity: 'medium',
          description: '突变',
          score_change: -3,
          detected_at: '',
        },
        trend: undefined,
        group: anomalyLowNoChange,
      }),
    });
    expect(screen.getByText('综合异常')).toBeInTheDocument();
    expect(screen.getByText('高')).toBeInTheDocument();
    expect(container.textContent).toContain('积分变化 +5.0');
    expect(screen.getByText('检测时间 2026-09-20')).toBeInTheDocument();
    expect(screen.getByText('突变检测')).toBeInTheDocument();
    expect(screen.getByText('中')).toBeInTheDocument();
    expect(container.textContent).toContain('积分变化 -3.0');
    expect(screen.getByText('趋势异常')).toBeInTheDocument();
    expect(screen.getByText('数据缺失')).toBeInTheDocument();
    expect(screen.getByText('群体偏离')).toBeInTheDocument();
    expect(screen.getByText('正常')).toBeInTheDocument();
  });

  it('anomaly 缺省：数据缺失卡片', () => {
    renderWith({ selectedProfileUserId: 1, studentProfile: profile({ anomaly: undefined }) });
    expect(screen.getAllByText('数据缺失').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText('该维度暂无检测数据').length).toBeGreaterThanOrEqual(4);
  });

  it('anomaly low 但 score_change!=0：显示低危 + 变化', () => {
    const lowChanged: AnomalyResult = {
      name: 'x',
      anomaly_type: 'x',
      severity: 'low',
      description: '轻微',
      score_change: -2,
      detected_at: '',
    };
    const { container } = renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({ anomaly: lowChanged }),
    });
    expect(screen.getByText('低')).toBeInTheDocument();
    expect(container.textContent).toContain('积分变化 -2.0');
  });

  // ── 成绩波动归因 ──
  it('attribution has_data + 三方向因子 + 净增', () => {
    const { container } = renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({ attribution }),
    });
    expect(screen.getByText('成绩波动归因')).toBeInTheDocument();
    expect(container.textContent).toContain('前期 70.0');
    expect(container.textContent).toContain('近期 85.0');
    expect(container.textContent).toContain('净变化 +15.0');
    expect(container.textContent).toContain('置信度 70%');
    expect(screen.getByText('作业')).toBeInTheDocument();
    expect(screen.getByText('作业质量提升')).toBeInTheDocument();
    expect(screen.getByText('出勤')).toBeInTheDocument();
    expect(container.querySelector('.text-green-600')).toBeTruthy();
    expect(container.querySelector('.text-red-600')).toBeTruthy();
    expect(container.querySelector('.bg-gray-400')).toBeTruthy();
  });

  it('attribution has_data=false 无 summary：默认文案', () => {
    renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({ attribution: { ...attribution, has_data: false, summary: '' } }),
    });
    expect(screen.getByText('暂无归因数据')).toBeInTheDocument();
  });

  it('attribution has_data=false 含 summary：显示 summary', () => {
    renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({ attribution: { ...attribution, has_data: false } }),
    });
    expect(screen.getByText('成绩显著上升')).toBeInTheDocument();
  });

  it('attribution 缺省：默认文案', () => {
    renderWith({ selectedProfileUserId: 1, studentProfile: profile({}) });
    expect(screen.getByText('暂无归因数据')).toBeInTheDocument();
  });

  // ── 完整画像集成 ──
  it('完整 studentProfile：渲染所有区块', () => {
    const { container } = renderWith({
      selectedProfileUserId: 1,
      studentProfile: profile({
        prediction,
        scorePredict,
        riskPredict: riskHigh,
        engagement: engagementHigh,
        anomaly: anomalyHigh,
        attribution,
      }),
    });
    expect(screen.getByText('风险评估')).toBeInTheDocument();
    expect(screen.getByText('参与度指数')).toBeInTheDocument();
    expect(screen.getByText('异常检测')).toBeInTheDocument();
    expect(container.textContent).toContain('张三');
    expect(container.textContent).toContain('一班');
  });
});
