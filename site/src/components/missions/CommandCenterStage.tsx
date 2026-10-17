'use client';
import { useEffect, useRef, useState } from 'react';
import { ccApp, ccRows, roboLines } from '@/content/site';
import { ccScene, type CcGeo } from '@/lib/missions/scenes';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { sfx } from '@/lib/sound';
import { useSceneProgress } from './Scene';
import { SceneActor, type ActorHandle } from '@/components/robo/SceneActor';
import s from './CommandCenter.module.css';

type View = { shake: boolean; fixed: number; stamp: boolean };
const same = (a: View, b: View) => a.shake === b.shake && a.fixed === b.fixed && a.stamp === b.stamp;
const ROBO = 110;

/**
 * The CommandCenter story is pinned (Scene extra) and follows scroll progress (ccScene): Robo starts INSIDE the app
 * window (clipped by it), hops down the failing rows fixing them, cheers when VERIFIED stamps, then climbs out over the
 * window's edge onto the page and only then talks: "Yeh accha hai…", then his backstory, one line per scroll range.
 * Scrolling up rewinds all of it. Reduced motion: the finished scene, Robo outside, every line as a list.
 */
export function CommandCenterStage() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null), app = useRef<HTMLDivElement>(null), actor = useRef<ActorHandle>(null);
  const [v, setV] = useState<View>({ shake: false, fixed: 0, stamp: false });
  const [sparks, setSparks] = useState(0);
  const prog = useRef(0), cur = useRef<View | null>(null), geo = useRef<{ key: string; g: CcGeo } | null>(null);

  /** Spots in stage fractions, measured from the real window and rows (cached per stage size). */
  const measure = (): CcGeo | null => {
    const st = stage.current, a = app.current; if (!st || !a) return null;
    const S = st.getBoundingClientRect(), key = `${Math.round(S.width)}x${Math.round(S.height)}`;
    if (geo.current?.key === key) return geo.current.g;
    const W = S.width || 1, H = S.height || 1, A = a.getBoundingClientRect();
    const rows = Array.from(a.querySelectorAll<HTMLElement>('[data-cc-row]'), (r, i) => {
      const R = r.getBoundingClientRect();
      return { x: (A.left - S.left + A.width * (i % 2 ? 0.5 : 0.36)) / W, y: (R.bottom - S.top - 2) / H }; // zig-zag down the list
    });
    const last = rows[rows.length - 1] ?? { x: 0.5, y: 0.5 };
    // the window's jagged left edge sits at ~8% of its width; he stops just inside it, then hops out to the floor
    const g: CcGeo = { rows, edge: { x: (A.left - S.left + A.width * 0.16) / W, y: last.y }, out: { x: Math.max(0.06, (A.left - S.left - 70) / W), y: 0.97 } };
    // clip him to the window, below its title bar, while he is inside
    st.querySelector<HTMLElement>('[data-scene-actor]')?.style.setProperty('--clip', `inset(${A.top - S.top + 40}px 0px ${Math.max(0, S.bottom - A.bottom)}px ${A.left - S.left + A.width * 0.06}px)`);
    geo.current = { key, g };
    return g;
  };

  const apply = (p0: number) => {
    const g = measure(); if (!g || !g.rows.length) return;
    const p = reduce ? 1 : p0, a = ccScene(p, g);
    actor.current?.set(a);
    const n: View = { shake: a.shake, fixed: a.fixed, stamp: a.stamp }, o = cur.current;
    if (o && same(o, n)) return;
    if (!reduce && n.fixed > (o?.fixed ?? 0)) sfx.beep();
    if (!reduce && n.stamp && !o?.stamp) { sfx.clunk(); setSparks((k) => k + 1); }
    cur.current = n; setV(n);
  };
  const applyRef = useRef(apply);
  applyRef.current = apply; // the resize observer is set up once: it must call the current apply (reduced motion can arrive later)
  useSceneProgress((p) => { prog.current = p; apply(p); });
  useEffect(() => { apply(prog.current); }, [reduce]); // eslint-disable-line react-hooks/exhaustive-deps -- reduced motion arrives a pass late
  useEffect(() => { // the window and rows only have a size after layout: re-measure on resize
    const el = stage.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { geo.current = null; applyRef.current(prog.current); }); ro.observe(el);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- apply reads refs

  return (
    <div ref={stage} className={s.stage}>
      <div ref={app} className={s.app}><div className={`mono ${s.bar}`}><i /><i /><i />&nbsp; {ccApp.title}</div>
        <div className={s.rows}>{ccRows.map((r, i) => (
          <div key={r.ticket} data-cc-row="" className={`${s.row} ${v.shake ? s.shake : ''}`}><span>{r.ticket}</span><span>{r.file}</span>
            <span data-cc-status className={`${s.st} ${i < v.fixed ? s.pass : s[r.kind]}`}>{i < v.fixed ? '✓ PASS' : r.label}</span></div>))}</div></div>
      <SceneActor ref={actor} name="cc" lines={roboLines} size={ROBO} bubbleWidth={300} sparks={sparks} />
      <div data-stamp data-on={v.stamp} className={`${s.stamp} ${v.stamp ? s.on : ''}`}>{ccApp.stamp[0]}<br />{ccApp.stamp[1]}</div>
    </div>
  );
}
