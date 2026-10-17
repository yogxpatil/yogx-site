import { expect, type Page, type CDPSession } from '@playwright/test';
import { enterSite } from '../e2e/intro-helpers';

/** Frame recorder, installed before any page script: every rAF frame as [start, end, scrollY], plus the moments a Robo line
 *  appeared. A frame's length is the gap between two rAF callbacks: what the visitor sees as one picture held on screen. */
export const RECORDER = `(() => {
  const w = window; w.__pf = []; w.__lines = []; w.__loaf = [];
  // long animation frames (> 50 ms) with what ran in them: the attribution for any frame over budget
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__loaf.push({ t: Math.round(e.startTime), d: Math.round(e.duration), y: Math.round(scrollY),
    render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0), style: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0),
    scripts: e.scripts.map((x) => [x.invoker, (x.sourceFunctionName || '') + '@' + (x.sourceURL || '').split('/').pop() + ':' + x.sourceCharPosition, Math.round(x.duration), Math.round(x.forcedStyleAndLayoutDuration)]) }))).observe({ type: 'long-animation-frame', buffered: true }); } catch (e) {}
  let last = 0;
  const tick = (t) => { if (last) w.__pf.push([last, t, Math.round(scrollY)]); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const watch = () => {
    const b = document.querySelector('[data-robo-bubble]');
    if (!b) return setTimeout(watch, 200);
    new MutationObserver(() => { if (b.getAttribute('data-on') === 'true') w.__lines.push(performance.now()); }).observe(b, { attributes: true, attributeFilter: ['data-on'] });
  };
  addEventListener('DOMContentLoaded', watch);
})();`;

/** Lite tier the way a weak PC reports itself: 4 CPU cores (the head script reads it before first paint). */
export const AS_WEAK_PC = `Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => 4 });`;
/** Full tier on any test machine. */
export const AS_STRONG_PC = `Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => 8 }); Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 8 });`;

export type Tier = 'full' | 'lite';
export async function prepare(page: Page, tier: Tier) {
  await page.addInitScript(tier === 'lite' ? AS_WEAK_PC : AS_STRONG_PC);
  await page.addInitScript(RECORDER);
}

export async function throttle(page: Page, rate: number): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  return cdp;
}

// At 60 Hz a frame is held for whole display refreshes: 16.7, 33.3, 50.0, 66.7 ms (+ timer jitter). "Over 33 ms" means
// held for 3+ refreshes (the page fell below 30 fps for that moment), "over 50 ms" means 4+ refreshes.
const OVER33 = 34, OVER50 = 51;
export type Stats = { frames: number; over33: number; over50: number; pct33: number; p95: number; max: number };
export function stats(lens: number[]): Stats {
  const s = [...lens].sort((a, b) => a - b), n = s.length;
  const over33 = s.filter((x) => x > OVER33).length, over50 = s.filter((x) => x > OVER50).length;
  return { frames: n, over33, over50, pct33: n ? +(100 * over33 / n).toFixed(1) : 0, p95: n ? +s[Math.floor(n * 0.95)].toFixed(1) : 0, max: n ? +s[n - 1].toFixed(1) : 0 };
}

/** Frame lengths recorded between two page times (ms). */
export const framesBetween = (page: Page, a: number, b: number) =>
  page.evaluate(([a, b]) => (window as unknown as { __pf: number[][] }).__pf.filter(([s, e]) => e > a && s < b).map(([s, e]) => e - s), [a, b]);

export const now = (page: Page) => page.evaluate(() => performance.now());

/** Open the site past the intro, at full speed (the throttle goes on afterwards). */
export async function open(page: Page, tier: Tier) {
  await prepare(page, tier);
  const errors = await enterSite(page);
  await expect(page.locator('html')).toHaveAttribute('data-tier', tier);
  return errors;
}

export const CHAPTERS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'] as const;
export const NAMES: Record<string, string> = { c1: 'Hero + portal', c2: 'Manifesto', c3: 'Flight path', c4: 'Missions', c5: 'Mission log', c6: 'Transmissions', c7: 'Signal' };

/** Scroll the whole page top to bottom with the mouse wheel (through the smooth scroller, like a visitor), then split the
 *  recorded frames by the chapter the page was in. A chapter's span runs to the next chapter's top (door included). */
// ~1250 px/s in small wheel steps: a brisk read-through (headless Chrome does not animate wheel scrolling, so big steps
// would be instant 100 px jumps no real browser makes)
export async function scrollAllChapters(page: Page, { step = 50, every = 40 } = {}) {
  const spans = await page.evaluate((ids) => {
    const tops = ids.map((id) => document.getElementById(id)!.getBoundingClientRect().top + scrollY);
    const end = document.documentElement.scrollHeight - innerHeight;
    return ids.map((id, i) => ({ id, from: Math.round(tops[i]), to: Math.round(i + 1 < ids.length ? tops[i + 1] : end + 1) }));
  }, [...CHAPTERS]);
  const end = spans[spans.length - 1].to - 1;
  await page.mouse.move(800, 450);
  const t0 = await now(page);
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(every);
    if (await page.evaluate(() => scrollY) >= end - 2) break;
  }
  await page.waitForTimeout(1500); // the last chapter's own reactions
  const t1 = await now(page);
  const raw = await page.evaluate(([a, b]) => (window as unknown as { __pf: number[][] }).__pf.filter(([s, e]) => e > a && s < b), [t0, t1]);
  const lines = await page.evaluate(([a, b]) => (window as unknown as { __lines: number[] }).__lines.filter((t) => t > a && t < b), [t0, t1]);
  const per = spans.map((sp) => ({ ...sp, name: NAMES[sp.id], ...stats(raw.filter(([, , y]) => y >= sp.from && y < sp.to).map(([s, e]) => e - s)) }));
  // a Robo line appearing: the frames from 100 ms before to 600 ms after it lands on screen
  const lineFrames = lines.flatMap((t) => raw.filter(([s, e]) => e > t - 100 && s < t + 600).map(([s, e]) => e - s));
  const loaf = await page.evaluate(([a, b]) => (window as unknown as { __loaf: { t: number; d: number }[] }).__loaf.filter((e) => e.t > a && e.t < b && e.d > 50), [t0, t1]);
  return { loaf, per, all: stats(raw.map(([s, e]) => e - s)), lines: lines.length, line: stats(lineFrames), worst: raw.map(([s, e, y]) => [Math.round(s - t0), Math.round(e - s), y]).sort((a, b) => b[1] - a[1]).slice(0, 8) };
}

export const table = (rows: (Stats & { name: string })[]) =>
  ['chapter | frames | >33ms | % >33ms | >50ms | p95 | max', ...rows.map((r) => `${r.name} | ${r.frames} | ${r.over33} | ${r.pct33}% | ${r.over50} | ${r.p95} | ${r.max}`)].join('\n');
