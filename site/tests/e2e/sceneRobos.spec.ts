import { test, expect, type Page } from '@playwright/test';
import { enterSite } from './intro-helpers';
import { sceneLengths } from '../../src/content/site';

// Robo phase 2: each scene's Robo is a pure function of scroll. Scroll down through a scene, then back up, and check his
// pose (data-mood) and the line on screen at each stop. The guide must have stepped aside meanwhile.

/** Element `id` with its top at frac × viewport height (negative = scrolled past). */
const topAt = (page: Page, id: string, frac: number) => page.evaluate(([i, f]) => { const e = document.getElementById(i as string)!; scrollTo(0, e.getBoundingClientRect().top + scrollY - innerHeight * (f as number)); }, [id, frac] as const);
/** Pinned chapters (mission log, transmissions): scroll so their pin progress is `p` (see pinTravel, PIN_END 0.9). */
const pinAt = (page: Page, id: string, extraVh: number, p: number) => page.evaluate(([id, e, p]) => {
  const sec = document.getElementById(id as string)!, c = sec.firstElementChild!.firstElementChild as HTMLElement;
  const travel = Math.max(0, c.offsetHeight - innerHeight), dist = (travel + ((e as number) / 100) * innerHeight) * 0.9;
  scrollTo(0, sec.getBoundingClientRect().top + scrollY + (p as number) * dist);
}, [id, extraVh, p] as const);

const mood = (page: Page, a: string) => page.locator(`[data-scene-actor="${a}"] [data-actor-bot]`);
/** Index of the fully shown line (-1: none), read from the line opacities. */
const shownLine = (page: Page, a: string) => page.evaluate((a) => {
  const ls = [...document.querySelectorAll<HTMLElement>(`[data-scene-actor="${a}"] [data-actor-line]`)];
  const b = document.querySelector<HTMLElement>(`[data-scene-actor="${a}"] [data-actor-bubble]`)!;
  if (Number(b.style.opacity) < 0.99) return -1;
  return ls.findIndex((l) => l.style.opacity === '1');
}, a);

/** Pose + line; and the guide has stepped aside while this scene Robo is on screen (or is back when he is not). */
async function expectAt(page: Page, a: string, m: string, line: number, guideAway = true) {
  await expect(mood(page, a)).toHaveAttribute('data-mood', m);
  await expect.poll(() => shownLine(page, a)).toBe(line);
  const guide = page.locator('[data-robo-guide]');
  if (guideAway) await expect(guide).toHaveAttribute('data-away', 'true'); else await expect(guide).not.toHaveAttribute('data-away', 'true');
}

