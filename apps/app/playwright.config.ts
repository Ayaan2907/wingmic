import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { env } from './lib/config/env';

const PORT = env.PORT ?? 3211;
const BASE_URL = `http://localhost:${PORT}`;
const isCI = env.CI ?? false;

// 2026-08-04 handoff quirk: some VMs carry a preinstalled Chromium (build 1194)
// that mismatches playwright-core's expected build — override when present.
// Fake media (mic priming e2e) only works on the FULL chromium build — the
// headless shell rejects getUserMedia with NotSupportedError — so everywhere
// else we select the full build explicitly via channel: 'chromium'.
const PW_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PW_FAKE_MIC_ARGS = ['--use-fake-device-for-media-stream'];
const chromiumDesktopUse = existsSync(PW_CHROMIUM)
  ? { ...devices['Desktop Chrome'], launchOptions: { executablePath: PW_CHROMIUM, args: PW_FAKE_MIC_ARGS } }
  : { ...devices['Desktop Chrome'], channel: 'chromium', launchOptions: { args: PW_FAKE_MIC_ARGS } };
// Dev-server console tee — onboarding-mic.spec.ts reads the magic-link URL the
// server prints here when RESEND_API_KEY is unset (the e2e sign-in seam).
const DEV_LOG = '/tmp/wingmic-e2e-dev.log';

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
      use: chromiumDesktopUse,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: {
    // exec + redirection (not a pipeline): the torn-down process IS the dev
    // server, so nothing survives holding :3211 with a stale DEV_LOG — specs
    // read the magic-link URL off the log when RESEND_API_KEY is unset
    command: `sh -c "exec bun run dev -- --port ${PORT} > ${DEV_LOG} 2>&1"`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
