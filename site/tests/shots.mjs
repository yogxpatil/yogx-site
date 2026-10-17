// Throwaway: screenshot each chapter in day and night. Delete after use.
import { chromium } from 'playwright';
const SP = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:3100');
await p.getByRole('button', { name: 'Enter site' }).click({ force: true });
await p.waitForSelector('main:not([inert])', { timeout: 20000 }); await p.waitForTimeout(1500);
const ids = await p.evaluate(() => [...document.querySelectorAll('section[id]')].map(s => [s.id, s.offsetTop, s.offsetHeight]));
console.log(JSON.stringify(ids));
for (const mode of ['day', 'night']) {
  if (mode === 'night') await p.evaluate(() => document.documentElement.classList.add('night'));
  for (const [id, top, h] of ids) {
    await p.evaluate(y => window.scrollTo(0, y), top + Math.max(0, Math.min(h * 0.4, h - 900)));
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${SP}/${mode}-${id}.png` });
  }
}
await b.close();
