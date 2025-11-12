import { defineConfig, devices } from '@playwright/test';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.PLAYWRIGHT_WEB_PORT ? Number(process.env.PLAYWRIGHT_WEB_PORT) : 3100;
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
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
