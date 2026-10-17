'use client';
import { useEffect, useRef } from 'react';
import { portalState, measureO, type OPoint } from '@/lib/transitions/portal';
import { sectionProgress } from '@/lib/scroll';
import { useScrollFrame } from '@/lib/useScrollFrame';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { appStore } from '@/lib/appState';
import { useStore } from '@/lib/store';
import { Hero } from './Hero';
import s from './Hero.module.css';

export function HeroWrap({ blob }: { blob: React.ReactNode }) {
  const wrap = useRef<HTMLElement>(null), sticky = useRef<HTMLDivElement>(null), portal = useRef<HTMLDivElement>(null), label = useRef<HTMLSpanElement>(null);
  const o = useRef<OPoint>({ x: 0, y: 0, fs: 0 });
  const reduce = useReducedMotion();
  const entered = useStore(appStore, (x) => x.entered);
  // keyboard users start in the content once the gate opens, not back on the address bar
  // (not when back from the fast lane: the view is mid-page there, focus at the top would be lost off screen)
  useEffect(() => { if (entered && !appStore.get().returning) sticky.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true }); }, [entered]);
  useEffect(() => {
    const m = () => { const h = sticky.current, oEl = h?.querySelector<HTMLElement>('[data-o]'); if (h && oEl) o.current = measureO(h, oEl); };
    m(); document.fonts?.ready.then(m); addEventListener('resize', m);
    return () => removeEventListener('resize', m);
  }, []);
  useScrollFrame(() => {
    const w = wrap.current, h = sticky.current, p = portal.current; if (!w || !h || !p) return;
    const r = w.getBoundingClientRect();
    const st = portalState(sectionProgress(r.top, r.height, innerHeight), o.current, reduce);
    h.style.transformOrigin = `${o.current.x}px ${o.current.y}px`;
    h.style.transform = st.heroTransform;
    h.style.visibility = st.heroHidden ? 'hidden' : 'visible';
    const hid = st.heroHidden ? '1' : '0'; if (h.dataset.heroHidden !== hid) h.dataset.heroHidden = hid;
    const dv = st.heroDiving ? '1' : '0'; if (h.dataset.heroDiving !== dv) h.dataset.heroDiving = dv;
    h.style.setProperty('--blob-o', String(st.blobOpacity));
    p.style.opacity = String(st.portalOpacity); p.style.clipPath = st.clip;
    if (label.current) label.current.style.opacity = String(st.labelOpacity);
    w.dataset.tone = st.tone;
  }, wrap);
  return (
    <section ref={wrap} id="c1" data-tone="light" className={s.wrap} aria-label="Two planes">
      <div ref={sticky} data-hero-sticky className={s.hero}><Hero blob={blob} /></div>
      <div ref={portal} data-portal className={s.portal} aria-hidden><span ref={label} className="mono">Through the O · 02 / Manifesto</span></div>
    </section>
  );
}
