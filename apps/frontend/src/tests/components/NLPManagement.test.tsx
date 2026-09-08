/**
 * NLPManagement测试 - 简化版（vitest 复活版）
 */
/// <reference types="jest" />

describe('NLPManagement Module', () => {
  test('NLP管理模块可以导入', async () => {
    const module = await import('../../pages/NLPManagement');
    expect(module.default).toBeDefined();
  });

  test('AppState hooks可以导入', async () => {
    const hooks = await import('../../hooks/useAppState');
    expect(hooks).toBeDefined();
  });
});

export {};
