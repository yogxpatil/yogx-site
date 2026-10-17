import { clamp } from '@/lib/math';
type P = [number, number];
export const ROUTE_D = 'M110 560 C 420 560, 600 520, 690 400 S 820 120, 920 90';
// S reflects (600,520) about (690,400) → (780,280)
const SEGS: [P, P, P, P][] = [[[110, 560], [420, 560], [600, 520], [690, 400]], [[690, 400], [780, 280], [820, 120], [920, 90]]];
const bez = ([a, b, c, d]: [P, P, P, P], t: number): P => {
  const u = 1 - t, k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [k[0] * a[0] + k[1] * b[0] + k[2] * c[0] + k[3] * d[0], k[0] * a[1] + k[1] * b[1] + k[2] * c[1] + k[3] * d[1]];
};
const PTS: P[] = [], CUM: number[] = [];
SEGS.forEach((s, si) => { for (let i = si ? 1 : 0; i <= 400; i++) PTS.push(bez(s, i / 400)); });
PTS.forEach((p, i) => CUM.push(i ? CUM[i - 1] + Math.hypot(p[0] - PTS[i - 1][0], p[1] - PTS[i - 1][1]) : 0));
export const ROUTE_LENGTH = CUM[CUM.length - 1];
export function routePoint(f: number): P {
  const L = clamp(f) * ROUTE_LENGTH;
  let i = 1; while (i < CUM.length - 1 && CUM[i] < L) i++;
  const span = CUM[i] - CUM[i - 1] || 1, k = (L - CUM[i - 1]) / span;
  return [PTS[i - 1][0] + (PTS[i][0] - PTS[i - 1][0]) * k, PTS[i - 1][1] + (PTS[i][1] - PTS[i - 1][1]) * k];
}
export type Milestone = { t: number; a: string; b: string; dx: number; dy: number; an: 'start' | 'end' };
export function milestoneLayout(m: Milestone) {
  const p = routePoint(m.t), lx = p[0] + m.dx, ly = p[1] + m.dy;
  return { p, label: [lx, ly] as P, lineEnd: [lx, ly + (m.dy < 0 ? 8 : -26)] as P };
}
export function mapState(p: number) {
  const m = clamp(p * 1.15);
  return { m, dot: routePoint(m), dashOffset: 1 - m, og: m > 0.985 };
}
