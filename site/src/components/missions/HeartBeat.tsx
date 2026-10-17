'use client';
import { useEffect, useRef } from 'react';
import { heartbeat } from '@/content/site';
import { buildEcg, cumLengths, pointAt, ecgAtProgress, isFlat } from '@/lib/missions/ecg';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { sfx } from '@/lib/sound';
import { useSceneActive, useSceneInView, useSceneProgress } from './Scene';
import { HB_LINE } from '@/content/robo-script';
import { PerchRobo, type PerchHandle } from '@/components/robo/PerchRobo';
import s from './HeartBeat.module.css';

const STEADY = '72 bpm';

/**
 * The ECG line that escapes the monitor and runs through the headline (proto #ecgp / #ecgh).
 * Lives in the scene's overlay slot and drives the monitor (`[data-monitor]`, `[data-bpm]`) directly with DOM writes,
 * so nothing re-renders. The line is drawn by scroll progress through the scene (ecgAtProgress): scrolling down draws
 * it, runs it through the flatline and lets the monitor recover; scrolling up rewinds. Only the small bpm wobble is
 * time-based, and it runs only while the scene is on screen.
 * Reduced motion: the whole line is drawn once, static, and the monitor shows a steady bpm.
 */
export function EcgOverlay() {
  const active = useSceneActive(), inView = useSceneInView(), reduce = useReducedMotion();
  const svg = useRef<SVGSVGElement>(null), path = useRef<SVGPathElement>(null), head = useRef<SVGCircleElement>(null);
  const flat = useRef(false), prog = useRef(0), redraw = useRef<(() => void) | null>(null);
  useSceneProgress((p) => { prog.current = p; redraw.current?.(); });
  useEffect(() => {
    const sv = svg.current, p = path.current, hd = head.current; if (!active || !sv || !p || !hd) return;
    const scene = sv.closest<HTMLElement>('[data-scene]'), mon = scene?.querySelector<HTMLElement>('[data-monitor]'), bpm = scene?.querySelector<HTMLElement>('[data-bpm]'), h3 = scene?.querySelector('h3');
    if (!scene || !mon || !bpm || !h3) return;
    let e = buildEcg(0, 0, 0), cum = [0], L = 0, last = -1;
    const rest = () => { flat.current = false; mon.dataset.flat = 'false'; bpm.textContent = STEADY; };
    const draw = () => {
      const f = ecgAtProgress(prog.current);
      if (f.drawn === last) return; // nothing moved since the last frame
      last = f.drawn;
      p.style.strokeDashoffset = String(L * (1 - f.drawn)); p.style.opacity = String(f.opacity);
      const pt = pointAt(e.pts, cum, L * f.drawn); hd.setAttribute('cx', String(pt[0])); hd.setAttribute('cy', String(pt[1])); hd.style.opacity = String(f.headOpacity);
      // flat while the moving head is inside the flat run; isFlat's k < 0.8 means "still drawing"
      const fl = isFlat(pt[0], e.flatA, e.flatB, f.drawn < 1 ? 0 : 1);
      if (fl !== flat.current) { flat.current = fl; mon.dataset.flat = String(fl); bpm.textContent = fl ? '— flatline' : STEADY; if (!fl) sfx.beep(); }
    };
    const build = () => {
      const R = sv.getBoundingClientRect(), m = mon.getBoundingClientRect(), h = h3.getBoundingClientRect();
      sv.setAttribute('viewBox', `0 0 ${R.width} ${R.height}`);
      e = buildEcg(m.left - R.left + m.width * 0.15, m.top - R.top + m.height * 0.62, h.top - R.top + h.height * 0.42);
      cum = cumLengths(e.pts); L = cum[cum.length - 1]; p.setAttribute('d', e.d); p.style.strokeDasharray = String(L);
      if (reduce) { p.style.strokeDashoffset = '0'; p.style.opacity = '1'; hd.style.opacity = '0'; } else { last = -1; draw(); }
    };
    build(); rest(); addEventListener('resize', build);
    const stop = () => removeEventListener('resize', build);
    if (reduce) return stop;
    redraw.current = draw; draw();
    return () => { redraw.current = null; stop(); rest(); };
  }, [active, reduce]);
  useEffect(() => {   // ambient: the steady bpm wobbles a little, only while the scene is on screen
    if (reduce || !inView || !active) return;
    const bpm = svg.current?.closest('[data-scene]')?.querySelector<HTMLElement>('[data-bpm]'); if (!bpm) return;
    const t = setInterval(() => { if (!flat.current) bpm.textContent = `${68 + Math.round(Math.random() * 8)} bpm`; }, 1200);
    return () => clearInterval(t);
  }, [reduce, inView, active]);
  return <svg ref={svg} className={s.ecg} aria-hidden><path ref={path} className={s.line} /><circle ref={head} className={s.head} r={5} /></svg>;
}

export function HeartBeatStage() {
  const robo = useRef<PerchHandle>(null), reduce = useReducedMotion();
  useSceneProgress((p) => robo.current?.update(reduce ? 1 : p)); // his note beside the monitor, in its own scroll range
  return (
    <>
      <div className={s.monitor} data-monitor data-flat="false">{heartbeat.monitor}<b data-bpm aria-hidden="true">{STEADY}</b></div>
      <p className="sr-only">Heartbeat monitor: steady pulse, about 72 beats per minute, across {heartbeat.services.length} services.</p>
      <PerchRobo ref={robo} name="hb" line={HB_LINE} at={{ x: 0.12, y: 0.8 }} from={0.06} tone="cream" />
      <ul className={s.services} aria-label="Services monitored">{heartbeat.services.map((n) => <li key={n}><i aria-hidden="true" />{n}</li>)}</ul>
    </>
  );
}
