/**
 * One-off dogfood: open /bay on the running dev server, dismiss the intro,
 * capture the loaded map (before ask), run an ask, capture the emphasized map
 * (after ask), and print the hook + HUD state. Screenshots land in the
 * evidence dir passed as argv[2].
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3211';
const out = process.argv[2] ?? '/home/user/work/evidence';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// a builder-y viewer profile — the ask then carries real fit and the map
// emphasis shows the product's actual behavior, not the null-profile floor
await context.addInitScript(() => {
  window.localStorage.setItem(
    'bay.clientProfile.v1',
    JSON.stringify({
      text: 'indie founder-engineer shipping a side project. goes to builder nights and hack weekends around the city, always hunting for good coffee and quiet corners.',
      roles: ['founder', 'engineer'],
      topics: ['builders', 'hackathons', 'coffee'],
      goals: ['meet people building things this week'],
    }),
  );
});
const page = await context.newPage();
await page.goto(`${BASE}/bay`);

// first-run intro
await page.getByTestId('bay-intro').waitFor({ timeout: 30_000 });
await page.screenshot({ path: `${out}/bay-first-open.png` });
await page.getByTestId('bay-intro-dismiss').click();

// wait for data on the map
await page.waitForFunction(() => {
  const w = window as unknown as { __bay?: { eventCount: number; placeCount: number } };
  return Boolean(w.__bay && w.__bay.placeCount > 0 && w.__bay.eventCount > 0);
}, { timeout: 30_000 });
await page.waitForTimeout(2500); // tiles settle
await page.screenshot({ path: `${out}/bay-map-loaded.png` });

const before = await page.evaluate(() => {
  // scalars only — the hook holds the map instance, which is cyclic
  const b = (window as unknown as { __bay?: { placeCount?: number; eventCount?: number; liveOnMap?: number; personaId?: string | null; emphasis?: unknown } }).__bay;
  return { placeCount: b?.placeCount, eventCount: b?.eventCount, liveOnMap: b?.liveOnMap, personaId: b?.personaId, emphasis: b?.emphasis ?? null };
});
const hudText = await page.getByTestId('bay-hud').innerText();

// the ask — before/after emphasis
await page.getByTestId('bay-ask-input').fill('where should a builder go tonight?');
await page.getByTestId('bay-ask-submit').click();
await page.getByTestId('bay-answer').waitFor({ timeout: 30_000 });
await page.waitForTimeout(1200); // ease the emphasis in
await page.screenshot({ path: `${out}/bay-ask-emphasis.png` });

const after = await page.evaluate(() => ({
  emphasis: (window as unknown as { __bay?: { emphasis?: unknown } }).__bay?.emphasis ?? null,
  answer: document.querySelector('[data-testid="bay-answer"]')?.textContent ?? null,
}));
const hudAfter = await page.getByTestId('bay-hud').innerText();

// hide the answer — the emphasis clears with it (it belongs to the answer)
await page.getByTestId('bay-answer-hide').click();
await page.waitForTimeout(600);
const hudAfterHide = await page.getByTestId('bay-hud').innerText();
const emphasisAfterHide = await page.evaluate(
  () => (window as unknown as { __bay?: { emphasis?: unknown } }).__bay?.emphasis ?? null,
);
await page.screenshot({ path: `${out}/bay-after-hide.png` });

console.log(JSON.stringify({
  before: { ...before, hud: hudText },
  after: { emphasis: after.emphasis, answer: after.answer?.slice(0, 400) ?? null, hud: hudAfter },
  afterHide: { emphasis: emphasisAfterHide, hud: hudAfterHide },
}, null, 2));

await browser.close();
