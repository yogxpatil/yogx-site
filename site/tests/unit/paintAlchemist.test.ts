import { describe, it, expect, vi } from 'vitest';
import { paintAlchemist } from '@/lib/blob/paintAlchemist';

function mockCtx() {
  const texts: string[] = [];
  const handler: ProxyHandler<Record<string, unknown>> = {
    get: (t, k) => (k === 'fillText' ? (s: string) => texts.push(s) : k in t ? t[k as string] : vi.fn()),
    set: (t, k, v) => { t[k as string] = v; return true; },
  };
  return { ctx: new Proxy({ canvas: { width: 0, height: 0 } }, handler) as unknown as CanvasRenderingContext2D, texts };
}

describe('paintAlchemist', () => {
  it('draws both Alchemist words and the four panel titles', () => {
    const { ctx, texts } = mockCtx();
    paintAlchemist(ctx, 1600, 900, [0, 1, 2, 3].map((i) => ({ i, x: 1000 + i, y: 100, w: 230, h: 160 })), 1);
    expect(texts).toEqual(expect.arrayContaining(['Digital', 'Alchemist', 'ELIXIR · 01', 'SPELLBOOK · 02', 'ASTROLABE · 03', 'TRANSMUTATION · 04']));
  });
  it('draws the headline letters at the measured slots in the page font instead of the serif words', () => {
    const calls: { s: string; x: number; y: number }[] = [];
    const t: Record<string, unknown> = { canvas: { width: 0, height: 0 } };
    const ctx = new Proxy(t, {
      get: (o, k) => (k === 'fillText' ? (s: string, x: number, y: number) => calls.push({ s, x, y }) : k === 'measureText' ? () => ({ width: 100, fontBoundingBoxAscent: 90, fontBoundingBoxDescent: 20 }) : k in o ? o[k as string] : vi.fn()),
      set: (o, k, v) => { o[k as string] = v; return true; },
    }) as unknown as CanvasRenderingContext2D;
    paintAlchemist(ctx, 1600, 900, [], 1, { family: 'Inter Tight', fs: 100, slots: [{ line: 0, ch: 'D', x: 50, base: 290 }, { line: 1, ch: 'L', x: 150, base: 290 }] });
    expect(t.font).not.toContain('Instrument');
    expect(calls.find((c) => c.s === 'D')).toEqual({ s: 'D', x: 50, y: 290 });
    expect(calls.find((c) => c.s === 'L')).toEqual({ s: 'L', x: 150, y: 290 });
    expect(calls.map((c) => c.s)).not.toContain('Digital');
  });
  it('skips panels when none are on screen (narrow viewports)', () => {
    const { ctx, texts } = mockCtx();
    paintAlchemist(ctx, 390, 844, [], 2);
    expect(texts).toContain('Alchemist');
    expect(texts).not.toContain('ELIXIR · 01');
  });
  it('draws the panel body text for elixir, spellbook and transmutation', () => {
    const { ctx, texts } = mockCtx();
    paintAlchemist(ctx, 1600, 900, [0, 1, 2, 3].map((i) => ({ i, x: 1000 + i, y: 100, w: 230, h: 160 })), 1);
    expect(texts).toEqual(expect.arrayContaining(['100+', 'x86 → arm64', '−75%']));
  });
  it('sizes the backing store to the CSS size times dpr', () => {
    const d1 = mockCtx();
    paintAlchemist(d1.ctx, 1600, 900, [], 1);
    expect(d1.ctx.canvas.width).toBe(1600); expect(d1.ctx.canvas.height).toBe(900);
    const d2 = mockCtx();
    paintAlchemist(d2.ctx, 800, 450, [], 2);
    expect(d2.ctx.canvas.width).toBe(1600); expect(d2.ctx.canvas.height).toBe(900);
  });
  it('caps a 4K canvas at dpr 2 so neither side exceeds 4096 px', () => {
    const { ctx } = mockCtx();
    paintAlchemist(ctx, 3840, 2160, [], 2);
    expect(ctx.canvas.width).toBeLessThanOrEqual(4096); expect(ctx.canvas.height).toBeLessThanOrEqual(4096);
    expect(ctx.canvas.width).toBe(Math.round(3840 * (4096 / 3840)));
    expect(ctx.canvas.height).toBe(Math.round(2160 * (4096 / 3840)));
  });
  it('labels the astrolabe with the six environments and the other-plane mark', () => {
    const { ctx, texts } = mockCtx();
    paintAlchemist(ctx, 1600, 900, [0, 1, 2, 3].map((i) => ({ i, x: 1000, y: 100, w: 230, h: 230 })), 1);
    expect(texts).toEqual(expect.arrayContaining(['DEV', 'QA', 'SB', 'STG', 'PROD', 'PROD2', '01 / THE OTHER PLANE']));
  });
  it('returns the astrolabe centre and radius in hero px (proto: cy = h/2 + 12, r = min/2 - 26)', () => {
    const { ctx } = mockCtx();
    const a = paintAlchemist(ctx, 1600, 900, [{ i: 2, x: 1000, y: 100, w: 230, h: 250 }], 1);
    expect(a).toEqual({ cx: 1115, cy: 237, r: 89 });
    expect(paintAlchemist(mockCtx().ctx, 390, 844, [], 2)).toBeNull();
  });
});
