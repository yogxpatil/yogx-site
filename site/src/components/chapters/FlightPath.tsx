'use client';
import { useEffect, useRef } from 'react';
import { flight } from '@/content/site';
import { ROUTE_D, mapState, milestoneLayout } from '@/lib/chapters/route';
import { sectionProgress } from '@/lib/scroll';
import { useScrollFrame } from '@/lib/useScrollFrame';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { CHAPTER_LINES } from '@/content/robo-script';
import { PerchRobo, type PerchHandle } from '@/components/robo/PerchRobo';
import s from './FlightPath.module.css';

const LAID = flight.milestones.map((m) => ({ m, ...milestoneLayout(m) }));
export function FlightPath() {
  const sec = useRef<HTMLElement>(null), route = useRef<SVGPathElement>(null), dot = useRef<SVGCircleElement>(null), glow = useRef<SVGCircleElement>(null), og = useRef<SVGGElement>(null);
  const ms = useRef<(SVGGElement | null)[]>([]), robo = useRef<PerchHandle>(null);
  const reduce = useReducedMotion();
  const apply = (p: number) => {
    const st = mapState(p);
    if (route.current) route.current.style.strokeDashoffset = String(st.dashOffset);
    [dot.current, glow.current].forEach((c) => { c?.setAttribute('cx', String(st.dot[0])); c?.setAttribute('cy', String(st.dot[1])); });
    ms.current.forEach((g, i) => g?.setAttribute('data-on', String(st.m >= LAID[i].m.t)));
    og.current?.setAttribute('data-on', String(st.og));
  };
  // Reduced motion: the chart is fully drawn and static, applied right away (not on first scroll).
  useEffect(() => { if (reduce) { apply(1); robo.current?.update(1); } });
  useScrollFrame(() => {
    const el = sec.current; if (!el || !route.current || reduce) return;
    const r = el.getBoundingClientRect();
    const p = sectionProgress(r.top, r.height, innerHeight);
    apply(p); robo.current?.update(p); // his note on the route, in its own scroll range
  }, sec);
  const [t1, t2, em, t3] = flight.title;
  return (
    <section ref={sec} id="c3" data-tone="light" data-actor-zone="" className={s.map} aria-label="Flight path">
      <div className={s.sticky}>
        <div className={s.mapl}>
          <span className="mono" style={{ color: 'var(--muted)' }}>{flight.label}</span>
          <h2>{t1}<br />{t2}<em>{em}</em>{t3}</h2>
          <p>{flight.body}</p>
          <div className={`mono ${s.legend}`}>{flight.legend.map((l) => <span key={l}>{l}</span>)}</div>
          <ol className="sr-only" aria-label="Career milestones">{flight.milestones.map((m) => <li key={m.a}>{m.a}: {m.b}</li>)}</ol>
        </div>
        <svg className={s.chart} viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <g stroke="var(--line)" strokeWidth={1}>
            <line x1={80} y1={40} x2={80} y2={580} /><line x1={80} y1={580} x2={980} y2={580} />
            <g opacity={0.6}>{[305, 530, 755].map((x) => <line key={x} x1={x} y1={40} x2={x} y2={580} />)}{[175, 310, 445].map((y) => <line key={y} x1={80} y1={y} x2={980} y2={y} />)}</g>
          </g>
          <text x={980} y={610} textAnchor="end" className={s.axis}>STABILITY →</text>
          <text x={50} y={40} transform="rotate(-90 50 40)" textAnchor="end" className={s.axis}>CREATIVITY →</text>
          <path ref={route} d={ROUTE_D} pathLength={1} fill="none" stroke="var(--rust)" strokeWidth={3} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1} />
          {LAID.map(({ m, p, label, lineEnd }, i) => (
            <g key={m.a} ref={(e) => { ms.current[i] = e; }} className={s.ms} data-ms data-on="false">
              <circle cx={p[0]} cy={p[1]} r={6} fill="var(--paper)" stroke="var(--rust)" strokeWidth={2.5} />
              <line x1={p[0]} y1={p[1]} x2={lineEnd[0]} y2={lineEnd[1]} stroke="var(--rust)" strokeWidth={1} />
              <text x={label[0]} y={label[1]} textAnchor={m.an} className={s.msA}>{m.a}</text>
              <text x={label[0]} y={label[1] + 22} textAnchor={m.an} className={s.msB}>{m.b.toUpperCase()}</text>
            </g>))}
          <g ref={og} className={s.og} data-og data-on="false"><circle cx={920} cy={90} r={46} fill="var(--apricot)" stroke="#1b1605" strokeWidth={2} />
            <text x={920} y={104} textAnchor="middle" className={s.ogT}>OG</text></g>
          <circle ref={dot} data-dot r={11} cx={110} cy={560} fill="var(--ink)" /><circle ref={glow} r={22} cx={110} cy={560} fill="var(--apricot)" opacity={0.35} />
        </svg>
        <PerchRobo ref={robo} name="flight" line={CHAPTER_LINES.c3 ?? ''} at={{ x: 0.35, y: 0.95 }} from={0.08} />
      </div>
    </section>
  );
}
