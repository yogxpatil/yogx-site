import { describe, it, expect } from 'vitest';
import { erfApprox, gooAt, RIM } from '@/lib/blob/goo';

const edge = (balls: [number, number, number][], dir: [number, number], grow = 0) => {
  let d = 0; while (gooAt(dir[0] * d, dir[1] * d, balls, grow) >= 0.5 && d < 2000) d += 0.25; return d;
};

describe('goo field (mirror of the prototype SVG filter)', () => {
  it('erf approximation is accurate to 1e-3', () => {
    expect(erfApprox(0)).toBeCloseTo(0, 6); expect(erfApprox(0.5)).toBeCloseTo(0.5205, 3); expect(erfApprox(-1)).toBeCloseTo(-0.8427, 3);
  });
  it('a lone drop keeps its own size: edge within r + 2 px, not an inflated lens', () => {
    const e = edge([[0, 0, 120]], [1, 0]); expect(e).toBeGreaterThan(120); expect(e).toBeLessThan(122);
  });
  it('the rust rim is a thin crisp ring of 5 ± 1 px', () => {
    const balls: [number, number, number][] = [[0, 0, 120]];
    expect(edge(balls, [1, 0], RIM) - edge(balls, [1, 0])).toBeGreaterThan(4); expect(edge(balls, [1, 0], RIM) - edge(balls, [1, 0])).toBeLessThan(6);
  });
  it('a satellite protrudes as a lump past 1.4 R', () => {
    expect(edge([[0, 0, 120], [110, 0, 60]], [1, 0])).toBeGreaterThan(168);
    expect(edge([[0, 0, 120], [110, 0, 60]], [0, 1])).toBeLessThan(130);
  });
  it('drops far apart stay separate (no bridge)', () => {
    expect(gooAt(150, 0, [[0, 0, 60], [300, 0, 60]])).toBe(0);
  });
});
