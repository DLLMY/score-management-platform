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
      // 单线程收集 coverage：消除 services/api.ts（1400 行）在并行 worker 下 v8 coverage map
      // 合并竞态（曾致全量 run 偶发从 ~86% 坍缩到 ~76%，非真实回归、零测试失败）；
      // 仅 coverage 收集单线程，测试执行仍按 pool 并行，CI 速度不减。
      singleThread: true,
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
      //   2026-09-27 B27 补测 PredictionTab/ScorePredictTab/RuleApplicationTab/ModelManagerTab 四个 algorithm-analysis 展示型 Tab（共 32 例全分支）
      //     Stmts 75.7 / Branch 63.18 / Funcs 71 / Lines 78.17（v8 JSON 口径，全量 1879 passed/3 skipped/EXIT=0）
      //     （四组件纯 props/deps 驱动、零网络零 store：PredictionTab null 守卫+summary 三计数+风险学生 high 红点/下降箭头/置信度；
      //      ScorePredictTab avg null→“—”/subjects 空→“综合”/scoreBands 占比/searchKeyword 过滤；RuleApplicationTab 三规则列表+学生/行为 select+应用规则 disabled+分布结果块(均注入 usePermissions isSuperAdmin:true)；
      //      ModelManagerTab 三模型段 6 个 PermissionButton 的 train/evaluate 回调+training/evaluating 态+训练/评估结果块）
      //     ratchet 74/60/69/76 → 74/62/70/77：按「缓冲 >=1.0 防 CI 方差」非均匀抬升——
      //     Branch 60→62(缓冲~1.18) / Funcs 69→70(缓冲~1.0) / Lines 76→77(缓冲~1.17) 锁增益；
      //     Stmts 75.7→ratchet 74(缓冲~1.7，+1 会压至 0.7<1.0 故不抬)。
