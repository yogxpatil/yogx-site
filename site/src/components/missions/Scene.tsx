'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Mission } from '@/content/site';
import { sceneProgress } from '@/lib/missions/progress';
import { useScrollFrame } from '@/lib/useScrollFrame';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { Patch } from './Patch';
import s from './Scene.module.css';

export const SceneActive = createContext(false);
export const SceneInView = createContext(false);
/** One-time reveal latch: becomes true the first time the scene is on screen and never goes back. */
export const useSceneActive = () => useContext(SceneActive);
/** Live flag: true while the scene is on screen (top above 65% of the viewport, bottom below the top edge), false once it leaves. */
export const useSceneInView = () => useContext(SceneInView);

type ProgressSource = { get: () => number; subscribe: (fn: (p: number) => void) => () => void };
const SceneProgress = createContext<ProgressSource | null>(null);
/**
 * Scroll progress through the scene (0 = just peeking in, 1 = story end; see sceneProgress). `onChange` runs with the
 * current value on mount and again only when it changes, outside React: write to refs/DOM, and setState only when a
 * discrete step flips. Scrolling back up reports the same values in reverse, so stage stories rewind.
 */
export function useSceneProgress(onChange: (p: number) => void): void {
  const src = useContext(SceneProgress), fn = useRef(onChange);
  fn.current = onChange;
  useEffect(() => {
    if (!src) return;
    fn.current(src.get());
    return src.subscribe((p) => fn.current(p));
  }, [src]);
}

/**
 * Scene shell shared by every mission.
 * - `active` (useSceneActive): latches true on first reveal; drives the one-time reveal (clip sweep).
 * - in-view (useSceneInView): true/false as the scene enters and leaves the screen; state changes only when the value flips.
 * - `stage`: the scene's animated world, rendered in the right-hand column; it can read both hooks above.
 *   `overlay` is rendered first inside the scene, covering all of it.
 * - progress (useSceneProgress): scroll position inside the scene as 0..1; each stage's main story is a pure function of
 *   it (lib/missions), so scrolling down advances, up rewinds and stopping holds.
 * Stage rules: ambient loops (blinks, steam, wobble) play only while in view; abort timers and cancel running animations in the effect cleanup (so leaving
 * the screen or unmounting stops everything and re-entering restarts cleanly); under reduced motion, apply the final
 * static state on the first effect run once `active` is true and do no looping work.
 */
export function Scene({ mission: m, overlay, stage }: { mission: Mission; overlay?: React.ReactNode; stage: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const [inView, setInView] = useState(false);
  const reduce = useReducedMotion();
  // Reduced motion: the scene is visible and in its final state right away.
  useEffect(() => { if (reduce) setActive(true); }, [reduce]);
  // Progress lives in a ref + subscriber set, so a scroll frame never re-renders anything.
  const src = useMemo<ProgressSource & { set: (p: number) => void }>(() => {
    let p = 0; const subs = new Set<(p: number) => void>();
    return { get: () => p, subscribe: (fn) => { subs.add(fn); return () => { subs.delete(fn); }; }, set: (v) => { if (v === p) return; p = v; subs.forEach((f) => f(v)); } };
  }, []);
  useScrollFrame(() => {
    if (reduce) return;
    const r = ref.current?.getBoundingClientRect();
    const v = !!r && r.top < innerHeight * 0.65 && r.bottom > 0;
    setInView(v); // React skips the re-render when the value is unchanged
    if (v) setActive(true);
    // Only while near the screen: far away it would just recompute the same 0 or 1. Rounded so sub-pixel jitter is no change.
    if (r && r.bottom > -innerHeight && r.top < innerHeight * 2) src.set(Math.round(sceneProgress(r.top, r.height, innerHeight) * 1000) / 1000);
  }, ref);
  return (
    <SceneProgress.Provider value={src}>
    <SceneActive.Provider value={active}>
      <SceneInView.Provider value={inView}>
        <article ref={ref} id={m.id} data-scene data-in={active} data-view={inView} data-tone={m.tone === 'light' ? undefined : m.tone} aria-label={`Mission ${m.code}: ${m.scene}`}
          className={`${s.scene} ${s[m.tone]} ${m.sweep ? s.sweep : ''} ${active ? s.in : ''}`}>
          {overlay}
          <div>
            <Patch code={m.code} name={m.patchName} />
            <span className={`mono ${s.num}`}>Scene {m.num} — {m.scene}</span>
            <h3>{m.title[0]} <em>{m.title[1]}</em></h3>
            <p>{m.body}</p>
            <dl className={`mono ${s.facts}`}>{m.facts.map(([b, t]) => <div key={t}><dt>{t}</dt><dd><b>{b}</b></dd></div>)}</dl>
          </div>
          <div className={s.stage}>{stage}</div>
        </article>
      </SceneInView.Provider>
    </SceneActive.Provider>
    </SceneProgress.Provider>
  );
}
