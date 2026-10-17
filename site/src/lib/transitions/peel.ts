import { clamp } from '@/lib/math';

/** The peel waits until the OCD scene's bottom (the log's top) has climbed to this fraction of the screen: until then
 *  OCD just scrolls up and its final state (PROD, the logs) stays fully in view for 40vh after its story ends. */
export const PEEL_START = 0.6;
/** Tilts the OCD scene away as the mission log slides up over it; done when the log's top reaches the screen top,
 *  which is where the log's own story starts. Shadow is warm ink, never black. */
export function peelState(bottom: number, vh: number) {
  const pe = clamp(1 - bottom / (vh * PEEL_START));
  if (pe <= 0) return { transform: 'none', boxShadow: 'none', filter: 'none' };
  return { transform: `perspective(1400px) rotateX(${pe * 34}deg) scale(${1 - pe * 0.1})`, boxShadow: `0 ${40 * pe}px ${80 * pe}px -10px rgba(22,19,8,${0.55 * pe})`, filter: `brightness(${1 - pe * 0.35})` };
}
export function riseState(top: number, vh: number) {
  const mp = clamp((vh - top) / vh);
  return { transform: `scale(${0.9 + mp * 0.1}) translateY(${(1 - mp) * 40}px)`, opacity: 0.4 + mp * 0.6 };
}
