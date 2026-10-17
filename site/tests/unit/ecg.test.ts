import { describe, it, expect } from 'vitest';
import { buildEcg, cumLengths, pointAt, isFlat } from '@/lib/missions/ecg';
describe('ECG path', () => {
  const e = buildEcg(1000, 300, 200);
  it('leaves the monitor, then runs left along the headline', () => {
    expect(e.pts[0]).toEqual([1000, 300]); expect(e.pts[1]).toEqual([970, 200]);
    expect(e.pts.slice(2, 5)).toEqual([[910, 200], [900, 192], [890, 200]]);
    expect(e.pts.slice(5, 10)).toEqual([[860, 200], [850, 140], [838, 260], [828, 182], [818, 200]]);
  });
  it('the fourth beat is a flatline 260 px long', () => {
    expect(e.flatA).toBe(370); expect(e.flatB).toBe(110);
    expect(e.pts.at(-1)![0]).toBeLessThanOrEqual(-40);
    expect(e.d.startsWith('M1000 300 L970 200')).toBe(true);
  });
  it('polyline maths', () => {
    const pts: [number, number][] = [[0, 0], [3, 4], [3, 10]]; const c = cumLengths(pts);
    expect(c).toEqual([0, 5, 11]); expect(pointAt(pts, c, 8)).toEqual([3, 7]);
  });
  it('flat only while the line is still being drawn', () => {
    expect(isFlat(200, 370, 110, 0.5)).toBe(true); expect(isFlat(200, 370, 110, 0.85)).toBe(false);
  });
});
