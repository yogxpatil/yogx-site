import { describe, it, expect } from 'vitest';
import { crosses, gaitFor, perches, pickPerch, route, travelMs } from '@/lib/robo/roam';
import { overlaps } from '@/lib/robo/place';

const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });
const ROBO = { w: 64, h: 78 };
const at = (p: { x: number; y: number }) => box(p.x, p.y, p.x + ROBO.w, p.y + ROBO.h);

describe('Robo roaming', () => {
  it('home (bottom-left) when nothing is in the way', () => {
    const p = pickPerch([], 1600, 900, ROBO, { x: 16, y: 778 });
    expect(p).toEqual({ x: 16, y: 778, peek: false });
  });

  it('a paragraph over his spot sends him along the bottom band to the nearest clear perch', () => {
    const para = box(0, 700, 400, 860);
    const p = pickPerch([para], 1600, 900, ROBO, { x: 16, y: 778 });
    expect(p.peek).toBe(false);
    expect(p.y).toBe(778); // still the bottom band
    expect(overlaps(at(p), para)).toBe(false);
    expect(p.x).toBeLessThan(700); // a roomy spot just past it, not a far corner
  });

  it('climbs a gutter when the whole bottom band is taken', () => {
    const band = box(0, 600, 1600, 900);
    const p = pickPerch([band], 1600, 900, ROBO, { x: 16, y: 778 });
    expect(p.peek).toBe(false);
    expect(p.x === 16 || p.x === 1600 - 16 - ROBO.w).toBe(true);
    expect(overlaps(at(p), band)).toBe(false);
  });

  it('every perch blocked: peeks half off-screen at the nearest edge', () => {
    const wall = box(0, 0, 1600, 900);
    const left = pickPerch([wall], 1600, 900, ROBO, { x: 16, y: 778 });
    expect(left).toEqual({ x: -32, y: 778, peek: true });
    const right = pickPerch([wall], 1600, 900, ROBO, { x: 1400, y: 778 });
    expect(right).toEqual({ x: 1600 - 32, y: 778, peek: true });
  });

  it('an extra test (the card must fit too) skips perches that fail it', () => {
    const p = pickPerch([], 1600, 900, ROBO, { x: 16, y: 778 }, (q) => q.x > 600);
    expect(p.x).toBeGreaterThan(600);
    expect(p.peek).toBe(false);
  });

  it('phone: perches stay inside the screen and the bottom band sits lower', () => {
    const list = perches(390, 844, { w: 46, h: 56 });
    expect(list[0]).toEqual({ x: 18, y: 844 - 22 - 56 });
    expect(list.every((p) => p.x >= 0 && p.x + 46 <= 390 && p.y >= 0 && p.y + 56 <= 844)).toBe(true);
  });

  it('peeking prefers an edge height where the visible half covers nothing', () => {
    const band = box(0, 600, 1600, 900), upper = box(40, 0, 1600, 600); // only a 40 px strip free on the left, above the band
    const p = pickPerch([band, upper], 1600, 900, ROBO, { x: 16, y: 778 });
    expect(p.peek).toBe(true);
    expect(p.x).toBe(-32);
    expect(p.y + ROBO.h).toBeLessThanOrEqual(600);
  });

  it('peeking also honours the extra test (card fits) when given', () => {
    const wall = box(0, 0, 1600, 900);
    // everything but a strip at the left edge is content: peek perches on the left are free for his visible half
    const obs = [box(40, 0, 1600, 900)];
    const p = pickPerch(obs, 1600, 900, ROBO, { x: 16, y: 778 }, (q) => q.y < 400);
    expect(p.peek).toBe(true);
    expect(p.y).toBeLessThan(400);
    expect(pickPerch([wall], 1600, 900, ROBO, { x: 16, y: 778 }, () => true)).toEqual({ x: -32, y: 778, peek: true });
  });

  it('open space inside the screen counts: a blocked gutter (the ALT ruler) and band send him into the empty area, not the edge', () => {
    // the owner's screen: ruler strip at the left, the band taken by the rack, a text block on the left, the right half empty
    const ruler = box(24, 162, 40, 738), band = box(0, 700, 1600, 900), text = box(100, 150, 700, 600);
    const p = pickPerch([ruler, band, text], 1600, 900, ROBO, { x: 16, y: 778 });
    expect(p.peek).toBe(false);
    for (const o of [ruler, band, text]) expect(overlaps(at(p), o)).toBe(false);
    expect(p.x).toBeGreaterThan(700); // in the empty right part, not squeezed into the left gutter
  });

  it('prefers a spot with room around it over a tight slot between text that is only a little nearer', () => {
    // a slot just wider than Robo between two paragraphs on the band, and open band a bit further on
    const a = box(0, 700, 300, 900), b = box(380, 700, 450, 900);
    const p = pickPerch([a, b], 1600, 900, ROBO, { x: 306, y: 778 });
    expect(p.peek).toBe(false);
    expect(p.x).toBeGreaterThanOrEqual(450);
    expect(p.x).toBeLessThan(900); // still close by, not the far corner
  });

  it('perches include interior spots, all inside the screen and below the HUD top row', () => {
    const list = perches(1600, 900, ROBO);
    expect(list.some((p) => p.x > 400 && p.x < 1200 && p.y < 600)).toBe(true);
    expect(list.every((p) => p.x >= 16 && p.x + ROBO.w <= 1600 - 16 && p.y >= 72 && p.y + ROBO.h <= 900 - 44)).toBe(true);
  });

  it('route: along the bottom band and up the gutters, never straight across', () => {
    expect(route({ x: 16, y: 778 }, { x: 600, y: 778 }, 778)).toEqual([{ x: 600, y: 778 }]);
    expect(route({ x: 16, y: 778 }, { x: 1520, y: 300 }, 778)).toEqual([{ x: 1520, y: 778 }, { x: 1520, y: 300 }]);
    expect(route({ x: 16, y: 300 }, { x: 1520, y: 400 }, 778)).toEqual([{ x: 16, y: 778 }, { x: 1520, y: 778 }, { x: 1520, y: 400 }]);
    expect(route({ x: 16, y: 300 }, { x: 16, y: 500 }, 778)).toEqual([{ x: 16, y: 500 }]);
  });

  it('crosses: content on the way counts; content at his start or end does not', () => {
    const from = { x: 16, y: 778 }, to = { x: 1520, y: 300 };
    const stops = route(from, to, 778);
    expect(crosses(from, stops, ROBO, [])).toBe(false);
    expect(crosses(from, stops, ROBO, [box(700, 760, 800, 860)])).toBe(true); // on the band between
    expect(crosses(from, stops, ROBO, [box(1500, 500, 1600, 560)])).toBe(true); // up the gutter
    expect(crosses(from, stops, ROBO, [box(0, 760, 60, 860)])).toBe(false); // where he starts
    expect(crosses(from, stops, ROBO, [box(700, 100, 900, 200)])).toBe(false); // nowhere near
  });

  it('gait: a slow scroll walks (cycle >= 0.75 s), a fast one runs (cycle < 0.35 s)', () => {
    expect(gaitFor(300).mood).toBe('walk');
    expect(gaitFor(300).cycle).toBeGreaterThanOrEqual(0.75);
    expect(gaitFor(0).cycle).toBeGreaterThanOrEqual(0.75);
    expect(gaitFor(3000).mood).toBe('run');
    expect(gaitFor(3000).cycle).toBeLessThan(0.35);
    expect(gaitFor(1799).mood).toBe('walk');
    expect(gaitFor(1801).mood).toBe('run');
  });

  it('gait, lite tier (weak device): never runs (no run cycle, no dust), even on a very fast scroll', () => {
    expect(gaitFor(3000, true).mood).toBe('walk');
    expect(gaitFor(3000, true).cycle).toBeGreaterThanOrEqual(0.7);
    expect(gaitFor(300, true)).toEqual(gaitFor(300));
  });

  it('travel time grows with distance, running is quicker, and it stays within bounds', () => {
    const a = { x: 0, y: 0 }, near = { x: 100, y: 0 }, far = { x: 1000, y: 0 };
    expect(travelMs(a, far, 'walk')).toBeGreaterThan(travelMs(a, near, 'walk'));
    expect(travelMs(a, far, 'run')).toBeLessThan(travelMs(a, far, 'walk'));
    expect(travelMs(a, a, 'walk')).toBe(0);
    expect(travelMs(a, { x: 5000, y: 0 }, 'walk')).toBeLessThanOrEqual(2400);
    expect(travelMs(a, { x: 10, y: 0 }, 'walk')).toBeGreaterThanOrEqual(250);
  });
});
