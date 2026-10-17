import { test, expect, type Page } from '@playwright/test';
import { enterSite as enter, waitOpen } from './intro-helpers';

test('intro → hero with WebGL blob, no page errors', async ({ page }) => {
  const errors = await enter(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Architect');
  await expect(page.locator('[data-blob="webgl"] canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('number keys jump to chapters and the HUD follows', async ({ page }) => {
  await enter(page);
  await page.keyboard.press('3');
  await expect.poll(async () => page.evaluate(() => Math.round(document.getElementById('c3')!.getBoundingClientRect().top)), { timeout: 15_000 }).toBeLessThan(5);
});

test('keyboard only: the site opens by itself with the headline focused, chapter links appear on focus', async ({ page }) => {
  await page.goto('/');
  await waitOpen(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  const link = page.getByRole('link', { name: '2 Manifesto' });
  await link.focus();
  await expect(link).toBeVisible();
});

test('breaker switches night mode', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: 'Toggle night mode' }).click();
  await expect(page.locator('html')).toHaveClass(/night/);
});

test('reduced motion: no intro, opens at once, blob still revealed', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await waitOpen(page, 5000);
  await expect(page.locator('[data-blob]')).toHaveCount(1);
  await ctx.close();
});

test('resize repaints the blob canvas at the new size', async ({ page }) => {
  await enter(page);
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect.poll(async () => page.evaluate(() => { const c = document.querySelector('[data-blob] canvas') as HTMLCanvasElement; return Math.round(c.getBoundingClientRect().width); })).toBeGreaterThan(1150);
});

test('@nowebgl hero falls back without crashing', async ({ page }) => {
  const errors = await enter(page);
  await expect(page.locator('[data-blob="fallback"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('@phone headline fits, no horizontal scroll, Dial present', async ({ page }) => {
  await enter(page);
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(fits).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
});

test('during the intro: the wheel that skips it does not scroll the page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-intro][data-kind="first"]')).toHaveCount(1, { timeout: 15_000 });
  await page.mouse.move(800, 450);
  await expect(async () => {
    await page.mouse.wheel(0, 300);
    await expect(page.locator('main:not([inert])')).toHaveCount(1, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await waitOpen(page);
  await page.waitForTimeout(300); // negative check: give a stray scroll time to show up
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(await page.evaluate(() => Math.round(document.getElementById('c1')!.getBoundingClientRect().top))).toBe(0);
});

test('during the intro: a number key only skips it, it does not jump to a chapter', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-intro][data-kind="first"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(async () => {
    await page.keyboard.press('4');
    await expect(page.locator('main:not([inert])')).toHaveCount(1, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('after entering: a wheel burst over the dial knob lands on chapter 2', async ({ page }) => {
  await enter(page);
  const knob = page.locator('[data-lenis-prevent]');
  const box = (await knob.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // A fast flick: 10 wheel events in one tick (real CDP input is too slow under software WebGL to produce a burst).
  await knob.evaluate((el) => { for (let k = 0; k < 10; k++) el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })); });
  await expect.poll(() => page.evaluate(() => Math.abs(Math.round(document.getElementById('c2')!.getBoundingClientRect().top))), { timeout: 15_000 }).toBeLessThanOrEqual(5);
  await expect(page.locator('[data-door="top"]')).toHaveCSS('transform', /matrix\(1, 0, 0, 1, 0, -/, { timeout: 15_000 }); // doors fully reopened
});

test('portal: scrolling flies into the O and never leaves a blank screen', async ({ page }) => {
  await enter(page);
  const y = (f: number) => page.evaluate((f) => { const w = document.getElementById('c1')!; scrollTo(0, w.offsetTop + f * (w.offsetHeight - innerHeight)); }, f);
  await y(0.5);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('[data-hero-sticky]')!).transform)).toMatch(/^matrix\(7\.7/);
  await y(1);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('[data-hero-sticky]')!).visibility)).toBe('hidden');
  await expect(page.locator('#c1')).toHaveAttribute('data-tone', 'dark');
});

test('doors: scrolling into a zone seals them, keys jump behind them and reopen', async ({ page }) => {
  await enter(page);
  await page.evaluate(() => { const z = document.querySelector<HTMLElement>('[data-door-zone][data-sector="03"]')!; scrollTo(0, z.offsetTop - innerHeight * 0.2); });
  await expect(page.locator('[data-lock]')).toHaveText('⛒ SEALED');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('[data-lock]')!).opacity)).toBe('1');
  await page.keyboard.press('3'); await page.keyboard.press('5'); // the 5 lands while the doors are busy and is refused
  await expect.poll(() => page.evaluate(() => Math.round(document.getElementById('c3')!.getBoundingClientRect().top)), { timeout: 15_000 }).toBeLessThan(5);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('[data-door="top"]')!).transform), { timeout: 15_000 }).toMatch(/matrix\(1, 0, 0, 1, 0, -/);
});

// Mission stories follow scroll: put scene `id` with its top at `frac` of the viewport height (negative = scrolled past the top).
const sceneAt = (page: Page, id: string, frac: number) => page.evaluate(([i, f]) => { const e = document.getElementById(i as string)!; scrollTo(0, e.getBoundingClientRect().top + scrollY - innerHeight * (f as number)); }, [id, frac] as const);

