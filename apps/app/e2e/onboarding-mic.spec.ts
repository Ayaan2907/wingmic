import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * onboarding-mic — spec D4 / AC6 evidence.
 *
 * Onboarding step 3 now asks for the real mic (getUserMedia) so the browser
 * caches the grant before the first take. Two runs over the real flow:
 *
 *   granted — fake mic device + context grantPermissions(['microphone']): the
 *   step confirms "mic ready", and a force-click on the pulsing orb starts
 *   recording with no permission sheet in between.
 *
 *   denied — fake device, NO granted permission: headless Chromium dismisses
 *   the permission prompt, so getUserMedia rejects with NotAllowedError and the
 *   step must surface the outcome honestly (blocked + retry, no fake ready)
 *   without trapping the flow.
 *
 * Launch options are worker-scoped, so they live in playwright.config.ts
 * (chromium-desktop project: handoff executablePath override, else full
 * chromium via channel — the headless shell cannot fake media streams — plus
 * --use-fake-device-for-media-stream). The two paths differ here only by
 * context permissions: the handoff's `--use-fake-ui-for-media-stream` and a
 * CDP grant produce the same granted outcome; the CDP grant is the
 * deterministic one.
 *
 * 2026-08-04 handoff quirks honored: preinstalled-Chromium executablePath
 * override (applied only when that path exists), grantPermissions(['microphone']),
 * force-click on the pulsing orb, webServer on :3211.
 */

const DEV_LOG = '/tmp/wingmic-e2e-dev.log';

test.beforeEach(({ browserName }) => {
  // browserName comes from project config — skipping on it never triggers a launch
  test.skip(browserName !== 'chromium', 'fake-mic flags are chromium-only');
});

/**
 * Sign in through the real magic-link flow. With RESEND_API_KEY unset the dev
 * server prints the verify URL to its console; the playwright.config webServer
 * tees that console to DEV_LOG and we read the link back out of it.
 */
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

/** Walk steps 1 → 3 of onboarding (the you-step requires first + last names). */
async function walkToMicStep(page: Page) {
  await expect(page.getByText(/step 1 of 4/i)).toBeVisible();
  // /^next/ — not /next/i: the Next.js dev-tools overlay button also matches /next/i
  await page.getByRole('button', { name: /^next/i }).click();
  await page.getByPlaceholder('Ada').fill('Ada');
  await page.getByPlaceholder('Lovelace').fill('Lovelace');
  await page.getByRole('button', { name: /^next/i }).click();
  await expect(page.getByText(/step 3 of 4/i)).toBeVisible();
}

test('granted: mic priming confirms ready and the first orb tap records without a permission sheet', async ({ page }) => {
  await page.context().grantPermissions(['microphone']);
  await signInViaMagicLink(page, 'e2e-mic-granted@wingmic.test', '/onboarding');
  await walkToMicStep(page);

  await page.getByRole('button', { name: /enable the mic/i }).click();
  await expect(page.getByText(/mic ready/i)).toBeVisible();
  await page.screenshot({ path: '/home/user/work/evidence/tc-1-granted-mic-ready.png', fullPage: true });

  await page.getByRole('button', { name: /^next/i }).click();
  await page.getByRole('button', { name: /get started/i }).click();
  await page.waitForURL(/\/chat/);

  // the orb pulses forever — force-click per the handoff quirk
  await page.locator('.capture-orb').click({ force: true });
  await expect(page.locator('[data-orb-state="recording"]')).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: '/home/user/work/evidence/tc-2-granted-orb-recording.png' });

  await page.keyboard.press('Escape'); // discard the take — clean exit
});

test('denied: blocked outcome is surfaced honestly with retry and the flow is not trapped', async ({ page }) => {
  await signInViaMagicLink(page, 'e2e-mic-denied@wingmic.test', '/onboarding');
  await walkToMicStep(page);

  await page.getByRole('button', { name: /enable the mic/i }).click();
  await expect(page.getByText(/mic blocked/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
  await expect(page.getByText(/mic ready/i)).toHaveCount(0);
  await page.screenshot({ path: '/home/user/work/evidence/tc-3-denied-honest-block.png', fullPage: true });

  // denial is not a trap — the flow continues to the privacy step
  await page.getByRole('button', { name: /^next/i }).click();
  await expect(page.getByText(/step 4 of 4/i)).toBeVisible();
});
