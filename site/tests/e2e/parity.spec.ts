import { test, expect, type Page } from '@playwright/test';
import { enterSite } from './intro-helpers';
import path from 'node:path';

const dbg = process.env.PARITY_DEBUG ? console.log : () => {};   // set PARITY_DEBUG=1 to print real vs prototype values
const PROTO = 'file://' + path.resolve(__dirname, '../../../.superpowers/brainstorm/78398-1792041843/content/home-v5.html');
type Side = { page: Page; sel: Record<string, string> };
const P = {
  hero: '.herowrap .hero', heroWrap: '#c1', o: '#theO', portal: '#portal', tunnel: '#c2', t1: '.t1', map: '#c3', dot: '#dot', msOn: '#mss .ms.on',
  zone03: '.tz[data-sector="03"]', doorTop: '.door.top', lock: '#lock', ecs: '#sc-ecs', tile: '#tiles i', ocd: '#sc-ocd', signal: '#c5', hl: '#hl', merge: '#merge',
  panels: '.hero .pnl', blobR: '', h1: '.plane .big',
};
const R = {
  hero: '[data-hero-sticky]', heroWrap: '#c1', o: '[data-o]', portal: '[data-portal]', tunnel: '#c2', t1: '[data-tl="1"]', map: '#c3', dot: '[data-dot]', msOn: '[data-ms][data-on="true"]',
  zone03: '[data-door-zone][data-sector="03"]', doorTop: '[data-door="top"]', lock: '[data-lock]', ecs: '#sc-ecs', tile: '[data-tile]', ocd: '#sc-ocd', signal: '#c7', hl: '[data-half="l"]', merge: '[data-merge]',
  panels: '[data-panel]', blobR: '[data-blob]', h1: 'h1',
};

// wait until the page has stopped scrolling and every animation frame agrees (replaces fixed sleeps)
const settle = async (page: Page) => { await page.bringToFront(); await page.evaluate(() => new Promise<void>((res) => {
  let last = -1, still = 0; const t0 = Date.now();
  const tick = () => { if (Math.abs(scrollY - last) < 0.5) still++; else still = 0; last = scrollY; (still >= 8 || Date.now() - t0 > 6000) ? res() : setTimeout(tick, 50); };
  tick();
})); await page.waitForTimeout(150); };
async function open(page: Page, url: string, enterSel: string | null) {
  if (enterSel) {
    await page.goto(url);
    await page.locator(enterSel).click({ force: true });
    await expect(page.locator('body')).not.toHaveClass(/locked/, { timeout: 20_000 });
  } else await enterSite(page, url); // the real site has no click-to-enter: skip its intro
  await settle(page);
}
const toSection = (s: Side, key: string, f: number) => s.page.evaluate(([sel, f]) => {
  const el = document.querySelector<HTMLElement>(sel as string)!; const top = el.getBoundingClientRect().top + scrollY;
  scrollTo(0, top + (f as number) * Math.max(el.offsetHeight - innerHeight, 0));
}, [s.sel[key], f] as const).then(() => settle(s.page));
const toZone = (s: Side, key: string, frac: number) => s.page.evaluate(([sel, frac]) => {
  const el = document.querySelector<HTMLElement>(sel as string)!; const top = el.getBoundingClientRect().top + scrollY;
  scrollTo(0, top - innerHeight + (frac as number) * (el.offsetHeight + innerHeight));   // frac = zone progress p
}, [s.sel[key], frac] as const).then(() => settle(s.page));
const matrix = (s: Side, key: string) => s.page.evaluate((sel) => { const t = getComputedStyle(document.querySelector(sel)!).transform;
  return t === 'none' ? [1, 0, 0, 1, 0, 0] : t.replace(/^matrix(3d)?\(|\)$/g, '').split(',').map(Number); }, s.sel[key]);
const box = (s: Side, key: string, i = 0) => s.page.evaluate(([sel, i]) => { const r = document.querySelectorAll(sel as string)[i as number]!.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }, [s.sel[key], i] as const);
const close = (a: number[], b: number[], tol: number, label = '') => { dbg('PARITY', label, 'real', a.map((v) => +v.toFixed(2)).join(','), 'proto', b.map((v) => +v.toFixed(2)).join(',')); a.forEach((v, i) => expect(Math.abs(v - b[i]), `index ${i}: ${v} vs ${b[i]}`).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b[i])))); };

