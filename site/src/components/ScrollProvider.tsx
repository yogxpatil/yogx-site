'use client';
import { useEffect } from 'react';
import Lenis from 'lenis';
import { appStore } from '@/lib/appState';
import { setLenis, setScrollEnabled } from '@/lib/scroll';

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    scrollTo(0, 0);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; // native scroll, no inertia
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    setLenis(lenis as never);
    if (!appStore.get().entered) setScrollEnabled(false);
    let raf = 0;
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); setLenis(null); };
  }, []);
  return <>{children}</>;
}
