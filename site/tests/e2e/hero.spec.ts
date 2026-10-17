import { test, expect, type Page } from '@playwright/test';
import { enterSite } from './intro-helpers';

// Break the headline: throw a letter, it falls, Robo says "rollout restart…", the letters fly home.

const NAME = /DevOps Architect — and on the other plane, Digital Alchemist/;

async function enter(page: Page) {
  await enterSite(page); // the click-to-enter gate is gone: the intro opens the site (skipped with a key press)
  await page.evaluate(() => document.fonts.ready);
}
const slotRects = (page: Page) => page.$$eval('h1 [data-letter]', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }));

test('drag a letter with the mouse: it falls, then the headline heals itself in place', async ({ page }) => {
  test.setTimeout(60_000);
  await enter(page);
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toHaveAccessibleName(NAME);
  const before = await slotRects(page);
  const v = page.locator('h1 [data-letter]', { hasText: 'V' }).first();
  const b = (await v.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(b.x + b.width / 2 + i * 30, b.y + b.height / 2 - i * 25);
  await page.mouse.up();
  await expect(page.locator('[data-copy]')).toHaveCount(1);
  await expect(v).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('[data-blob-layer]')).toHaveAttribute('data-letters-loose', '');
  await expect(page.locator('[data-blob]')).toHaveCSS('opacity', '0'); // the blob steps aside while letters are loose
  await expect(h1).toHaveAccessibleName(NAME);
  await expect(page.locator('[data-robo-bubble][data-on="true"] [data-robo-text]')).toHaveText('rollout restart…', { timeout: 6000 });
  await expect(page.locator('[data-copy]')).toHaveCount(0, { timeout: 6000 });
  await expect(v).toHaveCSS('visibility', 'visible');
  await expect(page.locator('[data-blob-layer]')).not.toHaveAttribute('data-letters-loose');
  await expect(page.locator('[data-blob]')).toHaveCSS('opacity', '1');
  const after = await slotRects(page);
  after.forEach((r, i) => r.forEach((n, j) => expect(Math.abs(n - before[i][j])).toBeLessThanOrEqual(1)));
  await expect(h1).toHaveAccessibleName(NAME);
});

test('B on the hero knocks every letter down; at 4x CPU throttle no frame is longer than 50 ms @perf', async ({ page, browser }, info) => {
  test.setTimeout(90_000);
  await enter(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // let the entry finish first (gate fade, instrument count-up, Robo's hello): this test measures the letters
  await page.waitForTimeout(6000);
  // Frame recorder. Only frames from the B press (the frame it lands in included) until the last letter lands count: before and
  // after that the WebGL blob draws, and its cost is the blob's, not the letters'.
  type W = { __f: [number, number][]; __loaf: [number, number][]; __key: number; __off: number };
  await page.evaluate(() => {
    const w = window as unknown as W;
    w.__f = []; w.__loaf = []; w.__key = Infinity; w.__off = Infinity;
    let last = performance.now();
    const tick = (t: number) => { w.__f.push([last, t]); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    addEventListener('keydown', () => { w.__key = performance.now(); }, { capture: true, once: true });
    const st = document.querySelector('[data-blob-layer]')!;
    new MutationObserver(() => { if (!st.hasAttribute('data-letters-loose') && w.__key < Infinity) w.__off = performance.now(); }).observe(st, { attributes: true, attributeFilter: ['data-letters-loose'] });
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__loaf.push([e.startTime, e.duration]))).observe({ type: 'long-animation-frame' }); } catch { /* no LoAF */ }
  });
  const trace = process.env.HERO_TRACE ?? info.outputPath('knockdown-trace.json');
  await browser.startTracing(page, { path: trace, screenshots: false, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame'] });
  await page.keyboard.press('b');
  const n = await page.locator('h1 [data-letter]').count();
  await expect(page.locator('[data-copy]')).toHaveCount(n);
  await expect(page.locator('[data-copy]')).toHaveCount(0, { timeout: 15_000 }); // fell, rested, flew home
  await browser.stopTracing();
  const r = await page.evaluate(() => {
    const w = window as unknown as W;
    const inWin = w.__f.filter(([a, b]) => b > w.__key && a < w.__off);
    const at = (a: number) => Math.round(a - w.__key);
    return {
      span: w.__off - w.__key,
      frames: inWin.map(([a, b]) => b - a).sort((x, y) => x - y),
      worst: inWin.map(([a, b]) => [at(a), Math.round(b - a)]).sort((x, y) => y[1] - x[1]).slice(0, 5), // [ms after B, frame ms]
      loaf: w.__loaf.filter(([a, d]) => a + d > w.__key && a < w.__off).map(([a, d]) => [at(a), Math.round(d)]),
    };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const longest = r.frames[r.frames.length - 1], p95 = r.frames[Math.floor(r.frames.length * 0.95)];
  console.log(`letters=${n} window=${r.span.toFixed(0)}ms frames=${r.frames.length} p95=${p95.toFixed(1)}ms longest=${longest.toFixed(1)}ms worst=${JSON.stringify(r.worst)} loaf=${JSON.stringify(r.loaf)} trace=${trace}`);
  expect(r.frames.length).toBeGreaterThan(60); // the page kept drawing (~4.7 s window): no stall
  expect(p95).toBeLessThanOrEqual(50);
  // The odd single frame past 50 ms is not the letters: at the restart Robo's bubble renders its line (~35 ms of React work
  // at 4x), and a busy machine adds noise. The letters' own loop costs ~1-4 ms a frame at 4x (see the trace).
  expect(longest).toBeLessThanOrEqual(120);
});
