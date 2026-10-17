import { test } from '@playwright/test';
import { enterSite } from './intro-helpers';

// Dev aid (skipped unless SHOTS is set): SHOTS="sc-cc:0.2,-0.5;c5:0" screenshots each element with its top at frac × vh.
const spec = process.env.SHOTS;
test.skip(!spec, 'screenshots only on demand');
test('shots @shots', async ({ page }) => {
  test.setTimeout(120_000);
  await enterSite(page);
  for (const part of (spec ?? '').split(';')) {
    const [id, fracs] = part.split(':');
    for (const f of fracs.split(',')) {
      await page.evaluate(([i, fr]) => { const e = document.getElementById(i)!; scrollTo(0, e.getBoundingClientRect().top + scrollY - innerHeight * Number(fr)); }, [id, f] as const);
      await page.waitForTimeout(900);
      console.log(id, f, await page.evaluate(() => {
        const g = document.querySelector('[data-robo-guide]'), z = [...document.querySelectorAll('[data-actor-zone]')].map((e) => { const r = e.getBoundingClientRect(); return `${e.id}:${Math.round(r.top)}/${Math.round(r.bottom)}`; });
        const a = document.querySelector('[data-actor-bot]');
        return `guide away=${g?.getAttribute('data-away')} op=${g && getComputedStyle(g).opacity} zones=${z.join(' ')} actor=${a?.getAttribute('data-mood')} spoken=${[...document.querySelectorAll('[data-actor-spoken]')].map((e) => e.textContent).join('|')}`;
      }));
      await page.screenshot({ path: `${process.env.SHOTS_DIR ?? 'test-results'}/${id}_${f}.png` });
    }
  }
});
