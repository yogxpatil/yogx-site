import { expect, type Page } from '@playwright/test';

export const ENTER_TIMEOUT = 20_000; // generous: the suite runs next to other workers under software WebGL

/** The site has opened: body scrolls, page content is interactive, the intro overlay has removed itself. */
export async function waitOpen(page: Page, timeout = ENTER_TIMEOUT) {
  await expect(page.locator('body')).not.toHaveClass(/locked/, { timeout });
  await expect(page.locator('main:not([inert])')).toHaveCount(1, { timeout });
  await expect(page.locator('[data-intro]')).toHaveCount(0, { timeout });
}

/**
 * Open the home page past the automatic intro. Default: skip it with a key press (Shift: does nothing else on the
 * page). A key pressed before React has hydrated is dropped, so press until it takes. `watch: true` lets it play out.
 * Returns the page errors seen.
 */
export async function enterSite(page: Page, url = '/', { watch = false } = {}) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  if (!watch) {
    await expect(async () => {
      await page.keyboard.press('Shift');
      await expect(page.locator('main:not([inert])')).toHaveCount(1, { timeout: 1_000 });
    }).toPass({ timeout: ENTER_TIMEOUT });
  }
  await waitOpen(page);
  return errors;
}
