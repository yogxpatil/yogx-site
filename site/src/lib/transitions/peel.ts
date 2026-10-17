import { clamp } from '@/lib/math';

/** Tilts the OCD scene away as the mission log slides up over it. Shadow is warm ink, never black. */
export function peelState(bottom: number, vh: number) {
  const pe = clamp(1 - bottom / vh);
  if (pe <= 0) return { transform: 'none', boxShadow: 'none', filter: 'none' };
  return { transform: `perspective(1400px) rotateX(${pe * 34}deg) scale(${1 - pe * 0.1})`, boxShadow: `0 ${40 * pe}px ${80 * pe}px -10px rgba(22,19,8,${0.55 * pe})`, filter: `brightness(${1 - pe * 0.35})` };
}
export function riseState(top: number, vh: number) {
  const mp = clamp((vh - top) / vh);
  return { transform: `scale(${0.9 + mp * 0.1}) translateY(${(1 - mp) * 40}px)`, opacity: 0.4 + mp * 0.6 };
}
