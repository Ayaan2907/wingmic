import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * event-session — spec D1 UI / AC2+AC3 evidence.
 *
 * The global current-event session: auto-bind from the user's calendar,
 * persistence across routes (leaving /chat keeps context), the one-tap
 * picker on overlapping events, unbind via the review sheet, and the quiet
 * expiry toast when the window closes.
 *
 * Seed: an ongoing calendar event written through production's own fallback
 * path — settings ICS URL set to a valid-but-404ing google URL plus the
 * ics_snapshot DB row getIcsSnapshot serves when the live fetch fails
 * (e2e/helpers/seed-ics.ts has the full rationale). Window matching, session
 * shaping, and binding run on real server code; each scenario uses a
 * distinct calendar URL to defeat the server's per-user snapshot cache.
 *
 * Fake-mic recipe honored (2026-08-04 handoff): chromium-only project,
 * grantPermissions(['microphone']), force-click on the pulsing orb. The
 * recording leg proves capture works while a session is bound; the commit
 * pipeline itself (AssemblyAI/OpenRouter) has no keys in the sandbox —
 * targetEventId-on-the-wire is covered by the ChatClient vitest suite and
 * the PR2 events router tests.
 */

const DEV_LOG = '/tmp/wingmic-e2e-dev.log';
const EMAIL = 'e2e-event-session@wingmic.test';

const URL_A = 'https://calendar.google.com/calendar/ical/e2e-event-session-a%40wingmic.test/public/basic.ics';
const URL_B = 'https://calendar.google.com/calendar/ical/e2e-event-session-b%40wingmic.test/public/basic.ics';
const URL_C = 'https://calendar.google.com/calendar/ical/e2e-event-session-c%40wingmic.test/public/basic.ics';

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'fake-mic flags are chromium-only');
});

function seedIcs(url: string, events: Array<{ summary: string; startMin: number; endMin: number }>) {
  execSync(
    `bun e2e/helpers/seed-ics.ts --email=${EMAIL} --url=${url} --events='${JSON.stringify(events)}'`,
    { cwd: `${__dirname}/..`, stdio: 'pipe' },
  );
}

async function signInViaMagicLink(page: Page, email: string, next: string) {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.getByPlaceholder('you@domain.com').fill(email);
  await page.getByRole('button', { name: /send sign-in link/i }).click();
  await expect(page.getByText(/link sent/i)).toBeVisible({ timeout: 20_000 });

  const url = await pollMagicLink(email);
  await page.goto(url);
  await page.waitForURL(/\/onboarding/);
}

