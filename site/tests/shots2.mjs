// Throwaway: screenshot the moment each blast-door zone has fully opened. Delete after use.
import { chromium } from 'playwright';
const SP = process.argv[2], W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
await p.goto('http://localhost:3100');
await p.getByRole('button', { name: 'Enter site' }).click({ force: true });
await p.waitForSelector('main:not([inert])', { timeout: 20000 }); await p.waitForTimeout(1500);
const zones = await p.evaluate(() => [...document.querySelectorAll('[data-door-zone]')].map(z => [z.dataset.sector, z.getBoundingClientRect().top + scrollY + z.offsetHeight]));
console.log(JSON.stringify(zones));
for (const [n, y] of zones) {
  await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(900);
  await p.screenshot({ path: `${SP}/open-${W}-${n}.png` });
}
await b.close();
