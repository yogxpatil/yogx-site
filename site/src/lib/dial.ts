import { clamp } from './math';
export const A0 = -135, SPAN = 270;
export const angleForIndex = (i: number, n: number) => A0 + (SPAN * i) / (n - 1);
export const indexForAngle = (a: number, n: number) => Math.round(clamp((a - A0) / SPAN) * (n - 1));
export const pointerAngle = (dx: number, dy: number) => (Math.atan2(dx, -dy) * 180) / Math.PI;
export function currentIndex(tops: number[], vh: number): number {
  let idx = 0; tops.forEach((t, i) => { if (t <= vh * 0.5) idx = i; }); return idx;
}
