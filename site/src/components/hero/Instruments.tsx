'use client';
import { useEffect, useRef, useState } from 'react';
import { envs, feedSeed, hero, type FeedRow } from '@/content/site';
import { nextBars, pushFeed, blipPosition, ringOffset } from '@/lib/instruments';
import { appStore } from '@/lib/appState';
import { useStore } from '@/lib/store';
import { useOnScreen } from '@/lib/useOnScreen';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { emitRobo } from '@/lib/robo/bus';
import s from './Instruments.module.css';

const hm = () => new Date().toTimeString().slice(0, 5);
const RADAR = [40, 100, 165, 230, 290, 340], RR = [0.55, 0.75, 0.45, 0.8, 0.6, 0.35], CIRC = 377;

export function Instruments() {
  const entered = useStore(appStore, (x) => x.entered);
  const root = useRef<HTMLDivElement>(null);
  const visible = useOnScreen(root);
  const [bars, setBars] = useState(() => nextBars(22, () => 0.5));
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [pct, setPct] = useState(0);
  const reduce = useReducedMotion();
  const [ringOn, setRingOn] = useState(false);
  const prod2 = () => emitRobo({ type: 'egg', id: 'prod2' });

  useEffect(() => {
    let k = 0; const next = () => setFeed((r) => pushFeed(r, { ...feedSeed[k++ % feedSeed.length], time: hm() }));
    for (let i = 0; i < 4; i++) next();
  }, []);
  useEffect(() => {
    if (!visible || !entered) return; // hold still under the intro: no hidden re-renders while it plays
    if (reduce) return;
    let k = 4; const next = () => setFeed((r) => pushFeed(r, { ...feedSeed[k++ % feedSeed.length], time: hm() }));
    const b = setInterval(() => setBars(nextBars(22, Math.random)), 1200), f = setInterval(next, 2600);
    return () => { clearInterval(b); clearInterval(f); };
  }, [visible, reduce, entered]);
  useEffect(() => {
    if (!entered) return;
    if (reduce) { setRingOn(true); setPct(hero.savingsPct); return; }
    // proto: ring starts 1600 ms after the click on the light = ~500 ms after the flood finishes
    let iv: ReturnType<typeof setInterval>;
    const t = setTimeout(() => {
      setRingOn(true);
      let v = 0; iv = setInterval(() => { v += 1; setPct(v); if (v >= hero.savingsPct) clearInterval(iv); }, 45);
    }, 500);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [entered, reduce]);

  return (
    <div ref={root} data-live={visible && entered} className={s.layer} role="group" aria-label="Live infrastructure instruments">
      <div className={`${s.pnl} ${s.p1}`} data-panel="0"><div className={s.ttl}><span>PNL-01 · FLEET</span><b>LIVE</b></div>
        <div className={s.n}>{hero.fleetCount}<small>ECS SERVICES</small></div>
        <div className={s.bars} aria-hidden>{bars.map((b, i) => <i key={i} className={b.hot ? s.hot : ''} style={{ height: `${b.h}%` }} />)}</div>
        <div className={s.ttl} style={{ margin: '10px 0 0' }}><span>6 ENVS</span><span>ARM64 ✓</span></div></div>
      <div className={`${s.pnl} ${s.p2}`} data-panel="1"><div className={s.ttl}><span>PNL-02 · DEPLOY FEED</span><b>OCD</b></div>
        <div className={s.feed}>{feed.map((r, i) => <div key={`${r.ticket}-${r.time}-${i}`}><span>{r.time}</span>{r.ticket} <em>{r.kind}→{r.env}</em> ✓</div>)}</div></div>
      <div className={`${s.pnl} ${s.p3}`} data-panel="2"><div className={s.ttl}><span>PNL-03 · ENV RADAR</span><b>6/6</b></div>
        <div className={s.radar} aria-hidden><div className={s.sweep} />
          {envs.map((e, i) => { const p = blipPosition(RADAR[i], RR[i], 96); return <div key={e} className={s.blip} {...(e === 'PROD2' ? { 'data-prod2': '', onPointerEnter: prod2, onPointerDown: prod2 } : {})} style={{ left: p.x + 4, top: p.y + 4, animationDelay: `${(RADAR[i] / 360) * 4 - 4}s` }}><span>{e}</span></div>; })}
        </div>
        <p className="sr-only">Environments online: {envs.join(', ')}</p></div>
      <div className={`${s.pnl} ${s.p4}`} data-panel="3">
        <svg className={s.ring} viewBox="0 0 150 150" width={150} height={150} aria-hidden><circle cx={75} cy={75} r={60} className={s.ringBg} />
          <circle cx={75} cy={75} r={60} className={s.ringFg} strokeDasharray={CIRC} strokeDashoffset={ringOn ? ringOffset(hero.savingsPct, CIRC) : CIRC} transform="rotate(-90 75 75)" />
          <text x={75} y={80} textAnchor="middle" className={s.ringT}>{pct === 0 ? '0%' : `−${pct}%`}</text></svg>
        <span className="sr-only">Client cost cut by ECS rightsizing: {hero.savingsPct}%</span>
        <div><div className={s.ttl} style={{ margin: 0 }}><span>PNL-04</span></div>
          <div className="mono" style={{ fontSize: 9.5, lineHeight: 1.7, color: 'var(--muted)' }}>CLIENT<br />COST CUT<br />RIGHTSIZED</div></div></div>
    </div>
  );
}
