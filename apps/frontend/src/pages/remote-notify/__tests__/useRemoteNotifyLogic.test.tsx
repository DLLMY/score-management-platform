import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../context/ToastContext';
import { useRemoteNotifyLogic } from '../useRemoteNotifyLogic';
import {
  DEFAULT_NOTIFY_FORM,
  DEFAULT_SCORE_FORM,
  DEFAULT_SCHEDULED_FORM,
  type RemoteNotifyDraft,
} from '../types';

const DRAFT_KEY = 'draft_remote-notify';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    mqtt: {
      getStatus: vi.fn(() => Promise.resolve({ connected: true, message: 'ok' })),
    },
    notifyTemplates: {
      getAll: vi.fn(() => Promise.resolve([])),
    },
    scheduledNotify: {
      getAll: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    },
    notifyHistory: {
      getAll: vi.fn(() => Promise.resolve({ data: [], total: 0 })),
      getStats: vi.fn(() =>
        Promise.resolve({
          total_count: 0,
          today_count: 0,
          week_count: 0,
          month_count: 0,
          success_count: 0,
          fail_count: 0,
          success_rate: 0,
        })
      ),
    },
    courseSchedules: {
      getNow: vi.fn(() =>
        Promise.resolve({
          is_during_class_time: false,
          any_in_session: false,
          in_session: false,
        })
      ),
    },
  },
}));

vi.mock('../../../services/api', () => ({
  default: mockApi,
  getAuthHeaders: vi.fn(() => ({})),
}));

vi.mock('../../../utils/logger', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function renderLogic() {
  return renderHook(() => useRemoteNotifyLogic(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <ToastProvider>{children}</ToastProvider>
    ),
  });
}

function seedDraft(draft: RemoteNotifyDraft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: draft, timestamp: Date.now() }));
}

const MEANINGFUL_DRAFT: RemoteNotifyDraft = {
  mode: 'broadcast',
  form: { ...DEFAULT_NOTIFY_FORM, text: '下课了同学们再见' },
  scoreForm: { ...DEFAULT_SCORE_FORM },
  scheduledForm: { ...DEFAULT_SCHEDULED_FORM },
  activeScheduledModal: false,
};

const EMPTY_DRAFT: RemoteNotifyDraft = {
  mode: 'broadcast',
  form: { ...DEFAULT_NOTIFY_FORM },
  scoreForm: { ...DEFAULT_SCORE_FORM },
  scheduledForm: { ...DEFAULT_SCHEDULED_FORM },
  activeScheduledModal: false,
};

describe('useRemoteNotifyLogic · 组合根装配', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('挂载即触发所有 loader 与 MQTT 探测，并装配完整 deps', async () => {
    const { result } = renderLogic();

    // 挂载副作用：模板/定时 loader + 班级实时状态(×2) + MQTT 状态探测
    await waitFor(() => {
      expect(mockApi.notifyTemplates.getAll).toHaveBeenCalled();
      expect(mockApi.scheduledNotify.getAll).toHaveBeenCalled();
      expect(mockApi.mqtt.getStatus).toHaveBeenCalled();
      expect(mockApi.courseSchedules.getNow).toHaveBeenCalled();
    });
    // 两处 useClassNowStatus 各拉一次
    expect(mockApi.courseSchedules.getNow).toHaveBeenCalledTimes(2);

    // 返回结构关键字段齐全
    expect(result.current).toHaveProperty('deps');
    expect(result.current).toHaveProperty('draftAvailable');
    expect(result.current).toHaveProperty('handleRestoreDraft');
    expect(result.current).toHaveProperty('handleDiscardDraft');
    expect(result.current).toHaveProperty('loadError');
    expect(result.current).toHaveProperty('openHistory');
    expect(result.current).toHaveProperty('mqttConnected');
    expect(result.current).toHaveProperty('scheduled');
    expect(result.current).toHaveProperty('scheduledPage');
    expect(result.current).toHaveProperty('setScheduledPage');
    expect(result.current).toHaveProperty('scheduledPerPage');

    // deps 透传契约关键字段齐全
    const d = result.current.deps;
    expect(d.mode).toBe('broadcast');
    expect(d.form).toEqual(DEFAULT_NOTIFY_FORM);
    expect(d.scoreForm).toEqual(DEFAULT_SCORE_FORM);
    expect(d.scheduledForm).toEqual(DEFAULT_SCHEDULED_FORM);
    expect(typeof d.handleSubmit).toBe('function');
    expect(typeof d.performSend).toBe('function');
    expect(typeof d.handleReset).toBe('function');
    expect(typeof d.handleUsePreset).toBe('function');
    expect(Array.isArray(d.templates)).toBe(true);
    expect(Array.isArray(d.scheduledNotifications)).toBe(true);
    expect(typeof d.showHistory).toBe('boolean');
    expect(Array.isArray(d.historyData)).toBe(true);
    expect(d.historyColumns).toHaveLength(4); // buildHistoryColumns 返回 4 列

    // 无草稿时不弹恢复条
    expect(result.current.draftAvailable).toBe(false);
  });

  it('存在有意义草稿 → 恢复条保留（isDraftMeaningful 命中 true 分支）', async () => {
    seedDraft(MEANINGFUL_DRAFT);
    const { result } = renderLogic();

    await waitFor(() => {
      expect(result.current.draftAvailable).toBe(true);
    });
    // 有意义草稿不会被静默清理
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });

  it('空草稿 → 静默清理（isDraftMeaningful 命中 false 分支 + clearDraft）', async () => {
    seedDraft(EMPTY_DRAFT);
    const { result } = renderLogic();

    // 先被 useAutoSave 标记为可用，随后组合根 effect 判定为空并清理
    await waitFor(() => {
      expect(result.current.draftAvailable).toBe(false);
    });
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('handleReset 经真实 deps 把发送表单重置为默认值', async () => {
    const { result } = renderLogic();

    await waitFor(() => {
      expect(mockApi.notifyTemplates.getAll).toHaveBeenCalled();
    });

    await act(async () => {
      result.current.deps.handleReset();
    });

    await waitFor(() => {
      expect(result.current.deps.form).toEqual(DEFAULT_NOTIFY_FORM);
    });
  });

  it('handleUsePreset 经真实 deps 合并预设到发送表单', async () => {
    const { result } = renderLogic();

    await waitFor(() => {
      expect(mockApi.notifyTemplates.getAll).toHaveBeenCalled();
    });

    await act(async () => {
      result.current.deps.handleUsePreset({
        name: '紧急会议',
        text: '请所有老师立即到会议室开会！',
        urgent: true,
      });
    });

    await waitFor(() => {
      expect(result.current.deps.form.text).toBe('请所有老师立即到会议室开会！');
      expect(result.current.deps.form.urgent).toBe(true);
    });
  });
});
