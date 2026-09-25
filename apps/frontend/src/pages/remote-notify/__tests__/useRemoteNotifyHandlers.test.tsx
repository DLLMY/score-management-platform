import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRemoteNotifyHandlers } from '../useRemoteNotifyHandlers';
import type { RemoteNotifySharedDeps } from '../useRemoteNotifyHandlers';
import type { NotifyTemplate } from '../../../services/api';
import {
  DEFAULT_NOTIFY_FORM,
  DEFAULT_SCORE_FORM,
  DEFAULT_SCHEDULED_FORM,
  DEFAULT_TEMPLATE_FORM,
  QUICK_PRESETS,
  type RemoteNotifyDraft,
} from '../types';

const { mockApi, mockShowToast, mockConfirm } = vi.hoisted(() => ({
  mockApi: {
    mqtt: { getStatus: vi.fn() },
    notifyHistory: { clean: vi.fn() },
    remoteNotify: {
      broadcast: vi.fn(),
      sendToDevice: vi.fn(),
      scoreChange: vi.fn(),
      preview: vi.fn(),
      test: vi.fn(),
    },
    notifyTemplates: { update: vi.fn(), create: vi.fn(), delete: vi.fn() },
    scheduledNotify: {
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      cancel: vi.fn(),
      trigger: vi.fn(),
    },
  },
  mockShowToast: vi.fn(),
  // 默认 false：避免 performSend 失败重试分支递归（retry 仅在 ok 时重发）
  mockConfirm: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('../../../services/api', () => ({
  default: mockApi,
  getAuthHeaders: vi.fn(() => ({})),
}));

// 仅类型导入 + 单个值导入（useStableToast 运行时未调用），提供 mock 以隔离模块图
vi.mock('../../../hooks', () => ({ useStableToast: vi.fn() }));
vi.mock('../../../components', () => ({ useConfirm: vi.fn() }));
vi.mock('../../../utils/logger', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeDeps(overrides: Partial<RemoteNotifySharedDeps> = {}): RemoteNotifySharedDeps {
  return {
    showToast: mockShowToast,
    mode: 'broadcast',
    setMode: vi.fn(),
    setIsSending: vi.fn(),
    setLastResult: vi.fn(),
    setMqttConnected: vi.fn(),
    forceSend: false,
    scheduledForceSend: false,
    setPreviewConfirm: vi.fn(),
    confirmRef: { current: mockConfirm },
    form: { ...DEFAULT_NOTIFY_FORM },
    setForm: vi.fn(),
    scoreForm: { ...DEFAULT_SCORE_FORM },
    setScoreForm: vi.fn(),
    templateForm: { ...DEFAULT_TEMPLATE_FORM },
    editingTemplate: null,
    loadTemplates: vi.fn(),
    closeTemplateModal: vi.fn(),
    loadScheduledNotifications: vi.fn(),
    scheduledForm: { ...DEFAULT_SCHEDULED_FORM },
    setScheduledForm: vi.fn(),
    openScheduledModal: vi.fn(),
    closeScheduledModal: vi.fn(),
    editingScheduled: null,
    setEditingScheduled: vi.fn(),
    clearDraft: vi.fn(),
    restoreDraft: vi.fn((): RemoteNotifyDraft | null => null),
    discardChanges: vi.fn(),
    historyList: { refetch: vi.fn() } as unknown as RemoteNotifySharedDeps['historyList'],
    historyStatsFetch: { refetch: vi.fn() },
    ...overrides,
  };
}

describe('useRemoteNotifyHandlers · 16 处理器', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowToast.mockClear();
    mockConfirm.mockResolvedValue(false);
    mockApi.mqtt.getStatus.mockResolvedValue({ connected: true });
    mockApi.remoteNotify.broadcast.mockResolvedValue({
      success: true,
      message: '已广播',
      topic: 't',
    });
    mockApi.remoteNotify.sendToDevice.mockResolvedValue({
      success: true,
      message: '已发送',
      topic: 't',
    });
    mockApi.remoteNotify.scoreChange.mockResolvedValue({
      success: true,
      message: '已扣分',
      topic: 't',
    });
    mockApi.remoteNotify.preview.mockResolvedValue({ online: [], count: 0 });
    mockApi.remoteNotify.test.mockResolvedValue({ success: true, message: '测试成功', topic: '' });
    mockApi.notifyHistory.clean.mockResolvedValue({ success: true });
    mockApi.notifyTemplates.create.mockResolvedValue({ success: true });
    mockApi.notifyTemplates.update.mockResolvedValue({ success: true });
    mockApi.notifyTemplates.delete.mockResolvedValue({ success: true });
    mockApi.scheduledNotify.create.mockResolvedValue({ success: true });
    mockApi.scheduledNotify.update.mockResolvedValue({ success: true });
    mockApi.scheduledNotify.delete.mockResolvedValue({ success: true });
    mockApi.scheduledNotify.cancel.mockResolvedValue({ success: true });
    mockApi.scheduledNotify.trigger.mockResolvedValue({ success: true });
  });

  // ---- 草稿 ----
  it('handleRestoreDraft(draft=null) → 直接返回，不触碰 setter', () => {
    const deps = makeDeps({ restoreDraft: vi.fn(() => null) });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    result.current.handleRestoreDraft();
    expect(deps.setMode).not.toHaveBeenCalled();
    expect(deps.setForm).not.toHaveBeenCalled();
  });

  it('handleRestoreDraft(含 draft，无 activeScheduledModal) → 还原三表单', () => {
    const deps = makeDeps({
      restoreDraft: vi.fn((): RemoteNotifyDraft | null => ({
        mode: 'test',
        form: { ...DEFAULT_NOTIFY_FORM, text: 'hi' },
        scoreForm: { ...DEFAULT_SCORE_FORM, student_name: 'x' },
        scheduledForm: { ...DEFAULT_SCHEDULED_FORM, text: 's' },
        activeScheduledModal: false,
      })),
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    result.current.handleRestoreDraft();
    expect(deps.setMode).toHaveBeenCalledWith('test');
    expect(deps.setForm).toHaveBeenCalledWith(expect.objectContaining({ text: 'hi' }));
    expect(deps.setScoreForm).toHaveBeenCalledWith(expect.objectContaining({ student_name: 'x' }));
    expect(deps.setScheduledForm).toHaveBeenCalledWith(expect.objectContaining({ text: 's' }));
    expect(deps.openScheduledModal).not.toHaveBeenCalled();
  });

  it('handleRestoreDraft(activeScheduledModal=true) → 额外关编辑 + 开定时弹窗', () => {
    const deps = makeDeps({
      restoreDraft: vi.fn((): RemoteNotifyDraft | null => ({
        mode: 'broadcast',
        form: { ...DEFAULT_NOTIFY_FORM },
        scoreForm: { ...DEFAULT_SCORE_FORM },
        scheduledForm: { ...DEFAULT_SCHEDULED_FORM },
        activeScheduledModal: true,
      })),
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    result.current.handleRestoreDraft();
    expect(deps.setEditingScheduled).toHaveBeenCalledWith(null);
    expect(deps.openScheduledModal).toHaveBeenCalled();
  });

  it('handleDiscardDraft → 调 discardChanges', () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    result.current.handleDiscardDraft();
    expect(deps.discardChanges).toHaveBeenCalled();
  });

  // ---- MQTT 状态 ----
  it('checkMqttStatus(在线) → setMqttConnected(true)', async () => {
    mockApi.mqtt.getStatus.mockResolvedValue({ connected: true });
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.checkMqttStatus();
    });
    expect(deps.setMqttConnected).toHaveBeenCalledWith(true);
  });

  it('checkMqttStatus(异常) → setMqttConnected(false)', async () => {
    mockApi.mqtt.getStatus.mockRejectedValue(new Error('down'));
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.checkMqttStatus();
    });
    expect(deps.setMqttConnected).toHaveBeenCalledWith(false);
  });

  // ---- 清理历史 ----
  it('handleCleanHistory(取消) → 不调用接口', async () => {
    mockConfirm.mockResolvedValue(false);
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleCleanHistory();
    });
    expect(mockApi.notifyHistory.clean).not.toHaveBeenCalled();
  });

  it('handleCleanHistory(确认) → 清理 + 双 refetch + 成功提示', async () => {
    mockConfirm.mockResolvedValue(true);
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleCleanHistory();
    });
    expect(mockApi.notifyHistory.clean).toHaveBeenCalledWith(30);
    expect(deps.historyList.refetch).toHaveBeenCalled();
    expect(deps.historyStatsFetch.refetch).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('success', '历史记录已清理');
  });

  it('handleCleanHistory(接口异常) → 错误提示', async () => {
    mockConfirm.mockResolvedValue(true);
    mockApi.notifyHistory.clean.mockRejectedValue(new Error('x'));
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleCleanHistory();
    });
    expect(mockShowToast).toHaveBeenCalledWith('error', '清理失败');
  });

  // ---- performSend ----
  it('performSend(broadcast 成功) → 清草稿 + 置空文本 + 查 MQ', async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.performSend(
        { text: 'x', speak: true, popup: true, timeout_sec: 8, urgent: false, force_send: false },
        'broadcast'
      );
    });
    expect(mockApi.remoteNotify.broadcast).toHaveBeenCalled();
    expect(deps.setLastResult).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(mockShowToast).toHaveBeenCalledWith('success', '已广播');
    expect(deps.clearDraft).toHaveBeenCalled();
    expect(deps.setForm).toHaveBeenCalled();
    const resetUpdater = (deps.setForm as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(typeof resetUpdater).toBe('function');
    expect(resetUpdater({ text: 'x' })).toEqual(expect.objectContaining({ text: '' }));
    expect(deps.setIsSending).toHaveBeenLastCalledWith(false);
    expect(mockApi.mqtt.getStatus).toHaveBeenCalled();
  });

  it('performSend(device 成功) → 调 sendToDevice(deviceId, notifyData)', async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.performSend(
        { text: 'x', speak: true, popup: true, timeout_sec: 8, urgent: false, force_send: false },
        'device',
        'dev-1'
      );
    });
    expect(mockApi.remoteNotify.sendToDevice).toHaveBeenCalledWith(
      'dev-1',
      expect.objectContaining({ text: 'x' })
    );
  });

  it('performSend(失败) → 错误提示 + 重试确认', async () => {
    mockApi.remoteNotify.broadcast.mockResolvedValue({
      success: false,
      message: 'busy',
      topic: '',
    });
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.performSend(
        { text: 'x', speak: true, popup: true, timeout_sec: 8, urgent: false, force_send: false },
        'broadcast'
      );
    });
    expect(mockShowToast).toHaveBeenCalledWith('error', 'busy');
    expect(mockConfirm).toHaveBeenCalled();
  });

  it('performSend(异常) → 错误提示 + 重试确认 + 写 lastResult', async () => {
    mockApi.remoteNotify.broadcast.mockRejectedValue(new Error('boom'));
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.performSend(
        { text: 'x', speak: true, popup: true, timeout_sec: 8, urgent: false, force_send: false },
        'broadcast'
      );
    });
    expect(mockShowToast).toHaveBeenCalledWith('error', 'boom');
    expect(deps.setLastResult).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'boom' })
    );
    expect(mockConfirm).toHaveBeenCalled();
  });

  // ---- handleSubmit ----
  it('handleSubmit(score_change 缺姓名) → 警告返回', async () => {
    const deps = makeDeps({
      mode: 'score_change',
      scoreForm: { ...DEFAULT_SCORE_FORM, student_name: '' },
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(mockShowToast).toHaveBeenCalledWith('warning', '请输入学生姓名');
    expect(mockApi.remoteNotify.scoreChange).not.toHaveBeenCalled();
  });

  it('handleSubmit(score_change 变化值为 0) → 警告返回', async () => {
    const deps = makeDeps({
      mode: 'score_change',
      scoreForm: { ...DEFAULT_SCORE_FORM, student_name: 'x', score_change: 0 },
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(mockShowToast).toHaveBeenCalledWith('warning', '请输入非零的积分变化值');
  });

  it('handleSubmit(score_change 缺原因) → 警告返回', async () => {
    const deps = makeDeps({
      mode: 'score_change',
      scoreForm: { ...DEFAULT_SCORE_FORM, student_name: 'x', score_change: 5, reason: '' },
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(mockShowToast).toHaveBeenCalledWith('warning', '请输入变动原因');
  });

  it('handleSubmit(device 缺文本) → 警告返回', async () => {
    const deps = makeDeps({
      mode: 'device',
      form: { ...DEFAULT_NOTIFY_FORM, text: '', device_id: 'd' },
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(mockShowToast).toHaveBeenCalledWith('warning', '请输入通知内容');
  });

  it('handleSubmit(device 缺设备ID) → 警告返回', async () => {
    const deps = makeDeps({
      mode: 'device',
      form: { ...DEFAULT_NOTIFY_FORM, text: 'hi', device_id: '' },
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(mockShowToast).toHaveBeenCalledWith('warning', '请输入设备ID');
  });

  it('handleSubmit(score_change 成功) → 清草稿 + 重置积分表单', async () => {
    const deps = makeDeps({
      mode: 'score_change',
      scoreForm: { ...DEFAULT_SCORE_FORM, student_name: 'x', score_change: 5, reason: 'r' },
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(mockApi.remoteNotify.scoreChange).toHaveBeenCalledWith(
      expect.objectContaining({
        student_name: 'x',
        score_change: 5,
        reason: 'r',
        force_send: false,
      })
    );
    expect(mockShowToast).toHaveBeenCalledWith('success', '已扣分');
    expect(deps.clearDraft).toHaveBeenCalled();
    expect(deps.setScoreForm).toHaveBeenCalledWith(expect.objectContaining({ student_name: '' }));
  });

  it('handleSubmit(score_change 失败) → 错误提示', async () => {
    mockApi.remoteNotify.scoreChange.mockResolvedValue({
      success: false,
      message: 'no',
      topic: '',
    });
    const deps = makeDeps({
      mode: 'score_change',
      scoreForm: { ...DEFAULT_SCORE_FORM, student_name: 'x', score_change: 5, reason: 'r' },
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(mockShowToast).toHaveBeenCalledWith('error', 'no');
  });

  it('handleSubmit(score_change 异常) → 错误提示 + 写 lastResult', async () => {
    mockApi.remoteNotify.scoreChange.mockRejectedValue(new Error('err'));
    const deps = makeDeps({
      mode: 'score_change',
      scoreForm: { ...DEFAULT_SCORE_FORM, student_name: 'x', score_change: 5, reason: 'r' },
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(mockShowToast).toHaveBeenCalledWith('error', 'err');
    expect(deps.setLastResult).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'err' })
    );
  });

  it('handleSubmit(broadcast 成功) → 拉预览并开确认弹窗', async () => {
    const deps = makeDeps({ mode: 'broadcast', form: { ...DEFAULT_NOTIFY_FORM, text: 'hi' } });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(mockApi.remoteNotify.preview).toHaveBeenCalled();
    expect(deps.setPreviewConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ open: true, kind: 'broadcast', preview: expect.anything() })
    );
  });

  it('handleSubmit(broadcast 预览异常) → 降级开弹窗(preview=null)', async () => {
    mockApi.remoteNotify.preview.mockRejectedValue(new Error('pv'));
    const deps = makeDeps({ mode: 'broadcast', form: { ...DEFAULT_NOTIFY_FORM, text: 'hi' } });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(deps.setPreviewConfirm).toHaveBeenCalledWith(expect.objectContaining({ preview: null }));
  });

  it('handleSubmit(test 成功) → 清草稿', async () => {
    const deps = makeDeps({ mode: 'test' });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(mockApi.remoteNotify.test).toHaveBeenCalledWith({ force_send: false });
    expect(mockShowToast).toHaveBeenCalledWith('success', '测试成功');
    expect(deps.clearDraft).toHaveBeenCalled();
  });

  it('handleSubmit(test 失败) → 错误提示', async () => {
    mockApi.remoteNotify.test.mockResolvedValue({ success: false, message: 'tf', topic: '' });
    const deps = makeDeps({ mode: 'test' });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(mockShowToast).toHaveBeenCalledWith('error', 'tf');
  });

  // ---- handleReset ----
  it('handleReset → 重置表单 + 清空 lastResult', () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    result.current.handleReset();
    expect(deps.setForm).toHaveBeenCalledWith(expect.objectContaining({ text: '', volume: 0.7 }));
    expect(deps.setLastResult).toHaveBeenCalledWith(null);
  });

  // ---- 模板 ----
  it('handleUseTemplate → 表单套用模板 + 成功提示', () => {
    const template: NotifyTemplate = {
      id: 1,
      name: 'tpl',
      text: 'T',
      volume: 1,
      speak: true,
      popup: true,
      timeout_sec: 5,
      urgent: true,
      bg_color: '#111',
      text_color: '#222',
      font_size: 30,
      language: 'en',
      category: '',
    };
    const deps = makeDeps({ form: { ...DEFAULT_NOTIFY_FORM, device_id: 'keep' } });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    result.current.handleUseTemplate(template);
    expect(deps.setForm).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'T', device_id: 'keep', font_size: 30, language: 'en' })
    );
    expect(mockShowToast).toHaveBeenCalledWith('success', '已加载模板: tpl');
  });

  it('handleUsePreset → 合并预设文本/紧急 + 提示', () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    result.current.handleUsePreset(QUICK_PRESETS[0]);
    expect(deps.setForm).toHaveBeenCalled();
    const presetUpdater = (deps.setForm as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(typeof presetUpdater).toBe('function');
    expect(presetUpdater({ text: '', urgent: true })).toEqual(
      expect.objectContaining({ text: QUICK_PRESETS[0].text, urgent: QUICK_PRESETS[0].urgent })
    );
    expect(mockShowToast).toHaveBeenCalledWith('success', `已加载预设: ${QUICK_PRESETS[0].name}`);
  });

  it('handleSaveTemplate(缺名称/内容) → 警告返回', async () => {
    const deps = makeDeps({ templateForm: { ...DEFAULT_TEMPLATE_FORM, name: '', text: '' } });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSaveTemplate();
    });
    expect(mockShowToast).toHaveBeenCalledWith('warning', '请填写模板名称和内容');
    expect(mockApi.notifyTemplates.create).not.toHaveBeenCalled();
  });

  it('handleSaveTemplate(新建) → create + 重载 + 关弹窗', async () => {
    const deps = makeDeps({ templateForm: { ...DEFAULT_TEMPLATE_FORM, name: 'n', text: 'x' } });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSaveTemplate();
    });
    expect(mockApi.notifyTemplates.create).toHaveBeenCalledWith(deps.templateForm);
    expect(deps.loadTemplates).toHaveBeenCalled();
    expect(deps.closeTemplateModal).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('success', '模板已保存');
  });

  it('handleSaveTemplate(更新) → update(id)', async () => {
    const editing = { id: 7, name: 'e', text: 'x' } as NotifyTemplate;
    const deps = makeDeps({
      editingTemplate: editing,
      templateForm: { ...DEFAULT_TEMPLATE_FORM, name: 'n', text: 'x' },
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSaveTemplate();
    });
    expect(mockApi.notifyTemplates.update).toHaveBeenCalledWith(7, deps.templateForm);
    expect(mockShowToast).toHaveBeenCalledWith('success', '模板已更新');
  });

  it('handleSaveTemplate(异常) → 错误提示', async () => {
    mockApi.notifyTemplates.create.mockRejectedValue(new Error('e'));
    const deps = makeDeps({ templateForm: { ...DEFAULT_TEMPLATE_FORM, name: 'n', text: 'x' } });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSaveTemplate();
    });
    expect(mockShowToast).toHaveBeenCalledWith('error', '保存失败');
  });

  it('handleDeleteTemplate(取消) → 不调接口', async () => {
    mockConfirm.mockResolvedValue(false);
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleDeleteTemplate(3);
    });
    expect(mockApi.notifyTemplates.delete).not.toHaveBeenCalled();
  });

  it('handleDeleteTemplate(确认) → delete + 重载 + 提示', async () => {
    mockConfirm.mockResolvedValue(true);
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleDeleteTemplate(3);
    });
    expect(mockApi.notifyTemplates.delete).toHaveBeenCalledWith(3);
    expect(deps.loadTemplates).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('success', '模板已删除');
  });

  it('handleDeleteTemplate(异常) → 错误提示', async () => {
    mockConfirm.mockResolvedValue(true);
    mockApi.notifyTemplates.delete.mockRejectedValue(new Error('e'));
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleDeleteTemplate(3);
    });
    expect(mockShowToast).toHaveBeenCalledWith('error', '删除失败');
  });

  // ---- 定时通知 ----
  it('handleSaveScheduled(缺内容) → 警告返回', async () => {
    const deps = makeDeps({
      scheduledForm: { ...DEFAULT_SCHEDULED_FORM, text: '', scheduled_at: '2026-01-01' },
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSaveScheduled();
    });
    expect(mockShowToast).toHaveBeenCalledWith('warning', '请输入通知内容');
  });

  it('handleSaveScheduled(缺时间) → 警告返回', async () => {
    const deps = makeDeps({
      scheduledForm: { ...DEFAULT_SCHEDULED_FORM, text: 'x', scheduled_at: '' },
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSaveScheduled();
    });
    expect(mockShowToast).toHaveBeenCalledWith('warning', '请选择发送时间');
  });

  it('handleSaveScheduled(新建) → create + 清草稿 + 重载 + 关弹窗', async () => {
    const deps = makeDeps({
      scheduledForm: { ...DEFAULT_SCHEDULED_FORM, text: 'x', scheduled_at: '2026-01-01' },
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSaveScheduled();
    });
    expect(mockApi.scheduledNotify.create).toHaveBeenCalledWith(deps.scheduledForm);
    expect(deps.clearDraft).toHaveBeenCalled();
    expect(deps.loadScheduledNotifications).toHaveBeenCalled();
    expect(deps.closeScheduledModal).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('success', '定时通知已创建');
  });

  it('handleSaveScheduled(更新) → update(id)', async () => {
    const deps = makeDeps({
      editingScheduled: { id: 9 } as unknown as RemoteNotifySharedDeps['editingScheduled'],
      scheduledForm: { ...DEFAULT_SCHEDULED_FORM, text: 'x', scheduled_at: '2026-01-01' },
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSaveScheduled();
    });
    expect(mockApi.scheduledNotify.update).toHaveBeenCalledWith(9, deps.scheduledForm);
    expect(mockShowToast).toHaveBeenCalledWith('success', '定时通知已更新');
  });

  it('handleSaveScheduled(异常) → 错误提示', async () => {
    mockApi.scheduledNotify.create.mockRejectedValue(new Error('e'));
    const deps = makeDeps({
      scheduledForm: { ...DEFAULT_SCHEDULED_FORM, text: 'x', scheduled_at: '2026-01-01' },
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleSaveScheduled();
    });
    expect(mockShowToast).toHaveBeenCalledWith('error', '保存失败');
  });

  it('handleDeleteScheduled → delete + 重载 + 提示', async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleDeleteScheduled(4);
    });
    expect(mockApi.scheduledNotify.delete).toHaveBeenCalledWith(4);
    expect(deps.loadScheduledNotifications).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('success', '定时通知已删除');
  });

  it('handleDeleteScheduled(异常) → 错误提示', async () => {
    mockApi.scheduledNotify.delete.mockRejectedValue(new Error('e'));
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleDeleteScheduled(4);
    });
    expect(mockShowToast).toHaveBeenCalledWith('error', '删除失败');
  });

  it('handleCancelScheduled → cancel + 重载 + 提示', async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleCancelScheduled(5);
    });
    expect(mockApi.scheduledNotify.cancel).toHaveBeenCalledWith(5);
    expect(deps.loadScheduledNotifications).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('success', '定时通知已取消');
  });

  it('handleCancelScheduled(异常) → 错误提示', async () => {
    mockApi.scheduledNotify.cancel.mockRejectedValue(new Error('e'));
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleCancelScheduled(5);
    });
    expect(mockShowToast).toHaveBeenCalledWith('error', '取消失败');
  });

  it('handleTriggerScheduled → trigger(force_send) + 重载 + 提示', async () => {
    const deps = makeDeps({ scheduledForceSend: true });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleTriggerScheduled(6);
    });
    expect(mockApi.scheduledNotify.trigger).toHaveBeenCalledWith(6, { force_send: true });
    expect(deps.loadScheduledNotifications).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('success', '通知已发送');
  });

  it('handleTriggerScheduled(异常) → 错误提示', async () => {
    mockApi.scheduledNotify.trigger.mockRejectedValue(new Error('e'));
    const deps = makeDeps();
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    await act(async () => {
      await result.current.handleTriggerScheduled(6);
    });
    expect(mockShowToast).toHaveBeenCalledWith('error', '发送失败');
  });

  it('handleUseCurrentFormForScheduled → 写入定时表单 + 开弹窗', () => {
    const deps = makeDeps({
      mode: 'device',
      form: { ...DEFAULT_NOTIFY_FORM, text: 'f', device_id: 'd1' },
    });
    const { result } = renderHook(() => useRemoteNotifyHandlers(deps));
    result.current.handleUseCurrentFormForScheduled();
    expect(deps.setScheduledForm).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'f',
        send_mode: 'device',
        device_id: 'd1',
        repeat_type: 'once',
      })
    );
    expect(deps.openScheduledModal).toHaveBeenCalled();
  });
});