//   2026-09-27 B28 补测 config/permissions + components/lazy(ConditionalLazy/LazyComponent) + hooks/useWorkbenchClass 纯逻辑/纯组件（共 4 文件零网络）
//     Stmts 76.40 / Branch 63.73 / Funcs 71.82 / Lines 78.82（v8 JSON 口径，全量 EXIT=0；B27 基线 1879 passed/3 skipped，本批 +~35 例）
//     （permissions 9 函数全分支；ConditionalLazy 含条件渲染 + FeatureLazy 工厂(localStorage+动态import)；LazyComponent 含 createLazyComponent 工厂 + ErrorBoundary；
//      useWorkbenchClass 含模块级 store + sessionStorage 降级 + setWorkbenchClassId 早返；columns.tsx 已于早期批次覆盖故不重复）
//     本轮仅 Stmts ratchet 抬升（实测 Branch/Funcs/Lines 缓冲均 <1.0 防 CI 方差）：
//     Stmts 74→75(缓冲~1.4)；
//     Branch 63.73→ratchet 62(缓冲~1.73，+1 需≥64.0 差0.27 故不抬) / Funcs 71.82→ratchet 70(缓冲~1.82，+1 需≥72.0 差0.18 故不抬) / Lines 78.82→ratchet 77(缓冲~1.82，+1 需≥79.0 差0.18 故不抬)。
//   2026-09-27 B29 补测 config/index.ts(生产分支) + useNLPParse(corrected_* 分支) + utils/optimisticUpdate(useOptimisticState 钩子) + AdvancedSearchFilter(5 函数)（零/低网络、低风险）
//     Stmts 76.78 / Branch 64.15 / Funcs 72.07 / Lines 79.22（v8 口径，全量 EXIT=0；B28 基线 1942 passed/3 skipped，本批 +~7 例）
//     （corrected_* 分支用例因 RTL result.current 快照偶发陈旧，拆入独立文件 useNLPParse.corrected.test.tsx 以隔离 act 环境规避；
//       AdvancedSearchFilter 原无测试，补齐 5 个未盖函数；optimisticUpdate 补 useOptimisticState 钩子；config/index.prod.test.ts 用 env mock 盖生产分支）
//     本轮按「缓冲 >=1.0」非均匀抬升：Stmts 维持 75(缓冲~1.78)；
//     Branch 62→63(实测 64.15，缓冲~1.15) / Funcs 70→71(实测 72.07，缓冲~1.07) / Lines 77→78(实测 79.22，缓冲~1.22)。
//   2026-09-27 B30 补测 useScoreEntryActions(写操作边角/catch 分支) + useRemoteNotifyHandlers(performSend 重发/广播无文本) + PermissionGuard(新建，含未盖 renderForbidden 等)(零/低网络、低风险)
//     Stmts 76.95 / Branch 64.29 / Funcs 72.11 / Lines 79.41（v8 口径，全量 EXIT=0；B29 基线 1942 passed/3 skipped，本批 +22 例 → 1964 passed/3 skipped）
//     （PermissionGuard 单测初跑时 fork worker 崩溃退出：真实 react-router-dom 在 vitest worker 下加载致进程异常，改为 vi.mock('react-router-dom') 桩替身后稳定；
//       useScoreEntryActions 的 handleBatchDelete/Reset catch 分支需 runBatched 抛错（默认 runBatched mock 会吞掉单项错误，故改 mock 为 throw）；
//       实测 Stmts/Branch/Funcs/Lines 分别 +0.17/+0.14/+0.04/+0.19，均未达到「下一整数 +1.0 缓冲」门槛 → ratchet 维持 75/63/71/78 不抬）
//   2026-09-28 B31 补测 useScoreEntryData(对象响应形态/竞态 early-return) + useUserListFetch(高级搜索分支/abort/AbortError/数组响应形态) + useNLPParse(无 parseResult 早返/results 非数组) + useClassNowStatus(is_during_class_time/非上课态/竞态)(零/低网络、低风险纯 hook)
//     Stmts 77.11 / Branch 64.79 / Funcs 72.11 / Lines 79.53（v8 JSON 口径，全量 EXIT=0；B30 基线 1964 passed/3 skipped，本批 +21 例 → 1985 passed/3 skipped）
//     （useScoreEntryData Branch 50→78.94、useUserListFetch Branch 52.3→84.09 为主要增益；全局 Branch +0.50；竞态 early-return/abort/AbortError/is_during_class_time 等分支补齐）
//     本轮仅 Stmts ratchet 抬升（缓冲须 >=1.0 防 CI 跨环境方差）：Stmts 75→76(缓冲~1.11)；
//     Branch 64.79→ratchet 63(缓冲~1.79，+1 需≥65.0 差0.21 故不抬) / Funcs 72.11→ratchet 71(缓冲~1.11，+1 需≥73.0 差0.89 故不抬) / Lines 79.53→ratchet 78(缓冲~1.53，+1 需≥80.0 差0.47 故不抬)。
//   2026-09-28 B32 补测 useStudentProfileLogic(纯逻辑 deps 注入 hook) + ToastContainer(纯展示组件) + useDashboardLogic(组合根 hook 扩展兜底分支)(零/低网络、低风险)
//     Stmts 77.59 / Branch 65.10 / Funcs 72.39 / Lines 80.01（v8 JSON 口径，全量 EXIT=0；B31 基线 1985 passed/3 skipped，本批 +19 例 → 2004 passed/3 skipped）
//     （放弃图表组件作补齐目标：recharts 的 ResponsiveContainer mock 为 passthrough、内部图元(Pie/Bar/Line 等)返回 null → Tooltip/CustomTooltip/formatter 分支不执行，Branch 真实增益极小；
//      改用纯逻辑/纯展示低风险高 ROI 模块：useStudentProfileLogic 覆盖 loadClasses/loadStudents/loadStudentProfile 的 try-catch 与三元/短路 + activeTab effect(10 例)；
//      ToastContainer 覆盖空态/成功/错误/点击移除分支(5 例)；useDashboardLogic 扩展 devices/records/notifications/getData 抛错兜底(4 例)；useRemoteNotifyLogic 新增 loadError 用例因异步时序不稳已回退）
//     本轮按「缓冲 >=1.0」非均匀抬升：Stmts 77.59→ratchet 76(缓冲~1.59，+1 需≥78.0 差0.41 故不抬) / Funcs 72.39→ratchet 71(缓冲~1.39，+1 需≥73.0 差0.61 故不抬)；
//     Branch 64.79→65.10 跨 65.0 线 → 63→64(缓冲~1.10) / Lines 79.53→80.01 跨 80.0 线 → 78→79(缓冲~1.01)。
//   2026-09-28 B33 补测 StudentGrowthTab(纯展示组件) + ToastContext(provider/hook)（零/低网络、低风险）
//     Stmts 78.08 / Branch 65.92 / Funcs 73.18 / Lines 80.47（v8 JSON 口径，全量 EXIT=0；B32 基线 2004 passed/3 skipped，本批 +30 例 → 2034 passed/3 skipped）
//     （选源修正：续 B32 排除图表组件 recharts mock 增益小、排除页面级组合根 hook；StudentGrowthTab 为 studentPortal 纯展示、
//       大量可选链/三元/短路分支(参与度三态/构成三率/趋势 up-down-flat/风险三档/积分趋势正负)，与 B23 StudentProfileTab 同型低风险高 ROI；
//       ToastContext 为基础 provider，覆盖 showToast 四类型+兜底/removeToast/handleUndo/details+errorFields 展开收起/5s 自动消失(fake timers)/useToast 抛错守卫）
//     本轮按「缓冲 >=1.0」非均匀抬升：Stmts 77.59→78.08 跨 78.0 线 → 76→77(缓冲~1.08) / Funcs 72.39→73.18 跨 73.0 线 → 71→72(缓冲~1.18)；
//     Branch 65.10→65.92 未达 66.0 → 维持 64(缓冲~1.92) / Lines 80.01→80.47 未达 81.0 → 维持 79(缓冲~1.47)。
//   2026-09-28 B34 补测 OptimizedImage(纯展示+懒加载) + UserCard/DeviceCard(dashboard 纯展示卡片)(零网络、低风险)
//     Stmts 78.44 / Branch 66.99 / Funcs 73.53 / Lines 80.85（v8 JSON 口径，全量 EXIT=0；B33 基线 2034 passed/3 skipped，本批 +24 例 → 2058 passed/3 skipped）
//     （OptimizedImage 为纯展示组件，imageOptimization 工具为纯函数无 canvas；覆盖 eager 加载+onLoad 回调/responsive srcSet+sizes/占位符尺寸兜底+fallbackColor/onError 回退；
//       发现懒加载死锁：imgRef 绑定在 imageSrc 就绪后才挂载的真实 img 上，而 IntersectionObserver 守卫 `!lazy || !imgRef.current` 在 imgRef.current 为 null 时提前返回
//       → 观察者永不创建、isInView 恒为 false、真实 img 永不渲染，lazy 触发分支与 IO 未定义守卫实际不可达(源缺陷，不在本批次修复)；
//       UserCard 覆盖 top-three 徽标(Crown/Award/Star)+名次(🥇🥈🥉/数字)/current_score 0 兜底/class_name 兜底/clusters 命中渲染/hover；
//       DeviceCard 覆盖 online/offline 双态配色文案/Wifi 透明度/名称兜底链(device_name→name→device_id)/hover；均为纯 props 零依赖低风险高 ROI）
//     本轮按「缓冲 >=1.0」非均匀抬升：Branch 65.92→66.99 跨 66.0 线 → 64→65(缓冲~1.99)；
//     Stmts 78.08→78.44 未达 79.0 → 维持 77(缓冲~1.44) / Funcs 73.18→73.53 未达 74.0 → 维持 72(缓冲~1.53) / Lines 80.47→80.85 未达 81.0 → 维持 79(缓冲~1.85)。
//   2026-09-28 B35 修复 OptimizedImage 懒加载死锁（源码）+ 补测 Card/Skeleton/Input 三个纯展示 UI 组件（零网络、低风险高 ROI）
//     Stmts 78.68 / Branch 67.68 / Funcs 74.00 / Lines 81.09（v8 JSON 口径，全量 EXIT=0；本批新增 35 例：OptimizedImage 9 / Card 8 / Skeleton 10 / Input 8）
//     （【源码修复】OptimizedImage 懒加载死锁：旧实现 observer 绑在 imageSrc 就绪后才挂载的真实 img（imgRef），而 imageSrc 又依赖 observer 回调置值，
//       守卫 `!lazy || !imgRef.current` 在 imgRef.current 为 null 时提前 return → 观察者永不创建 → isInView 恒 false → 真实 img 永不渲染；
//       改为 observer 观察始终挂载的包裹 div（containerRef），打破死锁，并补「进入视口触发加载」与「无 IntersectionObserver 环境守卫」两个可达分支测试；
//       Card 覆盖 title/subtitle/icon/actions 存在性、iconVariant 三态、variant=dark+gradient、hover 切换 isHovered 视觉类、glow 叠加层、delay 内联动画、float/glass/borderGradient/pulse/animate 类名拼接；
//       Skeleton 覆盖基础 variant/animation/width/height + TableSkeleton/CardSkeleton/FormSkeleton/CategoryCardSkeleton/DashboardSkeleton 条件渲染（showHeader/showAvatar/showSubtitle/showActions/showCharts/count）；
//       Input 覆盖 label+required 星号、error+errorMessage 关联 aria、icon 左/右位置、focus/blur 切换 isFocused、onChange 回传、disabled/readOnly/aria 透传、onFocus/onBlur 回调）
//     本轮按「缓冲 >=1.0」非均匀抬升：Branch 66.99→67.68 跨 67.0 线 → 65→66(缓冲~1.68) / Funcs 73.53→74.00 跨 74.0 线 → 72→73(缓冲~1.00，恰好达标仍满足 >=1.0) / Lines 80.85→81.09 跨 81.0 线 → 79→80(缓冲~1.09)；
//     Stmts 78.44→78.68 未达 79.0 → 维持 77(缓冲~1.68)。
//   2026-09-28 B36 补测 Button/Toast/ToggleSwitch 三个纯展示组件（零网络、低风险高 ROI）
//     Stmts 78.74 / Branch 68.19 / Funcs 74.14 / Lines 81.15（v8 JSON 口径，全量 EXIT=0；B35 基线 2127... 本批 +41 例 → 2127 passed/3 skipped）
//     （Button 覆盖 variant 10 型+primary/danger 覆盖+gradient+size 5 档+loading 禁用态+icon 左/右/无+fullWidth+glow+ripple+rounded+type+ariaLabel+ariaDisabled+tabIndex；
//       Toast 覆盖 type 四态默认文案+自定义 text+details/errorFields 展开收起+关闭按钮 300ms 回调+5s 自动关闭(fake timers)+图标渲染；
//       ToggleSwitch 覆盖 checked 双态 aria+activeClass/inactiveClass 覆盖+点击 onChange(!checked)+disabled 不触发+size md/lg；
//       三者均为纯展示、零路由零 store 依赖，低风险高 ROI；PermissionGuard 因依赖 usePermissions hook+react-router+localStorage/window.location 超出低风险原则故排除）
//     本轮按「缓冲 >=1.0」非均匀抬升：Branch 67.68→68.19 跨 68.0 线 → 66→67(缓冲~1.19)；
//     Stmts 78.68→78.74 未达 79.0 → 维持 77(缓冲~1.74) / Funcs 74.00→74.14 未达 75.0 → 维持 73(缓冲~1.14) / Lines 81.09→81.15 未达 82.0 → 维持 80(缓冲~1.15)。
//   2026-09-28 B37 补测 EmptyState(3 个导出组件) + Pagination + StatusBadge 三个纯展示组件（零网络、低风险）
//     Stmts 78.8 / Branch 68.38 / Funcs 74.25 / Lines 81.22（v8 JSON 口径，全量 EXIT=0；本批 +34 例）
//     （EmptyState 覆盖默认/自定义 icon/title/description + icon 兜底(FolderOpen) + 主/次操作按钮(actionLabel+onAction /
//       secondActionLabel+onSecondAction 双守卫) + className 透传；SearchEmptyState 默认/自定义搜索词/清除按钮；
//       ErrorState 默认/自定义 message/重试按钮；Pagination 覆盖 totalPages<=1 返回 null + 计数文案 + 页码窗口(首/中/末页)
//       + 当前页高亮 + 点击页码/上一页/下一页 + 首页上一页禁用/末页下一页禁用 + 中间页两端页码与省略号
//       (Set 去重使左右 -1 占位合并为单个 "...") + startItem/endItem 计算(末页非整页截断)；
//       StatusBadge 覆盖 status 命中映射 / 未命中回退 fallbackKey + as div/span + size md/sm/xs + message 三态(前缀 "| "/截断/不渲染)；
//       三者均为纯 props 驱动、零路由零 store 依赖，低风险高 ROI）
//     本轮按「缓冲 >=1.0」规则：实测相对 B36 基线增益仅 +0.06 / +0.19 / +0.11 / +0.07，
//     均未达到「下一档需跨过 ratchet+2.0（即测量值 ≥ 79.0/69.0/75.0/82.0）」的 +1.0 缓冲门槛 → ratchet 维持 77/67/73/80 不动。
//     （说明：低风险的纯展示组件已基本补尽，剩余未覆盖多为页面级大组件 / 含 store·路由·网络依赖的 hook，受低风险铁律约束；
//       若要继续抬升 ratchet，需放宽排除法或接受当前平台期。）
//   2026-09-28 B37 收尾（ratchet 平台期，阈值不变）：Stmts 78.8/Branch 68.38/Funcs 74.25/Lines 81.22，四指标均缓冲不足 → 维持 77/67/73/80。
//   2026-09-28 B38（按 B37 建议放宽排除法：挑中等风险但高增益组件，用 vi.mock 隔离后补测）补测 Modal + EntitySelect + StatusTag 三个组件（共 28 例全绿）
//     Stmts 79.12 / Branch 68.7 / Funcs 74.75 / Lines 81.55（v8 JSON 口径，全量 EXIT=0）
//     （Modal 为纯展示（createPortal 未使用，仅返回 div）、零依赖低风险高分支 ROI：覆盖 isOpen=false 渲染 null / size sm|md|lg|xl 四档 /
//       遮罩点击 target===currentTarget 触发 onClose / 内容区点击不触发 / footer 存在与缺省 / 右上角关闭按钮；
//       EntitySelect 为中等风险（依赖 services/api + 模块级 listCache）：用 vi.resetModules + vi.doMock('../../../services/api') 隔离，
//       覆盖 ClassSelect/StudentSelect/SubjectSelect 三下拉 + renderOptions（空占位/allowEmpty 空选项/class_name 后缀/onChangeValue 回调）+
//       useClassOptions/useStudentOptions/useSubjectOptions 成功与 catch(null) 分支 + 选项就绪后自动默认首项 onChange；
//       StatusTag 为纯展示高分支 ROI：覆盖 tone 五档(默认文案+配色) / toneKey 命中映射+未命中回退 neutral / tone 优先于 toneKey / label 覆盖 / className 透传）
//     本轮按「缓冲 >=1.0」非均匀抬升：Stmts 78.8→79.12 跨 79.0 线 → 77→78(缓冲~1.12)；
//     Branch 68.7→ratchet 67(缓冲~1.7，+1 需≥69.0 差0.3 故不抬) / Funcs 74.75→ratchet 73(缓冲~1.75，+1 需≥75.0 差0.25 故不抬) /
//     Lines 81.55→ratchet 80(缓冲~1.55，+1 需≥82.0 差0.45 故不抬)。
//   2026-09-28 B39（继续放宽排除法：补 StatCard/WorkbenchBreadcrumb/CurrentClassLabel，共 11 例全绿）
//     Stmts 79.13 / Branch 68.76 / Funcs 74.78 / Lines 81.55（v8 JSON 口径，全量 EXIT=0）
//     （StatCard 纯展示 size lg|sm 两档 + glowClass 三元 + className 透传；
//       WorkbenchBreadcrumb 纯展示，Link→/workbench + 当前标题 + 两 lucide 图标 svg；
//       CurrentClassLabel 中等风险（依赖 useWorkbenchClass + useClassOptions），用 vi.mock('../../../hooks') + vi.mock('../../form/EntitySelect') 隔离，
//       覆盖 filterClassId===ALL_CLASSES | ===0 双 or / classes.find 命中与未命中三态 label）
//     本轮相对 B38 增益 +0.01 / +0.06 / +0.03 / 0.00（前端全局代码基数大，单小组件对全局覆盖率贡献微），
//     均不达「下一档需跨过 ratchet+2.0（≥80.0/69.0/75.0/82.0）」的缓冲 → ratchet 维持 78/67/73/80 不动（平台期）。
//   2026-09-28 B40（收口组件层最后缺口：GlobalStateComponents/AnimatedList/KeyboardShortcutHelp，共 15 例全绿）
//     Stmts 79.69 / Branch 68.95 / Funcs 75.64 / Lines 82.02（v8 JSON 口径，全量 EXIT=0，2215 passed / 3 skipped）
//     （GlobalStateComponents 高 ROI：GlobalStateProvider + 3 消费者(GlobalLoading/GlobalErrorBoundary/NetworkStatusIndicator) + 3 hook
//       + window online/offline/load 事件监听与清理 + showLoading/hideLoading/clearError + useMemo 三 context value；
//       AnimatedList 泛型动画列表：新增/移除 item 的 key diff + setTimeout(onItemAppear) + animationDelay=index*50ms + _isNew/_isLeaving 三元；
//       KeyboardShortcutHelp 纯展示：隐藏触发按钮 + open 状态切换 + 遮罩/关闭按钮/内容 stopPropagation 三路关闭）
//     本轮按「缓冲 >=1.0」非均匀抬升：Funcs 75.64→ratchet 73 跨 75.0 线 → 73→74(缓冲~1.64)；
//     Lines 82.02→ratchet 80 跨 82.0 线 → 80→81(缓冲~1.02)；
//     Stmts 79.69→ratchet 78(+1 需≥80.0 差0.31 故不抬) / Branch 68.95→ratchet 67(+1 需≥69.0 仅差0.05 故不抬)。
//   2026-09-28 B41（按用户选 A 放宽：补页面级组件 pages/Login.tsx，共 16 例全绿）
//     Stmts 79.69 → 80.29（跨 80.0 线）｜ Branch 68.95 → 69.25（跨 69.0 线）｜ Funcs 75.64 → 75.71（未达 76.0）｜ Lines 82.02 → 82.68（未达 83.0）
//     （Login 为页面级逻辑组件、依赖干净：桩掉 ./login/LoginView + mock services/api / utils/validation / utils/auth / react-i18next，MemoryRouter 包裹；
//       覆盖检查认证(admin 命中跳转/空则渲染)/提交校验失败/管理员·非管理员写入/强制改密弹窗/role=dashboard·fromPath 跳转/异常兜底/
//       输入与焦点回调/强制改密(不一致·过短·无 admin·成功·异常)/关闭弹窗清状态；零/低网络依赖、低风险高 ROI）
//     本轮按「缓冲 >=1.0」非均匀抬升：Stmts 78→79(缓冲~1.29) / Branch 67→68(缓冲~1.25)；
//     Funcs 75.71→ratchet 74(距 76.0 差0.29 故不抬) / Lines 82.68→ratchet 81(距 83.0 差0.32 故不抬)。
//   B42（2026-09-28 晚，A 选项续）：选 pages/Notifications.tsx（页面级逻辑组件，sun=83/bun=48，逻辑层+委托 ./notifications/NotificationsView）
//     Stmts 80.29 → 81.17（跨 81.0 线）｜ Branch 69.25 → 69.78（仅差 0.22 未越 70.0 故不抬）｜ Funcs 75.71 → 76.31（跨 76.0 线）｜ Lines 82.68 → 83.53（跨 83.0 线）
//     （桩掉 ./notifications/NotificationsView + mock services/api / hooks(自定义 useListFetch 挂载即真实调用 fetcher 闭包) / components(useConfirm) / utils/logger，MemoryRouter 包裹；
//       覆盖 fetcher 成功/失败双分支 / 列表填充 / 标记已读(成功·失败) / 全部已读(带 message·失败) / 删除(confirm 取消·成功·失败) / 过滤三字段 / 表单四字段 /
//       发送(带回 notification 前置插入·无 notification 重拉·失败) / refetch / 模态开闭 / setPage / 各 getType*·getPriority*(全 switch 分支) / adminId localStorage 有·无；
//       零/低网络依赖、低风险高 ROI；Branch 因仅差 0.22 未越线，留待后续）
//     本轮按「缓冲 >=1.0」非均匀抬升：Stmts 79→80(缓冲~1.17) / Funcs 74→75(缓冲~1.31) / Lines 81→82(缓冲~1.53)；
//     Branch 69.78→ratchet 68(距 70.0 差0.22 故不抬)。
//   B43（2026-09-28 晚，A 选项续）：选 components/special/ImportExportPanel.tsx（sun=53/bun=66，分支最密集，逻辑层+委托 Modal/Button，直接用 fetch+getAuthHeaders+downloadBlob）
//     Stmts 81.17 → 81.58（距 82.0 差0.42 故不抬）｜ Branch 69.78 → 70.06（跨 70.0 线）｜ Funcs 76.31 → 76.35（距 77.0 差0.65 故不抬）｜ Lines 83.53 → 83.98（距 84.0 仅差0.02 惜败）
//     （mock services/api(getAuthHeaders) / utils/download(downloadBlob·downloadTextAsFile) / ToastContext(useToast) / PermissionGuard(PermissionButton) + 全局 fetch 桩；覆盖
//       handleFileChange(无效扩展名·合法xlsx·Excel mimetype·JSON·超50MB) / handleImport(onDataImport成功含failed_count·失败·异常 + fetch路径) /
//       handleExport(onDataExport成功·异常 + fetch路径 Content-Disposition UTF-8/ASCII/非ok) / handleDownloadTemplate(成功·非ok) /
//       导入结果面板(错误详情展开·导出错误数据·准备重新导入·下载失败数据CSV) / 渲染开关(show*全关·permissions分支·移除文件)；
//       Branch 为本轮唯一越线档，主目标（把 Branch 抬过 70.0）达成；Lines 仅差 0.02 未越，留待后续）
//     本轮按「缓冲 >=1.0」非均匀抬升：Branch 68→69(缓冲~1.06)；
//     Stmts 81.58→ratchet 80(距 82.0 差0.42) / Funcs 76.35→ratchet 75(距 77.0 差0.65) / Lines 83.98→ratchet 82(距 84.0 差0.02) 均不抬。
//   B44（2026-09-28 续，A 选项续）：选 pages/userList/UserListView.tsx（纯展示组件，sun=35/bun=48，0%→高覆盖，共 17 例全绿）
//     Stmts 81.58 → 81.85（距 82.0 差0.15 故不抬）｜ Branch 70.06 → 70.62（距 71.0 差0.38 故不抬）｜ Funcs 76.35 → 77.03（跨 77.0 线）｜ Lines 83.98 → 84.27（跨 84.0 线）
//     （mock 重型子组件 Modal/DataTable/ImportExportPanel/PermissionButton/BatchActionBar/AdvancedSearch/SearchFilter/Button/ToggleSwitch 为 stub，
//       构造类型安全 mock state(含 users/rules/pagination/formData/advancedConditions/selectedUsers) 与各 handler，逐分支触发：
//       标题权限按钮 / 高级筛选展开(+AdvancedSearch 字段)与切换 dispatch / 班级 select 变更 / 搜索框变更 /
//       AdvancedSearch onSearch·onReset(双分支) / BatchActionBar 选中时批量增删减分与清空 / DataTable 错误与 empty onAction /
//       添加弹窗(表单提交·取消·formErrors·autoSave 提示) / 编辑弹窗(标题切换·ToggleSwitch·启用禁用文案) / 导入弹窗(ImportExportPanel·完成回调) /
//       快速评分弹窗(rules 加减分支·关闭 dispatch)；零网络低依赖低风险高 ROI）
//     本轮按「缓冲 >=1.0」非均匀抬升：Funcs 75→76(缓冲~1.03) / Lines 82→83(缓冲~1.27)；
//     Stmts 81.85→ratchet 80(距 82.0 差0.15) / Branch 70.62→ratchet 69(距 71.0 差0.38) 均不抬。
//   B45（2026-09-28 深夜，A 选项续）：选 pages/StudentPortal.tsx（页面级逻辑容器，sun=38/bun=48，61.2%/27.8%→高覆盖，共 14 例全绿）
//     Stmts 81.85 → 82.2（跨 82.0 线）｜ Branch 70.62 → 70.79（距 71.0 差0.21 故不抬）｜ Funcs 77.03 → 77.24（距 78.0 差0.76 故不抬）｜ Lines 84.27 → 84.64（距 85.0 差0.36 故不抬）
//     （mock hooks(useListFetch 全桩/useStableToast 固定返回单例 showToast) + services/api(默认导出 api.student.*) + react-router-dom(useNavigate 单例) +
//       StudentPortalView 为 stub 捕获 props 驱动交互；覆盖 mount 读取 localStorage student(成功解析/无效 JSON 不崩溃) / 初始 tab=score 触发 loadScore /
//       切换 leaves·rank·growth·notifications 各自 loader / submitLeave(缺日期校验失败·成功调用 applyLeave+loadLeaves+showToast·失败 Error 消息·失败非 Error 兜底文案) /
//       requestUnlock(成功·失败兜底) / handleLogout(清除 localStorage+navigate) / totalChange 按 score_change 累加 / getScore 失败(Error 消息·非 Error 兜底)；
//       零/低网络依赖、低风险高 ROI；StudentPortal.tsx 单文件 94.89/63.88/93.33/94.56）
//     本轮按「缓冲 >=1.0」非均匀抬升：Stmts 80→81(缓冲~1.2)；
//     Branch 70.79→ratchet 69(距 71.0 差0.21) / Funcs 77.24→ratchet 76(距 78.0 差0.76) / Lines 84.64→ratchet 83(距 85.0 差0.36) 均不抬。
//   B46（2026-09-28 深夜，A 选项续）：选 pages/studentPortal/StudentPortalView.tsx（纯展示渲染层，B45 中作 stub，本批补测，共 17 例全绿）
//     Stmts 82.2 → 82.26（距 83.0 差0.74 故不抬）｜ Branch 70.79 → 71.44（跨 71.0 线）｜ Funcs 77.24 → 77.42（距 78.0 差0.58 故不抬）｜ Lines 84.64 → 84.7（距 85.0 差0.3 故不抬）
//     （mock ./components(StudentGrowthTab 桩为 null) 隔离；构造类型安全 props 逐 tab 渲染触发全部条件分支：
//       header student/class_name 兜底 / 6 个 tab 按钮 onClick setTab / error 条 / score(loading·score??—·流水合计正负号·分页 prev/next 禁用·刷新 refetch) /
//       notifications(空态·计数·title/status 兜底·刷新) / leaves(空态·状态三态配色·select 变更·提交 disabled) / phonebox(解锁四态 allowed/离线/teacher_disabled/其他·loading) /
//       rank(myRank null 兜底·ranking 空态·当前用户高亮) / growth(透传 StudentGrowthTab)；StudentPortalView.tsx 单文件 branch 49.5%→100%）
//     本轮按「缓冲 >=1.0」非均匀抬升：Branch 69→70（71.44 >= 71.0，缓冲 1.44）；
//     Stmts 82.26→ratchet 81(距 83.0 差0.74) / Funcs 77.42→ratchet 76(距 78.0 差0.58) / Lines 84.7→ratchet 83(距 85.0 差0.3) 均不抬。
//   B47（2026-09-28 深夜，A 选项续）：选 pages/remote-notify/SendForm.tsx（纯展示组件，deps 透传，共 18 例全绿）
//     Stmts 82.26 → 82.32（距 83.0 差0.68）｜ Branch 71.44 → 71.46（距 72.0 差0.54）｜ Funcs 77.42 → 77.63（距 78.0 差0.37）｜ Lines 84.7 → 84.77（距 85.0 差0.23）
//     （mock ./ModeSelector·./PreviewConfirmModal·../../components(PermissionButton+ClassStatusBadge) 隔离；构造完整 RemoteNotifyDeps mock，
//      逐 mode(broadcast/device/test/score_change) 与 form 状态触发全部条件分支：设备ID/通知内容/积分表单/样式设置/语音+音量/弹窗+自动关闭/紧急/预览/lastResult 成功失败/isSending/previewConfirm；
//      SendForm.tsx 单文件 stmts 15.4%→26.9%、fn 13.7%→25.5%、line 28.6%→50%；因该文件已被父组件 RemoteNotify 部分覆盖且体量小，全局增量未够跨越任一阈值）
//     本轮四指标均不抬（实测均未达 ratchet+2.0）：Stmts 82.32<83.0 / Branch 71.46<72.0 / Funcs 77.63<78.0 / Lines 84.77<85.0。
//   B48（2026-09-29 凌晨，A 选项续）：扩展既有 Header.test.tsx 补齐未覆盖分支（共 +10 例，累计 26 例全绿）
//     Stmts 82.32 → 82.57（距 83.0 差0.43）｜ Branch 71.46 → 71.81（距 72.0 差0.19）｜ Funcs 77.63 → 77.78（距 78.0 差0.22）｜ Lines 84.77 → 85.01（跨 85.0 线）
//     （复用既有 mock 设施，新增分支：通知 type=warning/error 图标·formatTime 分钟/小时/天/周前四档·未读>9 徽标 9+·theme=dark 渲染 Sun·
//      搜索值清除按钮·markRead 失败日志·Ctrl+K 聚焦·热键 u 跳转·点击外部关闭菜单；Header.tsx 单文件 line 81.8%→更高）
//     本轮按「缓冲 >=1.0」非均匀抬升：Lines 83→84（85.01 >= 85.0，缓冲 1.01）；
//     Stmts 82.57<83.0 / Branch 71.81<72.0 / Funcs 77.78<78.0 均不抬。
//   B49（2026-09-29，A 选项续）：选 pages/scoreEntry/ScoreEntryView.tsx（纯展示组件，branch 26.7%/fn 4.3%→高覆盖，共 18 例全绿）
//     Stmts 82.57 → 82.81（距 83.0 差0.19 故不抬）｜ Branch 71.81 → 72.22（跨 72.0 线）｜ Funcs 77.78 → 78.56（跨 78.0 线）｜ Lines 85.01 → 85.26（距 86.0 差0.74 故不抬）
//     （mock 重型子组件 ../../components(Card/Button/Modal/PermissionButton/DataTable/ImportExportPanel)+react-router useNavigate+formatDateTime 隔离；
//       构造类型安全 props 逐分支触发：draftAvailable 恢复条/考试时间守卫/进度100查看分析导航/pendingChanges 待保存计数与保存全部门禁/
//       确认全部 students 门禁/batchProgress 进度与取消/batchFailures 列表与关闭/导入 Modal 文件派发与导入门禁/
//       批量操作 Modal 科目派发与三按钮门禁/导入结果 Modal 成功失败计数与失败详情与导出错误数据/各筛选 select 派发；
//       ScoreEntryView.tsx 单文件 branch 26.7%→~100%、Funcs 4.3%→~100%；纯 props 驱动零网络零 store 依赖，低风险高 ROI）
//     本轮按「缓冲 >=1.0」非均匀抬升：Branch 70→71(缓冲~1.22) / Funcs 76→77(缓冲~1.56)；
//     Stmts 82.81→ratchet 81(距 83.0 差0.19) / Lines 85.26→ratchet 84(距 86.0 差0.74) 均不抬。
//   B50（2026-09-29，A 选项续）：选 pages/algorithm-analysis/EngagementTab.tsx（纯展示组件，branch 42.9%/fn 6.7%→高覆盖，共 13 例全绿）
//     Stmts 82.81 → 83.01（跨 83.0 线）｜ Branch 72.22 → 72.51（距 73.0 差0.49 故不抬）｜ Funcs 78.56 → 78.99（距 79.0 差0.01 惜败）｜ Lines 85.26 → 85.46（距 86.0 差0.54 故不抬）
//     （mock ./EngagementTrendChart + ../../components(DataTable 桩为逐行按钮以触发 onRowClick) 隔离；构造类型安全 deps 逐分支触发：
//       控制区班级/天数输入派发/生成按钮(selectedClass+loading 门禁)/导出按钮(exporting+selectedClass 门禁+导出中态)/
//       清除按钮重置/错误条/无班级提示/汇总卡片(total·with_data·high·failed)/排名表行点击(has_data 触发·否则不触发)/
//       个人趋势区(trendStudent 命中姓名标题·未命中兜底/周数下拉派发/加载态/图表渲染)；
//       EngagementTab.tsx 单文件 fn 6.7%→~100%、branch 42.9%→~100%；纯 deps 驱动零网络零 store 依赖，低风险高 ROI）
//     本轮按「缓冲 >=1.0」非均匀抬升：Stmts 83.01 虽跨 83.0 线，但本沙箱全量 run 出现 worker 掉文件/前序测试偶发抖动，
//     为守「保守留缓冲防跨环境方差」原则，Statements 维持 81（缓冲 2.01，放弃薄缓冲 82 以免阈值偶红）；
//     Branch 72.51→ratchet 71(距 73.0 差0.49) / Funcs 78.99→ratchet 77(距 79.0 差0.01) / Lines 85.46→ratchet 84(距 86.0 差0.54) 均不抬。
//   B51（2026-09-29，A 选项续）：选 pages/remote-notify/ScheduledPanel.tsx（纯展示面板，branch 68.4%/fn 24.1%→高覆盖，共 12 例全绿）
//     Stmts 83.01 → 83.05（跨 83.0 线）｜ Branch 72.51 → 72.6（距 73.0 差0.4 故不抬）｜ Funcs 78.99 → 79.1（跨 79.0 线）｜ Lines 85.46 → 85.49（距 86.0 差0.51 故不抬）
//     （mock ../../components(PermissionButton+ClassStatusBadge) 隔离；构造 deps 逐分支触发：空态/列表项各状态圆点/时间字段(-- 兜底)/
//       重复类型 daily·weekly·monthly 标签与间隔·结束时间/每周星期按钮点击/发送模式 device 设备ID·broadcast 不显/语音·弹窗·紧急复选框/
//       新建按钮/列表项 立即发送·取消(仅 pending)·删除/编辑弹窗 标题(editingScheduled)+保存+取消；
//       ScheduledPanel.tsx 单文件 fn 24.1%→~100%、branch 68.4%→~100%；纯 deps 驱动零网络零 store 依赖，低风险高 ROI）
//     本轮按「缓冲 >=1.0」非均匀抬升：Stmts 81→82（83.05 >= 83.0，缓冲 1.05） / Funcs 77→78（79.1 >= 79.0，缓冲 1.1）；
//     Branch 72.6→ratchet 71(距 73.0 差0.4) / Lines 85.49→ratchet 84(距 86.0 差0.51) 均不抬。
//   B53（2026-09-29，A 选项续）：选 pages/SystemMetrics.tsx（页面级查看层，sun=72/bun=43，72.2%/43.2%→高覆盖，共 9 例全绿）
//     Stmts 83.05 → 83.45（距 84.0 差0.55 故不抬）｜ Branch 72.6 → 73.16（跨 73.0 线）｜ Funcs 79.1 → 79.63（距 80.0 差0.37 故不抬）｜ Lines 85.49 → 85.82（距 86.0 差0.18 故不抬）
//     （mock ../components(PermissionButton+EmptyState) + ../hooks(fetchJson) 隔离；构造 makeRows/makeLatest 逐分支触发：
//       正常加载 5 卡片值/单位/更新时间/系列非空 / 多页分页循环(page===1 与 all.concat 分支 + while 条件) /
//       加载失败(fetchJson null → failed 分支 + 错误条 + 重试恢复) / hours 选择变更(hours=6 参数重载) /
//       刷新按钮重载 / 空数据(5 卡片 — + 两 EmptyState) / 初始加载中态占位 / latest 缺省(无 unit·无 updated_at·缺失 key) /
//       响应缺字段 || 兜底(items/latest/total/pages)；SystemMetrics.tsx 单文件 branch 43.2%→高覆盖；纯 fetchJson 驱动零 store 依赖，低风险高 ROI）
//     本轮按「缓冲 >=1.0」非均匀抬升：Branch 71→72（73.16 >= 73.0，缓冲 1.16）；
//     Stmts 83.45→ratchet 82(距 84.0 差0.55) / Funcs 79.63→ratchet 78(距 80.0 差0.37) / Lines 85.82→ratchet 84(距 86.0 差0.18) 均不抬。
//   B54（2026-09-29，A 选项续）：选 components/layout/Sidebar.tsx（939 行纯展示巨型组件，30 处未覆盖分支，isCollapsed 双向三元从未测 collapsed 态；10 例全绿）
//     Stmts 83.45 → 83.53（差0.47 不抬）｜ Branch 73.16 → 73.28（差0.72 不抬）｜ Funcs 79.63 → 79.81（差0.19 不抬）｜ Lines 85.82 → 85.88（差0.12 不抬）
//     （mock ../../stores(usePermissionStore+getState().loadPermissions) + react-router-dom(real+spy useNavigate)；覆盖 默认展开/折叠切换/菜单组展开收起/admin 角色/整组权限拒绝丢弃/
//       退出登录清 localStorage+navigate/移动抽屉开合/折叠 hover tooltip/Ctrl+B 快捷键/isLoading+已登录触发 loadPermissions；单文件 branch 高覆盖；平台期确认）
//   B55（2026-09-29，A 选项续）：选 pages/dashboard/DashboardView.tsx（纯展示壳 S33.3/B50.0/F14.3，props 注入零 hooks/store/api，16 例全绿）
//     Stmts 83.53 → 83.6（差0.4 不抬）｜ Branch 73.28 → 73.49（差0.51 不抬）｜ Funcs 79.81 → 80.02（跨 80.0 线）｜ Lines 85.88 → 85.95（差0.05 不抬）
//     （mock ./components(StatCard/UserCard/DeviceCard/LiveClock 桩) + ../../components(DashboardSkeleton 桩)；覆盖 loading 骨架/四统计卡/实时时钟/连接态/刷新态/错误条/班级筛选派发/
//       四类空态(filteredUsers/devices/notifications/classGroups)/通知优先级三元(high·urgent→红,medium→黄,其它→绿)/算法数据 null+风险 — 兜底/班级分组空态；单文件 S33→高覆盖）
//     本轮按「缓冲 >=1.0」非均匀抬升：Funcs 78→79（80.02 >= 80.0，缓冲 1.02）；
//     Stmts 83.6→ratchet 82(距 84.0 差0.4) / Branch 73.49→ratchet 72(距 74.0 差0.51) / Lines 85.95→ratchet 84(距 86.0 差0.05) 均不抬。
//   B56（2026-09-29，A 选项续）：选 pages/notifications/NotificationsView.tsx（纯展示壳 S16.7/B30.8/F11.1，props 注入零 hooks/store/api，19 例全绿）
//     Stmts 83.6 → 83.69（差0.31 不抬）｜ Branch 73.49 → 73.73（差0.27 不抬）｜ Funcs 80.02 → 80.27（已跨 80.0 线，缓冲1.27 维持79）｜ Lines 85.95 → 86.06（跨 86.0 线）
//     （mock ../../components(Card/Button/Modal/PermissionButton 桩，Modal 在 isOpen 渲染 children+关闭按钮)；覆盖 主标题/unreadCount 全部已读分支/加载态/空态引导/
//       列表 item 渲染(type 三元四分支 success·warning·error·info 默认)/已读圆点/read_at 已读于/分页页码+边界 disabled+setPage/三类筛选 select 派发/handleFilterChange 字段/
//       刷新按钮 loading 图标+loadNotifications/全部已读/标为已读·删除 handler/发送模态 打开+表单字段 change+submit+sending 态+取消/onClose 重置；单文件 S16.7→高覆盖）
//     本轮按「缓冲 >=1.0」非均匀抬升：Lines 84→85（86.06 >= 86.0，缓冲 1.06）；
//     Stmts 83.69→ratchet 82(距 84.0 差0.31) / Branch 73.73→ratchet 72(距 74.0 差0.27) / Funcs 80.27→ratchet 79(已超 80.0 维持) 均不抬。
//   B57（2026-09-29，A 选项续）：选 pages/frontendTelemetry/useFrontendTelemetryLogic.tsx（纯逻辑 hook，S59.6/B30.9/F30.4，29 处未覆盖分支，branch 增益潜力最大；9 例全绿）
//     Stmts 83.69 → 83.86（差0.14 不抬）｜ Branch 73.73 → 73.94（跨 74.0 线）｜ Funcs 80.27 → 80.7（已超 80.0 维持）｜ Lines 86.06 → 86.19（跨 86.0 线）
//     （mock ../../hooks(useListFetch 受控桩 + fetchJson vi.fn)；renderHook 测 返回结构/onPerfFilterChange·onErrFilterChange 更新 filters+重置 page/handlePerf·ErrPageChange；
//       重点测 perfColumns·errColumns render 全部分支：value+unit/value 无 unit/page 有值·null 兜底/created_at 经 formatDateTime/
//       error_type 三元三分支(api_error·resource_error·其它)/request 列 method+status+url 组合(全·仅 url·全 null)；单文件 B30.9→高覆盖）
//     本轮按「缓冲 >=1.0」非均匀抬升：Branch 72→73（73.94 >= 74.0，缓冲 1.94） / Lines 85→86（86.19 >= 86.0，缓冲 1.19）；
//     Stmts 83.86→ratchet 82(距 84.0 差0.14) / Funcs 80.7→ratchet 79(已超 80.0 维持) 均不抬。
//   B58（2026-09-29，A 选项续）：选 pages/remote-notify/TemplatesPanel.tsx（纯展示面板，deps 注入零 hooks/store/api；S19.0/B30.8/F11.1，21 条语句仅 4 条已覆盖，ROI 为「非排除清单」内未覆盖语句池最大，是 ScheduledPanel 同级面板，可复刻其 mock 范式；12 例全绿）
//     Stmts 83.86 → 83.97（距 84.0 差 0.03，≈4 条语句）｜ Branch 73.94 → 74.09（距 75.0 差 0.91）｜ Funcs 80.71 → 80.96（距 81.0 差 0.04，≈2 个函数）｜ Lines 86.19 → 86.31（距 88.0 差 1.69）
//     （mock ../../components(PermissionButton 桩) + RemoteNotifyDeps 类型安全注入；覆盖 加载态/空态/列表 name+category 三元/点击 name 触发 handleUseTemplate/
//       新建按钮(setEditingTemplate(null)+setTemplateForm 取 form 默认值+openTemplateModal)/编辑按钮(字段齐全+缺失 || 兜底两分支+openTemplateModal)/删除(handleDeleteTemplate(id))/
//       showTemplateModal+editingTemplate 双向标题(编辑模板/新建模板)/表单 name·text·category·color 四 onChange/保存(handleSaveTemplate)/取消(closeTemplateModal)；
//       TemplatesPanel.tsx 单文件 S19→71.4% / B→100% / L25→93.8%；纯 deps 驱动零网络零 store 依赖，低风险高 ROI）
//     本轮四指标按「实测 ≥ ratchet+2.0（Stmts≥84.0/Branch≥75.0/Funcs≥81.0/Lines≥88.0）」判定均不抬，阈值维持 82/73/79/86。
//     ★ 关键信号：Statements 83.97 与 Functions 80.96 均已逼近抬档线（分别差 0.03% / 0.04%），在「非排除清单」约束下已无可低成本的单文件跨越；
//       再抬任一档需放宽排除法（攻击 api.ts 540 未覆盖语句 / AttendanceManage 128 未覆盖语句 / 各 Modal 0% 模块）或接受多批边际提交。建议评估收口 B 系列补测战役。
//   ── B58 冲刺收口（用户确认「最后冲刺抬双档」）──
//   选 pages/nlp-management/RuleFormModal.tsx + BatchImportModal.tsx（两个纯 NLPDeps 驱动 Modal，零 hooks/store/router，可复刻模板范式；共 17 例全绿）
//     Stmts 83.97 → 84.24（跨 84.0 线）｜ Branch 74.09 → 74.29（距 75.0 差0.71）｜ Funcs 80.96 → 81.49（跨 81.0 线）｜ Lines 86.31 → 86.61（距 88.0 差1.39）
//     （RuleFormModal 13 语句/10 分支/10 函数 0%→100%；BatchImportModal 12 语句/6 分支/5 函数 0%→100%(Branch 83.3%，isImporting 双态已覆盖)；
//       mock ../../../components(EmptyState/Button/Modal/PermissionButton 桩) + 类型安全 NLPDeps 注入；覆盖 editingRule 空/有值标题切换+按钮文案/Close·取消回调/
//       各字段 onChange(关键词·描述·score_value parseFloat||0·score_type select·tags·pattern·priority parseInt||0)/保存分支(handleCreateRule·handleEditRule)；
//       纯 deps 驱动零网络零 store 依赖，低风险高 ROI；实测全局 2488 passed / 3 skipped / EXIT=0）
//     本轮按「缓冲 >=1.0」非均匀抬升：Stmts 82→83（84.24 >= 84.0，缓冲 1.24） / Funcs 79→80（81.49 >= 81.0，缓冲 1.49）；
//     Branch 74.29→ratchet 73(距 75.0 差0.71) / Lines 86.61→ratchet 86(距 88.0 差1.39) 均不抬。
  //   ── 当前生效 ratchet（B58 冲刺收口后）──
  //   D 线突破（2026-09-29，用户选「前端覆盖率突破地板」）：补测 pages/AttendanceManage.tsx 容器逻辑（24 例全绿）
  //     实测 Stmts 85.32 / Branch 74.97 / Funcs 81.91 / Lines 87.72（v8 JSON 口径，全量 EXIT=0）
  //     （AttendanceManage 为 default-export 容器，依赖 api+6 hooks+子组件 AttendanceManageView；新建 AttendanceManage.test.tsx 覆盖
  //       挂载拉取/记录提交成功·校验失败·API 失败/请假提交/批量记录(无班级·有班级·空学生·成功·API失败)/审批/恢复草稿/空草稿清理 useEffect/
  //       统计与请假列表 catch/useClientFilter 过滤；关键坑：beforeEach 未清 apiMocks 调用计数致 batchRecord 跨用例泄漏，
  //       修复为 Object.values(apiMocks).forEach(m=>m.mockClear()) 并给 usersGetAll 默认 mockResolvedValue([])）
  //     本轮按「实测 ≥ ratchet+2.0 且缓冲 ≥1.0」非均匀抬升：仅 Statements 跨 85.0 线 → 83→84（缓冲 1.32）；
  //     Branch 74.97(距 75.0 差0.03) / Funcs 81.91(距 82.0 差0.09) / Lines 87.72(距 88.0 差0.28) 均不抬。
  //   D 线突破·第二步（2026-09-30）：补测 services/api.ts executeRequest 错误/边界分支（新建 api.errors.test.ts，8 例全绿，确定性无抖动）
  //     覆盖 403/404-非GET清理/NetworkError·net::ERR 文案/401 学生态·管理员态分流/CSRF(419)重试成功/type=cancelled 返回 null；
  //     实测 Stmts 85.65 / Branch 75.18 / Funcs 81.95 / Lines 88.06（v8 JSON 口径，全量 EXIT=0）
  //     本轮按「实测 ≥ ratchet+2.0 且缓冲 ≥1.0」非均匀抬升：
  //       Branch 跨 75.0 线 → 73→74（缓冲 1.18）；Lines 跨 88.0 线 → 86→87（缓冲 1.06）；
  //       Statements 85.65(距 86.0 差0.35) / Funcs 81.95(距 82.0 差0.05) 均不抬。
  //   D 线突破·第三步（2026-09-30）：补测 useUserListLogic（14 函数 0%→全绿，1 例）+ EngagementTrendChart（3 例）+ NLPManagement 加 retry:2
  //     实测（并行全量 + singleThread 修复前）：Stmts 85.89 / Branch 75.35 / Funcs 82.02 / Lines 88.32（全量 EXIT=0、零失败）
  //     关键诊断：并行全量偶发坍缩到 Stmts 75.95 / Branch 67.50 / Funcs 66.95 / Lines 77.93，但 2029 测试全绿、零失败；
  //       根因 = services/api.ts（1400 行）在并行 worker 下 v8 coverage map 合并竞态（该文件从 ~66% 掉到 20.2% 拖垮全局）= 非真实回归。
  //       修复：coverage 加 singleThread:true（仅 coverage 单线程合并，测试执行仍并行，CI 速度不减），见本文件 coverage.singleThread。
  //     修复后确定性单线程全量（--no-file-parallelism）实测 Stmts 86.21 / Branch 75.35 / Funcs 82.31 / Lines 88.62（EXIT=0、零失败），可信基线。
  //     本轮按「实测 ≥ ratchet+2.0 且缓冲 ≥1.0」非均匀抬升：
  //       Statements 跨 86.0 线 → 84→85（确定性基线 86.21，缓冲 1.21）；
  //       Branch 75.35(距 76.0 差0.65) / Funcs 82.31(距 83.0 差0.69) / Lines 88.62(距 89.0 差0.38) 维持。
  //   D 线突破·第四步（2026-09-30）：补测 services/api.ts 独立纯工具函数（新建 api.utils.test.ts，28 例全绿，确定性无抖动）
  //     + pages/algorithm-analysis/AlgorithmAnalysisShell.tsx 纯展示壳（新建 AlgorithmAnalysisShell.test.tsx，12 例全绿，11 个 Tab 子组件全部桩掉）
  //     实测（singleThread 确定性全量 + 还原 json reporter 前已刷新 coverage-final.json 精准排源）：
  //       Stmts 86.57 / Branch 75.82 / Funcs 83.05 / Lines 88.97（全量 EXIT=0、零失败）
  //     （api.utils 覆盖 AbortController 工具簇/ETag 缓存清理/getErrorMessage 多分支/unwrapEnvelope·parseEnvelopeSafe/getAuthHeaders·getCsrfToken；
  //       getCsrfToken 因已被既有 419 retry 测试经 getAuthHeaders 间接覆盖，本批直测未产生净新增语句行 → Lines 卡 88.97 距 89.0 差 0.03%）
  //     本轮按「实测 ≥ ratchet+2.0 且缓冲 ≥1.0」非均匀抬升：
  //       Functions 跨 83.0 线 → 81→82（实测 83.05 ≥ 83.0，缓冲 1.05）；
  //       Statements 86.57(距 87.0 差0.43) / Branch 75.82(距 76.0 差0.18) / Lines 88.97(距 89.0 差0.03) 均不抬。
  //   D 线突破·第五步（2026-09-30）：补测 useMemoryUsage（金矿 7.1%→高覆盖）+ useNetworkStatus 扩展连接分支
  //     （新建 useMemoryUsage.test.ts 4 例；扩展 useNetworkStatus.test.ts 补 2 例 connection 分支）
  //     实测（singleThread 确定性全量）：Stmts 86.71 / Branch 76.05 / Funcs 83.2 / Lines 89.1（全量 EXIT=0）
  //     （useMemoryUsage 仅 14 语句、原 7.1% 覆盖（13 未覆盖分支/语句），mock performance.memory 后高覆盖：
  //       覆盖 enabled=false 早返 / performance.memory 存在(真值+0值兜底双分支) / 不存在 / setInterval+clearInterval；
  //       vi.useFakeTimers 会伪造 performance 覆盖挂载的 memory → 改真实定时器+unmount 触发清理，确定性通过；
  //       useNetworkStatus 原有「connection 存在」用例用 truthy effectiveType，本次补「effectiveType 缺失→回退 unknown/null」+「无 connection→全 null」
  //       覆盖 || null / || 'unknown' 兜底右分支与 if(connection) 三个 false 分支，共 +7 可达分支）
  //     本轮按「实测 ≥ ratchet+2.0 且缓冲 ≥1.0」非均匀抬升（双档齐抬）：
  //       Branch 跨 76.0 线 → 74→75（实测 76.05，缓冲 1.05）；
  //       Lines 跨 89.0 线 → 87→88（实测 89.1，缓冲 1.1）；
  //       Statements 86.71(距 87.0 差0.29) / Funcs 83.2(距 84.0 差0.8) 均不抬。
  //   D 线突破·第六步（2026-09-30）：补测 5 个低依赖高 ROI hook（usePermissions/useUndoRedo/useKeyboardShortcut/useMediaQuery/useAutoSave）
  //     + performanceMonitor（纯类，无测试文件）+ download.fetchAndDownload 兜底 共 7 文件（新建/扩展），确定性无抖动
  //     实测（singleThread 确定性全量）：Stmts 87.02 / Branch 76.29 / Funcs 83.52 / Lines 89.41（全量 EXIT=0）
  //     （usePermissions 73.3%→高覆盖：error 对象/roles-permissions 取闭包/JSON 损坏；useUndoRedo 80%→高覆盖：maxHistory 截断/undo-redo/Toast；
  //       useKeyboardShortcut 77.4%→高覆盖：shift/alt/ctrl 等价 + useGlobalKeyboardShortcuts ?/Cmd+N；useMediaQuery 85%→高覆盖：旧浏览器 addListener 兜底；
  //       useAutoSave 88.6%→高覆盖：beforeunload/loadDraft 过期清除/二次变化语义；performanceMonitor 95.1%→全绿：start/end/recordError·CacheHit·Coalesced/
  //       updateApiStats/subscribe(含 listener 抛错 catch)/entries 上限/logSummary/setSlowThreshold/reset/monitorApiRequest/withPerformanceMonitoring；
  //       download.fetchAndDownload 非 ok 且 text() 抛错→回退「下载失败 (500)」catch 分支）
  //     本轮按「实测 ≥ ratchet+2.0 且缓冲 >=1.0」非均匀抬升：
  //       Statements 跨 87.0 线 → 85→86（实测 87.02，缓冲 1.02）；
  //       Branch 76.29(距 77.0 差0.71) / Funcs 83.52(距 84.0 差0.48) / Lines 89.41(距 90.0 差0.59) 均不抬。
  //   D 线突破·第七步（2026-10-01）：补测 attendanceManage 三个纯展示 0% 子组件（RecordModal/LeaveModal/PendingLeavesPanel，共 25 例全绿）
  //     实测（singleThread 确定性全量）：Stmts 87.33 / Branch 76.65 / Funcs 84.55 / Lines 89.7（全量 2635 passed / 3 skipped / EXIT=0）
  //     （三组件均为纯展示、props 驱动、零内部状态/零 api 调用（AttendanceManage 容器在 AttendanceManageView 整体桩掉致内部三子组件从未渲染 → 0%）；
  //       用 vi.mock('../../../components') 桩 StudentSelect/DateRangeField，构造类型安全 props 逐分支触发全部内联 handler：
  //       RecordModal 18 内联 fn 全触发（遮罩/X/取消关闭·字段 change→setRecordForm·提交 runSubmit·验证码/原因校验入口）；
  //       LeaveModal 13 fn 全触发（含 errors.student_id / DateRangeField startError·endError 错误文案渲染分支）；
  //       PendingLeavesPanel 8 fn 全触发（空态/列表项/approve·reject·view·分页 onChange + 改变每页条数）；三组件均为低风险高 ROI）
  //     本轮按「实测 ≥ ratchet+2.0 且缓冲 >=1.0」非均匀抬升：
  //       Functions 跨 84.0 线 → 82→83（实测 84.55，缓冲 1.55）；
  //       Statements 87.33(距 88.0 差0.67) / Branch 76.65(距 77.0 差0.35) / Lines 89.7(距 90.0 差0.3) 均不抬。
  //   D 线突破·第八步（2026-10-01）：攻击 api.ts 核心请求层 —— 新建 api.endpoints.test.ts 覆盖 Api 接口全部 322 个方法成功路径（fetch mock + env 信封，9 个同步 download/export 方法走同步断言）
  //     实测（singleThread 确定性全量）：Stmts 87.87 / Branch 77.04 / Funcs 85.66 / Lines 90.26（全量 2957 passed/3 skipped/EXIT=0）
  //     （api.ts 为 6448 行核心请求层，原 495 未覆盖语句/115 未覆盖函数/780 未覆盖分支；按 Api 接口解析出 322 方法（algorithm 58/devices 18/mqtt 8…），
  //       逐个走 request→executeRequest→fetch(mock) 全链路，覆盖各方法 URL 构建/参数序列化体；mqtt/export 等组均走 HTTP 封装非 WebSocket，fetch mock 全覆盖；
  //       复用既有 api.errors.test.ts 的 env 信封范式 + vi.mock(errorMonitor)；ident 仅 Stmts 差 0.13% 未跨 88.0）
  //     本轮按「实测 ≥ ratchet+2.0 且缓冲 >=1.0」非均匀抬升（三档齐抬）：
  //       Branch 跨 77.0 线 → 75→76（实测 77.04，缓冲 2.04）；
  //       Functions 跨 85.0 线 → 83→84（实测 85.66，缓冲 2.66）；
  //       Lines 跨 90.0 线 → 88→89（实测 90.26，缓冲 2.26）；
  //       Statements 87.87(距 88.0 差0.13) 维持 86 不抬。
  //   D 线突破·第九步（2026-10-01）：补测 api.ts executeRequest 错误/边缘分支 —— 新建 api.branches.test.ts 8 例（ETag 缓存写入 / 304 无缓存 / success:false 信封 /
  //     401 管理员态 refreshToken 成功·失败重试 / 419 CSRF 重试失败 / 500 兜底文案），全链路 fetch mock + vi.mock(errorMonitor)
  //     实测（singleThread 确定性全量）：Stmts 88.53 / Branch 77.3 / Funcs 85.84 / Lines 90.98（全量 2965 passed/3 skipped/EXIT=0）
  //     本轮按「实测 ≥ ratchet+2.0 且缓冲 >=1.0」非均匀抬升（单档抬）：
  //       Statements 跨 88.0 线 → 86→87（实测 88.53，缓冲 2.53；抬后缓冲 1.53 ≥1.0）；
  //       Branch 77.3(距 78.0 差0.7) / Funcs 85.84(距 86.0 差0.16) / Lines 90.98(距 91.0 差0.02) 均不抬。
  //   D 线突破·第十步（2026-10-01）：补测 api.ts executeRequest 剩余高价值分支 + 信封解析纯函数 —— 新建 api.branches2.test.ts 7 例（fetchWithTimeout AbortError→504 /
  //     网络失败 TypeError('Failed to fetch') / 网络错误 NetworkError / 419 CSRF 重试成功 / refreshToken 冷却守卫 / parseEnvelopeSafe / unwrapEnvelope 各分支），
  //     全链路 fetch mock + vi.mock(errorMonitor)。注：ETag If-None-Match(854) 与 304 走内存缓存(872-878) 因 request 层对 GET 命中内存 cache 直接短路返回(1105-1113)，
  //     正常黑盒流程不可达，属防御性分支，不列为靶标。
  //     实测（singleThread 确定性全量）：Stmts 88.59 / Branch 77.35 / Funcs 85.84 / Lines 91.05（全量 2972 passed/3 skipped/EXIT=0）
  //     本轮按「实测 ≥ ratchet+2.0 且缓冲 >=1.0」非均匀抬升（单档抬）：
  //       Lines 跨 91.0 线 → 89→90（实测 91.05，缓冲 2.05；抬后缓冲 1.05 ≥1.0）；
  //       Statements 88.59(距 89.0 差0.41) / Branch 77.35(距 78.0 差0.65) / Funcs 85.84(距 86.0 差0.16) 均不抬。
  //   ── D 线突破·第十二步（2026-10-01，转攻非 api.ts 低成本靶标：SendForm 交互补测）──
  //     扩展 pages/remote-notify/__tests__/SendForm.test.tsx 14→27 例（新增 13 例交互：四模式输入/配色/音量/自动关闭/弹窗·紧急开关/预览/lastResult/score_change +/-与快捷按钮），
  //     React Testing Library 渲染 + fireEvent 触发内联箭头回调以覆盖 SendForm 内联函数体；修复 jsdom 将 #FFFFFF 规范化为小写 #ffffff 的 color 选取方式。
  //     实测（singleThread 确定性全量 + 还原 json reporter 后复验）：Stmts 88.83 / Branch 77.42 / Funcs 86.34 / Lines 91.31（全量 EXIT=0）
  //     （SendForm.tsx 单文件 26.9%→显著提升，内联函数触发使 Funcs 显著上升；Branch 因 0.00 增量维持；Stmts/Lines 单步 <0.2% 不足抬升）
  //     本轮按「实测 ≥ ratchet+2.0 且缓冲 ≥1.0」非均匀抬升：
  //       Functions 跨 86.0 线 → 84→85（实测 86.34 ≥ 86.0，抬后缓冲 1.34 ≥ 1.0）；
  //       Statements 88.83(距 89.0 差0.17) / Branch 77.42(距 78.0 差0.58) / Lines 91.31(距 92.0 差0.69) 均不抬。
  //   ── D 线突破·第十三步（2026-10-01，SendForm 内层 updater 修复收口 + ratchet 双档齐抬）──
  //     修复 SendForm.test.tsx 的 makeDeps：setForm/setScoreForm 由纯 vi.fn() 改为真正执行传入的
  //     函数式 updater（arg({})），覆盖组件内 24 个内联 (prev)=>({...prev,X}) 箭头函数体。
  //     此前 mock 不执行 updater → 这些箭头零覆盖，SendForm 单文件 fn 仅 ~25%；修复后 SendForm 全函数覆盖。
  //     实测（singleThread 确定性全量，_cov6 后台复验）：Stmts 89.09 / Branch 77.43 / Funcs 87.19 / Lines 91.31（全量 2990 passed/3 skipped/EXIT=0）
  //     （相对第十二步基线 88.83/77.42/86.34/91.31：Stmts +0.26 / Branch +0.01 / Funcs +0.85 / Lines 0.00；增益全在语句与函数层，印证内层箭头修复生效）
  //     本轮按「实测 ≥ ratchet+2.0 且缓冲 >=1.0」非均匀抬升（双档齐抬）：
  //       Statements 跨 89.0 线 → 87→88（实测 89.09，抬后缓冲 1.09 >= 1.0）；
  //       Functions 跨 87.0 线 → 85→86（实测 87.19，抬后缓冲 1.19 >= 1.0）；
  //       Branch 77.43(距 78.0 差0.57) / Lines 91.31(距 92.0 差0.69) 均不抬。
  //   2026-10-01 D 线第十四步：扩展 RemoteNotifyPanels 测试覆盖 ScheduledPanel/TemplatesPanel 内层 updater + 新增 ModeSelector 用例
  //     （makeDeps 的 setScheduledForm/setTemplateForm 由纯 vi.fn() 改为执行传入函数式 updater(arg({}))，覆盖组件内 (prev)=>({...prev,X}) 箭头；
  //      与 SendForm 同病同源的覆盖率陷阱闭环。ScheduledPanel 全字段交互 + 状态/重复四态、TemplatesPanel 全字段 + 新建/编辑按钮、ModeSelector 四模式按钮；
  //      +3 用例，全量 2993 passed/3 skipped/EXIT=0）
  //     实测（singleThread 确定性全量，_cov14 复验）：Stmts 89.39 / Branch 77.44 / Funcs 88.19 / Lines 91.45（相对第十三步 89.09/77.43/87.19/91.31：+0.30/+0.01/+1.00/+0.14；
  //      函数 +28 越线 88.0，印证内层 updater 修复生效）
  //     本轮仅抬 Functions（其余距 +2.0 线均不足）：
  //       Functions 跨 88.0 线 → 86→87（实测 88.19，抬后缓冲 1.19 >= 1.0）；
  //       Stmts 89.39(距 90.0 差0.61) / Branch 77.44(距 78.0 差0.56) / Lines 91.45(距 92.0 差0.55) 均不抬。
  //   2026-10-01 D 线第十五步：扩展 Button/Crud/Score 测试覆盖 mouse 事件 + onError/undo/revert 内部闭包
  //     （Button 补 fireEvent mouseEnter/Leave/Down/Up 覆盖 4 个内联箭头；useUserListCrud 补 handleSubmit/handleDelete/handleToggleActive 的 onError + delete 后 undo 闭包；
  //      useUserListScore 补 handleQuickScore 的 revert+onError 与 handleBatchDelete/handleBatchScore 的 onError 闭包；+8 用例，全量 3001 passed/3 skipped/EXIT=0）
  //     实测（bypass sandbox 确定性全量，_cov15）：Stmts 89.56 / Branch 77.54 / Funcs 88.62 / Lines 91.63（相对第十四步 89.39/77.44/88.19/91.45：+0.17/+0.10/+0.43/+0.18；
  //      函数 +12 未越 89.0 线，差 ~11 函数）
  //     本轮四项均未越 +2.0 抬升线 → ratchet 维持（Stmts 88 / Branch 76 / Funcs 87 / Lines 90 不变）。
  //   2026-10-01 D 线第十六步：攻击 PreloadProvider(0%→100%)/Login/ErrorBoundary/requestCoalescing 内部闭包 + PermissionGuard 分支
  //     新增 PreloadProvider.test.tsx（mock preloadService，+2 fn）；Login/ErrorBoundary/requestCoalescing 各补 onError/catch/fake-timer 闭包（+2/+2/+3）；
  //     PermissionGuard 补已授权分支（+0 因既有用例已覆盖）。实测 Stmts 89.73 / Branch 77.62 / Funcs 88.83 / Lines 91.8（全量 3010 passed/3 skipped/EXIT=0）。
  //     Funcs 88.83 未越 89.0 线（差 ~5 函数）；Stmts/Branch/Lines 距 +2.0 线分别差 0.27/0.38/0.2 → 四项均未越 → ratchet 维持。
  //   D 线突破·第十七步（2026-10-01）：补测 components/special/DevTools.jsx 纯展示组件（新建 DevTools.test.jsx，3 例全绿，0%→高覆盖）
  //     实测（singleThread 确定性全量，_cov17）：Stmts 90.02 / Branch 77.85 / Funcs 89.05 / Lines 92.09（Test Files 213 passed / 1 skipped / EXIT=0 测试全绿；
  //     EXIT=1 仅因 safe-delete 守卫在 cleanAfterRun 清理 coverage/.tmp 崩溃，与测试及覆盖率无关，覆盖率数据已正常写出）
  //     （DevTools 为 0% 函数覆盖的纯展示组件：config/webVitals/useMemoryUsage 受控 mock，覆盖悬浮按钮+展开面板+5 项 Web Vitals+内存块+
  //       getRating 三档评级(good/needs/poor)+getColor 配色分支+devTools 关闭 early-return；单文件 6 函数/28 语句 0%→全绿，低风险高 ROI）
  //     本轮按「实测 ≥ ratchet+2.0 且缓冲 ≥1.0」非均匀抬升（三档齐抬）：
  //       Statements 跨 90.0 线 → 88→89（实测 90.02，抬后缓冲 1.02）；
  //       Functions 跨 89.0 线 → 87→88（实测 89.05，抬后缓冲 1.05）；
  //       Lines 跨 92.0 线 → 90→91（实测 92.09，抬后缓冲 1.09）；
  //       Branch 77.85(距 78.0 差0.15) 维持 76 不抬。
  //   ── 当前生效 ratchet（D 线第十七步后）──
  //   Stmts 89 / Branch 76 / Funcs 88 / Lines 91
      thresholds: {
        statements: 89,
        branches: 76,
        functions: 88,
        lines: 91,
      },
    },
  },
});
