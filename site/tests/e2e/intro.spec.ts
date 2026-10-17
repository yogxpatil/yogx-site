import { test, expect } from '@playwright/test';
import { waitOpen } from './intro-helpers';

// The automatic intro replaces the click-to-enter gate: it plays by itself and opens the site.
const started = '[data-intro] > div:nth-child(2)[style*="width"]'; // the light/blob has been measured and placed: the animation is running

test('first visit: the site opens by itself, no click, page interactive within 4 s of the intro starting', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('[data-intro][data-kind="first"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator(started)).toHaveCount(1, { timeout: 15_000 });
  const t0 = Date.now();
  await expect(page.locator('main:not([inert])')).toHaveCount(1, { timeout: 4_000 });
  expect(Date.now() - t0).toBeLessThan(4_000);
  await waitOpen(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.locator('[data-robo-guide]')).toBeVisible(); // Robo hands over to the guide
  await expect(page.locator('[data-blob="webgl"] canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a key press mid-intro ends it at once', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(started)).toHaveCount(1, { timeout: 15_000 });
  await page.waitForTimeout(600);
  await page.keyboard.press('Shift');
  await expect(page.locator('[data-intro]')).toHaveCount(0, { timeout: 500 });
  await expect(page.locator('main:not([inert])')).toHaveCount(1, { timeout: 500 });
  await expect(page.locator('body')).not.toHaveClass(/locked/);
});

test('second load plays the short version (~0.8 s)', async ({ page }) => {
  await page.goto('/');
  await waitOpen(page);
  await page.reload();
  await expect(page.locator('[data-intro][data-kind="return"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator(started)).toHaveCount(1, { timeout: 15_000 });
  const t0 = Date.now();
  await expect(page.locator('main:not([inert])')).toHaveCount(1, { timeout: 2_500 });
  expect(Date.now() - t0).toBeLessThan(2_500); // 0.8 s plan, slack for a loaded test machine
  await expect(page.locator('[data-intro] [data-chibi]')).toHaveCount(0); // no Robo run-in on the short version
});

test('reduced motion: no intro at all', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await waitOpen(page, 5_000);
  expect(await page.evaluate(() => document.querySelector('[data-intro] [data-chibi]') === null)).toBe(true);
  await ctx.close();
});
