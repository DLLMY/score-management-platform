/**
 * UserList组件测试 - 简化版（vitest 复活版）
 */
/// <reference types="jest" />

describe('UserList Component', () => {
  // 冷启动 import 在并行/高负载下偶发超过默认 15s → 放宽到 60s，避免误判失败（仅放宽超时，逻辑不变）
  test('组件可以导入', async () => {
    const module = await import('../../pages/UserList');
    expect(module.default).toBeDefined();
  }, 60000);

  test('用户管理hooks可以导入', async () => {
    const hooks = await import('../../hooks');
    expect(hooks).toBeDefined();
  }, 60000);
});

export {};
