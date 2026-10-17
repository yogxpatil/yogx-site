// Throwaway: screenshot the brainstorm mockup. Delete after use.
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1300 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url); await p.waitForTimeout(800);
await p.click('[data-m="run"]'); await p.waitForTimeout(400);
await p.click('#play'); await p.waitForTimeout(3000);
await p.screenshot({ path: out, fullPage: true });
console.log('errors', JSON.stringify(errs));
await b.close();
