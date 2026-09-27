/**
 * bay-44px.spec — the /bay surface's touch-target floor measurement.
 *
 * The spec's a11y floor is 44px on every tappable control. QA's tc-6 caught
 * persona view chips at 36px: the later pill-styling .bay-view rule reset the
 * min-height inherited from the shared .bay-layer-toggle/.bay-view rule. This
 * spec pins the floor on the real controls (view chips plus the sibling layer
 * toggles that share the sizing rule) and asserts the dev-tools badge — the
 * dark "N" circle tc-6 logged as a "compass" — and any maplibre compass stay
 * clear of the HUD/status pill and the intro dialog, on desktop and mobile.
 *
 * chromium + mobile-safari via the shared playwright webServer; no sign-in,
 * no seed coupling beyond the dev server's own local.db inventory.
 */
import { test, expect } from '@playwright/test';

const FLOOR = 44;

type Rect = { x: number; y: number; width: number; height: number };

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function boxesOf(page: import('@playwright/test').Page, selector: string) {
  await page.locator(selector).first().waitFor();
  return page.$$eval(selector, (els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { label: (el.textContent ?? '').trim().slice(0, 24), h: r.height, w: r.width };
    }),
  );
}

test.describe('the bay touch-target floor (44px)', () => {
  test('persona view chips and layer toggles measure at least 44px', async ({ page }) => {
    await page.goto('/bay');
    const chips = page.locator('.bay-views-row .bay-view');
    await expect(chips.first()).toBeVisible();

    const chipBoxes = await boxesOf(page, '.bay-views-row .bay-view');
    expect(chipBoxes.length, 'persona view chips present').toBeGreaterThanOrEqual(3);
    for (const box of chipBoxes) {
      expect(box.h, `view chip "${box.label}" height`).toBeGreaterThanOrEqual(FLOOR);
      expect(box.w, `view chip "${box.label}" width`).toBeGreaterThanOrEqual(FLOOR);
    }

    // sibling audit: layer toggles share the sizing rule — pin them too
    const toggleBoxes = await boxesOf(page, '.bay-layers .bay-layer-toggle');
    expect(toggleBoxes.length, 'layer toggles present').toBeGreaterThanOrEqual(3);
    for (const box of toggleBoxes) {
      expect(box.h, `layer toggle "${box.label}" height`).toBeGreaterThanOrEqual(FLOOR);
      expect(box.w, `layer toggle "${box.label}" width`).toBeGreaterThanOrEqual(FLOOR);
    }
  });

  test('the dev badge and any map compass stay clear of HUD and intro', async ({ page }) => {
    await page.goto('/bay');
    const intro = page.locator('.bay-intro-card');
    await intro.waitFor();

    // tc-6's "compass N" is Next's dev-tools badge (nextjs-portal shadow DOM).
    // It renders in dev only, so the check applies when present.
    const badge = await page.evaluate<Rect | null>(() => {
      const el = document.querySelector('nextjs-portal')?.shadowRoot?.querySelector('#next-logo');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
    });
    const introBox = await intro.evaluate<Rect>((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    if (badge) {
      expect(overlaps(badge, introBox), 'dev badge overlaps the intro card').toBe(false);
    }

    await page.getByRole('button', { name: 'got it' }).click();
    const hud = page.locator('.bay-hud');
    await expect(hud).toBeVisible();
    const hudBox = await hud.evaluate<Rect>((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    if (badge) {
      expect(overlaps(badge, hudBox), 'dev badge overlaps the HUD').toBe(false);
    }

    // a real maplibre compass, if one is ever added, must clear the HUD too
    const compass = await page.evaluate<Rect | null>(() => {
      const el = document.querySelector<HTMLElement>('.maplibregl-ctrl-compass');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
    });
    if (compass) {
      expect(overlaps(compass, hudBox), 'map compass overlaps the HUD').toBe(false);
    }
  });
});
