import { describe, it, expect } from 'vitest';
import { manifestoState, activeQuote, quoteSizeVw, LAST_FORMED } from '@/lib/chapters/tunnel';
import { manifesto } from '@/content/site';

const N = 5, FLAT = 'rotateX(0deg) translateY(0vh) scale(1)';
const grid = Array.from({ length: 201 }, (_, i) => i / 200);

describe('manifesto quotes', () => {
  it('quote 1 is fully formed when the section arrives (p=0), the rest are hidden', () => {
    const { active, quotes } = manifestoState(0, N);
    expect(active).toBe(0); expect(quotes[0].t1).toBe(FLAT); expect(quotes[0].opacity).toBe(1); expect(quotes[0].t2Opacity).toBe(1);
    quotes.slice(1).forEach((q) => expect(q.opacity).toBe(0));
  });
  it('quote 5 is fully formed at p=1 and never folds out', () => {
    const { active, quotes } = manifestoState(1, N);
    expect(active).toBe(4); expect(quotes[4].t1).toBe(FLAT); expect(quotes[4].opacity).toBe(1);
    quotes.slice(0, 4).forEach((q) => expect(q.opacity).toBe(0));
    for (const p of grid) if (p >= LAST_FORMED) expect(manifestoState(p, N).quotes[4].t1).toBe(FLAT);
  });
  it('quote 5 holds for the last 30%', () => { expect(1 - LAST_FORMED).toBeCloseTo(0.3, 5); });
  it('active quote never goes backwards as p rises, and visits all five in order', () => {
    const seq = grid.map((p) => activeQuote(p, N));
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
    expect([...new Set(seq)]).toEqual([0, 1, 2, 3, 4]);
  });
  it('is reversible: the picture depends only on p, not on the path taken', () => {
    const down = grid.map((p) => JSON.stringify(manifestoState(p, N)));
    const up = [...grid].reverse().map((p) => JSON.stringify(manifestoState(p, N))).reverse();
    expect(up).toEqual(down);
  });
  it('never more than one quote is legible at a time', () => {
    for (const p of grid) expect(manifestoState(p, N).quotes.filter((q) => q.opacity > 0.5).length).toBeLessThanOrEqual(1);
    for (const p of [0, 0.1, 0.3, 0.45, 0.6, 0.8, 1]) expect(manifestoState(p, N).quotes.filter((q) => q.opacity > 0.5)).toHaveLength(1);
  });
  it('inside a fold the old quote hinges away while the next folds in from bent', () => {
    const { quotes } = manifestoState(0.15, N);
    expect(quotes[0].phase).toBe('out'); expect(quotes[0].bend).toBeGreaterThan(0);
    expect(quotes[1].phase).toBe('in'); expect(quotes[1].bend).toBeGreaterThan(0);
  });
  it('reduced motion: no hinge, one quote at opacity 1, swapping at the same points', () => {
    for (const p of grid) {
      const full = manifestoState(p, N), r = manifestoState(p, N, true);
      expect(r.active).toBe(full.active);
      expect(r.quotes.map((q) => q.opacity)).toEqual(r.quotes.map((_, i) => (i === r.active ? 1 : 0)));
      r.quotes.forEach((q) => { expect(q.t1).toBe('none'); expect(q.t3).toBe('none'); });
    }
  });
});

describe('quote copy and sizing', () => {
  it('has the five owner-approved quotes in order, italic middles lowercase', () => {
    expect(manifesto.quotes.map((q) => q.join(' / '))).toEqual([
      'I BUILD THE ROBOT / the second time / I DO ANYTHING.',
      'I CHECK TWICE / so production / NEVER HAS TO.',
      'I PROVE IT FIRST, / then I make it / BEAUTIFUL.',
      'I AUTOMATE THE BORING / so people get to do / THE BRILLIANT.',
      'I BELIEVE IN BORING / infrastructure and / BOLD DESIGN.',
    ]);
  });
  it('shrinks long quotes so the longest line fits, and never exceeds the cap', () => {
    for (const q of manifesto.quotes) {
      const vw = quoteSizeVw([q[0], q[2]]);
      expect(vw).toBeLessThanOrEqual(12.5);
      expect(vw * 0.54 * Math.max(q[0].length, q[2].length)).toBeLessThanOrEqual(90.01);
    }
    expect(quoteSizeVw(['I AUTOMATE THE BORING'])).toBeLessThan(quoteSizeVw(['I CHECK TWICE']));
  });
});
