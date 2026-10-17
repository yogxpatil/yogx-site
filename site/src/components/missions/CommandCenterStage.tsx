'use client';
import { useEffect, useRef, useState } from 'react';
import { ccApp, ccRows, roboLines } from '@/content/site';
import { ccAt, type Mood } from '@/lib/missions/robo';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { sfx } from '@/lib/sound';
import { useSceneProgress } from './Scene';
import { RoboChibi } from '@/components/robo/RoboChibi';
import type { Mood as ChibiMood } from '@/lib/robo/moods';
import s from './CommandCenter.module.css';

const lineText = (i: number) => roboLines[i].map((g) => g.t).join('');
const ROBO_PX = 150;
const START = { left: '66%', top: '110%' };
/** calm stands, angry stomps, happy cheers with a jump until the coffee is poured, then sits with it. */
const chibiMood = (v: { mood: Mood; mug: boolean }): ChibiMood => (v.mood === 'angry' ? 'angry' : v.mood === 'happy' ? (v.mug ? 'sit' : 'jump') : 'idle');
/** How long a line must stay current before the screen-reader region is told, so scrubbing the scroll is not chatter. */
const SPEAK_AFTER_MS = 500;
type View = { mood: Mood; shake: boolean; line: number; fixed: number; stamp: boolean; mug: boolean; moved: boolean };
const sameView = (a: View, b: View) => a.mood === b.mood && a.shake === b.shake && a.line === b.line && a.fixed === b.fixed && a.stamp === b.stamp && a.mug === b.mug && a.moved === b.moved;
const FINAL: View = { mood: 'happy', shake: false, line: 3, fixed: ccRows.length, stamp: true, mug: true, moved: true };

/**
 * The CommandCenter story follows scroll progress through the scene (ccAt): Robo rises and climbs, the rows are fixed
 * one by one, VERIFIED stamps; scrolling up rewinds all of it. Robo's position is written straight to the DOM; React
 * state only changes when a discrete step flips. Reduced motion: the finished scene, static.
 */
export function CommandCenterStage() {
  const reduce = useReducedMotion();
  const robo = useRef<HTMLDivElement>(null);
  const [v, setV] = useState<View>({ mood: 'calm', shake: false, line: -1, fixed: 0, stamp: false, mug: false, moved: false });
  const [sparks, setSparks] = useState(0), [spoken, setSpoken] = useState('');
  const prog = useRef(0), cur = useRef<View | null>(null), speak = useRef<ReturnType<typeof setTimeout>>(undefined);

  const apply = (p: number) => {
    const r = robo.current; if (!r) return;
    if (reduce) { r.style.left = '7%'; r.style.top = '36%'; r.style.transform = ''; cur.current = FINAL; setV(FINAL); setSpoken(lineText(3)); return; }
    const a = ccAt(p, ccRows.length);
    r.style.left = `${a.left}%`; r.style.top = `${a.top}%`; r.style.transform = a.rot ? `rotate(${a.rot}deg)` : '';
    const n: View = { mood: a.mood, shake: a.shake, line: a.line, fixed: a.fixed, stamp: a.stamp, mug: a.mug, moved: a.moved }, o = cur.current;
    if (o && sameView(o, n)) return;
    if (n.fixed > (o?.fixed ?? 0)) sfx.beep();
    if (n.stamp && !o?.stamp) { sfx.clunk(); setSparks((k) => k + 1); }
    cur.current = n; setV(n);
    if (n.line !== (o?.line ?? -1)) { // only a finished line is announced, once it has stayed current for a moment
      clearTimeout(speak.current);
      speak.current = setTimeout(() => setSpoken(n.line < 0 ? '' : lineText(n.line)), SPEAK_AFTER_MS);
    }
  };
  useSceneProgress((p) => { prog.current = p; apply(p); });
  useEffect(() => { apply(prog.current); }, [reduce]); // eslint-disable-line react-hooks/exhaustive-deps -- reduced motion arrives a pass late
  useEffect(() => () => clearTimeout(speak.current), []);

  return (
    <>
      <div className={s.app}><div className={`mono ${s.bar}`}><i /><i /><i />&nbsp; {ccApp.title}</div>
        <div className={s.rows}>{ccRows.map((r, i) => (
          <div key={r.ticket} className={`${s.row} ${v.shake ? s.shake : ''}`}><span>{r.ticket}</span><span>{r.file}</span>
            <span data-cc-status className={`${s.st} ${i < v.fixed ? s.pass : s[r.kind]}`}>{i < v.fixed ? '✓ PASS' : r.label}</span></div>))}</div></div>
      <div ref={robo} className={s.robo} style={START} data-cc-robo="">
        <RoboChibi mood={chibiMood(v)} facing="right" gait={0.62} size={ROBO_PX} sparks={sparks} />
      </div>
      <div className={`${s.bubble} ${v.line >= 0 ? s.on : ''}`} style={v.moved ? { left: '-4%', top: '6%' } : undefined} aria-hidden>
        {v.line >= 0 && roboLines[v.line].map((g, k) => (g.b ? <b key={k}>{g.t}</b> : <span key={k}>{g.t}</span>))}</div>
      <p className="sr-only" role="status" data-cc-spoken>{spoken}</p>
      <div data-stamp data-on={v.stamp} className={`${s.stamp} ${v.stamp ? s.on : ''}`}>{ccApp.stamp[0]}<br />{ccApp.stamp[1]}</div>
    </>
  );
}
