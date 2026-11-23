import { defineConfig, devices } from '@playwright/test';

const cache = `${process.env.TMPDIR ?? '/var/tmp'}/Game/cache`;
process.env.PLAYWRIGHT_BROWSERS_PATH ??= `${cache}/ms-playwright`;
if (process.platform === 'linux' && !process.env.CI) process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS ??= '1';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:19050';
const local = new URL(baseURL).hostname === '127.0.0.1';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: { baseURL, trace: 'off' },
  webServer: local
    ? {
        command: 'node tests/support/serve-dist.mjs',
        url: baseURL,
        reuseExistingServer: false,
        env: { PORT: new URL(baseURL).port },
      }
    : undefined,
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
    { name: 'pixel-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
