import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chrome',
      // 使用系统中已安装的 Google Chrome（channel: 'chrome'），
      // 规避沙箱环境下下载 chromium 二进制被网络阻断的问题；
      // 普通环境若已执行 `npm run e2e:install` 下载了 chromium，可改用
      // `npx playwright test --project=chromium` 运行。
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        // 沙箱/CI 环境常以受限权限运行，需 --no-sandbox 才能启动 Chrome
        launchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage'] },
      },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'npm run dev:vite',
    url: 'http://localhost:3000',
    timeout: 300 * 1000,
    // 本地已有 Vite dev 服务（3000）时直接复用，避免端口冲突报错；
    // CI/无服务环境由 Playwright 自动拉起 dev:vite。
    reuseExistingServer: true,
    // 若要对「生产构建产物(dist)」做端到端冒烟，先 `npx vite preview --outDir dist` 起好预览，
    // 再把 reuseExistingServer 改为 true 复用该预览服务即可（避免 dev 与 build 行为差异漏测）。
  },
});