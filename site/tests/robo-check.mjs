// Throwaway: confirm the live preview has the roaming Robo. Delete after use.
import { chromium } from 'playwright';
const SP = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:3100/?robo=reset');
await p.waitForSelector('main:not([inert])', { timeout: 25000 }); await p.waitForTimeout(3000);
const info = async () => p.evaluate(() => { const r = document.querySelector('[data-robo-guide]'); const c = document.querySelector('[data-chibi]'); const hide = document.querySelector('[data-robo-hide]'); const card = document.querySelector('[data-robo-bubble]'); return { guide: !!r, chibi: !!c, hide: !!hide, box: r && JSON.stringify(r.getBoundingClientRect()), card: card?.textContent?.slice(0, 60) ?? null, tab: !!document.querySelector('[data-robo-tab]') }; });
console.log('hero', JSON.stringify(await info()));
await p.screenshot({ path: `${SP}/live-hero.png` });
await p.evaluate(() => document.getElementById('c3').scrollIntoView()); await p.waitForTimeout(3500);
console.log('c3', JSON.stringify(await info()));
await p.screenshot({ path: `${SP}/live-c3.png` });
await b.close();
