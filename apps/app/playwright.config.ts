import { defineConfig, devices } from '@playwright/test';
import { env } from './lib/config/env';

const PORT = env.PORT ?? 3211;
const BASE_URL = `http://localhost:${PORT}`;
const isCI = env.CI ?? false;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: {
    command: `bun run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
