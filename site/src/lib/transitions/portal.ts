import { clamp, easeInOutCubic as ez } from '@/lib/math';

export type OPoint = { x: number; y: number; fs: number };
/** Portal progress where the blob stops rendering (it is already faded out by then). */
export const DIVE_AT = 0.1;
const DIVE_FADE_FROM = 0.02;

export function portalState(hp: number, o: OPoint, reduce = false) {
  const scale = Math.pow(60, ez(hp));
  const heroHidden = hp >= 0.97;
  return {
    scale,
    heroTransform: !reduce && hp > 0 && hp < 0.97 ? `scale(${scale})` : 'none',
    heroHidden,
    /** True once the dive has started in earnest: the blob is invisible, so it stops rendering. Never under reduced motion (nothing scales). */
    heroDiving: !reduce && hp >= DIVE_AT,
    blobOpacity: reduce ? 1 : 1 - clamp((hp - DIVE_FADE_FROM) / (DIVE_AT - DIVE_FADE_FROM)),
    clip: reduce ? 'none' : `ellipse(${o.fs * 0.17 * scale}px ${o.fs * 0.22 * scale}px at ${o.x}px ${o.y}px)`,
    portalOpacity: reduce ? clamp((hp - 0.3) / 0.4) : hp > 0.02 ? 1 : 0,
    labelOpacity: clamp((hp - 0.55) * 4),
    tone: (hp > 0.55 ? 'dark' : 'light') as 'light' | 'dark',
  };
}

/** Centre of the O relative to the hero, measured with the hero untransformed. */
export function measureO(hero: HTMLElement, oEl: HTMLElement): OPoint {
  const prev = hero.style.transform; hero.style.transform = 'none';
  const r = oEl.getBoundingClientRect(), h = hero.getBoundingClientRect();
  const fs = parseFloat(getComputedStyle(oEl).fontSize) || 0;
  hero.style.transform = prev;
  return { x: r.left - h.left + r.width / 2 + fs * 0.03, y: r.top - h.top + r.height * 0.5, fs };
}
