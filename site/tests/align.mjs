// Throwaway: hover the blob over shared headline letters at several sizes and crop. Delete after use.
import { chromium } from 'playwright';
const SP = process.argv[2];
const b = await chromium.launch();
for (const [w, h] of [[1920, 1080], [1366, 768], [1440, 900]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto('http://localhost:3100/?robo=reset');
  await p.getByRole('button', { name: 'Enter site' }).click({ force: true });
  await p.waitForSelector('main:not([inert])', { timeout: 20000 }); await p.waitForTimeout(2500);
  const anchors = await p.evaluate(() => [...document.querySelectorAll('h1 [data-anchor]')].map((n) => { const r = n.getBoundingClientRect(); return [n.textContent, r.x + r.width / 2, r.y + r.height / 2, r.height]; }));
  console.log(w, JSON.stringify(anchors.map((a) => a[0])));
  for (const [ch, x, y, hh] of anchors.slice(0, 3)) {
    await p.mouse.move(x, y, { steps: 8 }); await p.waitForTimeout(1600);
    await p.screenshot({ path: `${SP}/al-${w}-${ch}.png`, clip: { x: Math.max(0, x - hh), y: Math.max(0, y - hh * 0.8), width: hh * 2, height: hh * 1.6 } });
  }
  await p.close();
}
await b.close();
