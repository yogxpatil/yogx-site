import { describe, it, expect } from 'vitest';
import { ecsLayout, seededRand, layoutFor } from '@/lib/missions/ecs';
describe('EC2 → ECS layout', () => {
  it('three centred containers of four boxes each, staggered 60 ms', () => {
    const L = ecsLayout(1000, () => 0.5);
    expect(L.containers.map((c) => c.left)).toEqual([283, 433, 583]);
    expect(L.containers[0]).toMatchObject({ width: 110, height: 238, label: 'task-1 · arm64' });
    expect(L.boxes).toHaveLength(12);
    expect(L.boxes[4]).toEqual({ x0: 460, y0vh: 27.5, r0: 0, x1: 451, y1px: 76, delay: 0.24 });
  });
  it('seeded random is repeatable, so server and client scatter the same boxes', () => {
    const a = ecsLayout(1000, seededRand(7)), b = ecsLayout(1000, seededRand(7));
    expect(a).toEqual(b);
    const r = seededRand(7); const v = Array.from({ length: 50 }, r);
    expect(v.every((n) => n >= 0 && n < 1)).toBe(true);
  });
  it('layoutFor keeps the scatter seed but re-centres the containers for each width', () => {
    const a = layoutFor(1000), b = layoutFor(600);
    const mid = (L: ReturnType<typeof layoutFor>) => (L.containers[0].left + L.containers[2].left + L.containers[2].width) / 2;
    expect(mid(a)).toBeCloseTo(500 - 12 + 0, 0);
    expect(mid(b)).toBeCloseTo(300 - 12 + 0, 0);
    expect(layoutFor(1000)).toEqual(a);
  });
});
