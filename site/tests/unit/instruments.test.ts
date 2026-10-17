import { describe, it, expect } from 'vitest';
import { nextBars, pushFeed, blipPosition, ringOffset, rackScale } from '@/lib/instruments';

const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };

describe('instruments', () => {
  it('bars stay within 20..100% and mark the hottest as hot', () => {
    const bars = nextBars(3, seq([0, 0.5, 0.95]));
    expect(bars.map((b) => Math.round(b.h))).toEqual([20, 60, 96]);
    expect(bars.map((b) => b.hot)).toEqual([false, false, true]);
  });
  it('feed shows newest first and keeps at most four rows', () => {
    let rows: { time: string; ticket: string; kind: string; env: string }[] = [];
    for (let i = 0; i < 6; i++) rows = pushFeed(rows, { time: '', ticket: `T${i}`, kind: 'ECS', env: 'SB' });
    expect(rows.map((r) => r.ticket)).toEqual(['T5', 'T4', 'T3', 'T2']);
  });
  it('places radar blips clockwise from 12 o\'clock', () => {
    const p = blipPosition(90, 1, 100);
    expect(p.x).toBeCloseTo(200); expect(p.y).toBeCloseTo(100);
    const top = blipPosition(0, 0.5, 100);
    expect(top.x).toBeCloseTo(100); expect(top.y).toBeCloseTo(50);
  });
  it('ring offset for 40% leaves 60% of the stroke hidden', () => {
    expect(ringOffset(40, 377)).toBeCloseTo(226.2);
  });
});

describe('rackScale: the instrument rack always ends above the name + headline', () => {
  const rack = { top: 100, w: 900, h: 170 };
  it('keeps full size when there is room', () => expect(rackScale(rack, 400, 1600)).toBe(1));
  it('shrinks so the bottom edge stays 18 px above the name line', () => {
    const k = rackScale(rack, 260, 1600)!;
    expect(rack.top + rack.h * k).toBeCloseTo(260 - 18);
  });
  it('shrinks to fit the width between the margins', () => expect(rackScale(rack, 400, 720)).toBeCloseTo(0.8));
  it('steps aside (null) rather than shrink below readable size', () => expect(rackScale(rack, 180, 1600)).toBeNull());
});
