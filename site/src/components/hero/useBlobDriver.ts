'use client';
import { useEffect, useRef, useState } from 'react';
import { createBlob, splashBlob, type Blob } from '@/lib/blob/physics';
import { paintAlchemist, type Astro, type PanelRect } from '@/lib/blob/paintAlchemist';
import type { Headline } from '@/lib/blob/headlineSlots';
import { sfx } from '@/lib/sound';
import { emitRobo } from '@/lib/robo/bus';
import { looseStore } from '@/lib/hero/looseStore';

let probe: (() => { x: number; y: number; active: boolean; r: number }) | null = null;
/** Blob centre, radius and pointer-active flag in viewport (getBoundingClientRect) coordinates; null when no hero blob is mounted. */
export function blobProbe(): { x: number; y: number; active: boolean; r: number } | null { return probe ? probe() : null; }

/** Pointer position in the stage's own (unscaled) coordinates, undoing the portal zoom. */
export function mapPointer(x: number, y: number, r: { left: number; top: number; width: number }, offsetWidth: number): { x: number; y: number } {
  const k = offsetWidth > 0 && r.width > 0 ? r.width / offsetWidth : 1;
  return { x: (x - r.left) / k, y: (y - r.top) / k };
}

export function useBlobDriver(stage: React.RefObject<HTMLElement | null>) {
  const blob = useRef<Blob>(createBlob()).current;
  const size = useRef({ w: 1, h: 1 }).current;
  const target = useRef<{ x: number; y: number; active: boolean; touch: boolean }>({ x: 0, y: 0, active: false, touch: false }).current;
  const astro = useRef<Astro | null>(null);
  const [paint, setPaint] = useState<HTMLCanvasElement | null>(null);
  const [paintVersion, setV] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const el = stage.current?.closest<HTMLElement>('[data-hero-sticky]') ?? stage.current?.closest('section') ?? stage.current; if (!el) return;
    setReduce(matchMedia('(prefers-reduced-motion: reduce)').matches);
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); setPaint(canvas);
    const repaint = () => {
      const r = el.getBoundingClientRect(), k = el.offsetWidth > 0 && r.width > 0 ? r.width / el.offsetWidth : 1; size.w = el.offsetWidth || innerWidth; size.h = el.offsetHeight || innerHeight;
      const panels: PanelRect[] = [...el.querySelectorAll<HTMLElement>('[data-panel]')].map((p) => { const b = p.getBoundingClientRect(); return { i: Number(p.dataset.panel), x: (b.left - r.left) / k, y: (b.top - r.top) / k, w: b.width / k, h: b.height / k }; }).filter((p) => p.w > 0);
      const h1 = el.querySelector<HTMLElement>('h1'), slotEls = [...el.querySelectorAll<HTMLElement>('[data-slot]')];
      const headline: Headline | null = h1 && slotEls.length ? {
        family: getComputedStyle(h1).fontFamily, fs: parseFloat(getComputedStyle(h1).fontSize) || 0, // the painted letters must use the page's exact font
        slots: slotEls.map((n) => { const b = n.getBoundingClientRect(); return { line: Number(n.dataset.line), ch: n.dataset.ch ?? '', x: (b.left - r.left) / k, base: Math.round(((n.querySelector('[data-base]')?.getBoundingClientRect().top ?? b.bottom) - r.top) / k) }; }),
      } : null;
      if (ctx) astro.current = paintAlchemist(ctx, size.w, size.h, panels, Math.min(devicePixelRatio || 1, 2), headline);
      setV((v) => v + 1);
    };
    repaint();
    document.fonts?.ready.then(repaint);
    let t: ReturnType<typeof setTimeout>; const onResize = () => { clearTimeout(t); t = setTimeout(repaint, 150); };
    // A pixel-ratio change with no css resize (window dragged to another screen) fires no resize: watch the ratio itself
    let dprMq: MediaQueryList | null = null;
    const onDpr = () => { onResize(); watchDpr(); };
    const watchDpr = () => { dprMq?.removeEventListener?.('change', onDpr); dprMq = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`); dprMq.addEventListener?.('change', onDpr); };
    watchDpr();
    const local = (x: number, y: number) => { const m = mapPointer(x, y, el.getBoundingClientRect(), el.offsetWidth); target.x = m.x; target.y = m.y; target.active = true; };
    const myProbe = () => { const r = el.getBoundingClientRect(), k = el.offsetWidth > 0 && r.width > 0 ? r.width / el.offsetWidth : 1; return { x: r.left + blob.mx * k, y: r.top + blob.my * k, active: target.active && !looseStore.get().loose, r: blob.R * k }; }; // faded out while letters are thrown: it touches nothing
    probe = myProbe;
    // Robo's blob dare: the pointer first enters the blob circle (at most once per 4 s)
    let inside = false, lastTouch = -Infinity;
    const checkTouch = () => {
      if (looseStore.get().loose) { inside = false; return; } // the blob is faded out while headline letters are thrown
      const now = Date.now(), d = Math.hypot(target.x - blob.mx, target.y - blob.my), nowInside = blob.R > 0 && d < blob.R;
      if (nowInside && !inside && now - lastTouch >= 4000) { lastTouch = now; emitRobo({ type: 'blobTouch' }); }
      inside = nowInside;
    };
    const onMove = (e: PointerEvent) => { target.touch = false; local(e.clientX, e.clientY); checkTouch(); };
    const onTouch = (e: TouchEvent) => { const p = e.touches[0]; target.touch = true; if (p) local(p.clientX, p.clientY); checkTouch(); };
    const onLeave = () => { target.active = false; inside = false; };
    let tEnd: ReturnType<typeof setTimeout>;
    const onTouchEnd = () => { clearTimeout(tEnd); tEnd = setTimeout(onLeave, 1200); };
    const onClick = () => { if (looseStore.get().loose) return; splashBlob(blob, Math.random); sfx.splash(); };
    addEventListener('resize', onResize);
    el.addEventListener('pointermove', onMove); el.addEventListener('touchmove', onTouch, { passive: true });
    el.addEventListener('pointerleave', onLeave); el.addEventListener('touchend', onTouchEnd); el.addEventListener('click', onClick);
    return () => {
      clearTimeout(t); clearTimeout(tEnd); if (probe === myProbe) probe = null; dprMq?.removeEventListener?.('change', onDpr);
      removeEventListener('resize', onResize); el.removeEventListener('pointermove', onMove); el.removeEventListener('touchmove', onTouch);
      el.removeEventListener('pointerleave', onLeave); el.removeEventListener('touchend', onTouchEnd); el.removeEventListener('click', onClick);
    };
  }, [stage, blob, size, target]);

  return { host: stage, blob, size, target, astro, paint, paintVersion, reduce };
}
