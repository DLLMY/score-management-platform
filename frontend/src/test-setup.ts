// Vitest 全局测试环境初始化（CRA 遗留单测复活）
// - 注册 @testing-library/jest-dom 的 DOM matchers（toBeInTheDocument/toHaveClass 等）
// - 兼容 CRA 测试里直接使用全局 jest 对象（jest.fn / jest.mock 等，映射到 vitest 的 vi）
import '@testing-library/jest-dom';
import { vi } from 'vitest';

const jestCompat: Record<string, unknown> = {
  fn: vi.fn,
  mock: vi.mock,
  unmock: vi.unmock,
  spyOn: vi.spyOn,
  clearAllMocks: vi.clearAllMocks,
  resetAllMocks: vi.resetAllMocks,
  restoreAllMocks: vi.restoreAllMocks,
  useFakeTimers: vi.useFakeTimers,
  useRealTimers: vi.useRealTimers,
  advanceTimersByTime: vi.advanceTimersByTime,
};

// @ts-expect-error - 全局注入 jest 兼容对象，供 CRA 遗留测试（jest.fn() 等）使用
globalThis.jest = jestCompat;
