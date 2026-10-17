import { test, expect } from '@playwright/test';
import { waitOpen } from '../e2e/intro-helpers';
import { open, prepare, throttle, scrollAllChapters, table, stats, framesBetween, now, type Tier } from './measure';

// The whole-site performance budget (Task 15). Runs in the `perf` project: the machine's real GPU, as a visitor's PC has.
// CPU throttling (Chrome DevTools' CPU slowdown) stands in for a weak PC. Frame = the gap between two rAF callbacks.
// Budget, lite tier at 6x: no frame over 50 ms, at most 2 % over 33 ms, in every chapter.
// The full tier is measured the same way and reported (it is for capable PCs; a weak one gets lite).

const log = (label: string, v: unknown) => console.log(`${label}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);

for (const tier of ['lite', 'full'] as Tier[]) {
  test(`scroll every chapter at 6x CPU throttle, ${tier} tier @perf`, async ({ page }) => {
    test.setTimeout(300_000);
    const errors = await open(page, tier);
    await page.waitForTimeout(4000); // entry settles: Robo's hello, count-ups
    const cdp = await throttle(page, 6);
    const r = await scrollAllChapters(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    log(`${tier} 6x per chapter\n`, table(r.per));
    log(`${tier} 6x whole page`, r.all);
    log(`${tier} 6x Robo lines (${r.lines}) frames around them`, r.line);
    log(`${tier} 6x worst [ms in, frame ms, scrollY]`, r.worst);
    if (process.env.PERF_LOAF) log(`${tier} 6x long frames`, r.loaf.sort((a, b) => b.d - a.d).slice(0, 12));
    expect(errors).toEqual([]);
    for (const c of r.per) expect(c.frames, `${c.name} recorded frames`).toBeGreaterThan(20);
    if (tier === 'lite') {
      for (const c of r.per) {
        expect.soft(c.over50, `${c.name}: frames over 50 ms`).toBe(0);
        expect.soft(c.pct33, `${c.name}: % frames over 33 ms`).toBeLessThanOrEqual(2);
      }
    }
  });

  test(`first-visit intro at 6x CPU throttle, ${tier} tier @perf`, async ({ page }) => {
    test.setTimeout(120_000);
    await prepare(page, tier);
    const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
    const cdp = await throttle(page, 6);
    await page.goto('/');
    // the intro has started moving when its light is measured and placed
    await expect(page.locator('[data-intro] > div:nth-child(2)[style*="width"]')).toHaveCount(1, { timeout: 30_000 });
    const start = await now(page);
    await waitOpen(page, 30_000);
    await page.waitForTimeout(1500); // Robo's wave + the guide taking over
    const end = await now(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const fcp = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0);
    const kind = await page.evaluate(() => document.documentElement.dataset.tier);
    const s = stats(await framesBetween(page, start, end));
    log(`${tier} intro 6x`, { tier: kind, darkHoldMs: Math.round(start - fcp), introMs: Math.round(end - start), ...s });
    if (process.env.PERF_LOAF) log(`${tier} intro long frames`, await page.evaluate(() => (window as unknown as { __loaf: { d: number }[] }).__loaf.filter((e) => e.d > 50)));
    expect(errors).toEqual([]);
    if (tier === 'lite') { expect.soft(s.over50).toBe(0); expect.soft(s.pct33).toBeLessThanOrEqual(2); }
  });
}

test('lite tier: B knocks the headline down, then the visit panel, at 6x CPU throttle @perf', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, 'lite');
  await page.waitForTimeout(4000);
  const cdp = await throttle(page, 6);
  let a = await now(page);
  await page.keyboard.press('b');
  await expect(page.locator('[data-copy]').first()).toBeAttached();
  const bodies = await page.locator('[data-copy]').count();
  await expect(page.locator('[data-copy]')).toHaveCount(0, { timeout: 20_000 });
  const knock = stats(await framesBetween(page, a, await now(page)));
  log('lite knockdown 6x', { bodies, ...knock });
  a = await now(page);
  await page.getByRole('button', { name: /Your deploy/ }).click();
  const dlg = page.getByRole('dialog', { name: /Your visit/ });
  await expect(dlg.locator('[data-stage][data-state="pending"]')).toHaveCount(0, { timeout: 20_000 });
  await page.waitForTimeout(500);
  const visit = stats(await framesBetween(page, a, await now(page)));
  log('lite visit panel 6x', visit);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  expect(bodies).toBeLessThanOrEqual(12);
  for (const [n, s] of [['knockdown', knock], ['visit panel', visit]] as const) {
    expect.soft(s.over50, `${n}: frames over 50 ms`).toBe(0);
    expect.soft(s.pct33, `${n}: % frames over 33 ms`).toBeLessThanOrEqual(2);
  }
});

test('first load transfers at most 350 KB of gzipped JavaScript @perf', async ({ page }) => {
  await prepare(page, 'full');
  await page.goto('/');
  await waitOpen(page, 30_000);
  await page.waitForTimeout(2000); // the WebGL blob's code arrives after the first paint: count it too
  const js = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /\.js(\?|$)/.test(e.name))
    .map((e) => ({ n: e.name.split('/').pop(), gz: (e as PerformanceResourceTiming).encodedBodySize, raw: (e as PerformanceResourceTiming).decodedBodySize })));
  const gz = js.reduce((s, f) => s + f.gz, 0), raw = js.reduce((s, f) => s + f.raw, 0);
  log('first-load JS', { files: js.length, gzippedKB: +(gz / 1024).toFixed(1), rawKB: +(raw / 1024).toFixed(1), biggest: js.sort((x, y) => y.gz - x.gz).slice(0, 4) });
  expect(gz).toBeLessThanOrEqual(350 * 1024);
});
