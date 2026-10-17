// Throwaway: capture the combined intro mockup over time. Delete after use.
import { chromium } from 'playwright';
const [url, SP] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url); await p.waitForTimeout(300);
await p.click('[data-play="4"]');
let last = 0;
for (const t of [700, 1350, 1800, 2300, 2700, 3900]) { await p.waitForTimeout(t - last); last = t; await p.locator('#s4').screenshot({ path: `${SP}/combo-${t}.png` }); }
console.log('errors', JSON.stringify(errs));
await b.close();