test.describe('scene Robos follow the scroll, down and back up', () => {
  test.beforeEach(async ({ page }) => { await enterSite(page); });

  test('CommandCenter: works inside the app window, climbs out, then talks; rewinds back inside', async ({ page }) => {
    // pinned: progress = −top / (0.9 × extra)
    const f = (p: number) => -p * 0.9 * (sceneLengths.cc / 100);
    const inside = () => page.locator('[data-scene-actor="cc"]').getAttribute('data-inside');
    await topAt(page, 'sc-cc', f(0.005)); await expectAt(page, 'cc', 'angry', -1); expect(await inside()).toBe('true');
    await topAt(page, 'sc-cc', f(0.23)); await expectAt(page, 'cc', 'jump', -1); expect(await inside()).toBe('true');
    await expect(page.locator('[data-stamp]')).toHaveAttribute('data-on', 'true');
    for (const [p, m, l] of [[0.4, 'idle', 0], [0.65, 'angry', 2], [0.95, 'sit', 4]] as const) { await topAt(page, 'sc-cc', f(p)); await expectAt(page, 'cc', m, l); }
    expect(await inside()).toBe('false');
    await expect(page.locator('[data-scene-actor="cc"] [data-actor-spoken]')).toHaveText('Yahan sukoon hai. No tension. Bas guide karta hoon.');
    await topAt(page, 'sc-cc', f(0.4)); await expectAt(page, 'cc', 'idle', 0);
    await topAt(page, 'sc-cc', f(0.005)); await expectAt(page, 'cc', 'angry', -1); expect(await inside()).toBe('true');
    await expect(page.locator('[data-stamp]')).toHaveAttribute('data-on', 'false');
  });

  test('ECS: carries the boxes in towers, label flips, he waves; back up he un-stacks', async ({ page }) => {
    const f = (p: number) => -p * 0.9 * (sceneLengths.ecs / 100);
    const inSlot = () => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#sc-ecs [data-box]')].filter((b) => b.dataset.k === '1').length);
    await topAt(page, 'sc-ecs', f(0.5));
    await expect.poll(() => shownLine(page, 'ecs')).toBe(0);
    const some = await inSlot(); expect(some).toBeGreaterThan(2); expect(some).toBeLessThan(12);
    await topAt(page, 'sc-ecs', f(0.95)); await expectAt(page, 'ecs', 'wave', 1);
    expect(await inSlot()).toBe(12);
    await expect(page.locator('#sc-ecs [data-box]').first()).toHaveText('ECS');
    await topAt(page, 'sc-ecs', f(0.5));
    await expect.poll(inSlot).toBe(some);
    await expect.poll(() => shownLine(page, 'ecs')).toBe(0);
  });

  test('OCD: lands on each station with the ticket, a line per station; hops back', async ({ page }) => {
    const f = (p: number) => -p * 0.9 * (sceneLengths.ocd / 100);
    for (const [p, m, l] of [[0.27, 'point', 0], [0.67, 'point', 2], [0.95, 'jump', 3], [0.27, 'point', 0]] as const) { await topAt(page, 'sc-ocd', f(p)); await expectAt(page, 'ocd', m, l); }
  });

  test('Mission log: walks down the entries, the active one gets his line; walks back up', async ({ page }) => {
    await pinAt(page, 'c5', sceneLengths.log, 0); await expectAt(page, 'log', 'point', 0);
    await pinAt(page, 'c5', sceneLengths.log, 0.5);
    // mid-way: some middle entry's line is up (it may be mid cross-fade, so take the strongest one)
    const strongest = () => page.evaluate(() => { const o = [...document.querySelectorAll<HTMLElement>('[data-scene-actor="log"] [data-actor-line]')].map((l) => Number(l.style.opacity)); return o.indexOf(Math.max(...o)); });
    await expect.poll(strongest).toBeGreaterThan(0);
    const mid = await strongest(); expect(mid).toBeLessThan(6);
    await pinAt(page, 'c5', sceneLengths.log, 1); await expectAt(page, 'log', 'wave', 6);
    await pinAt(page, 'c5', sceneLengths.log, 0.5); await expect.poll(strongest).toBe(mid);
    await pinAt(page, 'c5', sceneLengths.log, 0); await expectAt(page, 'log', 'point', 0);
  });

  test('Transmissions: sits on the post being read, hops line to line and back', async ({ page }) => {
    // pos = 3p − 0.5
    for (const [p, l] of [[0.267, 0], [0.6, 1], [0.933, 2], [0.267, 0]] as const) { await pinAt(page, 'c6', sceneLengths.tx, p); await expectAt(page, 'tx', 'sit', l); }
  });

  test('Signal: walks to the OG seal, waves with the last line, sits and stays; rewinds', async ({ page }) => {
    // progress = −top / 1.6vh
    await topAt(page, 'c7', -0.48); await expectAt(page, 'signal', 'idle', -1, false); // still off the left edge: the guide is here
    await topAt(page, 'c7', -0.93); await expect(mood(page, 'signal')).toHaveAttribute('data-mood', 'walk');
    await topAt(page, 'c7', -1.36); await expectAt(page, 'signal', 'wave', 0);
    await topAt(page, 'c7', -1.6); await expectAt(page, 'signal', 'sit', 0);
    await topAt(page, 'c7', -0.48); await expectAt(page, 'signal', 'idle', -1, false);
  });

  test('node to node: a hop always finishes on a node, even if the scroll stops right after it starts', async ({ page }) => {
    const f = (p: number) => -p * 0.9 * (sceneLengths.cc / 100);
    const bot = page.locator('[data-scene-actor="cc"] [data-actor-bot]');
    await topAt(page, 'sc-cc', f(0.005)); await expect(bot).toHaveAttribute('data-mood', 'angry');
    const rest = await bot.evaluate((b) => (b as HTMLElement).style.transform);
    await topAt(page, 'sc-cc', f(0.1)); // jumps several rows at once: straight to the latest node
    await expect(bot).toHaveAttribute('data-mood', 'air'); // a hop is playing...
    await page.waitForTimeout(800); // ...and the scroll has stopped: it still lands
    expect(await bot.evaluate((b) => b.getAnimations().length)).toBe(0);
    await expect(bot).not.toHaveAttribute('data-mood', 'air');
    expect(await bot.evaluate((b) => (b as HTMLElement).style.transform)).not.toBe(rest);
    await topAt(page, 'sc-cc', f(0.005)); await page.waitForTimeout(800); // and back: the reverse hop lands where he started
    expect(await bot.evaluate((b) => (b as HTMLElement).style.transform)).toBe(rest);
  });

  test('a Robo note in every section: manifesto, flight path, HeartBeat', async ({ page }) => {
    for (const [id, name, frac] of [['c2', 'manifesto', -1.0], ['c3', 'flight', -1.2], ['sc-hb', 'hb', -0.2]] as const) {
      await topAt(page, id, frac);
      await expect.poll(() => shownLine(page, name), { message: `${name} note` }).toBe(0);
      await expect(page.locator('[data-robo-guide]')).toHaveAttribute('data-away', 'true');
    }
  });

  test('the guide is back between scenes with no Robo of their own', async ({ page }) => {
    await page.evaluate(() => scrollTo(0, 0));
    await expect(page.locator('[data-robo-guide]')).not.toHaveAttribute('data-away', 'true');
  });
});

test('reduced motion: scene Robos stand in their final pose with every line readable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterSite(page);
  await expect(page.locator('[data-scene-actor="cc"] [data-actor-lines] li')).toHaveCount(5);
  await expect(mood(page, 'cc')).toHaveAttribute('data-mood', 'sit');
  await expect(page.locator('[data-scene-actor="ecs"] [data-actor-lines] li')).toHaveCount(2);
  await expect(page.locator('[data-log-say]')).toHaveCount(7);
  await expect(mood(page, 'signal')).toHaveAttribute('data-mood', 'sit');
});