test.describe.configure({ mode: 'serial' });
// Retired 2026-10-17: the owner approved a redesign that intentionally leaves the home-v5 prototype — name line above the
// headline, panel rack, longer pinned scenes and slower doors that start at 30% — so scroll positions and door transforms no
// longer line up with it. Kept for reference; the new behaviour is covered by the transition, robo and hero specs.
test.skip('@parity real site matches home-v5 at the same scroll positions', async ({ browser }) => {
  test.setTimeout(120_000);
  const pp = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const rp = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const proto: Side = { page: pp, sel: P }, real: Side = { page: rp, sel: R };
  await open(pp, PROTO, '#enter');
  await open(rp, `http://localhost:${process.env.PW_PORT || 3100}/`, null); // the server playwright started (PW_PORT), never a hard-coded preview

  // 1 · hero: headline, O. The four panels intentionally left the prototype's spots (2026-10-17: one rack that never
  // touches the headline), so they are checked for that instead of for position.
  // The hero now leads with the name line above DEVOPS ARCHITECT (owner, 2026-10-17), which moves the headline up:
  // its vertical spot intentionally differs from the prototype, so compare left edge and width only.
  { const [rx, , rw] = await box(real, 'h1'), [px, , pw] = await box(proto, 'h1');
    close([rx, rw], [px, pw], 0.01, 'h1'); }
  { const [ox, , ow, oh] = await box(real, 'o'), [qx, , qw, qh] = await box(proto, 'o');
    close([ox, ow, oh], [qx, qw, qh], 0.02, 'O'); } // same vertical shift as the headline
  const panelHits = await rp.evaluate(() => {
    const letters = [...document.querySelectorAll('h1 [data-letter]')].map((e) => e.getBoundingClientRect());
    return [...document.querySelectorAll('[data-panel]')].map((p) => p.getBoundingClientRect())
      .filter((p) => letters.some((l) => l.left < p.right && l.right > p.left && l.top < p.bottom && l.bottom > p.top)).length;
  });
  expect(panelHits, 'panels overlapping headline letters').toBe(0);
  // blob radius after hovering the same point, once it has stopped changing for ~0.6 s
  const readR = (s: Side, sel: string, attr: string) => s.page.evaluate(([sel, attr]) => Number(document.querySelector(sel)!.getAttribute(attr)), [sel, attr] as const);
  const settledR = async (s: Side, sel: string, attr: string) => {
    await s.page.bringToFront(); await s.page.mouse.move(500, 500);
    let prev = -1, same = 0;
    await expect.poll(async () => { const r = await readR(s, sel, attr); same = Math.abs(r - prev) < 0.05 ? same + 1 : 0; prev = r; return same; }, { timeout: 15_000, intervals: [150] }).toBeGreaterThanOrEqual(8);
    return prev;
  };
  const pr = await settledR(proto, '#gm circle', 'r');
  const rr = await settledR(real, '[data-blob]', 'data-r');
  dbg('blob radius proto', pr, 'real', rr);
  expect(Math.abs(rr - pr) / pr).toBeLessThan(0.03);

  // 2 · portal halfway
  for (const s of [proto, real]) await toSection(s, 'heroWrap', 0.5);
  close((await matrix(real, 'hero')).slice(0, 1), (await matrix(proto, 'hero')).slice(0, 1), 0.02, 'portal scale');
  // 3 · (manifesto tunnel intentionally no longer compared: five new quotes, own timing)
  // 4 · doors at zone 03, p = 0.2 / 0.5 / 0.8
  for (const p of [0.2, 0.5, 0.8]) {
    for (const s of [proto, real]) await toZone(s, 'zone03', p);
    close(await matrix(real, 'doorTop'), await matrix(proto, 'doorTop'), 0.02, 'door p=' + p);
    const lr = await rp.locator(R.lock).textContent(), lp = await pp.locator(P.lock).textContent(); dbg('PARITY lock p=' + p, 'real', lr, 'proto', lp);
    expect(lr).toBe(lp);
  }
  // 5 · flight path halfway
  for (const s of [proto, real]) await toSection(s, 'map', 0.5);
  const dot = async (s: Side) => s.page.evaluate((sel) => { const c = document.querySelector(sel)!; return [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]; }, s.sel.dot);
  close(await dot(real), await dot(proto), 0.005, 'dot');
  const msr = await rp.locator(R.msOn).count(), msp = await pp.locator(P.msOn).count(); dbg('PARITY milestones on real', msr, 'proto', msp);
  expect(msr).toBe(msp);
  // 6 · tiles as ECS enters, peel as OCD leaves
  for (const s of [proto, real]) await s.page.evaluate((sel) => { const el = document.querySelector<HTMLElement>(sel)!; scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.5); }, s.sel.ecs);
  await settle(pp); await settle(rp);
  const gone = (s: Side) => s.page.evaluate((sel) => [...document.querySelectorAll<HTMLElement>(sel)].filter((t) => t.style.opacity === '0').length, s.sel.tile);
  const gr = await gone(real), gp = await gone(proto); dbg('PARITY tiles gone real', gr, 'proto', gp);
  expect(Math.abs(gr - gp)).toBeLessThanOrEqual(2);
  for (const s of [proto, real]) await s.page.evaluate((sel) => { const el = document.querySelector<HTMLElement>(sel)!; scrollTo(0, el.getBoundingClientRect().bottom + scrollY - innerHeight * 0.5); }, s.sel.ocd);
  await settle(pp); await settle(rp);
  close(await matrix(real, 'ocd'), await matrix(proto, 'ocd'), 0.03, 'ocd peel');
  // 7 · signal merge
  for (const s of [proto, real]) await toSection(s, 'signal', 0.5);
  close(await matrix(real, 'hl'), await matrix(proto, 'hl'), 0.03, 'signal left half');
  const op = (s: Side) => s.page.evaluate((sel) => Number(getComputedStyle(document.querySelector(sel)!).opacity), s.sel.merge);
  const opr = await op(real), opp = await op(proto); dbg('PARITY merge opacity real', opr, 'proto', opp);
  expect(Math.abs(opr - opp)).toBeLessThan(0.05);
});
