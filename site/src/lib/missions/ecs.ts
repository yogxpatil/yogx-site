import { clamp } from '@/lib/math';

/** Small seeded random (mulberry32): same seed, same sequence, so the scatter never differs between renders. */
export function seededRand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ecsLayout(W: number, rand: () => number) {
  const cols = 3, per = 4, cw = 110, gap = 40, left = W / 2 - (cols * cw + (cols - 1) * gap) / 2;
  const containers = Array.from({ length: cols }, (_, c) => ({ left: left + c * (cw + gap) - 12, width: cw, height: per * 56 + 14, label: `task-${c + 1} · arm64` }));
  const boxes = Array.from({ length: cols * per }, (_, i) => {
    const c = i % cols, row = Math.floor(i / cols);
    return { x0: rand() * (W - 80), y0vh: rand() * 55, r0: rand() * 70 - 35, x1: left + c * (cw + gap) + 6, y1px: row * 56 + 20, delay: Math.round(i * 6) / 100 };
  });
  return { containers, boxes };
}

/** Layout for a stage of this width; the same seed always scatters the boxes the same way, so a resize only re-centres and rescales. */
export const layoutFor = (width: number, seed = 12) => ecsLayout(width, seededRand(seed));

// Story thresholds on scene progress. Everything below is a pure function of progress, so scrolling up undoes it.
const PACK_FROM = 0.08, PACK_TO = 0.6, RELABEL_AT = 0.72, SPREAD = 0.4, MAX_DELAY = 0.66;
/** Overall packing 0..1 (boxes flying from scattered to their containers). */
export const ecsPack = (p: number) => clamp((p - PACK_FROM) / (PACK_TO - PACK_FROM));
/** One box's own 0..1 (scatter to slot); boxes leave in a stagger, so the last lands exactly when `pack` hits 1. */
export function boxPack(pack: number, delay: number): number {
  const t = clamp((pack - (delay / MAX_DELAY) * SPREAD) / (1 - SPREAD));
  return t * t * (3 - 2 * t);
}
/** Dashed containers fade in as the boxes arrive. */
export const ctrOpacity = (pack: number) => clamp((pack - 0.5) / 0.5);
/** Boxes read ECS (not EC2) once packed and a beat further. */
export const isEcsLabel = (p: number) => p >= RELABEL_AT;
