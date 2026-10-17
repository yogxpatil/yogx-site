import { test, expect, type Page } from '@playwright/test';
import { enterSite } from './intro-helpers';
const enter = (page: Page) => enterSite(page);
const go = (page: Page, sel: string, f = 0.5) => page.evaluate(([sel, f]) => { const el = document.querySelector<HTMLElement>(sel)!; scrollTo(0, el.offsetTop + f * Math.max(el.offsetHeight - innerHeight, 0)); }, [sel, f] as const);

test('reduced motion: no zoom, no bend, doors fade, scenes static, no tiles', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1600, height: 900 } }); const page = await ctx.newPage();
  await enter(page);
  await go(page, '#c1', 0.5);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-hero-sticky]')!).transform)).toBe('none');
  await go(page, '#c2', 0.1);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-tl="1"]')!).transform)).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  await page.evaluate(() => { const z = document.querySelector<HTMLElement>('[data-door-zone][data-sector="03"]')!; scrollTo(0, z.offsetTop - innerHeight * 0.2); });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('[data-door="top"]')!).transform)).toBe('none');
  await page.evaluate(() => document.getElementById('sc-cc')!.scrollIntoView());
  await expect(page.locator('[data-cc-status]').first()).toHaveText('✓ PASS');
  await expect(page.locator('[data-tile]')).toHaveCount(0);
  await ctx.close();
});

test('night mode: dark chapters go abyss, apricot scenes keep ink text', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: 'Toggle night mode' }).click();
  await expect(page.locator('html')).toHaveClass(/night/);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('c2')!).backgroundColor)).toBe('rgb(13, 11, 4)');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#sc-ocd h3')!).color)).toBe('rgb(27, 22, 5)');
});

test('every chapter renders with no page errors, top to bottom', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await enter(page);
  for (const id of ['c2', 'c3', 'c4', 'c5', 'c6', 'c7']) { await go(page, `#${id}`, 0.5); await expect(page.locator(`#${id}`)).toBeAttached(); }
  expect(errors).toEqual([]);
});

test('@phone chapters fit without horizontal scroll', async ({ page }) => {
  await enter(page);
  for (const id of ['c2', 'c3', 'c4', 'c5', 'c6', 'c7']) { await go(page, `#${id}`, 0.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
});


// regression (owner report): after the portal zoom (scale ~58) and back, the hero text was left half-painted.
// Root cause: `will-change: transform` on the sticky hero kept one huge GPU layer whose tiles went stale after the zoom
// (computed styles stayed correct, only the pixels were wrong), so we assert both the style and the real pixels.
async function inkPixels(page: Page) {
  const box = await page.evaluate(() => { const r = document.querySelector<HTMLElement>('[data-hero-sticky] h1')!.getBoundingClientRect(); return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.width, innerWidth - Math.max(0, r.x)), height: Math.min(r.height, innerHeight - Math.max(0, r.y)) }; });
  const png = (await page.screenshot({ clip: box })).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d')!; g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 140 && d[i + 1] < 90) n++;   // ink or rust
    return n / (d.length / 4);
  }, png);
}
const heroState = (page: Page) => page.evaluate(() => {
  const h1 = document.querySelector<HTMLElement>('[data-hero-sticky] h1')!, st = document.querySelector<HTMLElement>('[data-hero-sticky]')!;
  const cs = getComputedStyle(h1), ss = getComputedStyle(st);
  return { y: Math.round(scrollY), vis: cs.visibility, op: cs.opacity, svis: ss.visibility, tf: ss.transform, wc: ss.willChange, hidden: st.dataset.heroHidden };
});
async function roundTrip(page: Page) {
  await enter(page);
  expect((await heroState(page)).wc, 'the hero must not hold a permanent GPU layer').toBe('auto');
  await expect.poll(async () => (await inkPixels(page)) > 0.05, { timeout: 10_000 }).toBe(true);
  await page.mouse.move(800, 450); await page.waitForTimeout(1500);
  const before = await inkPixels(page);
  const c2 = await page.evaluate(() => document.getElementById('c2')!.offsetTop);
  const vh0 = await page.evaluate(() => innerHeight);
  for (const y of [400, 900, 1300, c2 + 50]) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(500); }
  await expect.poll(async () => (await heroState(page)).hidden).toBe('1');
  for (const y of [1300, 900, 400, 100, 0]) {
    await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(500);
    const t = await heroState(page);
    // second root cause (phones): the zoomed hero overflowed the page, the browser zoomed out and innerHeight jumped (839 to 3356), corrupting the zoom progress
    expect(await page.evaluate(() => innerHeight), 'viewport height must not change while the hero is scaled').toBe(vh0);
    if (y < c2 * 0.5) { expect(t.svis, JSON.stringify(t)).toBe('visible'); expect(t.hidden, JSON.stringify(t)).toBe('0'); }
  }
  await page.mouse.move(801, 451); await page.waitForTimeout(1500);
  await expect.poll(async () => Math.abs((await inkPixels(page)) - before), { timeout: 8000, message: 'hero headline pixels back to normal' }).toBeLessThan(before * 0.2);
  const s = await heroState(page);
  expect(s.vis).toBe('visible'); expect(s.op).toBe('1'); expect(s.tf).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
}
test('going back up from the manifesto, the hero text is fully painted again', async ({ page }) => { test.setTimeout(120_000); await roundTrip(page); });
test('key jump from the manifesto back to chapter 1 shows the hero', async ({ page }) => {
  test.setTimeout(120_000); await enter(page);
  const c2 = await page.evaluate(() => document.getElementById('c2')!.offsetTop);
  await page.evaluate((y) => scrollTo(0, y + 50), c2); await page.waitForTimeout(400);
  await page.keyboard.press('1');
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 20_000 }).toBeLessThan(5);
  await expect.poll(async () => (await inkPixels(page)) > 0.05, { timeout: 8000 }).toBe(true);
  const s = await heroState(page); expect(s.svis).toBe('visible'); expect(s.op).toBe('1');
});
test('@phone going back up from the manifesto, the hero text is fully painted again', async ({ page }) => { test.setTimeout(120_000); await roundTrip(page); });

