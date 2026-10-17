'use client';
import { useEffect, useRef } from 'react';
import { sceneLengths, transmissions } from '@/content/site';
import { TX_LINES } from '@/content/robo-script';
import { waveD } from '@/lib/chapters/wave';
import { txScene } from '@/lib/missions/scenes';
import { pinTravel } from '@/lib/missions/progress';
import { useScrollFrame } from '@/lib/useScrollFrame';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { SceneActor, type ActorHandle } from '@/components/robo/SceneActor';
import s from './Transmissions.module.css';

/**
 * Field transmissions, pinned (sceneLengths.tx of extra scroll, after the doors before it are fully open): Robo sits on
 * the post line being read and hops down line to line as you scroll (txScene), the pin's progress spread evenly over
 * the posts; content taller than the screen (phone) slides up inside the frame (pinTravel). Reduced motion: no pin.
 */
export function Transmissions() {
  const sec = useRef<HTMLElement>(null), content = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null), actor = useRef<ActorHandle>(null);
  const reduce = useReducedMotion(), contentH = useRef(0);
  const extra = () => (sceneLengths.tx / 100) * innerHeight;
  useEffect(() => {
    const el = sec.current, c = content.current; if (!el || !c) return;
    if (reduce) { el.style.height = ''; c.style.transform = ''; return; }
    const fit = () => { contentH.current = c.offsetHeight; el.style.height = `${Math.max(c.offsetHeight, innerHeight) + extra()}px`; };
    fit();
    addEventListener('resize', fit);
    if (typeof ResizeObserver === 'undefined') return () => removeEventListener('resize', fit);
    const ro = new ResizeObserver(fit); ro.observe(c);
    return () => { ro.disconnect(); removeEventListener('resize', fit); };
  }, [reduce]);
  useScrollFrame(() => {
    const el = sec.current, t = track.current; if (!el || !t) return;
    const pin = reduce ? { p: 1, shift: 0 } : pinTravel(el.getBoundingClientRect().top, contentH.current, innerHeight, extra());
    if (content.current && !reduce) content.current.style.transform = `translate3d(0,${(-pin.shift).toFixed(1)}px,0)`;
    const rows = Array.from(t.querySelectorAll<HTMLElement>('[data-tx-row]'));
    const tops = rows.map((r) => r.offsetTop), h = t.offsetHeight || 1, w = t.offsetWidth || 1;
    const pos = reduce ? rows.length - 1 : rows.length * pin.p - 0.5;
    // perched near the right end of each line, clear of the titles (phone: the right edge)
    const x = innerWidth <= 760 ? (w - 34) / w : (w - 230) / w;
    actor.current?.set(txScene(pos, tops.map((y) => y / h), x));
  }, sec);
  return (
    <section ref={sec} id="c6" data-tone="dark" data-actor-zone="" className={s.tx} aria-label="Transmissions">
      <div className={reduce ? undefined : s.pin}><div ref={content} className={s.content}>
        <div className={s.top}><h2>{transmissions.title[0]}<em>{transmissions.title[1]}</em></h2><span className="mono" style={{ color: '#8c8470' }}>{transmissions.kicker}</span></div>
        <div ref={track} className={s.track}>
          {transmissions.rows.map((r, k) => {
            const body = (<><span className={s.fq}>{r.fq}</span><h3>{r.pre}<em>{r.em}</em>{r.post}</h3><span className={s.go}>{r.go}</span>
              <svg viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden><path d={waveD(k)} /></svg></>);
            return r.href ? <a key={r.fq} href={r.href} data-tx-row="" className={s.row}>{body}</a> : <div key={r.fq} data-tx-row="" role="group" aria-label={`${r.fq}${r.soon ? ': coming soon' : ': link coming soon'}`} className={`${s.row} ${r.soon ? s.soon : ''}`}>{body}</div>;
          })}
          <SceneActor ref={actor} name="tx" lines={TX_LINES} size={78} tone="cream" bubbleWidth={290} />
        </div>
        <p className={`serif ${s.note}`}>{transmissions.footnote}</p>
      </div></div>
    </section>
  );
}
