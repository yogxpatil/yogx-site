import { test, expect, type Page } from '@playwright/test';
import { enterSite } from './intro-helpers';

// Browser zoom changes the CSS viewport AND devicePixelRatio mid-session. The painted Alchemist headline inside the
// blob must stay on the page headline's pixels: hover a shared letter, then compare the frame with and without the blob.

async function enter(page: Page) {
  await enterSite(page);
  await expect(page.locator('[data-blob="webgl"] canvas')).toBeVisible();
}

/** Best-fit shift (device px) of the letter pixels in `on` against `off`; line 0 is ink, line 1 rust. */
async function bestFit(page: Page, off: Buffer, on: Buffer, line: number, range: number) {
  return page.evaluate(async ({ off, on, line, range }) => {
    const decode = async (b64: string) => {
      const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d')!; x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data, m = new Uint8Array(c.width * c.height);
      for (let i = 0; i < m.length; i++) {
        const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
        m[i] = line === 0 ? +(r < 70 && g < 70 && b < 50) : +(r > 90 && r < 180 && g < 70 && b < 40);
      }
      return { m, w: c.width, h: c.height };
    };
    const a = await decode(off), b = await decode(on);
    let best = { dx: 0, dy: 0, err: Infinity, ink: 0 };
    for (let dy = -range; dy <= range; dy++) for (let dx = -range; dx <= range; dx++) {
      let err = 0, ink = 0;
      for (let y = range; y < a.h - range; y++) for (let x = range; x < a.w - range; x++) {
        const p = a.m[y * a.w + x]; if (p !== b.m[(y + dy) * b.w + x + dx]) err++; ink += p;
      }
      if (err < best.err) best = { dx, dy, err, ink };
    }
    return best;
  }, { off: off.toString('base64'), on: on.toString('base64'), line, range });
}

test('painted headline stays on the page headline after browser zoom (width + dpr change mid-session)', async ({ page }) => {
  test.setTimeout(120_000);
  await enter(page);
  const cdp = await page.context().newCDPSession(page);
  // Screenshots go through CDP too: page.screenshot() re-applies Playwright's own viewport and would undo the override.
  const shot = async (clip: { x: number; y: number; width: number; height: number }) =>
    Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } })).data, 'base64');
  for (const [width, height, dpr] of [[1440, 900, 1], [1152, 720, 1.25], [1309, 818, 1.1], [1600, 1000, 0.9]] as const) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false });
    // the canvas buffer has followed the new size and pixel ratio (the repaint is debounced after resize)
    await expect.poll(() => page.evaluate((d) => {
      const c = document.querySelector<HTMLCanvasElement>('[data-blob="webgl"] canvas')!;
      return c.width === Math.floor(c.parentElement!.clientWidth * Math.min(Math.max(d, 1), 2));
    }, dpr), { timeout: 10_000 }).toBe(true);
    await page.waitForTimeout(300); // the debounced repaint of the painted plane itself
    const anchors = await page.evaluate(() => {
      const first = (line: number) => document.querySelector<HTMLElement>(`h1 [data-anchor][data-line="${line}"]`)!.getBoundingClientRect();
      return [0, 1].map((line) => { const r = first(line); return { line, x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    });
    for (const a of anchors) {
      await page.mouse.move(a.x, a.y, { steps: 6 });
      // the blob has eased onto the pointer: its radius is up and has stopped changing
      let R = 0;
      await expect.poll(async () => {
        const a1 = Number(await page.locator('[data-blob]').getAttribute('data-r'));
        await page.waitForTimeout(150);
        const a2 = Number(await page.locator('[data-blob]').getAttribute('data-r'));
        R = a2;
        return a1 > 0 && a1 === a2;
      }, { timeout: 10_000 }).toBe(true);
      expect(R).toBeGreaterThan(0);
      const side = R * 1.1, clip = { x: a.x - side / 2, y: a.y - side / 2, width: side, height: side }; // inside the blob circle
      const on = await shot(clip);
      await page.locator('[data-blob-layer]').evaluate((n: HTMLElement) => { n.style.visibility = 'hidden'; });
      const off = await shot(clip);
      await page.locator('[data-blob-layer]').evaluate((n: HTMLElement) => { n.style.visibility = ''; });
      const f = await bestFit(page, off, on, a.line, Math.ceil(10 * dpr));
      const at = `${width}@${dpr} line ${a.line}: best shift ${f.dx},${f.dy} device px, ${f.err} of ${f.ink} letter px differ`;
      expect(f.ink, at).toBeGreaterThan(500);
      // aligned = no shift and the shapes coincide (a scaled copy can best-fit at 0,0 yet differ everywhere)
      expect([Math.abs(f.dx) <= 1, Math.abs(f.dy) <= 1, f.err < f.ink * 0.1], at).toEqual([true, true, true]);
    }
  }
});