test('portal dive: the blob stops rendering mid-dive and comes back on return', async ({ page }) => {
  test.setTimeout(90_000);
  // count real WebGL draw calls so "paused" means the GPU is idle, not just hidden
  await page.addInitScript(() => {
    (window as unknown as { __draws: number }).__draws = 0;
    for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const orig = C.prototype.drawElements, orig2 = C.prototype.drawArrays;
      C.prototype.drawElements = function (this: unknown, ...a: Parameters<typeof orig>) { (window as unknown as { __draws: number }).__draws++; return orig.apply(this as never, a); };
      C.prototype.drawArrays = function (this: unknown, ...a: Parameters<typeof orig2>) { (window as unknown as { __draws: number }).__draws++; return orig2.apply(this as never, a); };
    }
  });
  await enter(page);
  const draws = async () => { const a = await page.evaluate(() => (window as unknown as { __draws: number }).__draws); await page.waitForTimeout(700); return (await page.evaluate(() => (window as unknown as { __draws: number }).__draws)) - a; };
  const st = () => page.evaluate(() => ({ diving: document.querySelector<HTMLElement>('[data-hero-sticky]')!.dataset.heroDiving, op: getComputedStyle(document.querySelector('[data-blob-layer]')!).opacity }));
  expect(await draws()).toBeGreaterThan(0); // idle hero: the blob renders
  await page.evaluate(() => { const w = document.getElementById('c1')!; scrollTo(0, w.offsetTop + 0.3 * (w.offsetHeight - innerHeight)); });
  await expect.poll(st).toEqual({ diving: '1', op: '0' });
  expect(await draws()).toBe(0); // mid-dive: nothing is drawn
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(st).toEqual({ diving: '0', op: '1' });
  await expect.poll(draws, { timeout: 15_000 }).toBeGreaterThan(0); // back on the hero: rendering again
});

test('night mode: the HUD stays readable on the dark Signal, the apricot OCD scene and the manifesto', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: 'Toggle night mode' }).click();
  await expect(page.locator('html')).toHaveClass(/night/);
  const hud = () => page.evaluate(() => { const t = [...document.querySelectorAll('span')].find((s) => s.textContent?.startsWith('CURSOR')); return getComputedStyle(t!).color; });
  await page.evaluate(() => { const el = document.getElementById('c7')!; scrollTo(0, el.offsetTop + 0.3 * (el.offsetHeight - innerHeight)); });
  await expect.poll(hud, { timeout: 8000 }).toBe('rgb(242, 238, 228)'); // Signal is dark at night now
  await page.evaluate(() => { const el = document.getElementById('sc-ocd')!; scrollTo(0, el.getBoundingClientRect().top + scrollY - 20); });
  await expect.poll(hud, { timeout: 8000 }).toBe('rgb(27, 22, 5)');
  await page.evaluate(() => { const el = document.getElementById('c2')!; scrollTo(0, el.offsetTop + 0.1 * (el.offsetHeight - innerHeight)); });
  await expect.poll(hud, { timeout: 8000 }).toBe('rgb(242, 238, 228)');
});

test('keyboard: after entering, focus is on the headline', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused({ timeout: 20_000 });
});
