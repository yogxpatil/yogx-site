import { clamp, easeInOutCubic as ez } from '@/lib/math';
export function signalState(p: number) {
  // rounded so p = 1/1.3 lands exactly on 1 despite float error
  const s = ez(clamp(Math.round(p * 1.3 * 1e6) / 1e6));
  return { left: `translateX(${s * 20}%)`, right: `translateX(${-s * 20}%)`, merge: clamp((s - 0.55) * 2.4), seal: clamp(Math.round((s - 0.8) * 5 * 1e6) / 1e6), sealTransform: `rotate(${-20 + s * 12}deg) scale(${0.6 + s * 0.4})` };
}
