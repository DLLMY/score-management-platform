/**
 * UserList组件测试 - 简化版（vitest 复活版）
 */
/// <reference types="jest" />

describe('UserList Component', () => {
  test('组件可以导入', async () => {
    const module = await import('../../pages/UserList');
    expect(module.default).toBeDefined();
  });

  test('用户管理hooks可以导入', async () => {
    const hooks = await import('../../hooks/useAppState');
    expect(hooks).toBeDefined();
  });
});

export {};
