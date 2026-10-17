'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { hop, hopLift, moveMs, walk, type ActorFrame, type Pose, type Pt } from '@/lib/missions/actor';
import type { Seg } from '@/lib/missions/robo';
import type { Mood } from '@/lib/robo/moods';
import { isLite } from '@/lib/tier';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { RoboChibi } from './RoboChibi';
import s from './SceneActor.module.css';

export type Line = string | Seg[];
export type ActorHandle = {
  /** Place Robo and his lines: pose, per-line opacity/drift and bubble opacity (speech()), and the line to announce. */
  set(f: ActorFrame): void;
};

const SPEAK_AFTER_MS = 500; // a line must stay current this long before the screen reader hears it (no scrub chatter)
const text = (l: Line) => (typeof l === 'string' ? l : l.map((g) => g.t).join(''));
const Rich = ({ l }: { l: Line }) => <>{typeof l === 'string' ? l : l.map((g, k) => (g.b ? <b key={k}>{g.t}</b> : <span key={k}>{g.t}</span>))}</>;

type Props = {
  lines: Line[]; size?: number; tone?: 'ink' | 'cream'; bubbleWidth?: number; name: string; sparks?: number; className?: string;
  /** reduced motion: show every line as a list in the box (default); false when the scene places each line itself */
  reduceList?: boolean;
};

/**
 * A scene's own Robo (phase 2). Lives in an absolutely positioned box that covers the scene stage; the scene computes a
 * Pose from its scroll progress (lib/missions/actor) and calls set() every time progress changes. Position, squash and
 * line opacities are written straight to the DOM; React state changes only when the mood, facing or announced line flip.
 * Reduced motion: the final pose (the scene passes it) and every line shown as a readable list.
 * Lite tier: no squash/tilt, and the walk cycle runs on its own clock instead of being posed by scroll each frame.
 */
