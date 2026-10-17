import { describe, it, expect } from 'vitest';
import { stepBodies, restartSchedule, knockSet, type Body } from '@/lib/hero/letterPhysics';

const body = (p: Partial<Body>): Body => ({ x: 0, y: 0, vx: 0, vy: 0, w: 40, h: 50, rot: 0, vr: 0, rest: false, ...p });
const box = { w: 800, h: 600 };
const run = (bs: Body[], secs: number, dt = 1 / 60, until?: () => boolean) => {
  let t = 0;
  for (; t < secs; t += dt) { stepBodies(bs, dt, box); if (until?.()) break; }
  return t;
};

describe('letter physics', () => {
  it('a body dropped from 200 px comes to rest on the floor within 3 s', () => {
    const b = body({ x: 100, y: box.h - 50 - 200 });
    const t = run([b], 3, 1 / 60, () => b.rest);
    expect(b.rest).toBe(true);
    expect(t).toBeLessThan(3);
    expect(Math.abs(b.y + b.h - box.h)).toBeLessThanOrEqual(1);
  });

  it('two stacked bodies do not interpenetrate', () => {
    const lo = body({ x: 100, y: box.h - 50 }), hi = body({ x: 110, y: box.h - 300, vy: 300 });
    run([lo, hi], 3);
    expect(lo.rest && hi.rest).toBe(true);
    expect(hi.y + hi.h).toBeLessThanOrEqual(lo.y + 1);
    expect(Math.abs(hi.y + hi.h - lo.y)).toBeLessThanOrEqual(1); // it sits on top, not hovering
  });

  it('a pile of letters thrown in from all sides never overlaps and stays inside the box', () => {
    const bs = Array.from({ length: 15 }, (_, i) => body({ x: 30 + i * 47, y: 100 + (i % 3) * 30, vx: (i % 2 ? 1 : -1) * 600, vy: -400, vr: 3 }));
    run(bs, 6);
    expect(bs.every((b) => b.rest)).toBe(true);
    for (const b of bs) { expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x).toBeLessThanOrEqual(box.w - b.w); expect(b.y + b.h).toBeLessThanOrEqual(box.h + 1); }
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      expect(ox <= 1 || oy <= 1).toBe(true);
    }
  });

  it('walls keep x within [0, box.w - w]', () => {
    const l = body({ x: 20, y: 100, vx: -3000 }), r = body({ x: 700, y: 100, vx: 3000 });
    for (let t = 0; t < 2; t += 1 / 60) {
      stepBodies([l, r], 1 / 60, box);
      for (const b of [l, r]) { expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x).toBeLessThanOrEqual(box.w - b.w); }
    }
  });

  it('a long frame (low-end PC, 100 ms) does not tunnel through the floor', () => {
    const b = body({ x: 100, y: 0, vy: 2000 });
    for (let i = 0; i < 40; i++) { stepBodies([b], 0.1, box); expect(b.y + b.h).toBeLessThanOrEqual(box.h + 1); }
    expect(b.rest).toBe(true);
  });

  it('a resting body whose support is taken away falls again', () => {
    const lo = body({ x: 100, y: box.h - 50 }), hi = body({ x: 100, y: box.h - 100 });
    run([lo, hi], 2);
    expect(hi.rest).toBe(true);
    run([hi], 2, 1 / 60, () => hi.y + hi.h >= box.h - 1 && hi.rest);
    expect(Math.abs(hi.y + hi.h - box.h)).toBeLessThanOrEqual(1);
  });

  it('restartSchedule staggers the fly-back', () => {
    expect(restartSchedule(5)).toEqual([0, 90, 180, 270, 360]);
    expect(restartSchedule(3, 50)).toEqual([0, 50, 100]);
    expect(restartSchedule(0)).toEqual([]);
  });
});

describe('knockSet (which letters B knocks down)', () => {
  it('no cap: every letter, in order', () => {
    expect(knockSet(5, Infinity)).toEqual([0, 1, 2, 3, 4]);
  });
  it('lite cap of 12: twelve letters spread over the whole headline, first and last included', () => {
    const k = knockSet(30, 12);
    expect(k).toHaveLength(12);
    expect(new Set(k).size).toBe(12);
    expect(k[0]).toBe(0);
    expect(k[11]).toBe(29);
    k.slice(1).forEach((v, i) => expect(v).toBeGreaterThan(k[i]));
  });
  it('fewer letters than the cap: all of them', () => {
    expect(knockSet(8, 12)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});
