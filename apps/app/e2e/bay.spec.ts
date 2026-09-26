/**
 * bay.spec — the /bay surface's end-to-end funnel: open → paste-LinkedIn
 * score → claim → ask with map emphasis (the merged-product spec's anonymous
 * stranger path, locked decisions 3 and 6).
 *
 * Everything runs against the real dev server (playwright webServer) on the
 * zero-secret local.db, seeded by helpers/seed-bay.ts: three places, two live
 * events, one expired event that must never reach the map. Sign-in rides the
 * magic-link log seam (RESEND_API_KEY unset locally — same seam as the
 * event-session spec). The sandbox has no extraction LLM key, so the signed-in
 * claim's capture pipeline answers the honest "nothing was written" note —
 * that degradation is deterministic here and is itself the pinned behavior.
 *
 * chromium-only: MapLibre's webgl handling and the sign-in seam timing are
 * tuned on the chromium-desktop project (same precedent as event-session).
 */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const DEV_LOG = '/tmp/wingmic-e2e-dev.log';
const EMAIL = 'e2e-bay-claim@wingmic.test';

/** The window.__bay test hook — the ported map's data-level affordances. */
type BayHook = {
  placeCount: number;
  eventCount: number;
  liveOnMap: number;
  personaId: string | null;
  signedIn: boolean;
  profileSaved: boolean;
  emphasis: Record<string, number> | null;
  pick: (id: string) => void;
};

function seedBay() {
  // the local.db gotcha (AGENTS.md): TURSO_DB_URL defaults to ./local.db
  // relative to each script's cwd — pin the app's db with an absolute file
  // URL or packages/db writes a DIFFERENT local.db than the dev server reads
  const dbUrl = `file:${resolve(__dirname, '../local.db')}`;
  // a just-torn-down webServer can hold the file lock a beat after Playwright
  // kills it — retry rather than flake the whole suite on teardown timing
  const run = (cmd: string, cwd: string) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        execSync(`TURSO_DB_URL="${dbUrl}" ${cmd}`, {
          cwd,
          stdio: 'pipe',
          env: process.env,
          timeout: 120_000,
        });
        return;
      } catch (err) {
        if (attempt === 3) throw err;
        execSync('sleep 2');
      }
    }
  };
  // curated inventory (places + frozen events) from the db package — seed:bay
  // applies pending migrations first, then seeds
  run('bun run seed:bay', `${__dirname}/../../../packages/db`);
  // …then live/expired events with now-relative timestamps from the helper
  run('bun e2e/helpers/seed-bay.ts', `${__dirname}/..`);
}

const hook = (page: Page) =>
  page.evaluate(() => (window as unknown as { __bay?: BayHook }).__bay) as Promise<BayHook | undefined>;

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

test.beforeAll(() => {
  seedBay();
});

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'webgl map + sign-in seam tuned on chromium');
});

test.describe('the /bay surface', () => {
  test('opens honestly: intro dialog, counts HUD, and the test hook', async ({ page }) => {
    await page.goto('/bay');
    await expect(page.getByTestId('bay-intro')).toBeVisible();
    await page.getByTestId('bay-intro-dismiss').click();
    await expect(page.getByTestId('bay-intro')).toBeHidden();

    await page.waitForFunction(() => {
      const w = window as unknown as { __bay?: { eventCount: number; placeCount: number } };
      return Boolean(w.__bay && w.__bay.placeCount > 0 && w.__bay.eventCount > 0);
    });
    const state = await hook(page);
    if (!state) throw new Error('window.__bay never appeared — the map failed to boot');
    expect(state.placeCount).toBeGreaterThan(0);
    expect(state.eventCount).toBeGreaterThanOrEqual(2);
    // the expired seed row never reaches the map: every served event renders
    expect(state.liveOnMap).toBe(state.eventCount);

    // the HUD never lies about coverage: the same counts the hook reports
    const hud = await page.getByTestId('bay-hud').innerText();
    expect(hud).toContain(`${state.placeCount} places`);
    expect(hud).toContain(`${state.liveOnMap} of ${state.eventCount} events`);

    // picking a known-but-expired id does nothing — it is not on the map,
    // and the history row stayed in the table (nothing silently deleted)
    await page.evaluate(() =>
      (window as unknown as { __bay?: BayHook }).__bay?.pick('luma:e2e-expired-mixer'),
    );
    await expect(page.getByTestId('bay-card')).toHaveCount(0);
  });

  test('the funnel: paste → score → claim → ask with map emphasis', async ({ page }) => {
    await page.goto('/bay');
    await page.getByTestId('bay-intro-dismiss').click();
    await page.waitForFunction(() => {
      const w = window as unknown as { __bay?: { eventCount: number } };
      return Boolean(w.__bay && w.__bay.eventCount > 0);
    });

    // ── paste-linkedin score ────────────────────────────────────────────
    await page.evaluate(() => (window as unknown as { __bay?: BayHook }).__bay?.pick('luma:e2e-builder-night'));
    const profile = page.getByTestId('bay-profile-input');
    await expect(profile).toBeVisible();
    await profile.fill('sam rivera — ml engineer at a small robotics lab. into drones, mapping, and evals.');
    await page.getByTestId('bay-profile-go').click();
    await expect(page.getByTestId('bay-score-verdict')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('bay-score-reasons')).toBeVisible();
    // a fit weight is never shown as a probability — no odds language in the card
    const card = await page.getByTestId('bay-card').innerText();
    expect(card).not.toMatch(/%|\bodds\b/i);
    // the paste kept itself (ported auto-score rule)
    expect(await hook(page)).toMatchObject({ profileSaved: true });

    // ── claim, signed-out: the magic link, next=/bay ────────────────────
    await page.getByTestId('bay-claim-email').fill(EMAIL);
    await page.getByTestId('bay-claim-cta').click();
    await page.waitForURL(/\/signin/);
    await expect(page.getByPlaceholder('you@domain.com')).toHaveValue(EMAIL);
    await page.getByRole('button', { name: /send sign-in link/i }).click();
    await expect(page.getByText(/link sent/i)).toBeVisible({ timeout: 20_000 });
    const link = await pollMagicLink(EMAIL);
    await page.goto(link);
    // /bay is public and chromeless — the verified link returns straight there
    // (onboarding still gates only the protected surfaces, so a stranger
    // finishes the funnel before any account-admin)
    await page.waitForURL(/\/bay/);

    // ── claim, signed-in: the browser-held profile becomes the claim ────
    await page.goto('/bay');
    await page.waitForFunction(() => {
      const w = window as unknown as { __bay?: { profileSaved: boolean; eventCount: number } };
      return Boolean(w.__bay && w.__bay.profileSaved && w.__bay.eventCount > 0);
    });
    await page.evaluate(() => (window as unknown as { __bay?: BayHook }).__bay?.pick('luma:e2e-builder-night'));
    await expect(page.getByTestId('bay-score-verdict')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('bay-claim-cta').click();
    // zero-secret sandbox: no extraction key, so the capture pipeline cannot
    // store the profile — the honest note is the correct outcome here
    await expect(page.getByTestId('bay-claim-error')).toContainText(/nothing was written|try again/i, {
      timeout: 20_000,
    });

    // ── the ask: one question → answer card → map emphasis ──────────────
    await page.getByTestId('bay-ask-input').fill('where should a builder go tonight?');
    await page.getByTestId('bay-ask-submit').click();
    await expect(page.getByTestId('bay-answer')).toBeVisible({ timeout: 30_000 });
    const after = await hook(page);
    expect(after?.emphasis).not.toBeNull();
  });
});
