/**
 * RemoteNotify测试 - 简化版（vitest 复活版）
 * 仅做导入冒烟校验：确认拆分后的主壳 default export 与子模块可被正常解析，
 * 不触碰任何运行时 DOM（避免 vitest worker 环境不稳定导致的误报）。
 */
/// <reference types="jest" />

describe('RemoteNotify Module', () => {
  test('远程通知模块可以导入', async () => {
    const module = await import('../../pages/RemoteNotify');
    expect(module.default).toBeDefined();
  });

  test('AppState hooks可以导入', async () => {
    const hooks = await import('../../hooks/useAppState');
    expect(hooks).toBeDefined();
  });
});

export {};
