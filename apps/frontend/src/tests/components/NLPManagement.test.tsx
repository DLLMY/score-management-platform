/**
 * NLPManagement测试 - 简化版（vitest 复活版）
 */
/// <reference types="jest" />

describe('NLPManagement Module', () => {
  test('NLP管理模块可以导入', async () => {
    // 动态 import 在并行全量 run 下偶发模块加载竞态（单跑稳定通过），
    // 测试体内手动重试 3 次以吸收偶发抖动（vitest 4 的 test 第三参仅接受 timeout:number）。
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const module = await import('../../pages/NLPManagement');
        expect(module.default).toBeDefined();
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }, 30000);

  test('AppState hooks可以导入', async () => {
    const hooks = await import('../../hooks');
    expect(hooks).toBeDefined();
  });
});

export {};
