import { describe, it, expect } from 'vitest';
import { createBlob, stepBlob, splashBlob, ballsOf } from '@/lib/blob/physics';

const size = { w: 1000, h: 800 };
const run = (b: ReturnType<typeof createBlob>, frames: number, target: { x: number; y: number; active: boolean }) => {
  for (let f = 0; f < frames; f++) stepBlob(b, f * 16, target, size);
};

describe('blob physics', () => {
  it('main drop settles on an active target at 20% of the short side', () => {
    const b = createBlob(); run(b, 300, { x: 600, y: 300, active: true });
    expect(Math.abs(b.mx - 600)).toBeLessThan(1); expect(Math.abs(b.my - 300)).toBeLessThan(1);
    expect(b.R).toBeCloseTo(160, 0);
  });
  it('drifts at idle size (15%) when nobody is pointing', () => {
    const b = createBlob(); run(b, 400, { x: 0, y: 0, active: false });
    expect(b.R).toBeCloseTo(120, 0);
    expect(b.mx).toBeGreaterThan(size.w * 0.1); expect(b.mx).toBeLessThan(size.w * 0.7);
  });
  it('splash throws satellites away, then they come back', () => {
    const b = createBlob(); run(b, 300, { x: 500, y: 400, active: true });
    splashBlob(b, () => 0.25);
    const far = Math.max(...b.sats.map((s) => Math.hypot(s.x - b.mx, s.y - b.my)));
    expect(far).toBeGreaterThan(b.R * 1.5);
    run(b, 600, { x: 500, y: 400, active: true });
    const back = Math.max(...b.sats.map((s) => Math.hypot(s.x - b.mx, s.y - b.my)));
    expect(back).toBeLessThan(b.R * 1.2);
  });
  it('exposes n balls, main first', () => {
    const b = createBlob(7); run(b, 10, { x: 500, y: 400, active: true });
    const balls = ballsOf(b);
    expect(balls).toHaveLength(7);
    expect(balls[0]).toEqual([b.mx, b.my, b.R]);
  });
  it('moves the same distance in the same time at 60 Hz and 144 Hz', () => {
    const runAt = (frames: number, elapsed: number) => {
      const b = createBlob();
      stepBlob(b, 0, { x: 100, y: 100, active: true }, size); // seed on the starting point
      for (let f = 1; f <= frames; f++) stepBlob(b, (f * elapsed) / frames, { x: 800, y: 400, active: true }, size);
      return b;
    };
    const slow = runAt(60, 1000), fast = runAt(144, 1000);
    expect(Math.abs(slow.mx - fast.mx)).toBeLessThan(2);
    // Mid-motion check at 150 ms: a frame-locked step would show a large gap here.
    const early60 = runAt(9, 150), early144 = runAt(22, 150);
    expect(Math.abs(early60.mx - early144.mx)).toBeLessThan(2);
    expect(early60.mx).toBeGreaterThan(100); expect(early60.mx).toBeLessThan(700);
  });
  it('treats a NaN target or NaN time as idle and keeps the blob finite', () => {
    const b = createBlob(); run(b, 60, { x: 500, y: 400, active: true });
    stepBlob(b, NaN, { x: NaN, y: NaN, active: true }, size);
    stepBlob(b, 100, { x: Infinity, y: 400, active: true }, size);
    expect(Number.isFinite(b.mx)).toBe(true); expect(Number.isFinite(b.my)).toBe(true); expect(Number.isFinite(b.R)).toBe(true);
    for (const s of b.sats) { expect(Number.isFinite(s.x)).toBe(true); expect(Number.isFinite(s.y)).toBe(true); }
  });
  it('repeated t=0 calls still converge to idle size', () => {
    const b = createBlob();
    for (let i = 0; i < 120; i++) stepBlob(b, 0, { x: 0, y: 0, active: false }, size);
    expect(b.R).toBeCloseTo(120, 0);
  });
  it('a finger drag uses the larger touch radius (24% of the short side)', () => {
    const b = createBlob(); run(b, 300, { x: 500, y: 400, active: true, touch: true } as never);
    expect(b.R).toBeCloseTo(192, 0);
  });
});

describe('settleBlob (reduced-motion fallback)', () => {
  it('brings a fresh blob to at least 90% of the idle radius', async () => {
    const { settleBlob } = await import('@/lib/blob/physics');
    const b = createBlob(); settleBlob(b, size);
    expect(b.R).toBeGreaterThanOrEqual(0.9 * 0.15 * 800);
  });
});
