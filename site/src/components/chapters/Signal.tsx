'use client';
import { useRef } from 'react';
import { emitRobo } from '@/lib/robo/bus';
import { tapCounter } from '@/lib/robo/signals';
import { signal } from '@/content/site';
import { signalState } from '@/lib/chapters/signal';
import { sectionProgress } from '@/lib/scroll';
import { useScrollFrame } from '@/lib/useScrollFrame';
import { useReducedMotion } from '@/lib/useReducedMotion';
import s from './Signal.module.css';

export function Signal() {
  const sec = useRef<HTMLElement>(null), l = useRef<HTMLDivElement>(null), r = useRef<HTMLDivElement>(null), m = useRef<HTMLDivElement>(null), og = useRef<HTMLDivElement>(null);
  const last = useRef('');
  const taps = useRef(tapCounter(3, 1500));
  const reduce = useReducedMotion();
  useScrollFrame(() => {
    const el = sec.current; if (!el || !l.current || !r.current || !m.current || !og.current) return;
    const b = el.getBoundingClientRect();
    const v = b.top < innerHeight && b.bottom > 0 ? 'true' : 'false'; if (el.dataset.view !== v) el.dataset.view = v; // lamp pauses off screen
    const st = signalState(reduce ? 1 : sectionProgress(b.top, b.height, innerHeight));
    const key = `${st.left}|${st.merge.toFixed(3)}|${st.seal.toFixed(3)}|${st.sealTransform}`;
    if (key === last.current) return;
    last.current = key;
    l.current.style.transform = st.left; r.current.style.transform = st.right; m.current.style.opacity = String(st.merge);
    og.current.style.opacity = String(st.seal); og.current.style.transform = st.sealTransform;
  }, sec);
  return (
    <section ref={sec} id="c7" data-tone="auto" className={s.signal} aria-label="Signal">
      <div className={s.sticky}>
        <div ref={l} data-half="l" className={`${s.half} ${s.l}`} /><div ref={r} data-half="r" className={`${s.half} ${s.r}`} /><div ref={m} data-merge className={s.merge} />
        <div className={s.sig}>
          <span className="mono">{signal.kicker}</span>
          <h2>{signal.line}<br /><em>{signal.em}</em></h2>
          <div className={`mono ${s.status}`}><span className={s.lamp} aria-hidden />{signal.status}</div>
          <nav aria-label="Contact" className={`mono ${s.links}`}>{signal.links.map((k) => (
            // Pending URLs are not links. Real ones open outside the page (new tab / mail app), so they never jump the page and reset the merge.
            k.href ? <a key={k.label} href={k.href} className={s.link} {...(k.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{k.label}</a>
              : <span key={k.label} className={s.pending} aria-disabled="true">{k.label} <small>soon</small></span>))}</nav>
        </div>
        <div ref={og} data-ogseal className={s.ogseal} aria-hidden onPointerDown={() => { if (taps.current(Date.now())) emitRobo({ type: 'egg', id: 'og3' }); }}>OG</div>
      </div>
    </section>
  );
}
