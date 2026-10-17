import { test, expect, type Page } from '@playwright/test';
import { enterSite } from './intro-helpers';

const ENTER_TIMEOUT = 20_000;
const C1 = 'Namaste! Main Robo. Iss bande ka tour guide. Jaldi hai? Fast lane le lo →';

const enter = (page: Page, url = '/?robo=reset') => enterSite(page, url);
const bubble = (page: Page) => page.locator('[data-robo-bubble][data-on="true"]');

test('Robo greets on the hero with a fast-lane link, and the link opens /fast-lane', async ({ page }) => {
  await enter(page);
  await expect(bubble(page)).toBeVisible({ timeout: 10_000 });
  await expect(bubble(page).locator('[data-robo-text]')).toHaveText(C1);
  await bubble(page).getByRole('link', { name: /Fast lane/ }).click();
  await expect(page).toHaveURL(/\/fast-lane\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Yogesh Patil');
});

test('back from fast lane returns to the same place without the intro', async ({ page }) => {
  await enter(page);
  await page.evaluate(() => window.scrollTo(0, document.getElementById('sc-ecs')!.getBoundingClientRect().top + window.scrollY));
  await expect.poll(() => page.evaluate(() => Math.round(document.getElementById('sc-ecs')!.getBoundingClientRect().top)), { timeout: 10_000 }).toBeLessThan(5);
  await page.waitForTimeout(400); // let the scroll settle before it is saved
  await page.keyboard.press('r');
  await expect(page).toHaveURL(/\/fast-lane\/$/);
  const saved = Number(await page.evaluate(() => sessionStorage.getItem('yogx:return')));
  expect(saved).toBeGreaterThan(1000);
  await page.getByRole('link', { name: /Back to the fun version/ }).first().click();
  await expect(page).toHaveURL(/\/$/);
  // entered at once: no intro, page content live
  await expect(page.locator('[data-intro]')).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator('main:not([inert])')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBeGreaterThan(saved - 4);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - saved)).toBeLessThanOrEqual(4);
});

test('a jump from chapter 1 to chapter 3 never leaves the old CH-01 card on screen', async ({ page }) => {
  await enter(page);
  await expect(bubble(page)).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('3');
  await expect.poll(() => page.evaluate(() => Math.round(document.getElementById('c3')!.getBoundingClientRect().top)), { timeout: 15_000 }).toBeLessThan(5);
  // through the landing and the walk over: at no point may the chapter-1 card come back
  for (let i = 0; i < 12; i++) {
    await expect(page.locator('[data-robo-bubble][data-on="true"] [data-robo-channel]', { hasText: 'CH-01' })).toHaveCount(0);
    await page.waitForTimeout(500);
  }
});

test('Robo never stands on the ALT ruler', async ({ page }) => {
  await enter(page);
  for (const id of ['c1', 'c2', 'c3']) {
    await page.evaluate((x) => window.scrollTo(0, document.getElementById(x)!.getBoundingClientRect().top + window.scrollY), id);
    await page.waitForTimeout(3500); // settle, re-perch, walk
    const hit = await page.evaluate(() => {
      const a = document.querySelector('[data-robo]')!.getBoundingClientRect(), b = document.querySelector('[data-robo-avoid]')!.getBoundingClientRect();
      return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    });
    expect(hit, `on the ruler at ${id}`).toBe(false);
  }
});

test('fast lane share image is a real PNG served as image/png', async ({ page, request }) => {
  await page.goto('/fast-lane/');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toMatch(/\/og\/fast-lane\.png$/);
  const res = await request.get('/og/fast-lane.png');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
});

async function noHeadingOverlap(page: Page) {
  await enter(page);
  await expect(bubble(page)).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(600);
  const hit = await page.evaluate(() => {
    const b = document.querySelector('[data-robo-bubble] [data-robo-card]')!.getBoundingClientRect();
    const out: string[] = [];
    for (const h of document.querySelectorAll('h1,h2,h3')) {
      const cs = getComputedStyle(h), r = h.getBoundingClientRect();
      if (cs.visibility === 'hidden' || cs.display === 'none' || r.width === 0 || r.height === 0) continue;
      if (r.bottom <= 0 || r.top >= innerHeight) continue;
      if (r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top) out.push(h.textContent ?? '');
    }
    return out;
  });
  expect(hit).toEqual([]);
}

test('bubble never covers headings at 1280x720', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await noHeadingOverlap(page);
});

test('bubble never covers headings on the phone @phone', async ({ page }) => {
  await noHeadingOverlap(page);
});

test('hide: Robo walks off into an edge tab, stays hidden after reload, and the tab brings him back', async ({ page }) => {
  await enter(page);
  await expect(bubble(page)).toBeVisible({ timeout: 10_000 });
  await page.locator('[data-robo-hide]').click();
  await expect(bubble(page).locator('[data-robo-text]')).toHaveText('Theek hai… main chala jaata hoon.', { timeout: 5_000 });
  await expect(page.locator('[data-robo-tab]')).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('[data-robo-guide]')).toHaveAttribute('data-phase', 'gone');
  await enter(page, '/'); // reload keeping storage (no reset)
  await expect(page.locator('[data-robo-tab]')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.press('2');
  await expect.poll(() => page.evaluate(() => Math.round(document.getElementById('c2')!.getBoundingClientRect().top)), { timeout: 15_000 }).toBeLessThan(5);
  await page.waitForTimeout(2500);
  await expect(page.locator('[data-robo-bubble][data-on="true"]')).toHaveCount(0);
  await expect(page.locator('[data-robo-guide]')).toHaveAttribute('data-hushed', 'true');
  await page.locator('[data-robo-tab]').click();
  await expect(page.locator('[data-robo-tab]')).toHaveCount(0);
  await expect(bubble(page).locator('[data-robo-text]')).toHaveText('Wapas aa gaya!', { timeout: 5_000 });
});

