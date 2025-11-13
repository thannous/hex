import { defineConfig, devices } from '@playwright/test';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.PLAYWRIGHT_WEB_PORT ? Number(process.env.PLAYWRIGHT_WEB_PORT) : 3000;
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // Avoid ever-running suites
  globalTimeout: 10 * 60 * 1000,
  reporter: [
    ['line'],
    ['json', { outputFile: 'reports/test-results.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${PORT}`,
    cwd: __dirname,
    env: {
      NEXT_PUBLIC_ENABLE_TEST_ROUTES: 'true',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.local',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    },
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
