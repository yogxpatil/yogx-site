import type { FeedRow } from '@/content/site';
export const nextBars = (n: number, rand: () => number) =>
  Array.from({ length: n }, () => { const h = 20 + rand() * 80; return { h, hot: h > 88 }; });
export const pushFeed = (rows: FeedRow[], row: FeedRow, max = 4) => [row, ...rows].slice(0, max);
export function blipPosition(deg: number, rr: number, radius: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: radius + Math.cos(a) * rr * radius, y: radius + Math.sin(a) * rr * radius };
}
export const ringOffset = (pct: number, circ: number) => circ * (1 - pct / 100);

const FIT_GAP = 18;   // px kept clear between the rack and the name line above the headline
const MIN_SCALE = 0.62; // smaller than this the readouts stop being readable: the rack steps aside instead

/** How much the rack must shrink to end above the name + headline and stay inside the side margins.
 *  null = it would get too small to read: hide it. */
export function rackScale(rack: { top: number; w: number; h: number }, limitTop: number, room: number): number | null {
  const k = Math.min(1, (limitTop - FIT_GAP - rack.top) / rack.h, room / rack.w);
  return k >= MIN_SCALE ? k : null;
}
