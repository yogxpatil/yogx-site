'use client';
import { useEffect, useRef, useState } from 'react';
import { ocd } from '@/content/site';
import { OCD_STATIONS, stationLeft, ocdAt } from '@/lib/missions/ocd';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { useSceneProgress } from './Scene';
import s from './Stages.module.css';

/**
 * The ticket rides BUILD → TEST → SB → PROD by scroll progress through the scene (ocdAt): scrolling down moves it and
 * lights the stations, scrolling up carries it back, stopping holds. Position is a direct style write; only the
 * lit-station count is state. Reduced motion: ticket on PROD, everything lit.
 */
export function OcdStage() {
  const reduce = useReducedMotion();
  const ticket = useRef<HTMLDivElement>(null), prog = useRef(0);
  const [lit, setLit] = useState(0);
  const apply = (p: number) => {
    const t = ticket.current; if (!t) return;
    if (reduce) { setLit(4); t.style.left = `${stationLeft(3)}%`; return; }
    const o = ocdAt(p);
    t.style.left = `${o.left}%`; setLit(o.lit); // React skips the re-render when the count is unchanged
  };
  useSceneProgress((p) => { prog.current = p; apply(p); });
  useEffect(() => { apply(prog.current); }, [reduce]); // eslint-disable-line react-hooks/exhaustive-deps -- reduced motion arrives a pass late
  return (
    <div className={s.ocd}>
      <div className={s.track} />
      {OCD_STATIONS.map((n, i) => <div key={n} className={`${s.station} ${i < lit ? s.lit : ''}`} style={{ left: `${stationLeft(i)}%` }}>{n}</div>)}
      <div ref={ticket} className={s.ticket} style={{ left: '0%' }}>{ocd.ticket}<small>{ocd.file}</small></div>
      <div className={s.logline} aria-live="off">{ocd.logs.slice(0, lit).map((l) => <div key={l}>→ {l}</div>)}</div>
    </div>
  );
}
