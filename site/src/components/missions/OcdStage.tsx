'use client';
import { useEffect, useRef, useState } from 'react';
import { ocd } from '@/content/site';
import { OCD_LINES } from '@/content/robo-script';
import { OCD_STATIONS, stationLeft, ocdAt } from '@/lib/missions/ocd';
import { ocdScene } from '@/lib/missions/scenes';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { SceneActor, type ActorHandle } from '@/components/robo/SceneActor';
import { useSceneProgress } from './Scene';
import s from './Stages.module.css';

const XS = OCD_STATIONS.map((_, i) => stationLeft(i) / 100);

/**
 * The ticket rides BUILD → TEST → SB → PROD by scroll progress through the scene (ocdAt) and Robo hops station to
 * station ahead of it, landing as it arrives, with a short line at each (ocdScene). Scrolling up carries both back.
 * Ticket position is a direct style write; only the lit-station count is state. Reduced motion: ticket on PROD,
 * everything lit, Robo on PROD with every line readable.
 */
export function OcdStage() {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null), ticket = useRef<HTMLDivElement>(null), actor = useRef<ActorHandle>(null), prog = useRef(0);
  const [lit, setLit] = useState(0);
  const apply = (p0: number) => {
    const t = ticket.current, b = box.current; if (!t || !b) return;
    const p = reduce ? 1 : p0, o = ocdAt(p);
    t.style.left = `${o.left}%`; setLit(o.lit); // React skips the re-render when the count is unchanged
    // he stands on top of the station discs: their top edge is 30vh − 30px into the stage
    const ground = (0.3 * innerHeight - 30) / (b.clientHeight || 1);
    const a = ocdScene(p, XS, ground);
    actor.current?.set(a);
  };
  useSceneProgress((p) => { prog.current = p; apply(p); });
  useEffect(() => { apply(prog.current); }, [reduce]); // eslint-disable-line react-hooks/exhaustive-deps -- reduced motion arrives a pass late
  return (
    <div ref={box} className={s.ocd}>
      <div className={s.track} />
      {OCD_STATIONS.map((n, i) => <div key={n} className={`${s.station} ${i < lit ? s.lit : ''}`} style={{ left: `${stationLeft(i)}%` }}>{n}</div>)}
      <div ref={ticket} className={s.ticket} style={{ left: '0%' }}>{ocd.ticket}<small>{ocd.file}</small></div>
      <div className={s.logline} aria-live="off">{ocd.logs.slice(0, lit).map((l) => <div key={l}>→ {l}</div>)}</div>
      <SceneActor ref={actor} name="ocd" lines={OCD_LINES} size={96} bubbleWidth={270} />
    </div>
  );
}
