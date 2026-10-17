import { describe, it, expect } from 'vitest';
import { routePoint, milestoneLayout, mapState, ROUTE_LENGTH } from '@/lib/chapters/route';
describe('flight path', () => {
  it('starts and ends at the prototype route endpoints', () => {
    expect(routePoint(0)).toEqual([110, 560]);
    const e = routePoint(1); expect(e[0]).toBeCloseTo(920, 1); expect(e[1]).toBeCloseTo(90, 1);
  });
  it('route length is plausible (longer than the chord)', () => {
    expect(ROUTE_LENGTH).toBeGreaterThan(Math.hypot(810, 470)); expect(ROUTE_LENGTH).toBeLessThan(1300);
  });
  it('places labels with the prototype offsets and leader-line rule', () => {
    const up = milestoneLayout({ t: 0.16, a: 'x', b: 'y', dx: 0, dy: -150, an: 'start' });
    expect(up.label[0]).toBeCloseTo(up.p[0]); expect(up.label[1]).toBeCloseTo(up.p[1] - 150); expect(up.lineEnd[1]).toBeCloseTo(up.p[1] - 142);
    const down = milestoneLayout({ t: 0.6, a: 'x', b: 'y', dx: 50, dy: 70, an: 'start' });
    expect(down.lineEnd[1]).toBeCloseTo(down.p[1] + 44);
  });
  it('map progress is scroll × 1.15, OG after .985', () => {
    expect(mapState(0.5).m).toBeCloseTo(0.575); expect(mapState(0.5).dashOffset).toBeCloseTo(0.425);
    expect(mapState(0.85).og).toBe(false); expect(mapState(0.87).og).toBe(true);
  });
});