export const SceneActor = forwardRef<ActorHandle, Props>(function SceneActor({ lines, size = 120, tone = 'ink', bubbleWidth = 280, name, sparks = 0, className, reduceList = true }, ref) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null), bot = useRef<HTMLDivElement>(null), squash = useRef<HTMLDivElement>(null), bub = useRef<HTMLDivElement>(null);
  const lineEls = useRef<(HTMLSpanElement | null)[]>([]);
  const dims = useRef({ w: 0, h: 0 }), last = useRef<ActorFrame | null>(null);
  const [mood, setMood] = useState<Mood>('idle'), [facing, setFacing] = useState<'left' | 'right'>('right'), [scrub, setScrub] = useState(false);
  const [spoken, setSpoken] = useState(''), speakT = useRef<ReturnType<typeof setTimeout>>(undefined), spokenIdx = useRef(-2);

  /** The move in flight (px), if any: a self-contained hop or walk that always finishes. */
  const mv = useRef<{ from: Pt; to: Pt; kind: 'hop' | 'walk'; lift: number; t0: number; dur: number; anims: Animation[] } | null>(null);
  const restAt = useRef<Pt | null>(null), latest = useRef<ActorFrame | null>(null);
  const px = (p: Pt) => `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0)`;
  /** Where he is right now (px): mid-move, the same path the animation draws; otherwise his resting node. */
  const nowAt = (): Pt | null => {
    const m = mv.current; if (!m) return restAt.current;
    const t = Math.min(1, Math.max(0, (performance.now() - m.t0) / m.dur));
    return m.kind === 'hop' ? hop(m.from, m.to, t, m.lift) : walk(m.from, m.to, t);
  };
  const stopMove = () => { mv.current?.anims.forEach((a) => a.cancel()); mv.current = null; };
  /** Settle on the node: commit the end state as plain styles and show the pose he arrived for. */
  const settle = () => {
    const m = mv.current, b = bot.current; if (!m || !b) return;
    b.style.transform = px(m.to); restAt.current = m.to;
    stopMove();
    if (latest.current) restPose(latest.current.pose);
  };
  const restPose = (pose: Pose) => {
    const q = squash.current, lite = isLite(); if (!q) return;
    q.style.transform = lite || pose.move !== 'glide' ? '' : `rotate(${pose.rot.toFixed(2)}deg) scale(${pose.sx.toFixed(3)},${pose.sy.toFixed(3)})`;
    const stepOn = pose.step !== null && !lite && pose.move === 'glide';
    if (stepOn) q.style.setProperty('--step', pose.step!.toFixed(3));
    const inside = pose.inside ? 'true' : 'false'; // clipped to the window he is in (the box's --clip)
    if (box.current && box.current.dataset.inside !== inside) box.current.dataset.inside = inside;
    setMood(pose.mood); setFacing(pose.facing); setScrub(stepOn);
  };
  /** Start a hop / walk from where he is now to `to` (retargets a move in flight: straight to the latest node). */
  const startMove = (to: Pt, pose: Pose) => {
    const b = bot.current, q = squash.current, { h } = dims.current; if (!b || !q) return;
    const from = nowAt() ?? to; stopMove();
    const kind = pose.move === 'walk' ? 'walk' : 'hop', dist = Math.hypot(to.x - from.x, to.y - from.y);
    const lift = pose.lift !== undefined ? pose.lift * h : hopLift(dist), dur = moveMs(kind, dist), N = 14, lite = isLite();
    const frames: Keyframe[] = [], sq: Keyframe[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = kind === 'hop' ? hop(from, to, t, lift) : walk(from, to, t);
      frames.push({ offset: t, transform: px(p) });
      if (kind === 'hop' && !lite) sq.push({ offset: t, transform: `rotate(${p.rot.toFixed(2)}deg) scale(${p.sx.toFixed(3)},${p.sy.toFixed(3)})` });
    }
    const anims = [b.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' })];
    if (sq.length) anims.push(q.animate(sq, { duration: dur, easing: 'linear', fill: 'forwards' }));
    mv.current = { from, to, kind, lift, t0: performance.now(), dur, anims };
    anims[0].onfinish = () => { if (mv.current?.anims === anims) settle(); };
    // leaving the window: unclipped from the start of the hop out (coming back in, the clip waits for the landing)
    if (!pose.inside && box.current) box.current.dataset.inside = 'false';
    setMood(kind === 'hop' ? 'air' : 'walk'); setScrub(false);
    setFacing(Math.abs(to.x - from.x) > 1 ? (to.x < from.x ? 'left' : 'right') : pose.facing);
  };

  const paint = (frame: ActorFrame) => {
    const { pose, op, dy, bubble, active } = frame;
    const { w, h } = dims.current, b = bot.current, q = squash.current, u = bub.current;
    if (!b || !q) return;
    latest.current = frame;
    const target = { x: pose.x * w, y: pose.y * h }, rest = restAt.current;
    // where he is headed (px in the box), for the guide's "is a scene Robo on screen" check: a hop in flight between
    // scroll frames would otherwise leave the guide looking at where he was
    if (box.current) box.current.dataset.at = `${Math.round(target.x)},${Math.round(target.y)},${size}`;
    const carry = pose.carry ? 'true' : 'false';
    if (b.dataset.carry !== carry) b.dataset.carry = carry;
    const animated = !reduce && pose.move !== 'glide' && typeof b.animate === 'function';
    if (!animated || !rest) { // follow the scroll (glide), reduced motion, or the very first placement: no animation
      stopMove(); b.style.transform = px(target); restAt.current = target; restPose(pose);
    } else {
      const goal = mv.current?.to ?? rest;
      if (Math.hypot(target.x - goal.x, target.y - goal.y) > 0.5) startMove(target, pose); // a new node: go there
      else if (!mv.current) restPose(pose); // same node: just the pose (mood, facing) may change
    }
    if (u) { // no bubble under reduced motion (the lines are a list)
      u.style.opacity = String(bubble);
      const half = Math.min(bubbleWidth, w) / 2 + 6, bx = Math.min(Math.max(pose.bx * w, half), Math.max(half, w - half));
      u.style.transform = `translate3d(${bx.toFixed(1)}px,${(pose.by * h - size * 1.02).toFixed(1)}px,0) translate(-50%,-100%) scale(${(0.92 + 0.08 * Math.min(1, bubble * 2)).toFixed(3)})`;
      u.style.setProperty('--tail', `${(pose.bx * w - bx).toFixed(1)}px`);
      u.dataset.on = bubble > 0.05 ? 'true' : 'false';
    }
    lineEls.current.forEach((el, i) => { if (!el) return; el.style.opacity = String(op[i] ?? 0); el.style.transform = dy[i] ? `translateY(${dy[i]}px)` : ''; });
    if (active !== spokenIdx.current) {
      spokenIdx.current = active;
      clearTimeout(speakT.current);
      speakT.current = setTimeout(() => setSpoken(active < 0 ? '' : text(lines[active])), SPEAK_AFTER_MS);
    }
  };
  useImperativeHandle(ref, () => ({ set: (f) => { last.current = f; paint(f); } }));

  useEffect(() => {
    const el = box.current; if (!el) return;
    // a resize re-places him at once (no hop): the node is the same, only the pixels changed
    const fit = () => { dims.current = { w: el.clientWidth, h: el.clientHeight }; stopMove(); restAt.current = null; if (last.current) paint(last.current); };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- paint reads refs only
  useEffect(() => () => { clearTimeout(speakT.current); mv.current?.anims.forEach((a) => a.cancel()); }, []);

  return (
    <div ref={box} className={`${s.box} ${className ?? ''}`} data-scene-actor={name} data-tone={tone}>
      <div ref={bot} className={s.bot} data-actor-bot="" data-mood={mood}>
        <div ref={squash} className={s.squash} style={{ marginLeft: -size * 38 / 92, marginTop: -size * 0.9 }}>
          <RoboChibi mood={mood} facing={facing} gait={0.62} size={size} scrub={scrub} sparks={sparks} />
        </div>
      </div>
      {reduce ? (reduceList &&
        <ol className={s.list} data-actor-lines="list">{lines.map((l, i) => <li key={i}><Rich l={l} /></li>)}</ol>
      ) : (
        <div ref={bub} className={s.bubble} data-actor-bubble="" data-on="false" aria-hidden style={{ width: bubbleWidth }}>
          <span className={s.waves} aria-hidden><i /><i /><i /></span>
          <div className={s.stack}>{lines.map((l, i) => <span key={i} ref={(el) => { lineEls.current[i] = el; }} className={s.line} data-actor-line={i}><Rich l={l} /></span>)}</div>
        </div>
      )}
      <p className="sr-only" role="status" data-actor-spoken="">{reduce ? '' : spoken}</p>
    </div>
  );
});
