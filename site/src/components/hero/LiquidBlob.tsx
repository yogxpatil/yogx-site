'use client';
import { useEffect, useRef } from 'react';
import { stepBlob, ballsOf } from '@/lib/blob/physics';
import { useOnScreen } from '@/lib/useOnScreen';
import { useBlobDriver } from './useBlobDriver';
import { createBlobGl, type BlobGl } from './blobGl';
import { looseStore } from '@/lib/hero/looseStore';
import { appStore } from '@/lib/appState';
import { useStore } from '@/lib/store';

/** always: a frame every display refresh. demand: one frame per change (reduced motion). never: no frames. */
type Mode = 'always' | 'demand' | 'never';

/** `onFail`: WebGL could not start, or its context was lost: the parent swaps in the SVG blob. */
export default function LiquidBlob({ onFail }: { onFail?: () => void }) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const driver = useBlobDriver(host);
  const visible = useOnScreen(host);
  const live = useStore(appStore, (x) => x.blobLive); // paused until the intro's handoff
  const mode: Mode = !visible || !live ? 'never' : driver.reduce ? 'demand' : 'always';
  const gl = useRef<BlobGl | null>(null);
  const failRef = useRef(onFail);
  failRef.current = onFail;
  const loop = useRef({ mode: 'never' as Mode, raf: 0, t0: 0, paused: false, draw: () => {}, invalidate: () => {} });

  // one frame: step the physics, then draw. Time restarts at 0 whenever the loop (re)starts, as the old Canvas clock did.
  loop.current.draw = () => {
    const g = gl.current; if (!g) return;
    const d = driver, t = performance.now() - loop.current.t0;
    if (!d.reduce) stepBlob(d.blob, t, d.target, d.size);
    else if (d.blob.R === 0) for (let k = 0; k < 120; k++) stepBlob(d.blob, 0, { x: 0, y: 0, active: false }, d.size);
    const a = d.astro.current;
    d.host.current?.setAttribute('data-r', String(Math.round(d.blob.R)));
    g.draw({ balls: ballsOf(d.blob) as [number, number, number][], astro: [a?.cx ?? 0, a?.cy ?? 0, a?.r ?? 0], res: [d.size.w, d.size.h], time: d.reduce ? 0 : t / 1000 }); // reduced motion: ripples + astrolabe hold still
  };

  // the GL context, sized to the host's layout box (not its on-screen box: the portal zoom must not grow the buffer)
  useEffect(() => {
    const c = canvas.current, h = host.current; if (!c || !h) return;
    let g: BlobGl | null = null;
    try { g = createBlobGl(c); } catch { g = null; }
    gl.current = g; if (!g) { failRef.current?.(); return; }
    // the GPU dropped the context (driver reset, too many contexts): claim it and hand over to the SVG blob
    const lost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(loop.current.raf); loop.current.raf = 0; gl.current = null; failRef.current?.(); };
    c.addEventListener('webglcontextlost', lost);
    const fit = (w = h.clientWidth, hh = h.clientHeight) => { g!.resize(w || 1, hh || 1); loop.current.invalidate(); };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(([e]) => fit(e.contentRect.width, e.contentRect.height)) : null;
    ro?.observe(h);
    return () => { c.removeEventListener('webglcontextlost', lost); ro?.disconnect(); cancelAnimationFrame(loop.current.raf); gl.current = null; if (!c.getContext('webgl2')?.isContextLost()) g!.dispose(); };
  }, []);

  // the frame loop: `mode`, unless headline letters are thrown (the blob is faded out then, so it stops drawing).
  // Done straight on the loop, not through React state: a re-render inside the letters' frame is a long frame on a low-end PC.
  useEffect(() => {
    const L = loop.current;
    const tick = () => { L.raf = 0; L.draw(); if (L.mode === 'always' && !L.paused) L.raf = requestAnimationFrame(tick); };
    const apply = () => {
      const m: Mode = L.paused ? 'never' : mode;
      const changed = m !== L.mode;
      L.mode = m;
      if (changed) { L.t0 = performance.now(); cancelAnimationFrame(L.raf); L.raf = 0; }
      if (m === 'always' && !L.raf) L.raf = requestAnimationFrame(tick);
      if (m === 'demand' && changed) L.invalidate();
    };
    L.invalidate = () => { if (L.mode !== 'never' && !L.raf) L.raf = requestAnimationFrame(tick); };
    const onLoose = () => { const lo = looseStore.get().loose; if (lo !== L.paused) { L.paused = lo; apply(); } };
    L.paused = looseStore.get().loose;
    apply();
    const off = looseStore.subscribe(onLoose);
    return () => { off(); cancelAnimationFrame(L.raf); L.raf = 0; L.mode = 'never'; };
  }, [mode]);

  // the painted plane: upload each new version (and the very first: that upload + a throw-away draw compiles and warms
  // the whole pipeline before the intro moves; then the intro may start)
  useEffect(() => {
    const g = gl.current, p = driver.paint; if (!g || !p || p.width < 1) return;
    try { g.upload(p); } catch { /* a lost context: nothing to draw on */ }
    if (driver.reduce) { driver.blob.R = 0; delete (driver.blob as { lastT?: number }).lastT; }
    // the warm-up draws once and clears: it used to draw with no balls at a 1 x 1 size, which painted the whole plane
    // full screen and left it on the canvas until the first live frame (the orange flash at the intro handoff)
    if (!appStore.get().blobWarm) { try { g.warm(); } catch { /* the first frame does it instead */ } appStore.set({ blobWarm: true }); }
    loop.current.invalidate();
  }, [driver.paint, driver.paintVersion, driver.reduce, driver.blob]);

  useEffect(() => { if (live) loop.current.invalidate(); }, [live]);

  return (
    <div ref={host} data-blob="webgl" aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
      <canvas ref={canvas} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
