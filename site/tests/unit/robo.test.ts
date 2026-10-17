import { describe, it, expect } from 'vitest';
import { moodStyle, eyeOffset, ccAt, CC_AT } from '@/lib/missions/robo';
describe('Robo (port of CommandCenter Companion, proto lines 787-818)', () => {
  it('moods set lamp colour, cheeks and head tilt', () => {
    expect(moodStyle('angry')).toEqual({ light: '#ff7a52', cheekOpacity: 0.8, head: 'rotate(-6deg)' });
    expect(moodStyle('happy')).toEqual({ light: '#f99e67', cheekOpacity: 0.28, head: 'rotate(4deg) translateY(-2px)' });
    expect(moodStyle('calm').head).toBe('none');
  });
  it('eyes follow the pointer within 2.4 × 1.6 px', () => {
    const e = eyeOffset(100, 0); expect(e.x).toBeCloseTo(2.4); expect(e.y).toBeCloseTo(0);
    expect(eyeOffset(0, -50).y).toBeCloseTo(-1.6);
  });
});

describe('CommandCenter story by scroll progress', () => {
  const at = (p: number) => ccAt(p, 6);
  it('starts below the screen with nothing fixed, ends in the corner with every row fixed and VERIFIED stamped', () => {
    expect(at(0)).toMatchObject({ top: 110, mood: 'calm', line: -1, fixed: 0, stamp: false, mug: false });
    expect(at(1)).toMatchObject({ left: 7, top: 36, rot: 0, mood: 'happy', line: 3, fixed: 6, stamp: true, mug: true, moved: true });
  });
  it('runs in prototype order: angry, climb, complain, calm, fix rows one by one, stamp, happy, coffee', () => {
    // first progress at which each event happens, in order
    const first = (pred: (a: ReturnType<typeof at>) => boolean) => { for (let i = 0; i <= 1000; i++) if (pred(at(i / 1000))) return i; return -1; };
    const order = [first((a) => a.mood === 'angry'), first((a) => a.line === 0), first((a) => a.moved), first((a) => a.line === 1 && a.mood === 'calm'), first((a) => a.line === 2),
      ...[1, 2, 3, 4, 5, 6].map((n) => first((a) => a.fixed === n)), first((a) => a.stamp), first((a) => a.mood === 'happy'), first((a) => a.line === 3), first((a) => a.mug)];
    expect(order.every((v) => v >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it('is reversible: the same progress always gives the same scene, so scrolling up rewinds it', () => {
    const fwd = Array.from({ length: 101 }, (_, i) => at(i / 100));
    const back = Array.from({ length: 101 }, (_, i) => at((100 - i) / 100)).reverse();
    expect(back).toEqual(fwd);
    expect(at(0.7).fixed).toBeGreaterThan(0); expect(at(0.3).fixed).toBe(0); expect(at(0.7).stamp).toBe(false);
    expect(at(0.95).stamp).toBe(true); expect(at(CC_AT.stamp - 0.01).stamp).toBe(false); expect(at(CC_AT.stamp - 0.01).mood).toBe('calm');
  });
  it('backstory line follows progress and rewinds', () => {
    const lines = [0.3, 0.36, 0.4, 0.55, 0.7, 0.95].map((p) => at(p).line);
    expect(lines).toEqual([-1, 0, 0, 1, 2, 3]);
    expect([0.95, 0.7, 0.55, 0.4, 0.3].map((p) => at(p).line)).toEqual([3, 2, 1, 0, -1]);
  });
  it('Robo moves continuously between rise and corner', () => {
    expect(at(0.1).top).toBeLessThan(110); expect(at(0.1).top).toBeGreaterThan(30); expect(at(0.2)).toMatchObject({ left: 66, top: 30 });
    expect(at(0.3).left).toBeLessThan(66); expect(at(0.4)).toMatchObject({ left: 7, top: 36 });
  });
});