function pollMagicLink(email: string): Promise<string> {
  const deadline = Date.now() + 20_000;
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        const log = readFileSync(DEV_LOG, 'utf8');
        const matches = [...log.matchAll(new RegExp(`magic link for ${email}: (\\S+)`, 'g'))];
        const last = matches.at(-1);
        if (last?.[1]) return resolve(last[1]);
      } catch {
        // log file not written yet — keep polling until the deadline
      }
      if (Date.now() > deadline) {
        return reject(new Error(`magic link for ${email} never printed to ${DEV_LOG}`));
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

/** Full onboarding (granted-mic path), ending on /chat. */
async function completeOnboarding(page: Page) {
  await expect(page.getByText(/step 1 of 4/i)).toBeVisible();
  // /^next/ — not /next/i: the Next.js dev-tools overlay button also matches /next/i
  await page.getByRole('button', { name: /^next/i }).click();
  await page.getByPlaceholder('Ada').fill('Ada');
  await page.getByPlaceholder('Lovelace').fill('Lovelace');
  await page.getByRole('button', { name: /^next/i }).click();
  await expect(page.getByText(/step 3 of 4/i)).toBeVisible();
  await page.getByRole('button', { name: /enable the mic/i }).click();
  await expect(page.getByText(/mic ready/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /^next/i }).click();
  await page.getByRole('button', { name: /get started/i }).click();
  await page.waitForURL(/\/chat/);
}

test('current-event session: auto-bind, persists across routes, picker, expiry toast', async ({ page }) => {
  test.setTimeout(180_000);
  await page.context().grantPermissions(['microphone']);

  await signInViaMagicLink(page, EMAIL, '/onboarding');
  await completeOnboarding(page);

  // ── AC2: exactly one ongoing match auto-binds with no user action ──
  seedIcs(URL_A, [{ summary: 'nexa summit', startMin: -60, endMin: 120 }]);
  await page.goto('/chat'); // reload — the provider resolves on mount
  const chip = page.getByTestId('event-session-chip');
  await expect(chip).toContainText(/nexa summit/i, { timeout: 20_000 });
  await expect(chip).toContainText(/at/i);
  await page.screenshot({ path: '/home/user/work/evidence/tc-4-auto-bind-chip.png', fullPage: true });

  // ── AC2: the session is global — leaving /chat keeps context ──
  await page.getByRole('link', { name: 'graph' }).click();
  // First /graph visit compiles the route in dev-mode — allow for it.
  await expect(page).toHaveURL(/\/graph/, { timeout: 45_000 });
  await expect(chip).toContainText(/nexa summit/i, { timeout: 20_000 });
  await page.getByRole('link', { name: 'chat' }).click();
  await expect(chip).toContainText(/nexa summit/i);

  // ── capture works while a session is bound (fake-mic recipe) ──
  await page.locator('.capture-orb').click({ force: true });
  await expect(page.locator('[data-orb-state="recording"]')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape'); // discard the take — the session must survive it
  await expect(page.locator('[data-orb-state="recording"]')).toHaveCount(0);
  await expect(chip).toContainText(/nexa summit/i);

  // ── AC3: unbind via the review sheet; the same event stays suppressed ──
  await chip.click();
  const review = page.getByTestId('event-session-review');
  await expect(review).toBeVisible();
  await expect(review).toContainText(/nexa summit/i);
  await expect(review).toContainText(/from your calendar/i);
  await page.getByTestId('event-session-unbind').click();
  await expect(page.getByTestId('event-session-ghost')).toContainText(/not at an event/i);

  // ── AC3: two overlapping matches → one-tap picker auto-opens ──
  seedIcs(URL_B, [
    { summary: 'nexa summit', startMin: -60, endMin: 120 },
    { summary: 'web summit', startMin: -30, endMin: 90 },
  ]);
  await page.getByRole('link', { name: 'graph' }).click(); // SPA nav → refetch
  await expect(page).toHaveURL(/\/graph/, { timeout: 45_000 });
  const picker = page.getByTestId('event-session-picker');
  await expect(picker).toBeVisible({ timeout: 20_000 });
  await expect(picker).toContainText(/are you at\?/i);
  await expect(page.getByTestId('event-session-chip')).toContainText(/which event is this\?/i);
  await page.screenshot({ path: '/home/user/work/evidence/tc-5-ambiguous-picker.png', fullPage: true });

  await page.getByTestId('event-session-option').filter({ hasText: /web summit/i }).click();
  const pickedChip = page.getByTestId('event-session-chip');
  await expect(pickedChip).toContainText(/web summit/i, { timeout: 20_000 });

  // ── AC3: window closes → quiet "left <event>" toast, honest ghost ──
  seedIcs(URL_C, []);
  await page.getByRole('link', { name: 'acts' }).click(); // SPA nav → refetch
  await expect(page).toHaveURL(/\/acts/, { timeout: 45_000 });
  await expect(page.getByTestId('event-session-toast')).toContainText(/left web summit/i, { timeout: 20_000 });
  await page.screenshot({ path: '/home/user/work/evidence/tc-6-expiry-toast.png', fullPage: true });
  await expect(page.getByTestId('event-session-ghost')).toContainText(/not at an event/i);
});
