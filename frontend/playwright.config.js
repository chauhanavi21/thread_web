import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:5417', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    { command: 'node e2e/api-server.mjs', url: 'http://127.0.0.1:4400/api/health', reuseExistingServer: false },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5417 --strictPort',
      url: 'http://127.0.0.1:5417',
      env: { THREADS_API_URL: 'http://127.0.0.1:4400' },
      reuseExistingServer: false,
    },
  ],
});
