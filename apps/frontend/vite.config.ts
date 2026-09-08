import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite 构建配置（与 CRA 并存，互不破坏）。
 * - 通过 envPrefix 暴露已有的 REACT_APP_* 变量，复用 .env 配置
 * - /api、/ws 代理转发到后端（默认 http://localhost:5000，可用 REACT_APP_API_URL 覆盖）
 * - 路径别名：源码实际全部使用相对导入（已确认无 @/* 等别名导入），
 *   故无需 vite-tsconfig-paths（该包为 ESM-only，在 CJS 配置下会被 esbuild
 *   以 require 加载而失败）。如未来引入 @/ 别名，再用 resolve.alias 显式映射。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'REACT_APP_']);
  // 代理目标默认用 127.0.0.1（IPv4）：localhost 在部分环境会解析到 ::1(IPv6)，
  // 而后端只监听 IPv4，导致 500。REACT_APP_API_URL 为空时回退到这个 IPv4 地址。
  const apiUrl = env.REACT_APP_API_URL || 'http://127.0.0.1:5000';

  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'REACT_APP_'],
    // CRA→Vite 迁移期：源码已迁到 .tsx/.jsx，但 git 里仍残留同名 .js 旧文件。
    // Vite 默认扩展名解析顺序把 .js 排在 .tsx 之前，导致 import './App' 命中陈旧的
    // .js（含 JSX 但无 JSX 解析 → 构建报错）。这里把 .tsx/.ts/.jsx 提前，确保构建
    // 总是解析到真正的 TypeScript 源码，同时不删除任何遗留 .js 文件。
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
    },
    server: {
      port: 3000,
      host: true,
      // Vite 5.4+ 支持 allowedHosts: true 放行所有受信任域名
      allowedHosts: true,
      proxy: {
        '/api': { target: apiUrl, changeOrigin: true },
        '/ws': { target: apiUrl, changeOrigin: true, ws: true },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      // 提升体积告警阈值：antd / recharts 等稳定 vendor 抽取为独立 chunk 后，
      // 单 chunk 体积可能仍超 500kB（属正常缓存优化），提高阈值避免噪音告警。
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // 按依赖来源拆 vendor chunk，提升浏览器缓存命中率并消除超大业务 chunk。
          // 注意：不要把 react 单独拆成 react-vendor —— 那样 react-ecosystem
          // (react-router/zustand/lucide) 与 react 分属不同 chunk 会形成循环依赖，
          // 导致 React 未初始化（Cannot read 'useState'）白屏。react 与运行时依赖
          // 统一留在 vendor；仅把体积大且单向依赖的 recharts 抽成独立 chunk。
          // antd 处理（M13 后 antd 仅被 ImportConfigManagement / SemesterReport 两个懒加载页引用）：
          //   - 不能强制整包进 'antd'（manualChunks 阻止 tree-shake，产生 785KB 全量 chunk）；
          //   - 也不能落入 'vendor' 兜底（会把 antd 全量拖进首屏 vendor，污染首屏 190KB→436KB）；
          //   - 返回 undefined 交给 rollup 自动分包 → antd 模块进入仅被懒加载页引用的共享 chunk，
          //     首屏不加载，页面级才拉取（且可按需 tree-shake）。
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (
              id.includes('recharts') ||
              id.includes('d3-') ||
              id.includes('victory') ||
              id.includes('internmap')
            ) {
              return 'recharts';
            }
            if (
              id.includes('/antd/') ||
              id.includes('@ant-design') ||
              id.includes('@rc-component') ||
              id.includes('/rc-') ||
              id.includes('rc-util')
            ) {
              return undefined; // 自动分包到页面级共享 chunk
            }
            return 'vendor';
          },
        },
      },
    },
  };
});
