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
      // 关闭启动期 trash 旧 coverage 目录（沙箱 safe-delete shim 会拦截导致整轮 abort）
      clean: false,
      // 规避中文路径下 html 报告生成伪影：仅输出 text 摘要 + json-summary
      exclude: [
        'src/**/*.test.{js,jsx,ts,tsx}',
        'src/test-setup.ts',
        'src/main.tsx',
        'src/**/*.d.ts',
      ],
      // ── 覆盖率门控（对齐后端 70% ratchet）──
      // 阈值采用「只升不降」ratchet：每次补测后按实测新基线抬高下限，防止覆盖率回退。
      // 实测基线演进（v8，全量 npm test --coverage）：
      //   2026-09-23 首测/补钙            Stmts 28.1 / Branch 19.1 / Funcs 20.9 / Lines 29.8
      //   + api.coverage 数据驱动 383 用例  Stmts 38.0 / Branch 26.7 / Funcs 36.9 / Lines 39.5
      //   2026-09-24 补测 4 个 0% 模块      Stmts 42.9 / Branch 28.6 / Funcs 40.0 / Lines 44.6
      //     （webVitals / useUserListFetch / useScoreEntryActions / useNLPRules，+56 用例全绿）
      //   2026-09-25 补测 9 个 src/hooks 模块  Stmts 48.5 / Branch 31.8 / Funcs 43.5 / Lines 50.3
      //     （useOptimizedFetch/useListData/useListFetch 已测 + useModal/useAutoSave/useStableToast/
      //      useDebouncedValue/useKeyboardShortcut/useUndoRedo/useClassNowStatus，+68 用例全绿）
      //   2026-09-25 补测 userList Crud/Score hooks  Stmts 49.88 / Branch 32.77 / Funcs 44.86 / Lines 51.73
      //     （useUserListCrud/useUserListScore 两个 hook 全参数化测试 +22 用例全绿；全量 947 passed/3 skipped）
      // 本轮将四项阈值统一抬高至「实测值 - 约 0.8~1pt 缓冲」，锁住本轮增益；两次全量实测完全一致（v8 噪声可忽略）。
      // 语义：任一指标低于阈值即非零退出 → CI 变红（vitest 默认 100-阈值语义）。
      // 目标：随关键业务流补测推进，逐步抬高阈值至 70%。
      thresholds: {
        statements: 49,
        branches: 32,
        functions: 44,
        lines: 51,
      },
    },
  },
});
