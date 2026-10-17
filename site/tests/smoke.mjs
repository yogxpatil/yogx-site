// Throwaway: load the preview (intro plays by itself), scroll, report page errors. Delete after use.
import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto('http://localhost:3100/?robo=reset');
try { await p.waitForSelector('main:not([inert])', { timeout: 20000 }); } catch { console.log('NOT OPENED', JSON.stringify(errs.slice(0, 8))); await b.close(); process.exit(1); }
await p.waitForTimeout(800);
for (let y = 0; y < 20000; y += 1500) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(250); }
await p.goto('http://localhost:3100/fast-lane'); await p.waitForTimeout(800);
console.log('ok', JSON.stringify(errs.slice(0, 8)));
await b.close();
