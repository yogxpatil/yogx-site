import { clamp } from '@/lib/math';
export const TC = 12, TR = 7;
export const TILES = Array.from({ length: TC * TR }, (_, k) => { const x = k % TC, y = Math.floor(k / TC);
  return { x, y, label: (x * 7 + y * 3) % 9 === 0 ? `c-${String(y * TC + x).padStart(2, '0')}` : '' }; });
export const tilesProgress = (top: number, vh: number) => clamp((vh - top) / (vh * 0.9));
export function tileState(tp: number, x: number, y: number) {
  const lp = clamp(tp * 1.7 - ((x + (TR - 1 - y)) / (TC + TR)) * 0.9);
  // unflipped: a flat 'none', not rotateX(0deg): every 3D-transformed tile is its own GPU layer, 84 of them per frame
  return { transform: lp > 0 ? `rotateX(${-lp * 105}deg) translateZ(${lp * 30}px)` : 'none', opacity: lp > 0.92 ? 0 : 1 };
}
