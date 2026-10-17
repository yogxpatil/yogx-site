import { test, expect, type Page } from '@playwright/test';
import { enterSite } from './intro-helpers';

// Owner rule (2026-10-17): a transition never covers content the visitor has not seen yet, and the next content only
// moves once the transition has finished.
// - Doors start closing only after the previous section's last item is above the screen middle (or gone), and that item
//   was fully in view for a good stretch (40vh of scroll) before.
// - The OCD → mission-log peel: OCD's last item stays fully in view for 40vh before the peel, and once the log's story
//   starts nothing of OCD covers the log.
// - ECS tiles: gone before the ECS story starts.

/** The section's lowest visible text element (leaf with text, laid out, not transparent), as viewport rect. */
const lastItem = (page: Page, sel: string) => page.evaluate((sel) => {
  const root = document.querySelector(sel)!;
  let best: { top: number; bottom: number; text: string } | null = null;
  root.querySelectorAll<HTMLElement>('*').forEach((e) => {
    if (e.children.length || !e.textContent?.trim()) return;
    const r = e.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) return;
    for (let a: HTMLElement | null = e; a && a !== root.parentElement; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.opacity === '0' || cs.visibility === 'hidden' || cs.display === 'none') return; }
    if (!best || r.bottom > best.bottom) best = { top: r.top, bottom: r.bottom, text: e.textContent.trim().slice(0, 40) };
  });
  return best as { top: number; bottom: number; text: string } | null;
}, sel);

/** Scroll so `el`'s top sits at frac × viewport height. */
const topAt = (page: Page, sel: string, frac: number) => page.evaluate(([s, f]) => { const e = document.querySelector(s as string)!; scrollTo(0, e.getBoundingClientRect().top + scrollY - innerHeight * (f as number)); }, [sel, frac] as const);
const vh = (page: Page) => page.evaluate(() => innerHeight);
const doorPos = (page: Page) => page.evaluate(() => { const t = document.querySelector<HTMLElement>('[data-door="top"]'); if (!t) return 0; const m = getComputedStyle(t).transform; const ty = m === 'none' ? 0 : Number(m.split(',')[5]?.replace(')', '')); return 1 - Math.abs(ty) / (t.offsetHeight * 1.01 || 1); });

/** Each door zone and the section just before it (the one whose last item must be seen first). */
const ZONES: [string, string][] = [
  ['[data-door-zone][data-sector="03"]', '#c2'], ['[data-door-zone][data-sector="04"]', '#c3'],
  ['[data-door-zone][data-sector="HB-02"]', '#sc-cc'], ['[data-door-zone][data-sector="OCD-04"]', '#sc-ecs'],
  ['[data-door-zone][data-sector="06"]', '#c5'], ['[data-door-zone][data-sector="07"]', '#c6'],
];

async function checkDoors(page: Page) {
  const h = await vh(page);
  for (const [zone, prev] of ZONES) {
    // 40vh of scroll before the doors start: the last item is fully on screen
    await topAt(page, zone, 0.72);
    await page.waitForTimeout(150);
    expect(await doorPos(page), `${zone}: doors still open 40vh before they start`).toBeLessThan(0.02);
    const early = await lastItem(page, prev);
    expect(early, `${prev} has content`).not.toBeNull();
    expect(early!.top, `${prev} last item "${early!.text}" fully in view 40vh before the doors`).toBeGreaterThanOrEqual(-1);
    expect(early!.bottom).toBeLessThanOrEqual(h + 1);
    // where the doors start moving: the last item is above the middle (or gone)
    await topAt(page, zone, 0.29);
    await expect.poll(() => doorPos(page), { message: `${zone}: doors start moving here` }).toBeGreaterThan(0);
    const at = await lastItem(page, prev);
    expect(at!.bottom, `${prev} last item "${at!.text}" seen before ${zone} closes`).toBeLessThanOrEqual(h * 0.5 + 1);
  }
}

async function checkPeelAndTiles(page: Page) {
  const h = await vh(page);
  // peel: OCD's last item fully in view from 40vh before the peel starts until it starts (log top at 60%)
  for (const f of [1.0, 0.61]) {
    await topAt(page, '#c5', f); await page.waitForTimeout(150);
    const it = await lastItem(page, '#sc-ocd');
    expect(it!.top, `OCD last item "${it!.text}" in view (log top at ${f})`).toBeGreaterThanOrEqual(-1);
    expect(it!.bottom).toBeLessThanOrEqual(h * f + 1); // and not under the rising log
  }
  // the log's story starts at its top = 0: nothing of OCD covers it
  await topAt(page, '#c5', 0); await page.waitForTimeout(200);
  const covered = await page.evaluate(() => {
    const hits: string[] = [];
    for (const y of [0.1, 0.3, 0.5, 0.7, 0.9]) for (const x of [0.2, 0.5, 0.8]) {
      const e = document.elementFromPoint(innerWidth * x, innerHeight * y);
      if (e?.closest('#sc-ocd')) hits.push(`${x},${y}`);
    }
    return hits;
  });
  expect(covered, 'OCD covering the mission log at the start of its story').toEqual([]);
  // ECS tiles have flipped away before the ECS story starts (scene top = 0)
  await topAt(page, '#sc-ecs', 0); await page.waitForTimeout(200);
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#sc-ecs [data-tile]')].filter((t) => t.offsetParent && getComputedStyle(t).opacity !== '0').length)).toBe(0);
}

for (const [w, h] of [[1366, 768], [1440, 900]] as const) {
  test.describe(`transitions never cover unseen content at ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    test('doors', async ({ page }) => { test.setTimeout(90_000); await enterSite(page); await checkDoors(page); });
    test('peel and tiles', async ({ page }) => { await enterSite(page); await checkPeelAndTiles(page); });
  });
}

test('transitions never cover unseen content on the phone @phone', async ({ page }) => {
  test.setTimeout(120_000);
  await enterSite(page);
  await checkDoors(page);
  await checkPeelAndTiles(page);
});
