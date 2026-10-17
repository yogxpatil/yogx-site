import { describe, it, expect } from 'vitest';
import { introKind, introPlan, hopFrames, gap } from '@/lib/intro/timeline';

describe('introKind', () => {
  it.each([
    [{ reduce: true, seen: false, returning: false }, 'none'],
    [{ reduce: true, seen: true, returning: true }, 'none'],
    [{ reduce: false, seen: false, returning: true }, 'none'],
    [{ reduce: false, seen: true, returning: true }, 'none'],
    [{ reduce: false, seen: true, returning: false }, 'return'],
    [{ reduce: false, seen: false, returning: false }, 'first'],
  ] as const)('%o → %s', (input, want) => {
    expect(introKind(input)).toBe(want);
  });
  it.each([
    [{ reduce: false, seen: false, returning: false, lite: true }, 'return'], // a weak device gets the short version even the first time
    [{ reduce: false, seen: true, returning: false, lite: true }, 'return'],
    [{ reduce: false, seen: false, returning: true, lite: true }, 'none'],
    [{ reduce: true, seen: false, returning: false, lite: true }, 'none'],
    [{ reduce: false, seen: false, returning: false, lite: false }, 'first'],
  ] as const)('lite tier: %o → %s', (input, want) => {
    expect(introKind(input)).toBe(want);
  });
});

describe('introPlan', () => {
  const ORDER = ['robo-in', 'plug', 'spark', 'flicker', 'rings', 'swell', 'flood', 'settle', 'headline', 'robo-perch', 'done'];
  it('first visit: every cue, in a fixed order, ending between 2.8 and 3.4 s', () => {
    const p = introPlan('first');
    expect(p.map((c) => c.id)).toEqual(ORDER);
    const end = p[p.length - 1].at;
    expect(end).toBeGreaterThanOrEqual(2800);
    expect(end).toBeLessThanOrEqual(3400);
    for (let i = 1; i < p.length; i++) expect(p[i].at).toBeGreaterThanOrEqual(p[i - 1].at);
  });
  it('the spark lands on the jump apex (~480 ms after take-off), the flicker right after it', () => {
    const p = introPlan('first');
    expect(gap(p, 'plug', 'spark')).toBe(480);
    expect(gap(p, 'spark', 'flicker')).toBeLessThanOrEqual(100);
  });
  it('return visit: flicker, swell, settle in about 0.8 s, no Robo', () => {
    const p = introPlan('return');
    expect(p.map((c) => c.id)).toEqual(['flicker', 'swell', 'flood', 'settle', 'headline', 'done']);
    expect(p[p.length - 1].at).toBeGreaterThanOrEqual(700);
    expect(p[p.length - 1].at).toBeLessThanOrEqual(900);
  });
  it('none: done at once', () => {
    expect(introPlan('none')).toEqual([{ at: 0, id: 'done' }]);
  });
  it('returns a fresh copy (callers cannot corrupt the plan)', () => {
    introPlan('first')[0].at = 999;
    expect(introPlan('first')[0].at).toBe(0);
  });
});

describe('hopFrames', () => {
  const xy = (k: Keyframe) => (String(k.transform).match(/translate\(([-\d.]+)px,([-\d.]+)px\)/) ?? []).slice(1).map(Number);
  it('starts and ends on the given points and arcs above both (not a straight line)', () => {
    const f = hopFrames(0, 100, 200, 140, 60);
    expect(xy(f[0])).toEqual([0, 100]);
    expect(xy(f[f.length - 1])).toEqual([200, 140]);
    const ys = f.map((k) => xy(k)[1]);
    expect(Math.min(...ys)).toBeLessThan(100 - 40);
    expect(f.every((k) => typeof k.offset === 'number')).toBe(true);
  });
  it('squashes on take-off and landing, stretches in the air', () => {
    const f = hopFrames(0, 0, 100, 0, 40);
    expect(String(f[0].transform)).toMatch(/scale\(1\.12,\.86\)/);
    expect(String(f[2].transform)).toMatch(/scale\(\.94,1\.08\)/);
    expect(String(f[f.length - 2].transform)).toMatch(/scale\(1\.1,\.88\)/);
  });
});
