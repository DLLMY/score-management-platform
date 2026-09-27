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
      //   2026-09-26 补测 cacheDB(纯逻辑IndexedDB工具) + ImportExportPanel(导入导出模板主链路)  Stmts 62.80 / Branch 46.19 / Funcs 57.02 / Lines 65.29（v8 文本报告口径预估 ~62.3/45.8/56.3/64.8）
      //     （cacheDB 9 API + 降级 8 用例=17 全绿，覆盖 open/set/get(含过期删除)/delete/clear/byPattern/cleanupExpired/stats + 无 indexedDB 降级；
      //      ImportExportPanel 17 用例全绿，经 props 回调隔离网络 + vi.mock(Modal/PermissionButton/useToast/download/getAuthHeaders)，覆盖文件校验/导入成功失败/导出/错误详情/失败数据CSV/模板权限分支；
      //      ImportExportPanel 12.8%→71.7%、cacheDB 24%→~92%；全量 1337 passed/3 skipped）
      //   2026-09-26 补测 Header + Sidebar 导航布局组件（mock usePermissionStore/useThemeStore/api/router 隔离）  Stmts 65.42 / Branch 49.53 / Funcs 59.62 / Lines 67.88（v8 JSON 口径；文本报告预估 ~64.9/49.0/59.1/67.4）
      //     （Header 16 用例覆盖渲染/搜索/通知中心/主题切换/登出 + fetchNotifications 成功失败401；Sidebar 10 用例覆盖渲染/折叠/分组展开/移动抽屉/Esc/登出/权限加载；全量 1363 passed/3 skipped）
      //      Header 0%→~79%、Sidebar 1.5%→~85%；全局四指标各 +2.5 左右
      //      本轮四指标各 +2 锁住增益（保守留缓冲防 CI 跨环境方差）：Stmts 64(缓冲~0.9) / Branch 48(缓冲~1.0) / Funcs 58(缓冲~1.1) / Lines 66(缓冲~1.4)。
      //   2026-09-26 补测 preloadService(纯类) + useAppState(hook) + LazyImage(组件) + imageOptimization(纯函数)  Stmts 67.13 / Branch 50.63 / Funcs 61.34 / Lines 69.53（v8 文本报告口径）
      //     （preloadService 5.1%→~100%、useAppState 3.3%→98.3%(Branch95.2%/Funcs95.2%)、LazyImage 4.1%→91.8%(Funcs100%)、
      //      imageOptimization 14%→~98%；4 文件共 +45 用例全绿；全量 1408 passed/3 skipped）
      //     本轮四指标各 +2 锁住增益（保守留缓冲防 CI 跨环境方差）：Stmts 66(缓冲~1.1) / Branch 49(缓冲~1.6) / Funcs 60(缓冲~1.3) / Lines 68(缓冲~1.5)。
      //   2026-09-26 补测 ConfirmDialog/BatchActionBar(纯 UI) + useApiFetch(hook) + errorMonitor/performanceReportingService(单例服务) + useModelLogic(hook)
      //     Stmts 69.52 / Branch 52.17 / Funcs 63.58 / Lines 71.86（v8 文本报告口径）
      //     （ConfirmDialog 0%→~100%、BatchActionBar 0%→~98%、useApiFetch 16%→~100%、
      //      errorMonitor 65.6%→~96%、performanceReportingService 50.5%→~97%、useModelLogic 19%→~100%；
      //      6 文件共 +115 用例全绿；全量 1523 passed/3 skipped）
      //     ★ Lines 首次越过 70% 目标线（71.86%）。
      //     本轮四指标各 +2 锁住增益（保守留缓冲防 CI 跨环境方差）：Stmts 68(缓冲~1.5) / Branch 51(缓冲~1.2) / Funcs 62(缓冲~1.6) / Lines 70(缓冲~1.9)。
      //   2026-09-27 补测 dashboard/helpers(纯函数) + useEngagementLogic/useRuleApplicationLogic(hook) + stores/index(5 个 zustand store)
      //     Stmts 71.30 / Branch 53.18 / Funcs 64.80 / Lines 73.66（v8 文本报告口径）
      //     （helpers 8.1%→~100%、useEngagementLogic 33.3%→~98%、useRuleApplicationLogic 27.8%→~100%、
      //      stores/index 69.8%→~97%（含 WebSocketStore 全部事件 handler，既有 stores.test.ts 未覆盖该 store）；
      //      4 文件共 +136 用例全绿；全量 1659 passed/3 skipped）
      //     本轮 Branch/Funcs 实测增益不足 2 点，按「缓冲须 >=1.0」原则只各 +1，避免 CI 跨环境方差变红：
      //     Stmts 70(缓冲~1.3) / Branch 52(缓冲~1.18) / Funcs 63(缓冲~1.8) / Lines 72(缓冲~1.66)。
      //   2026-09-27 B21 补测 DataTable(组件增强 28 例) + useDashboardLogic(hook 10 例) + useAlgorithmAnalysisLogic(hook 11 例)
      //     Stmts 72.58 / Branch 54.42 / Funcs 65.97 / Lines 74.84（v8 JSON 口径，全量 1698 passed/3 skipped/EXIT=0）
      //     （DataTable 重写覆盖 error/empty/自定义/虚拟滚动/分页/排序/selectable/对齐等 28 场景；useDashboardLogic 覆盖挂载加载/兜底/推送/刷新/过滤分组；
      //      useAlgorithmAnalysisLogic 覆盖 Tab 初始/切换自动加载/各算法接口写入/关键词过滤/scrollIntoView；ImportExportPanel 已有 21 例不重复补）
      //     本轮四指标各 +1 锁住增益（实测增益 ~2.4~3.0，保守留缓冲防 CI 跨环境方差）：
      //     Stmts 71(缓冲~1.58) / Branch 53(缓冲~1.42) / Funcs 64(缓冲~1.97) / Lines 73(缓冲~1.84)。
      //   2026-09-27 B22 补测 useAlgorithmAnalysisColumns(纯 hook，4 组列定义 render 闭包全分支)
      //     Stmts 73.14 / Branch 55.90 / Funcs 67.04 / Lines 75.42（v8 JSON 口径，全量 1721 passed/3 skipped/EXIT=0）
      //     （useAlgorithmAnalysisColumns 26 未覆盖函数/112 未覆盖分支 0%→全绿；23 例驱动 predictionDetail/scorePredict/attribution/engagement
      //      四组列每个 render 分支：趋势 up/down/缺省、分数三态着色、has_data 三态、attendance_rate 空值、trend_action 点击/disabled 等；
      //      纯逻辑零网络零 store 依赖，低风险高 ROI）
      //     本轮四指标各 +1 锁住增益（实测增益 Stmts+0.56/Branch+1.48/Funcs+1.07/Lines+0.58，保守留缓冲防 CI 方差）：
      //     Stmts 72(缓冲~1.14) / Branch 54(缓冲~1.9) / Funcs 65(缓冲~2.04) / Lines 74(缓冲~1.42)。
      //   2026-09-27 B23 补测 StudentProfileTab(纯展示组件，4 组区块 render 闭包全分支)
      //     Stmts 73.69 / Branch 57.63 / Funcs 67.61 / Lines 75.99（v8 JSON 口径，全量 1748 passed/3 skipped/EXIT=0）
      //     （StudentProfileTab 16 未覆盖函数/146 未覆盖分支 0%→高覆盖；27 例驱动 deps 不同形状：选择器空态/错误态/加载态/选择交互、
      //      predict+scorePredict 卡片(趋势三态/缺字段兜底/区间/置信度)、riskPredict 三风险级+sub_risks/factors/actions 条件块、
      //      engagement has_data 三态+leave_days+attendance_rate 过滤、anomaly 四卡片(完整/缺失/低危无变化/正常)、attribution 三方向因子+净增+缺数据；
      //      纯 props 驱动零网络零 store 依赖，低风险高 ROI）
      //     本轮锁定增益（缓冲须 >=1.0 防 CI 跨环境方差）：Branch 54→55(缓冲~2.63) / Funcs 65→66(缓冲~1.61)；
      //     Stmts 73.69→ratchet 72(缓冲~1.69，+1 会压至 0.69<1.0 故不抬) / Lines 75.99→ratchet 74(缓冲~1.99，+1 会压至 0.99<1.0 故不抬)。
      //   2026-09-27 B24 补测 RiskPredictTab/AnomalyTab/RuleRecommendTab 三个算法簇纯展示组件（共 33 例全分支）
      //     Stmts 74.21 / Branch 59.23 / Funcs 68.08 / Lines 76.56（v8 JSON 口径，全量 1781 passed/3 skipped/EXIT=0）
      //     （三组件各为纯展示、仅消费 deps 零网络零 store：RiskPredictTab 52 分支/7 函数 0%→覆盖(风险三档/score null/因子 slice>3/actions/导出按钮态/占比)；
      //      AnomalyTab 48 分支/3 函数 0%→覆盖(severity 三档/字段兜底/score_change 符号与非有限/未知 severity 兜底/过滤)；
      //      RuleRecommendTab 36 分支/3 函数 0%→覆盖(impact 正负零配色/字段兜底/confidence 非有限/过滤)；合计 136 分支/13 函数 0%→高覆盖）
      //     本轮四指标各 +1 锁住增益（实测增益 Stmts+0.52/Branch+1.60/Funcs+0.47/Lines+0.57，缓冲均 >=1.0 防 CI 方差）：
      //     Stmts 73(缓冲~1.21) / Branch 56(缓冲~3.23) / Funcs 67(缓冲~1.08) / Lines 75(缓冲~1.56)。
      //   2026-09-27 B25 补测 ParseTab/AnalysisTab/TrainingTab 三个 nlp-management 纯展示组件（共 36 例全分支）
      //     Stmts 74.67 / Branch 61.57 / Funcs 69.11 / Lines 77.05（v8 JSON 口径，全量 1817 passed/3 skipped/EXIT=0）
      //     （三组件各为纯展示、仅消费 deps 零网络零 store：ParseTab 74 分支 0%→覆盖(意图三态/matched_rules>1/相似度 badge/库内匹配/手动修正兜底/纠正记录切换);
      //      AnalysisTab 73 分支 0%→覆盖(准确率三档/缓存命中率三档/意图明细四态/优化策略三选项/基准四项/慢请求/优化建议三优先级);
      //      TrainingTab 48 分支 0%→覆盖(评估四指标 null/训练结果/对比表 best 高亮/训练历史四态+auto_ 前缀剥离/F1 null 兜底/算法下拉+交叉验证);
      //      合计 ~180 分支/0%→高覆盖；测试对 ../../hooks 的 usePermissions 注入 isSuperAdmin:true 以规避 PermissionButton 在测试环境 disabled 导致点击不触发）
      //     本轮锁定增益（缓冲须 >=1.0 防 CI 跨环境方差）：Branch 56→60(缓冲~1.57) / Funcs 67→68(缓冲~1.11) / Lines 75→76(缓冲~1.05)；
      //     Stmts 74.67→ratchet 73(缓冲~1.67，+1 会压至 0.67<1.0 故不抬)。
      // 语义：任一指标低于阈值即非零退出 → CI 变红（vitest 默认 100-阈值语义）。
      // 目标：随关键业务流补测推进，逐步抬高阈值至 70%。
      //   2026-09-27 B26 补测 RulesTab/StatisticsTab/CorrectionModal 三个 nlp-management 组件（共 30 例全分支）
      //     Stmts 75.21 / Branch 61.98 / Funcs 70.22 / Lines 77.63（v8 JSON 口径，全量 1847 passed/3 skipped/EXIT=0）
      //     （RulesTab DataTable+PermissionButton 行操作/列渲染 add/deduct 配色+标签+准确率; StatisticsTab 统计卡片+高频规则+模型指标进度条;
      //      CorrectionModal 含 api.users.getAll 副作用双 mock：学生下拉匹配/意图三按钮/分数解析/标签逗号分隔/描述备注/取消/反馈disabled/保存执行）
      //     ratchet 73/60/68/76 → 74/60/69/76：按「缓冲 >=1.0 防 CI 方差」非均匀抬升——
      //     Stmts 73→74(缓冲~1.21) / Funcs 68→69(缓冲~1.22) 锁增益；Branch 60 与 Lines 76 实测缓冲均 >=1.0 故维持。
      thresholds: {
        statements: 74,
        branches: 60,
        functions: 69,
        lines: 76,
      },
    },
  },
});
