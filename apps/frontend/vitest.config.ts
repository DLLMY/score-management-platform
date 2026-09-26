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
      //   2026-09-25 补测 remote-notify handlers  Stmts 51.83 / Branch 33.69 / Funcs 45.61 / Lines 53.82
      //     （useRemoteNotifyHandlers 16 个纯 handler 全参数化测试 +47 用例全绿；另 prettier 收口 10 个历史测试文件；
      //      全量 994 passed/3 skipped）
      //   2026-09-25 补测 remote-notify 组合根  Stmts 52.68 / Branch 34.04 / Funcs 46.11 / Lines 54.72
      //     （useRemoteNotifyLogic 真实子 hook 集成测试 +5 用例全绿，装配 ToastProvider + mock services/api；
      //      覆盖挂载 loader/MQTT 探测/deps 装配/buildHistoryColumns/双 useEffect/isDraftMeaningful 双分支；
      //      全量 999 passed/3 skipped）
      //   2026-09-25 补测 remote-notify 8 组件 + columns  Stmts 53.13 / Branch 35.84 / Funcs 47.18 / Lines 55.19
      //     （RemoteNotifyView 组合根渲染 + HistoryPanel/TemplatesPanel/ScheduledPanel/PreviewConfirmModal/
      //      ModeSelector/columns 展示组件测试，共 +19 用例全绿；mock 共享 UI 为 stub 覆盖各面板主路径与条件分支；
      //      remote-notify 模块 Funcs 18.6→37.26、Branch 71.25；全量 1018 passed/3 skipped）
      // 本轮四指标统一抬高锁住增益：Branch 35 缓冲 0.84 / Funcs 47 缓冲 0.18 防 v8 噪声误红。
      //   2026-09-25 补测 scoreEntry 逻辑层(reducer/derived/batch/data/draft)  Stmts 54.57 / Branch 37.10 / Funcs 48.14 / Lines 56.56
      //     （reducer.ts / useScoreEntryBatch / useScoreEntryDraft 100%；useScoreEntryData 94.7S/50B、useScoreEntryDerived 98.4S/93.2B；
      //      5 文件共 +63 用例全绿；全量 1095 passed/3 skipped；scoreEntry 模块 Lines 19.2→76.48 / Stmts 18.5→75.68）
      //     本轮四指标各 +1 锁住增益：Stmts 54(缓冲0.57) / Branch 36(缓冲1.10) / Funcs 48(缓冲0.14) / Lines 56(缓冲0.56)。
      //   2026-09-26 补测 data-display SearchFilter + AdvancedSearchFilter 纯组件  Stmts 56.6 / Branch 39.69 / Funcs 50.32 / Lines 58.71
      //     （两组件均为 props 驱动、无路由/上下文依赖；覆盖输入防抖/清空/回车/筛选 chips/selectFilters/重置、
      //      高级面板展开/关键字/搜索/重置/保存模态/加载/删除已存搜索/日期-状态-分类-班级-积分-排序字段全分支；23 用例全绿；
      //      SearchFilter 0%→100%、AdvancedSearchFilter 0%→100%；全量 1143 passed/3 skipped）
      //      本轮四指标 +1 锁住增益：Stmts 56(缓冲0.6) / Branch 38(缓冲1.69) / Funcs 49(缓冲1.32) / Lines 58(缓冲0.71)。
      //   2026-09-26 补测 userList reducer 纯函数 + data-display 动画组件(Skeleton/AnimatedList/AnimatedScore)  Stmts 57.75 / Branch 40.83 / Funcs 51.17 / Lines 59.92
      //     （reducer 28 action 全分支，含 UPDATE_USER_SCORE 缺分回退为 0、DELETE_USER 总数-1 及页码越界回退；Skeleton 4 个命名导出组件；
      //      AnimatedList 增删动画 + onItemAppear 首现/新增触发；AnimatedScore rAF 动画 + 颜色阈值 + null 显示“--”；32 用例全绿；
      //      userList/reducer 0%→100%、Skeleton 0%→100%、AnimatedList 0%→100%、AnimatedScore 0%→94.4%；全量 1175 passed/3 skipped）
      //      本轮四指标 +1 锁住增益：Stmts 57(缓冲0.75) / Branch 39(缓冲1.83) / Funcs 50(缓冲1.17) / Lines 59(缓冲0.92)。
      //   2026-09-26 补测 userList/columns + data-display/UserTableRow/VirtualList + ui/AdvancedSearch 纯组件  Stmts 58.28 / Branch 41.67 / Funcs 52.31 / Lines 60.48
      //     （columns.buildUserColumns 5 列结构与渲染/排序/操作列 handler；UserTableRow 行渲染/选中/黑名单-启用-禁用/评分编辑删除/memo 比较器；
      //      VirtualList 虚拟化窗口/autoHeight/scroll 同步 rAF 滑动窗/ResizeObserver 有-无分支/keyExtractor/items 变化 reset；AdvancedSearch 六类字段+清除+footer+自定义 label；
      //      4 文件共 +37 用例全绿；UserTableRow 0%→100%、VirtualList 79.54%→97.72%、AdvancedSearch 0%→100%、userList/columns 0%→100%；
      //      全量 1212 passed/3 skipped）
      //      本轮四指标 +1 锁住增益：Stmts 58(缓冲0.28) / Branch 40(缓冲1.67) / Funcs 51(缓冲1.31) / Lines 60(缓冲0.48)。
      //   2026-09-26 补测 nlp-management/columns + hooks/useNLPStatistics + 7 个 UI 基础组件  Stmts 59.07 / Branch 43.42 / Funcs 53.81 / Lines 61.34
      //     （columns 4 工厂 buildRuleColumns/buildTrainingResultColumns/buildPerformanceColumns/buildCorrectionColumns 全分支；useNLPStatistics 成功/失败双分支；
      //      UI 基础组件 Select/Badge/LoadingSpinner/Switch/Textarea/DateRangeField/ClassStatusBadge 纯渲染+交互；9 文件共 +66 用例全绿；
      //      Select/Badge/LoadingSpinner/DateRangeField/ClassStatusBadge 0%→100%、Switch 0%→100%、Textarea 0%→100%、nlp columns 31%→87%+、useNLPStatistics 0%→100%；
      //      全量 1278 passed/3 skipped）
      //      本轮四指标 +1 锁住增益：Stmts 59(本地59.07/CI58.94→回落58留0.94缓冲，跨环境方差) / Branch 41(缓冲2.42) / Funcs 52(缓冲1.81) / Lines 61(缓冲0.34)。
      //   2026-09-26 补测 ErrorBoundary + MemoComponents + api 请求层（v8 文本报告口径）  Stmts 60.31 / Branch 44.13 / Funcs 54.81 / Lines 62.68
      //     （ErrorBoundary 0%→92.2%、MemoComponents 0%→92.5%(Funcs100%)、api.ts 65.1%→66.3%(Funcs78%、Branch41.4%)；三者共 +25 用例全绿；全量 1303 passed/3 skipped）
      //     本轮抬高锁住增益（保守留缓冲防 CI 跨环境方差）：Stmts 60(缓冲0.31) / Branch 43(缓冲1.13) / Funcs 54(缓冲0.81) / Lines 62(缓冲0.68)。
      // 语义：任一指标低于阈值即非零退出 → CI 变红（vitest 默认 100-阈值语义）。
      // 目标：随关键业务流补测推进，逐步抬高阈值至 70%。
      thresholds: {
        statements: 60,
        branches: 43,
        functions: 54,
        lines: 62,
      },
    },
  },
});
