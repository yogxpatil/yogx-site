'use client';
import { useEffect, useRef } from 'react';
import { missionLog, sceneLengths } from '@/content/site';
import { peelState, riseState } from '@/lib/transitions/peel';
import { useScrollFrame } from '@/lib/useScrollFrame';
import { isLite } from '@/lib/tier';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { LOG_LINES } from '@/content/robo-script';
import { logScene, readingPos } from '@/lib/missions/scenes';
import { pinTravel } from '@/lib/missions/progress';
import { SceneActor, type ActorHandle } from '@/components/robo/SceneActor';
import s from './MissionLog.module.css';

/** The OCD scene belongs to Missions; we only borrow three inline styles, so we must give them back. */
function clearOcd() {
  const o = document.getElementById('sc-ocd');
  if (o) { o.style.transform = ''; o.style.boxShadow = ''; o.style.filter = ''; o.style.transformOrigin = ''; }
}

export function MissionLog() {
  const sec = useRef<HTMLElement>(null), head = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null), actor = useRef<ActorHandle>(null);
  const revealed = useRef(new Set<Element>()), last = useRef('');
  const reduce = useReducedMotion();
  useEffect(() => { if (reduce) { clearOcd(); last.current = ''; } }, [reduce]);
  useEffect(() => () => clearOcd(), []);
  // Pinned: the section is the content's height + sceneLengths.log, the frame sticks and the content slides up inside
  // it more slowly than the page (pinTravel), so each entry gets more scroll. Reduced motion: plain flow, no pin.
  const contentH = useRef(0);
  useEffect(() => {
    const el = sec.current, c = content.current; if (!el || !c) return;
    if (reduce) { el.style.height = ''; c.style.transform = ''; return; }
    const fit = () => { contentH.current = c.offsetHeight; el.style.height = `${c.offsetHeight + (sceneLengths.log / 100) * innerHeight}px`; };
    fit();
    addEventListener('resize', fit);
    if (typeof ResizeObserver === 'undefined') return () => removeEventListener('resize', fit);
    const ro = new ResizeObserver(fit); ro.observe(c);
    return () => { ro.disconnect(); removeEventListener('resize', fit); };
  }, [reduce]);
  useScrollFrame(() => {
    const el = sec.current; if (!el) return;
    const top = el.getBoundingClientRect().top;
    const pin = reduce ? { p: 1, shift: 0 } : pinTravel(top, contentH.current, innerHeight, (sceneLengths.log / 100) * innerHeight);
    if (content.current && !reduce) content.current.style.transform = `translate3d(0,${(-pin.shift).toFixed(1)}px,0)`;
    el.querySelectorAll<HTMLElement>('[data-mrow]').forEach((r) => {
      if (revealed.current.has(r)) return;
      if (r.getBoundingClientRect().top < innerHeight * 0.85) { r.dataset.in = 'true'; revealed.current.add(r); }
    });
    // Robo walks down the node rail with the reading line (logScene); reduced motion: on the last row, waving
    const t = track.current;
    if (t) {
      const rows = Array.from(t.querySelectorAll<HTMLElement>('[data-mrow]'));
      const tops = rows.map((r) => r.offsetTop), h = t.offsetHeight || 1, w = t.offsetWidth || 1;
      // the reading line, in list coordinates: it drifts from 35% to 85% down the screen over the pin, so the first entry
      // is read at the start and the last one (low on the screen once the content has slid fully up) by the end
      const line = innerHeight * (0.35 + 0.5 * pin.p) + pin.shift - t.offsetTop;
      const pos = reduce ? rows.length - 1 : readingPos(line, tops, h);
      // on the node rail (desktop), standing beside each row's node; phone (no rail): at the right edge
      const rail = innerWidth <= 760 ? (w - 40) / w : 208 / w, foot = innerWidth <= 760 ? 30 : 68;
      actor.current?.set(logScene(pos, tops.map((y) => (y + foot) / h), rail));
    }
    if (reduce) return;
    const key = `${Math.round(top * 2)}|${innerHeight}`;
    if (key === last.current) return;
    last.current = key;
    // The log sits directly under the OCD scene, so its own top is the scene's bottom edge.
    // Measuring the (tilted) scene itself would feed the tilt back into the measurement.
    const ocdEl = document.getElementById('sc-ocd');
    // lite tier (weak device): the scene still peels away, without the full-screen shadow and dimming it repaints every frame
    if (ocdEl) {
      // the scene is pinned, so it is taller than the screen: tilt it about the top of its last screen, as if it were one
      // screen tall; tilting about its real top would swing its bottom forward, down over the mission log
      ocdEl.style.transformOrigin = `50% ${Math.max(0, ocdEl.offsetHeight - innerHeight)}px`;
      const p = peelState(top, innerHeight), lite = isLite(); ocdEl.style.transform = p.transform; ocdEl.style.boxShadow = lite ? 'none' : p.boxShadow; ocdEl.style.filter = lite ? 'none' : p.filter; }
    if (head.current) { const r = riseState(top, innerHeight); head.current.style.transform = r.transform; head.current.style.opacity = String(r.opacity); }
 }, sec);
  return (
    <section ref={sec} id="c5" data-tone="light" data-actor-zone="" className={s.mlog} aria-label="Mission log">
      <div className={reduce ? undefined : s.pin}><div ref={content} className={s.content}>
      <div ref={head} className={s.head}><h2>{missionLog.head[0]}<br /><span>{missionLog.head[1]}</span></h2><span className="mono" style={{ color: 'var(--muted)' }}>{missionLog.kicker}</span></div>
      <div ref={track} className={s.track}>
      <ol className={s.list}>{missionLog.rows.map((r, i) => (
        <li key={r.small} data-mrow data-in={reduce ? 'true' : 'false'} className={`${s.mrow} ${r.now ? s.now : ''}`}>
          <div className={s.yr}>{r.yr}<small>{r.small}</small></div><div className={s.node} aria-hidden />
          <div><h3>{r.title}</h3><p>{r.body}</p>{reduce && <p className={s.say} data-log-say=""><b>Robo:</b> {LOG_LINES[i]}</p>}{r.certs?.map((c) => <span key={c.label} className={`${s.cert} ${c.amber ? s.amber : ''}`}>{c.label}</span>)}</div>
          <div className={s.tag}><b>{r.big}</b>{r.tag}</div>
        </li>))}</ol>
      <SceneActor ref={actor} name="log" lines={LOG_LINES} size={84} bubbleWidth={300} reduceList={false} />
      </div>
      </div></div>
    </section>
  );
}
