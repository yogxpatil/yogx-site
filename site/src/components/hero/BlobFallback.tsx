'use client';
import { useEffect, useRef, useState } from 'react';
import { stepBlob, settleBlob, ballsOf } from '@/lib/blob/physics';
import { RIM } from '@/lib/blob/goo';
import { useOnScreen } from '@/lib/useOnScreen';
import { useBlobDriver } from './useBlobDriver';
import { looseStore } from '@/lib/hero/looseStore';
import { appStore } from '@/lib/appState';

const N = 7;
/** The SVG blob (no WebGL, or a weak device). Mounted before the intro moves: it paints its plane and encodes it as an
 *  image then (and tells the intro it is warm), but draws nothing until `live` (the intro's handoff). */
export function BlobFallback({ live = true }: { live?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const d = useBlobDriver(host);
  const visible = useOnScreen(host);
  const [img, setImg] = useState('');
  const body = useRef<(SVGCircleElement | null)[]>([]), rim = useRef<(SVGCircleElement | null)[]>([]), rip = useRef<(SVGCircleElement | null)[]>([]);
  const goo = useRef<SVGFilterElement>(null);
  // the painted plane as an image: toBlob encodes off the main thread (toDataURL took ~140 ms of main thread on a weak
  // PC, inside the intro's handoff frame); each new image replaces the last, whose URL is then freed
  const url = useRef('');
  useEffect(() => {
    const c = d.paint; if (!c || c.width <= 1) return;
    let alive = true;
    const done = (u: string | null) => { if (!alive || !u) return; if (url.current.startsWith('blob:')) URL.revokeObjectURL(url.current); url.current = u; setImg(u); };
    if (typeof c.toBlob === 'function' && typeof URL.createObjectURL === 'function') c.toBlob((b) => { if (b) done(URL.createObjectURL(b)); });
    else done(c.toDataURL());
    return () => { alive = false; };
  }, [d.paint, d.paintVersion]);
  useEffect(() => () => { if (url.current.startsWith('blob:')) URL.revokeObjectURL(url.current); }, []);
  useEffect(() => { if (img && !appStore.get().blobWarm) appStore.set({ blobWarm: true }); }, [img]);
  useEffect(() => {
    if (!visible || !live) return;
    let raf = 0;
    const loop = (t: number) => {
      if (looseStore.get().loose) { raf = 0; return; } // headline letters thrown: faded out, so no frames until they are home
      if (d.reduce) { d.blob.R = 0; settleBlob(d.blob, d.size); } // nothing animates, so draw the settled idle blob once
      else stepBlob(d.blob, t, d.target, d.size);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      ballsOf(d.blob).forEach(([x, y, r], i) => {
        body.current[i]?.setAttribute('cx', String(x)); body.current[i]?.setAttribute('cy', String(y)); body.current[i]?.setAttribute('r', String(r));
        rim.current[i]?.setAttribute('cx', String(x)); rim.current[i]?.setAttribute('cy', String(y)); rim.current[i]?.setAttribute('r', String(r + RIM));
        x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r);
      });
      const pad = 70, g = goo.current; // proto: filter region hugs the blob for speed
      if (g) { g.setAttribute('x', String(x0 - pad)); g.setAttribute('y', String(y0 - pad)); g.setAttribute('width', String(x1 - x0 + pad * 2)); g.setAttribute('height', String(y1 - y0 + pad * 2)); }
      rip.current.forEach((c, j) => { if (!c) return; const age = (((d.reduce ? 0 : t) / 1000 + j * 0.6) % 2.4) / 2.4;
        c.setAttribute('cx', String(d.blob.mx)); c.setAttribute('cy', String(d.blob.my)); c.setAttribute('r', String(d.blob.R * (0.25 + age * 1.3))); c.setAttribute('opacity', String((1 - age) * 0.55)); });
      raf = d.reduce ? 0 : requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const off = looseStore.subscribe(() => { if (!looseStore.get().loose && !raf && !d.reduce) raf = requestAnimationFrame(loop); });
    return () => { off(); cancelAnimationFrame(raf); };
  }, [d.blob, d.size, d.target, d.reduce, d.paintVersion, d.size.w, d.size.h, visible, live]);
  const { w, h } = d.size;
  return (
    <div ref={host} data-blob="fallback" aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          <filter ref={goo} id="yx-goo" filterUnits="userSpaceOnUse" x={0} y={0} width={10} height={10}><feGaussianBlur in="SourceGraphic" stdDeviation={15} /><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 34 -15" /></filter>
          <filter id="yx-grit" filterUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves={2} seed={7} /><feColorMatrix values="0 0 0 0 .53  0 0 0 0 .15  0 0 0 0 0  0 0 0 .55 -.12" /></filter>
          <mask id="yx-bm" maskUnits="userSpaceOnUse" x="-50%" y="-50%" width="200%" height="200%"><g filter="url(#yx-goo)" fill="#fff">{Array.from({ length: N }, (_, i) => <circle key={i} ref={(e) => { body.current[i] = e; }} r={0} />)}</g></mask>
        </defs>
        <g filter="url(#yx-goo)" fill="#882700">{Array.from({ length: N }, (_, i) => <circle key={i} ref={(e) => { rim.current[i] = e; }} r={0} />)}</g>
        <g mask="url(#yx-bm)">
          {img && <image href={img} width={w} height={h} preserveAspectRatio="none" />}
          <rect width={w} height={h} filter="url(#yx-grit)" />
          <g fill="none" stroke="#882700" strokeWidth={1.3}>{[0, 1, 2, 3].map((j) => <circle key={j} ref={(e) => { rip.current[j] = e; }} r={0} opacity={0} />)}</g>
        </g>
      </svg>
    </div>
  );
}