test('typing yogx finds an egg', async ({ page }) => {
  await enter(page);
  await page.keyboard.type('yogx');
  await expect(page.locator('[data-robo-eggs]')).toHaveText('1 / 5 found', { timeout: 5_000 });
  await enter(page); // ?robo=reset clears it
  await expect(page.locator('[data-robo-eggs]')).toHaveCount(0);
});

test('storage blocked: greeting still appears, no page errors', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
  });
  const page = await ctx.newPage();
  const errors = await enter(page);
  await expect(bubble(page)).toBeVisible({ timeout: 10_000 });
  await expect(bubble(page).locator('[data-robo-text]')).toHaveText(C1);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('fast lane has no phone number', async ({ page }) => {
  await page.goto('/fast-lane/');
  expect(await page.locator('body').innerText()).not.toMatch(/(?:\+91[\s-]?)?[6-9]\d{9}/); // no phone number of any kind
});

test('fast lane has no phone number on the phone @phone', async ({ page }) => {
  await page.goto('/fast-lane/');
  expect(await page.locator('body').innerText()).not.toMatch(/(?:\+91[\s-]?)?[6-9]\d{9}/); // no phone number of any kind
});

test('hovering the PROD2 radar label finds the egg', async ({ page }) => {
  await enter(page);
  const label = page.locator('[data-prod2] span');
  await label.hover({ timeout: 8_000 });
  await expect(page.locator('[data-robo-eggs]')).toHaveText('1 / 5 found', { timeout: 5_000 });
});

async function fastLaneClearOfDial(page: Page) {
  const link = page.getByRole('link', { name: /Fast lane/ }).first();
  await expect(link).toBeVisible();
  const a = (await link.boundingBox())!, d = (await page.locator('[data-dial]').boundingBox())!;
  const overlap = a.x < d.x + d.width && a.x + a.width > d.x && a.y < d.y + d.height && a.y + a.height > d.y;
  expect(overlap, `link ${JSON.stringify(a)} vs dial ${JSON.stringify(d)}`).toBe(false);
}

test('HUD fast lane link never overlaps the Dial at 1600x900 and 1280x720', async ({ page }) => {
  await enter(page);
  await fastLaneClearOfDial(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await fastLaneClearOfDial(page);
});

test('HUD fast lane link never overlaps the Dial on the phone @phone', async ({ page }) => {
  await enter(page);
  await fastLaneClearOfDial(page);
});

test('the PROD2 blip is what sits under the pointer, not the blob canvas', async ({ page }) => {
  await enter(page);
  const hit = await page.evaluate(() => {
    const r = document.querySelector('[data-prod2]')!.getBoundingClientRect();
    return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[data-prod2]');
  });
  expect(hit).toBe(true);
});

async function hudLinksClear(page: Page) {
  const fast = (await page.getByRole('link', { name: /Fast lane/ }).first().boundingBox())!;
  const dep = (await page.getByRole('button', { name: /Your deploy/ }).boundingBox())!;
  const dial = (await page.locator('[data-dial]').boundingBox())!;
  const vp = page.viewportSize()!;
  const hit = (a: typeof fast, b: typeof fast) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  for (const [n, r] of [['fast', fast], ['deploy', dep]] as const) {
    expect(r.x >= 0 && r.x + r.width <= vp.width, `${n} in viewport ${JSON.stringify(r)}`).toBe(true);
    expect(hit(r, dial), `${n} vs dial`).toBe(false);
  }
  expect(hit(fast, dep), 'fast vs deploy').toBe(false);
}
for (const [w, h] of [[1600, 900], [1280, 720], [1024, 768], [800, 900]]) {
  test(`HUD links stay in view and clear of the Dial and each other at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await enter(page);
    await hudLinksClear(page);
  });
}
test('HUD links stay in view and clear of the Dial and each other on the phone @phone', async ({ page }) => {
  await enter(page);
  await hudLinksClear(page);
});

test('"Your deploy" opens the visit panel: four stages settle, a real first-byte ms shows, Esc returns focus', async ({ page }) => {
  await enter(page);
  const btn = page.getByRole('button', { name: /Your deploy/ });
  const a = (await btn.boundingBox())!, d = (await page.locator('[data-dial]').boundingBox())!;
  expect(a.x < d.x + d.width && a.x + a.width > d.x && a.y < d.y + d.height && a.y + a.height > d.y, 'deploy button overlaps dial').toBe(false);
  await btn.focus();
  await page.keyboard.press('Enter');
  const dlg = page.getByRole('dialog', { name: /Your visit/ });
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('[data-stage][data-state="pending"]')).toHaveCount(0, { timeout: 8_000 });
  await expect(dlg.locator('[data-stage="ship"]')).toContainText(/first byte \d+(\.\d+)? (ms|s)/);
  await expect(dlg).toContainText('Measured in your browser. Never sent anywhere.');
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await expect(btn).toBeFocused();
});
