import { describe, it, expect } from 'vitest';
import { cardBox, cardWidths, choose, overlaps, spots, readMs } from '@/lib/robo/place';

const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });
// Robo on a 1600x900 desktop: 64x78 at left 16, bottom 44
const ROOT = box(16, 778, 80, 856);

describe('Robo card placement', () => {
  const near = (a: { left: number; top: number; right: number; bottom: number }, b: typeof a) =>
    Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom, 0);

  it('desktop: beside Robo first (max 280 px, never beyond 34vw); every spot keeps the card within 16 px of him', () => {
    const s = spots(1600, 900, ROOT);
    expect(s[0]).toEqual({ kind: 'side', bottom: 12, maxW: 280, align: 'start' });
    expect(s.every((x) => x.maxW <= 280)).toBe(true);
    expect(s.every((x) => near(cardBox(x, { w: x.maxW, h: 93 }, ROOT), ROOT) <= 16)).toBe(true);
    expect(spots(800, 900, ROOT).every((x) => x.maxW <= 272)).toBe(true);
  });

  it('on the right half of the screen the card opens to his left first, then above (flush right)', () => {
    const r = box(1400, 794, 1464, 872);
    const s = spots(1600, 900, r);
    expect(s[0].kind).toBe('left');
    const b = cardBox(s[0], { w: 250, h: 93 }, r);
    expect(b.right).toBe(1400 - 12);
    const up = s.find((x) => x.kind === 'up')!;
    expect(cardBox(up, { w: 250, h: 93 }, r).right).toBe(1464);
  });

  it('phone: above Robo first (70vw), beside him only if the screen leaves room', () => {
    const root = box(18, 766, 64, 822);
    const s = spots(390, 844, root);
    expect(s[0]).toEqual({ kind: 'up', bottom: 68, maxW: 273, align: 'start' });
    expect(s.filter((x) => x.kind === 'side').map((x) => x.maxW)).toEqual([273, 215, 273, 215]);
    expect(s.some((x) => x.kind === 'left')).toBe(false);
    expect(s.every((x) => near(cardBox(x, { w: x.maxW, h: 80 }, root), root) <= 16)).toBe(true);
  });

  it('every spot uses one of the fixed card widths, so all sizes can be measured up front', () => {
    for (const [vw, vh, r] of [[1600, 900, ROOT], [1600, 900, box(1400, 794, 1464, 872)], [800, 900, ROOT], [390, 844, box(18, 766, 64, 822)], [390, 844, box(326, 500, 372, 556)]] as const) {
      const ws = cardWidths(vw);
      expect(spots(vw, vh, r).every((x) => ws.includes(x.maxW))).toBe(true);
    }
  });

  it('touching edges is not an overlap', () => {
    expect(overlaps(box(0, 0, 10, 10), box(10, 0, 20, 10))).toBe(false);
    expect(overlaps(box(0, 0, 10, 10), box(9, 9, 20, 20))).toBe(true);
  });

  it('a paragraph beside Robo pushes the card above him', () => {
    const para = box(80, 770, 410, 815); // the hero intro line at 1600x900
    const list = spots(1600, 900, ROOT);
    const r = choose(list, (w) => ({ w, h: 93 }), ROOT, [para], 0, { w: 1600, h: 900 });
    expect(r.clear).toBe(true);
    expect(list[r.i].kind).toBe('up');
    expect(overlaps(cardBox(list[r.i], { w: list[r.i].maxW, h: 93 }, ROOT), para)).toBe(false);
  });

  it('never picks a spot that leaves the screen', () => {
    const low = box(16, 830, 80, 896); // Robo low on the screen: the spots below him would leave it
    const list = spots(1600, 900, low), view = { w: 1600, h: 900 };
    const r = choose(list, (w) => ({ w, h: 93 }), low, [], 0, view);
    expect(r.clear).toBe(true);
    expect(cardBox(list[r.i], { w: list[r.i].maxW, h: 93 }, low).bottom).toBeLessThanOrEqual(900);
    expect(choose(list, (w) => ({ w, h: 2000 }), low, [], 0, view).i).toBe(-1); // too tall for any spot
  });

  it('tries the current spot first; with nothing clear, takes the one covering least', () => {
    const list = spots(1600, 900, ROOT);
    expect(choose(list, (w) => ({ w, h: 80 }), ROOT, [], 3)).toEqual({ i: 3, clear: true });
    const wall = box(0, 0, 1600, 900), small = box(0, 0, 1600, 830);
    const r = choose(list, (w) => ({ w, h: 80 }), ROOT, [wall]);
    expect(r.clear).toBe(false);
    const r2 = choose(list, (w) => ({ w, h: 80 }), ROOT, [small]);
    expect(r2.clear).toBe(false);
    expect(list[r2.i].bottom).toBe(-28); // lowest spot covers the least of a block ending at 830
  });

  it('a card stays up long enough to read: max(6 s, 2.5 s + 75 ms per character)', () => {
    expect(readMs('x'.repeat(10))).toBe(6000);
    expect(readMs('x'.repeat(90))).toBe(9250);
  });
});
