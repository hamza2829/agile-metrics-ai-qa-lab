import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: [
    ['list'],
    ['junit', { outputFile: '../reports/playwright.xml' }],
    ['html', { outputFolder: '../reports/playwright-html', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: process.env.LAB_CHROMIUM ? { executablePath: process.env.LAB_CHROMIUM } : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `${process.env.LAB_PYTHON ?? 'python'} -m uvicorn lab.app:app --host 127.0.0.1 --port 8000`,
      cwd: '../api',
      url: 'http://127.0.0.1:8000/api/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run preview',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
