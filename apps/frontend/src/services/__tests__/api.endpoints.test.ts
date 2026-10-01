import { vi, describe, it, expect, beforeEach } from 'vitest';
import api from '../api';

// 静音 ErrorMonitor：成功路径测试不需要错误上报噪音
vi.mock('../../utils/errorMonitor', () => ({
  errorMonitor: { report: () => {}, reportApiError: () => {}, reportConsoleError: () => {} },
}));

const mockFetch = vi.fn();
(globalThis as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

function env(_data: unknown, _extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    headers: { get: (): string | null => null },
    json: () => Promise.resolve({ success: true, code: 0, data: _data, ..._extra }),
    blob: () => Promise.resolve(new Blob()),
    text: () => Promise.resolve(''),
  };
}

const apiAny = api as any;

describe('api endpoints 成功路径覆盖 (322 方法)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
    document.cookie = '';
  });

  it('dashboard.getData', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.dashboard.getData()).resolves.not.toThrow();
  });
  it('users.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.users.getAll({})).resolves.not.toThrow();
  });
  it('users.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.users.getById(1)).resolves.not.toThrow();
  });
  it('users.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.users.create({})).resolves.not.toThrow();
  });
  it('users.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.users.update(1, {})).resolves.not.toThrow();
  });
  it('users.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.users.delete(1)).resolves.not.toThrow();
  });
  it('users.getByCard', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.users.getByCard(1)).resolves.not.toThrow();
  });
  it('users.toggleActive', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.users.toggleActive(1)).resolves.not.toThrow();
  });
  it('users.import', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.users.import([])).resolves.not.toThrow();
  });
  it('users.batchDelete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.users.batchDelete([])).resolves.not.toThrow();
  });
  it('users.batchUpdateScore', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.users.batchUpdateScore([], 30, 'x')).resolves.not.toThrow();
  });
  it('users.downloadTemplate', () => {
    mockFetch.mockResolvedValue(env({}));
    const res = apiAny.users.downloadTemplate();
    expect(res).toBeDefined();
  });
  it('scoreCategories.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scoreCategories.getAll()).resolves.not.toThrow();
  });
  it('scoreCategories.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scoreCategories.create({})).resolves.not.toThrow();
  });
  it('scoreCategories.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scoreCategories.update(1, {})).resolves.not.toThrow();
  });
  it('scoreCategories.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scoreCategories.delete(1)).resolves.not.toThrow();
  });
  it('rules.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.rules.create({})).resolves.not.toThrow();
  });
  it('rules.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.rules.update(1, {})).resolves.not.toThrow();
  });
  it('rules.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.rules.delete(1)).resolves.not.toThrow();
  });
  it('rules.export', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.rules.export()).resolves.not.toThrow();
  });
  it('rules.import', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.rules.import([])).resolves.not.toThrow();
  });
  it('rules.downloadTemplate', () => {
    mockFetch.mockResolvedValue(env({}));
    const res = apiAny.rules.downloadTemplate();
    expect(res).toBeDefined();
  });
  it('rankRules.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.rankRules.getAll()).resolves.not.toThrow();
  });
  it('rankRules.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.rankRules.create({})).resolves.not.toThrow();
  });
  it('rankRules.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.rankRules.update(1, {})).resolves.not.toThrow();
  });
  it('rankRules.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.rankRules.delete(1)).resolves.not.toThrow();
  });
  it('rankRules.getByScore', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.rankRules.getByScore(30)).resolves.not.toThrow();
  });
  it('records.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.records.create({})).resolves.not.toThrow();
  });
  it('records.getByUser', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.records.getByUser(1, {})).resolves.not.toThrow();
  });
  it('records.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.records.getAll({})).resolves.not.toThrow();
  });
  it('records.getStatistics', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.records.getStatistics({})).resolves.not.toThrow();
  });
  it('auth.getCsrfToken', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.auth.getCsrfToken()).resolves.not.toThrow();
  });
  it('admins.getCsrfToken', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.admins.getCsrfToken()).resolves.not.toThrow();
  });
  it('admins.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.admins.getAll()).resolves.not.toThrow();
  });
  it('admins.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.admins.getById(1)).resolves.not.toThrow();
  });
  it('admins.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.admins.create({})).resolves.not.toThrow();
  });
  it('admins.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.admins.update(1, {})).resolves.not.toThrow();
  });
  it('admins.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.admins.delete(1)).resolves.not.toThrow();
  });
  it('export.users', () => {
    mockFetch.mockResolvedValue(env({}));
    const res = apiAny.export.users('excel');
    expect(res).toBeDefined();
  });
  it('export.records', () => {
    mockFetch.mockResolvedValue(env({}));
    const res = apiAny.export.records(1, 'excel');
    expect(res).toBeDefined();
  });
  it('export.rules', () => {
    mockFetch.mockResolvedValue(env({}));
    const res = apiAny.export.rules('excel');
    expect(res).toBeDefined();
  });
  it('export.devices', () => {
    mockFetch.mockResolvedValue(env({}));
    const res = apiAny.export.devices('excel');
    expect(res).toBeDefined();
  });
  it('export.summary', () => {
    mockFetch.mockResolvedValue(env({}));
    const res = apiAny.export.summary();
    expect(res).toBeDefined();
  });
  it('analysis.getUserAnalysis', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.analysis.getUserAnalysis(1)).resolves.not.toThrow();
  });
  it('analysis.getClassAnalysis', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.analysis.getClassAnalysis('x')).resolves.not.toThrow();
  });
  it('analysis.getClassCompare', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.analysis.getClassCompare([], '7d')).resolves.not.toThrow();
  });
  it('timeRules.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.timeRules.getAll()).resolves.not.toThrow();
  });
  it('timeRules.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.timeRules.getById(1)).resolves.not.toThrow();
  });
  it('timeRules.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.timeRules.create({})).resolves.not.toThrow();
  });
  it('timeRules.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.timeRules.update(1, {})).resolves.not.toThrow();
  });
  it('timeRules.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.timeRules.delete(1)).resolves.not.toThrow();
  });
  it('classPeriods.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.classPeriods.getAll()).resolves.not.toThrow();
  });
  it('classPeriods.getActive', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.classPeriods.getActive()).resolves.not.toThrow();
  });
  it('classPeriods.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.classPeriods.getById(1)).resolves.not.toThrow();
  });
  it('classPeriods.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.classPeriods.delete(1)).resolves.not.toThrow();
  });
  it('classPeriods.batchUpdate', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.classPeriods.batchUpdate([])).resolves.not.toThrow();
  });
  it('classPeriods.reset', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.classPeriods.reset()).resolves.not.toThrow();
  });
  it('courseSchedules.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.courseSchedules.getById(1)).resolves.not.toThrow();
  });
  it('courseSchedules.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.courseSchedules.delete(1)).resolves.not.toThrow();
  });
  it('courseSchedules.export', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.courseSchedules.export(1, 'excel')).resolves.not.toThrow();
  });
  it('courseSchedules.getNow', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.courseSchedules.getNow(1, 1)).resolves.not.toThrow();
  });
  it('importConfig.list', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.importConfig.list({})).resolves.not.toThrow();
  });
  it('importConfig.get', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.importConfig.get(1)).resolves.not.toThrow();
  });
  it('importConfig.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.importConfig.create({})).resolves.not.toThrow();
  });
  it('importConfig.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.importConfig.update(1, {})).resolves.not.toThrow();
  });
  it('importConfig.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.importConfig.delete(1)).resolves.not.toThrow();
  });
  it('importConfig.setDefault', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.importConfig.setDefault(1)).resolves.not.toThrow();
  });
  it('importConfig.downloadTemplate', () => {
    mockFetch.mockResolvedValue(env({}));
    const res = apiAny.importConfig.downloadTemplate('x');
    expect(res).toBeDefined();
  });
  it('box.verify', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.box.verify({})).resolves.not.toThrow();
  });
  it('phoneBoxPolicy.get', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.phoneBoxPolicy.get(1)).resolves.not.toThrow();
  });
  it('phoneBoxPolicy.override', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.phoneBoxPolicy.override(30, 1)).resolves.not.toThrow();
  });
  it('phoneBoxPolicy.cancelOverride', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.phoneBoxPolicy.cancelOverride(1)).resolves.not.toThrow();
  });
  it('mqtt.getConfig', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.mqtt.getConfig()).resolves.not.toThrow();
  });
  it('mqtt.updateConfig', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.mqtt.updateConfig({})).resolves.not.toThrow();
  });
  it('mqtt.getStatus', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.mqtt.getStatus()).resolves.not.toThrow();
  });
  it('mqtt.connect', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.mqtt.connect()).resolves.not.toThrow();
  });
  it('mqtt.disconnect', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.mqtt.disconnect()).resolves.not.toThrow();
  });
  it('mqtt.subscribe', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.mqtt.subscribe({})).resolves.not.toThrow();
  });
  it('mqtt.unsubscribe', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.mqtt.unsubscribe({})).resolves.not.toThrow();
  });
  it('mqtt.getLogs', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.mqtt.getLogs(30)).resolves.not.toThrow();
  });
  it('system.backup', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.system.backup()).resolves.not.toThrow();
  });
  it('system.restore', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.system.restore('x')).resolves.not.toThrow();
  });
  it('system.listBackups', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.system.listBackups()).resolves.not.toThrow();
  });
  it('system.clearCache', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.system.clearCache()).resolves.not.toThrow();
  });
  it('system.getConfig', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.system.getConfig()).resolves.not.toThrow();
  });
  it('system.updateConfig', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.system.updateConfig({})).resolves.not.toThrow();
  });
  it('operationLogs.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.operationLogs.getAll({})).resolves.not.toThrow();
  });
  it('operationLogs.getStats', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.operationLogs.getStats({})).resolves.not.toThrow();
  });
  it('operationLogs.getSummary', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.operationLogs.getSummary()).resolves.not.toThrow();
  });
  it('notifications.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.notifications.getAll({})).resolves.not.toThrow();
  });
  it('notifications.getUnread', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.notifications.getUnread()).resolves.not.toThrow();
  });
  it('notifications.markAsRead', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.notifications.markAsRead(1)).resolves.not.toThrow();
  });
  it('notifications.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.notifications.create({})).resolves.not.toThrow();
  });
  it('notifications.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.notifications.delete(1)).resolves.not.toThrow();
  });
  it('classes.getStudents', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.classes.getStudents('x')).resolves.not.toThrow();
  });
  it('classes.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.classes.create({})).resolves.not.toThrow();
  });
  it('classes.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.classes.update(1, {})).resolves.not.toThrow();
  });
  it('classes.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.classes.delete(1)).resolves.not.toThrow();
  });
  it('classes.export', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.classes.export('x', 'excel')).resolves.not.toThrow();
  });
  it('adminClasses.getByAdmin', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.adminClasses.getByAdmin(1)).resolves.not.toThrow();
  });
  it('adminClasses.assign', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.adminClasses.assign(1, 1, true)).resolves.not.toThrow();
  });
  it('adminClasses.remove', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.adminClasses.remove(1, 1)).resolves.not.toThrow();
  });
  it('permissionLogs.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.permissionLogs.getAll({})).resolves.not.toThrow();
  });
  it('scoreAnalysis.getExamAnalysis', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scoreAnalysis.getExamAnalysis(1)).resolves.not.toThrow();
  });
  it('scoreAnalysis.getClassAnalysis', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scoreAnalysis.getClassAnalysis('x')).resolves.not.toThrow();
  });
  it('scoreAnalysis.getStudentAnalysis', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scoreAnalysis.getStudentAnalysis(1)).resolves.not.toThrow();
  });
  it('scores.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scores.getAll({})).resolves.not.toThrow();
  });
  it('scores.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scores.update(1, {})).resolves.not.toThrow();
  });
  it('scores.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scores.delete(1)).resolves.not.toThrow();
  });
  it('scores.importScores', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scores.importScores(new FormData())).resolves.not.toThrow();
  });
  it('scores.confirmAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scores.confirmAll(1)).resolves.not.toThrow();
  });
  it('scores.batchCreate', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scores.batchCreate([])).resolves.not.toThrow();
  });
  it('reports.exportClassSemester', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.reports.exportClassSemester(1, 'excel')).resolves.not.toThrow();
  });
  it('remoteNotify.preview', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.remoteNotify.preview()).resolves.not.toThrow();
  });
  it('remoteNotify.test', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.remoteNotify.test({})).resolves.not.toThrow();
  });
  it('notifyTemplates.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.notifyTemplates.getAll()).resolves.not.toThrow();
  });
  it('notifyTemplates.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.notifyTemplates.getById(1)).resolves.not.toThrow();
  });
  it('notifyTemplates.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.notifyTemplates.create({})).resolves.not.toThrow();
  });
  it('notifyTemplates.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.notifyTemplates.update(1, {})).resolves.not.toThrow();
  });
  it('notifyTemplates.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.notifyTemplates.delete(1)).resolves.not.toThrow();
  });
  it('notifyTemplates.getCategories', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.notifyTemplates.getCategories()).resolves.not.toThrow();
  });
  it('scheduledNotify.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scheduledNotify.getAll({})).resolves.not.toThrow();
  });
  it('scheduledNotify.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scheduledNotify.getById(1)).resolves.not.toThrow();
  });
  it('scheduledNotify.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scheduledNotify.delete(1)).resolves.not.toThrow();
  });
  it('scheduledNotify.cancel', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.scheduledNotify.cancel(1)).resolves.not.toThrow();
  });
  it('notifyHistory.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.notifyHistory.getById(1)).resolves.not.toThrow();
  });
  it('notifyHistory.getStats', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.notifyHistory.getStats()).resolves.not.toThrow();
  });
  it('notifyHistory.clean', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.notifyHistory.clean(30)).resolves.not.toThrow();
  });
  it('adminNotifications.getRecent', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.adminNotifications.getRecent({})).resolves.not.toThrow();
  });
  it('adminNotifications.getCount', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.adminNotifications.getCount(1)).resolves.not.toThrow();
  });
  it('adminNotifications.markRead', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.adminNotifications.markRead(1)).resolves.not.toThrow();
  });
  it('adminNotifications.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.adminNotifications.delete(1)).resolves.not.toThrow();
  });
  it('wakeOnLan.updateDevice', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.wakeOnLan.updateDevice(1, {})).resolves.not.toThrow();
  });
  it('wakeOnLan.deleteDevice', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.wakeOnLan.deleteDevice(1)).resolves.not.toThrow();
  });
  it('devices.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.getAll({})).resolves.not.toThrow();
  });
  it('devices.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.getById(1)).resolves.not.toThrow();
  });
  it('devices.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.create({})).resolves.not.toThrow();
  });
  it('devices.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.update(1, {})).resolves.not.toThrow();
  });
  it('devices.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.delete(1)).resolves.not.toThrow();
  });
  it('devices.getAlerts', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.getAlerts('x')).resolves.not.toThrow();
  });
  it('devices.getHeartbeats', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.getHeartbeats(1)).resolves.not.toThrow();
  });
  it('devices.bindClass', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.bindClass(1, {})).resolves.not.toThrow();
  });
  it('devices.bindAdmin', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.bindAdmin(1, {})).resolves.not.toThrow();
  });
  it('devices.remoteControl', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.remoteControl(1, 'x')).resolves.not.toThrow();
  });
  it('devices.resolveAlert', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.resolveAlert(1, 1)).resolves.not.toThrow();
  });
  it('devices.updateSettings', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.updateSettings(1, {})).resolves.not.toThrow();
  });
  it('devices.getStats', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.getStats()).resolves.not.toThrow();
  });
  it('devices.getAdvancedStats', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.getAdvancedStats()).resolves.not.toThrow();
  });
  it('devices.import', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.import(new FormData())).resolves.not.toThrow();
  });
  it('devices.issueSecret', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.issueSecret(1)).resolves.not.toThrow();
  });
  it('devices.getSecretStatus', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.getSecretStatus(1)).resolves.not.toThrow();
  });
  it('devices.revokeSecret', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.devices.revokeSecret(1)).resolves.not.toThrow();
  });
  it('firmware.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.firmware.getAll()).resolves.not.toThrow();
  });
  it('firmware.getVersions', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.firmware.getVersions({})).resolves.not.toThrow();
  });
  it('firmware.getUpgradeRecords', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.firmware.getUpgradeRecords()).resolves.not.toThrow();
  });
  it('firmware.upload', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.firmware.upload(new FormData())).resolves.not.toThrow();
  });
  it('firmware.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.firmware.update(1, {})).resolves.not.toThrow();
  });
  it('firmware.updateVersion', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.firmware.updateVersion(1, {})).resolves.not.toThrow();
  });
  it('firmware.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.firmware.delete(1)).resolves.not.toThrow();
  });
  it('firmware.deleteVersion', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.firmware.deleteVersion(1)).resolves.not.toThrow();
  });
  it('firmware.download', () => {
    mockFetch.mockResolvedValue(env({}));
    const res = apiAny.firmware.download(1);
    expect(res).toBeDefined();
  });
  it('firmware.getOTAStatus', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.firmware.getOTAStatus()).resolves.not.toThrow();
  });
  it('firmware.otaUpgrade', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.firmware.otaUpgrade(1, [])).resolves.not.toThrow();
  });
  it('exams.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.exams.getAll({})).resolves.not.toThrow();
  });
  it('exams.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.exams.getById(1)).resolves.not.toThrow();
  });
  it('exams.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.exams.create({})).resolves.not.toThrow();
  });
  it('exams.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.exams.update(1, {})).resolves.not.toThrow();
  });
  it('exams.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.exams.delete(1)).resolves.not.toThrow();
  });
  it('exams.publish', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.exams.publish(1)).resolves.not.toThrow();
  });
  it('exams.close', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.exams.close(1)).resolves.not.toThrow();
  });
  it('subjects.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.subjects.getAll({})).resolves.not.toThrow();
  });
  it('subjects.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.subjects.delete(1)).resolves.not.toThrow();
  });
  it('subjects.toggle', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.subjects.toggle(1)).resolves.not.toThrow();
  });
  it('subjects.getClasses', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.subjects.getClasses(1)).resolves.not.toThrow();
  });
  it('subjects.removeClass', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.subjects.removeClass(1, 1)).resolves.not.toThrow();
  });
  it('subjects.updateOrder', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.subjects.updateOrder([])).resolves.not.toThrow();
  });
  it('approvals.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.approvals.getAll({})).resolves.not.toThrow();
  });
  it('approvals.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.approvals.getById(1)).resolves.not.toThrow();
  });
  it('approvals.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.approvals.create({})).resolves.not.toThrow();
  });
  it('approvals.approve', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.approvals.approve(1, {})).resolves.not.toThrow();
  });
  it('approvals.reject', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.approvals.reject(1, {})).resolves.not.toThrow();
  });
  it('approvals.batchApprove', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.approvals.batchApprove([], 'x')).resolves.not.toThrow();
  });
  it('approvals.batchReject', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.approvals.batchReject([], 'x')).resolves.not.toThrow();
  });
  it('approvals.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.approvals.delete(1)).resolves.not.toThrow();
  });
  it('algorithm.getPrediction', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getPrediction(1, 30)).resolves.not.toThrow();
  });
  it('algorithm.getBatchPrediction', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getBatchPrediction('x', 30)).resolves.not.toThrow();
  });
  it('algorithm.getRiskStudents', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getRiskStudents(30)).resolves.not.toThrow();
  });
  it('algorithm.getUserAnomaly', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getUserAnomaly(1, 30)).resolves.not.toThrow();
  });
  it('algorithm.getBatchAnomaly', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getBatchAnomaly('x', 30)).resolves.not.toThrow();
  });
  it('algorithm.getSuddenChange', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getSuddenChange(1, 30)).resolves.not.toThrow();
  });
  it('algorithm.getTrendAnomaly', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getTrendAnomaly(1, 30)).resolves.not.toThrow();
  });
  it('algorithm.getGroupAnomaly', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getGroupAnomaly(1, 30)).resolves.not.toThrow();
  });
  it('algorithm.getRuleRecommend', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getRuleRecommend('x', 30)).resolves.not.toThrow();
  });
  it('algorithm.getNewRuleRecommend', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getNewRuleRecommend('x', 30)).resolves.not.toThrow();
  });
  it('algorithm.getRuleOptimization', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getRuleOptimization('x', 30)).resolves.not.toThrow();
  });
  it('algorithm.getRuleCombination', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getRuleCombination('x', 30)).resolves.not.toThrow();
  });
  it('algorithm.getRuleStatistics', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getRuleStatistics(30)).resolves.not.toThrow();
  });
  it('algorithm.trainRuleRecommendModel', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.trainRuleRecommendModel(30)).resolves.not.toThrow();
  });
  it('algorithm.evaluateRuleRecommendModel', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.evaluateRuleRecommendModel(30)).resolves.not.toThrow();
  });
  it('algorithm.getScorePredict', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getScorePredict(1, 30)).resolves.not.toThrow();
  });
  it('algorithm.getBatchScorePredict', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getBatchScorePredict('x', 30)).resolves.not.toThrow();
  });
  it('algorithm.getScoreDistribution', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getScoreDistribution('x')).resolves.not.toThrow();
  });
  it('algorithm.trainScorePredictModel', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.trainScorePredictModel(30)).resolves.not.toThrow();
  });
  it('algorithm.evaluateScorePredictModel', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.evaluateScorePredictModel(30)).resolves.not.toThrow();
  });
  it('algorithm.getRiskPredict', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getRiskPredict(1, 30)).resolves.not.toThrow();
  });
  it('algorithm.getScoreAttribution', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getScoreAttribution(1, 30)).resolves.not.toThrow();
  });
  it('algorithm.getEngagement', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getEngagement(1, 30)).resolves.not.toThrow();
  });
  it('algorithm.getBatchAttribution', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getBatchAttribution('x', 30)).resolves.not.toThrow();
  });
  it('algorithm.getEngagementRank', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getEngagementRank('x', 30)).resolves.not.toThrow();
  });
  it('algorithm.getEngagementTrend', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getEngagementTrend(1, 30)).resolves.not.toThrow();
  });
  it('algorithm.getBatchRiskPredict', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getBatchRiskPredict('x', 30)).resolves.not.toThrow();
  });
  it('algorithm.getHighRiskStudents', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getHighRiskStudents(30)).resolves.not.toThrow();
  });
  it('algorithm.trainRiskPredictModel', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.trainRiskPredictModel(30)).resolves.not.toThrow();
  });
  it('algorithm.evaluateRiskPredictModel', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.evaluateRiskPredictModel(30)).resolves.not.toThrow();
  });
  it('algorithm.executeRuleEngine', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.executeRuleEngine({}, {})).resolves.not.toThrow();
  });
  it('algorithm.getScoreDistributionStats', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getScoreDistributionStats('x')).resolves.not.toThrow();
  });
  it('algorithm.adjustScoreDistribution', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.adjustScoreDistribution('x')).resolves.not.toThrow();
  });
  it('algorithm.validateScoreDistribution', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.validateScoreDistribution([1, 2, 3])).resolves.not.toThrow();
  });
  it('algorithm.detectOutliers', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.detectOutliers([1, 2, 3])).resolves.not.toThrow();
  });
  it('algorithm.validateAndCorrectScores', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.validateAndCorrectScores([1, 2, 3])).resolves.not.toThrow();
  });
  it('algorithm.earnScore', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.earnScore(1, 'x', {})).resolves.not.toThrow();
  });
  it('algorithm.spendScore', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.spendScore(1, 'x', 30)).resolves.not.toThrow();
  });
  it('algorithm.getEarningRules', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getEarningRules()).resolves.not.toThrow();
  });
  it('algorithm.getSpendingRules', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getSpendingRules()).resolves.not.toThrow();
  });
  it('algorithm.getUserBalance', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getUserBalance(1)).resolves.not.toThrow();
  });
  it('algorithm.handlePhoneAccess', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.handlePhoneAccess(1, 30)).resolves.not.toThrow();
  });
  it('algorithm.getRewardTypes', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getRewardTypes()).resolves.not.toThrow();
  });
  it('algorithm.getEligibleRewards', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getEligibleRewards(1)).resolves.not.toThrow();
  });
  it('algorithm.redeemReward', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.redeemReward(1, 'x')).resolves.not.toThrow();
  });
  it('algorithm.getDailyRewardUsage', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getDailyRewardUsage(1)).resolves.not.toThrow();
  });
  it('algorithm.getStatistics', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getStatistics({})).resolves.not.toThrow();
  });
  it('algorithm.getClusters', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getClusters({})).resolves.not.toThrow();
  });
  it('algorithm.getCompositeScores', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getCompositeScores({})).resolves.not.toThrow();
  });
  it('algorithm.getWarnings', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getWarnings({})).resolves.not.toThrow();
  });
  it('algorithm.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getAll()).resolves.not.toThrow();
  });
  it('algorithm.runAnalysis', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.runAnalysis()).resolves.not.toThrow();
  });
  it('algorithm.getWarningConfig', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getWarningConfig()).resolves.not.toThrow();
  });
  it('algorithm.recalculateClusters', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.recalculateClusters()).resolves.not.toThrow();
  });
  it('algorithm.recalculateCompositeScores', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.recalculateCompositeScores()).resolves.not.toThrow();
  });
  it('algorithm.runWarningEvaluation', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.runWarningEvaluation()).resolves.not.toThrow();
  });
  it('algorithm.resolveWarning', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.resolveWarning(1)).resolves.not.toThrow();
  });
  it('algorithm.getCompositeScoreProgress', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.algorithm.getCompositeScoreProgress()).resolves.not.toThrow();
  });
  it('deviceGroup.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.deviceGroup.getAll({})).resolves.not.toThrow();
  });
  it('deviceGroup.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.deviceGroup.getById(1)).resolves.not.toThrow();
  });
  it('deviceGroup.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.deviceGroup.create({})).resolves.not.toThrow();
  });
  it('deviceGroup.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.deviceGroup.update(1, {})).resolves.not.toThrow();
  });
  it('deviceGroup.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.deviceGroup.delete(1)).resolves.not.toThrow();
  });
  it('deviceGroup.getDevices', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.deviceGroup.getDevices(1)).resolves.not.toThrow();
  });
  it('deviceGroup.removeDevices', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.deviceGroup.removeDevices(1, [])).resolves.not.toThrow();
  });
  it('deviceGroup.getByDevice', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.deviceGroup.getByDevice(1)).resolves.not.toThrow();
  });
  it('deviceGroup.getStats', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.deviceGroup.getStats()).resolves.not.toThrow();
  });
  it('seating.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.seating.getAll(1)).resolves.not.toThrow();
  });
  it('seating.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.seating.getById(1)).resolves.not.toThrow();
  });
  it('seating.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.seating.create({})).resolves.not.toThrow();
  });
  it('seating.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.seating.update(1, {})).resolves.not.toThrow();
  });
  it('seating.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.seating.delete(1)).resolves.not.toThrow();
  });
  it('seating.autoArrange', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.seating.autoArrange(1, 'x', 1)).resolves.not.toThrow();
  });
  it('duty.createGroup', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.duty.createGroup({})).resolves.not.toThrow();
  });
  it('duty.deleteGroup', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.duty.deleteGroup(1)).resolves.not.toThrow();
  });
  it('duty.assignDuty', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.duty.assignDuty({})).resolves.not.toThrow();
  });
  it('duty.markComplete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.duty.markComplete(1)).resolves.not.toThrow();
  });
  it('duty.rotate', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.duty.rotate(1, 'weekly')).resolves.not.toThrow();
  });
  it('committee.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.committee.getAll(1)).resolves.not.toThrow();
  });
  it('committee.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.committee.create({})).resolves.not.toThrow();
  });
  it('committee.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.committee.update(1, {})).resolves.not.toThrow();
  });
  it('committee.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.committee.delete(1)).resolves.not.toThrow();
  });
  it('committee.getTerms', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.committee.getTerms(1)).resolves.not.toThrow();
  });
  it('committee.createTerm', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.committee.createTerm({})).resolves.not.toThrow();
  });
  it('parent.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.parent.create({})).resolves.not.toThrow();
  });
  it('parent.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.parent.update(1, {})).resolves.not.toThrow();
  });
  it('parent.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.parent.delete(1)).resolves.not.toThrow();
  });
  it('parent.resolveLog', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.parent.resolveLog(1)).resolves.not.toThrow();
  });
  it('homework.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.homework.getById(1)).resolves.not.toThrow();
  });
  it('homework.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.homework.create({})).resolves.not.toThrow();
  });
  it('homework.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.homework.update(1, {})).resolves.not.toThrow();
  });
  it('homework.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.homework.delete(1)).resolves.not.toThrow();
  });
  it('homework.markSubmitted', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.homework.markSubmitted(1, 1)).resolves.not.toThrow();
  });
  it('homework.markChecked', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.homework.markChecked(1, 1, 'x')).resolves.not.toThrow();
  });
  it('attendance.record', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.attendance.record({})).resolves.not.toThrow();
  });
  it('attendance.batchRecord', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.attendance.batchRecord([])).resolves.not.toThrow();
  });
  it('attendance.getStats', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.attendance.getStats(1, 'x', 'x')).resolves.not.toThrow();
  });
  it('attendance.applyLeave', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.attendance.applyLeave({})).resolves.not.toThrow();
  });
  it('attendance.approveLeave', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.attendance.approveLeave(1, true)).resolves.not.toThrow();
  });
  it('studyGroup.getAll', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.studyGroup.getAll(1)).resolves.not.toThrow();
  });
  it('studyGroup.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.studyGroup.getById(1)).resolves.not.toThrow();
  });
  it('studyGroup.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.studyGroup.create({})).resolves.not.toThrow();
  });
  it('studyGroup.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.studyGroup.update(1, {})).resolves.not.toThrow();
  });
  it('studyGroup.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.studyGroup.delete(1)).resolves.not.toThrow();
  });
  it('studyGroup.addMember', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.studyGroup.addMember(1, 1)).resolves.not.toThrow();
  });
  it('studyGroup.removeMember', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.studyGroup.removeMember(1, 1)).resolves.not.toThrow();
  });
  it('studyGroup.addScore', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.studyGroup.addScore(1, 30, 'x')).resolves.not.toThrow();
  });
  it('mentalHealth.createRecord', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.mentalHealth.createRecord({})).resolves.not.toThrow();
  });
  it('mentalHealth.resolveAlert', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.mentalHealth.resolveAlert(1)).resolves.not.toThrow();
  });
  it('teacherComment.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.teacherComment.create({})).resolves.not.toThrow();
  });
  it('teacherComment.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.teacherComment.update(1, {})).resolves.not.toThrow();
  });
  it('teacherComment.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.teacherComment.delete(1)).resolves.not.toThrow();
  });
  it('activity.getById', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.activity.getById(1)).resolves.not.toThrow();
  });
  it('activity.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.activity.create({})).resolves.not.toThrow();
  });
  it('activity.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.activity.update(1, {})).resolves.not.toThrow();
  });
  it('activity.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.activity.delete(1)).resolves.not.toThrow();
  });
  it('activity.registerStudent', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.activity.registerStudent(1, 1)).resolves.not.toThrow();
  });
  it('activity.cancelRegistration', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.activity.cancelRegistration(1, 1)).resolves.not.toThrow();
  });
  it('culture.create', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.culture.create({})).resolves.not.toThrow();
  });
  it('culture.update', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.culture.update(1, {})).resolves.not.toThrow();
  });
  it('culture.delete', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.culture.delete(1)).resolves.not.toThrow();
  });
  it('studyGuide.createGuide', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.studyGuide.createGuide({})).resolves.not.toThrow();
  });
  it('studyGuide.updateGuide', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.studyGuide.updateGuide(1, {})).resolves.not.toThrow();
  });
  it('studyGuide.deleteGuide', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.studyGuide.deleteGuide(1)).resolves.not.toThrow();
  });
  it('studyGuide.createPlan', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.studyGuide.createPlan({})).resolves.not.toThrow();
  });
  it('studyGuide.updatePlan', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.studyGuide.updatePlan(1, {})).resolves.not.toThrow();
  });
  it('studyGuide.deletePlan', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.studyGuide.deletePlan(1)).resolves.not.toThrow();
  });
  it('studyGuide.updatePlanProgress', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.studyGuide.updatePlanProgress(1, 30)).resolves.not.toThrow();
  });
  it('student.getMe', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.student.getMe()).resolves.not.toThrow();
  });
  it('student.getScore', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.student.getScore()).resolves.not.toThrow();
  });
  it('student.getRecords', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.student.getRecords({})).resolves.not.toThrow();
  });
  it('student.getNotifications', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.student.getNotifications({})).resolves.not.toThrow();
  });
  it('student.getLeaves', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.student.getLeaves()).resolves.not.toThrow();
  });
  it('student.requestPhoneboxUnlock', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.student.requestPhoneboxUnlock()).resolves.not.toThrow();
  });
  it('student.getMyRank', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.student.getMyRank()).resolves.not.toThrow();
  });
  it('student.getInsights', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.student.getInsights(30, 30)).resolves.not.toThrow();
  });
  it('rank.getClassRanking', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.rank.getClassRanking({})).resolves.not.toThrow();
  });
  it('cache.clearByUrl', async () => {
    mockFetch.mockResolvedValue(env({}));
    await expect(apiAny.cache.clearByUrl('x')).resolves.not.toThrow();
  });
});
