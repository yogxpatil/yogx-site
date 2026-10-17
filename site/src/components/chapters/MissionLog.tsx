'use client';
import { useEffect, useRef } from 'react';
import { missionLog } from '@/content/site';
import { peelState, riseState } from '@/lib/transitions/peel';
import { useScrollFrame } from '@/lib/useScrollFrame';
import { isLite } from '@/lib/tier';
import { useReducedMotion } from '@/lib/useReducedMotion';
import s from './MissionLog.module.css';

/** The OCD scene belongs to Missions; we only borrow three inline styles, so we must give them back. */
function clearOcd() {
  const o = document.getElementById('sc-ocd');
  if (o) { o.style.transform = ''; o.style.boxShadow = ''; o.style.filter = ''; }
}

export function MissionLog() {
  const sec = useRef<HTMLElement>(null), head = useRef<HTMLDivElement>(null);
  const revealed = useRef(new Set<Element>()), last = useRef('');
  const reduce = useReducedMotion();
  useEffect(() => { if (reduce) { clearOcd(); last.current = ''; } }, [reduce]);
  useEffect(() => () => clearOcd(), []);
  useScrollFrame(() => {
    const el = sec.current; if (!el) return;
    const top = el.getBoundingClientRect().top;
    el.querySelectorAll<HTMLElement>('[data-mrow]').forEach((r) => {
      if (revealed.current.has(r)) return;
      if (r.getBoundingClientRect().top < innerHeight * 0.85) { r.dataset.in = 'true'; revealed.current.add(r); }
    });
    if (reduce) return;
    const key = `${Math.round(top * 2)}|${innerHeight}`;
    if (key === last.current) return;
    last.current = key;
    // The log sits directly under the OCD scene, so its own top is the scene's bottom edge.
    // Measuring the (tilted) scene itself would feed the tilt back into the measurement.
    const ocdEl = document.getElementById('sc-ocd');
    // lite tier (weak device): the scene still peels away, without the full-screen shadow and dimming it repaints every frame
    if (ocdEl) { const p = peelState(top, innerHeight), lite = isLite(); ocdEl.style.transform = p.transform; ocdEl.style.boxShadow = lite ? 'none' : p.boxShadow; ocdEl.style.filter = lite ? 'none' : p.filter; }
    if (head.current) { const r = riseState(top, innerHeight); head.current.style.transform = r.transform; head.current.style.opacity = String(r.opacity); }
 }, sec);
  return (
    <section ref={sec} id="c5" data-tone="light" className={s.mlog} aria-label="Mission log">
      <div ref={head} className={s.head}><h2>{missionLog.head[0]}<br /><span>{missionLog.head[1]}</span></h2><span className="mono" style={{ color: 'var(--muted)' }}>{missionLog.kicker}</span></div>
      <ol className={s.list}>{missionLog.rows.map((r) => (
        <li key={r.small} data-mrow data-in={reduce ? 'true' : 'false'} className={`${s.mrow} ${r.now ? s.now : ''}`}>
          <div className={s.yr}>{r.yr}<small>{r.small}</small></div><div className={s.node} aria-hidden />
          <div><h3>{r.title}</h3><p>{r.body}</p>{r.certs?.map((c) => <span key={c.label} className={`${s.cert} ${c.amber ? s.amber : ''}`}>{c.label}</span>)}</div>
          <div className={s.tag}><b>{r.big}</b>{r.tag}</div>
        </li>))}</ol>
    </section>
  );
}
