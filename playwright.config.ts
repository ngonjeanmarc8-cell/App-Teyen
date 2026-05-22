import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Load env for the Playwright process (so test code can read it if needed).
config({ path: '.env.test' });

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Pass .env.test to the spawned Next dev server so it talks to teyen-test.
        command: process.env.CI
          ? 'pnpm next dev'
          : 'pnpm exec dotenv -e .env.test -- cross-env PLACEMENT_FAKE=1 CHAT_FAKE=1 MISSION_FAKE=1 pnpm next dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
