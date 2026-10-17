import type { FeedRow } from '@/content/site';
export const nextBars = (n: number, rand: () => number) =>
  Array.from({ length: n }, () => { const h = 20 + rand() * 80; return { h, hot: h > 88 }; });
export const pushFeed = (rows: FeedRow[], row: FeedRow, max = 4) => [row, ...rows].slice(0, max);
export function blipPosition(deg: number, rr: number, radius: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: radius + Math.cos(a) * rr * radius, y: radius + Math.sin(a) * rr * radius };
}
export const ringOffset = (pct: number, circ: number) => circ * (1 - pct / 100);