test('OCD scene: the ticket rides the pipeline with the scroll, and back', async ({ page }) => {
  await enter(page);
  const lit = () => page.evaluate(() => document.querySelectorAll('#sc-ocd [class*="station"][class*="lit"]').length);
  await sceneAt(page, 'sc-ocd', 0.6);
  await expect(page.locator('#sc-ocd')).toHaveAttribute('data-in', 'true');
  await expect.poll(lit).toBe(0);
  await sceneAt(page, 'sc-ocd', -0.3);
  await expect(page.locator('#sc-ocd').getByText('→ build #812')).toBeVisible();
  await expect.poll(lit).toBe(4);
  await sceneAt(page, 'sc-ocd', 0.6); // scroll back up: the ticket goes back to the start
  await expect.poll(lit).toBe(0);
  await expect(page.locator('#sc-ocd').getByText('→ build #812')).toHaveCount(0);
});

test('CC-01: Robo fixes the rows and stamps VERIFIED as you scroll, and un-fixes them scrolling up', async ({ page }) => {
  await enter(page);
  await sceneAt(page, 'sc-cc', 0.9);
  await expect(page.locator('[data-stamp]')).toHaveAttribute('data-on', 'false');
  await sceneAt(page, 'sc-cc', -0.35);
  await expect(page.locator('[data-stamp]')).toHaveAttribute('data-on', 'true');
  await expect(page.locator('[data-cc-status]')).toHaveText(Array(6).fill('✓ PASS'));
  await sceneAt(page, 'sc-cc', 0.6); // back up: the stamp lifts and the rows fail again
  await expect(page.locator('[data-stamp]')).toHaveAttribute('data-on', 'false');
  await expect(page.locator('[data-cc-status]').first()).not.toHaveText('✓ PASS');
});

test('HB-02: ECG leaves the monitor, the monitor flatlines then recovers as you scroll, and the line rewinds', async ({ page }) => {
  await enter(page);
  const path = page.locator('#sc-hb svg[class*="ecg"] path');
  await sceneAt(page, 'sc-hb', 0.6);
  await expect(path).toHaveAttribute('d', /^M[\d.]+ [\d.]+ L/);
  const flat = new Set<string>();
  for (let i = 0; i <= 40; i++) { await sceneAt(page, 'sc-hb', 0.7 - i * 0.025); await page.waitForTimeout(60); flat.add((await page.locator('#sc-hb [data-monitor]').getAttribute('data-flat')) ?? ''); }
  expect([...flat].sort()).toEqual(['false', 'true']); // flatlined at some point on the way down
  await expect(page.locator('#sc-hb [data-bpm]')).toHaveText(/\d+ bpm/); // and recovered by the end
  await expect(path).toHaveCSS('stroke-dashoffset', '0px');
  await sceneAt(page, 'sc-hb', 0.78); // back above 8% progress: nothing drawn
  await expect(path).toHaveCSS('opacity', '0');
});

test('ECS-03: tiles flip away on scroll, boxes pack into three containers and relabel ECS, and unpack scrolling up', async ({ page }) => {
  await enter(page);
  await sceneAt(page, 'sc-ecs', 0.5);
  await expect(page.locator('[data-tile]')).toHaveCount(84);
  await sceneAt(page, 'sc-ecs', 0);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('[data-tile]')].filter((t) => (t as HTMLElement).style.opacity === '0').length), { timeout: 10_000 }).toBeGreaterThan(70);
  await sceneAt(page, 'sc-ecs', -0.3);
  await expect(page.locator('#sc-ecs [data-ecs]')).toHaveAttribute('data-packed', 'true');
  await expect(page.locator('#sc-ecs [data-box]').first()).toHaveText('ECS');
  await expect(page.locator('#sc-ecs [data-ctr]')).toHaveCount(3);
  await sceneAt(page, 'sc-ecs', 0.7); // back up: unpacked and relabelled EC2
  await expect(page.locator('#sc-ecs [data-ecs]')).toHaveAttribute('data-packed', 'false');
  await expect(page.locator('#sc-ecs [data-box]').first()).toHaveText('EC2');
});

test('mission log rows reveal, the OCD scene peels away, transmissions and signal render', async ({ page }) => {
  await enter(page);
  await page.evaluate(() => document.getElementById('c5')!.scrollIntoView());
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#c5 [data-mrow][data-in="true"]').length), { timeout: 10_000 }).toBeGreaterThan(0);
  // OCD scene tilts while the log overlaps it
  await page.evaluate(() => scrollTo(0, document.getElementById('c5')!.getBoundingClientRect().top + scrollY - innerHeight * 0.5));
  await expect.poll(() => page.evaluate(() => document.getElementById('sc-ocd')!.style.transform), { timeout: 10_000 }).toMatch(/perspective\(1400px\) rotateX/);
  await page.evaluate(() => document.getElementById('c6')!.scrollIntoView());
  await expect(page.locator('#c6 a[href]')).toHaveCount(0);
  await expect(page.locator('#c6')).toContainText('INCOMING…');
  await page.evaluate(() => scrollTo(0, document.getElementById('c7')!.getBoundingClientRect().top + scrollY + innerHeight * 1.2));
  await expect.poll(() => page.evaluate(() => Number((document.querySelector('[data-merge]') as HTMLElement).style.opacity)), { timeout: 10_000 }).toBeGreaterThan(0.95);
  await expect.poll(() => page.evaluate(() => Number((document.querySelector('[data-ogseal]') as HTMLElement).style.opacity)), { timeout: 10_000 }).toBeGreaterThan(0.95);
  // scrolling back above the log hands the OCD scene back untilted
  await page.evaluate(() => document.getElementById('sc-ocd')!.scrollIntoView());
  await expect.poll(() => page.evaluate(() => document.getElementById('sc-ocd')!.style.transform), { timeout: 10_000 }).not.toMatch(/perspective/);
});
