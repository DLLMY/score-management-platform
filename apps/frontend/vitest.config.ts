import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Vitest 单测配置（CRA 遗留单测复活，独立于 vite.config.ts）。
 * 运行：npm test（= vitest run）
 * 注意：vitest 4 的 `vitest/config` 不导出 loadEnv，因此不复用 vite.config.ts，
 * 这里独立声明 test 所需的最小配置（react 插件 + jsdom + jest-dom setup）。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // 与 vite.config.ts 保持一致的扩展名解析顺序（.tsx 优先，避免命中遗留 .js）
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    // 默认 5s 在 Windows + 中文路径 + 并行任务竞争下偶发超时（UserList 冷启动 import 曾 5s 超时）
    testTimeout: 15000,
    hookTimeout: 15000,
    // Windows + 中文路径下 forks pool 启动 worker 常超时 → 本地用 threads；
    // CI（Linux）threads pool 报 webidl.markAsUncloneable → CI 用默认 forks。
    pool: process.env.CI ? 'forks' : 'threads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      // 规避中文路径下 html 报告生成伪影：仅输出 text 摘要 + json-summary
      exclude: [
        'src/**/*.test.{js,jsx,ts,tsx}',
        'src/test-setup.ts',
        'src/main.tsx',
        'src/**/*.d.ts',
      ],
      // ── 覆盖率门控（对齐后端 70% ratchet）──
      // 阈值 = 实测基线（2026-09-23，全量 39 测试文件）向下取整留极小缓冲：
      //   Stmts 27.39 / Branch 18.88 / Funcs 20.73 / Lines 28.85
      // 语义：任一指标低于阈值即非零退出 → CI 变红（vitest 默认 100-阈值语义）。
      // 这是「只升不降」的 ratchet 下限：新增代码必须带测试，否则聚合覆盖率下滑会触发失败。
      // 目标：随关键业务流（登录鉴权 / 评分重算 / 手机箱状态机）补测推进，逐步抬高阈值至 70%。
      thresholds: {
        statements: 27,
        branches: 18,
        functions: 20,
        lines: 28,
      },
    },
  },
});
