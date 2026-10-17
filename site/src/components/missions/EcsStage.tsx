'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { layoutFor, ctrOpacity } from '@/lib/missions/ecs';
import { ecsScene, ECS, type Brick } from '@/lib/missions/scenes';
import { ECS_LINES } from '@/content/robo-script';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { SceneActor, type ActorHandle } from '@/components/robo/SceneActor';
import { useSceneProgress } from './Scene';
import s from './Stages.module.css';

const BW = 74, BH = 46, ROBO = 104;

/**
 * Robo carries the scattered EC2 boxes like bricks, a tower of four on his head per trip, and drops them into the three
 * containers (bottom row first), then the label flips EC2 → ECS. All of it is a function of scroll progress through the scene (ecsScene):
 * scrolling up, he un-stacks them. Box positions are transforms written straight to the DOM; only the EC2/ECS label is
 * React state. Reduced motion: packed, labelled ECS, Robo standing beside them with both lines readable.
 */
export function EcsStage() {
  const reduce = useReducedMotion();
  const st = useRef<HTMLDivElement>(null), actor = useRef<ActorHandle>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [ecs, setEcs] = useState(false);
  const prog = useRef(0);
  /** Per box: its last state and transform, and the fly/drop animation in flight. */
  const motion = useRef<{ state: string; T: string; x: number; y: number; anim: Animation | null }[]>([]);
  useEffect(() => {
    const el = st.current; if (!el) return;
    let w = -1, h = -1;
    const fit = () => { if (el.clientWidth !== w || el.clientHeight !== h) { w = el.clientWidth; h = el.clientHeight; setSize({ w, h }); } };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const L = useMemo(() => (size ? layoutFor(size.w) : null), [size]);
  // carry order: container by container, bottom row first (bricks are stacked, not dropped from the top)
  const order = useMemo(() => {
    if (!L || !size) return null;
    const vh = typeof window === 'undefined' ? 900 : innerHeight, { w, h } = size;
    const idx = L.boxes.map((_, i) => i).sort((a, b) => (a % 3) - (b % 3) || Math.floor(b / 3) - Math.floor(a / 3));
    const bricks: Brick[] = idx.map((i) => {
      const b = L.boxes[i];
      return { x0: (b.x0 + BW / 2) / w, y0: ((b.y0vh * vh) / 100 + BH / 2) / h, x1: (b.x1 + BW / 2) / w, y1: ((22 * vh) / 100 + b.y1px + BH / 2) / h };
    });
    return { idx, bricks, carry: (ROBO * 0.86 + BH / 2) / h, floor: ((22 * vh) / 100 - 2) / h, ground: { x: Math.min(0.9, (L.containers[2].left + L.containers[2].width + 70) / w), y: Math.min(0.97, ((22 * vh) / 100 + 4 * 56 + 14 + 40 + ROBO * 0.9) / h) } }; // floor: the containers' top rims (he drops the bricks in from above)
  }, [L, size]);
  const apply = useCallback(() => {
    const el = st.current; if (!el || !order || !size || !L) return;
    const p = reduce ? 1 : prog.current, a = ecsScene(p, order.bricks, order.floor, order.carry, order.ground, 4, (BH + 2) / size.h);
    const doneCount = a.boxes.filter((b) => b.state === 'slot').length;
    el.style.setProperty('--ck', String(ctrOpacity(Math.min(1, 0.5 + doneCount / order.bricks.length))));
    el.dataset.packed = String(a.packed);
    const els = el.querySelectorAll<HTMLElement>('[data-box]');
    order.idx.forEach((bi, j) => {
      const b = a.boxes[j], box = els[bi]; if (!box) return;
      const r = b.state === 'slot' ? 0 : b.state === 'head' ? L.boxes[bi].r0 * 0.15 : L.boxes[bi].r0;
      const bx = b.x * size.w - BW / 2, by = b.y * size.h - BH / 2;
      const T = `translate3d(${bx.toFixed(1)}px,${by.toFixed(1)}px,0) rotate(${r.toFixed(1)}deg)`;
      const m = (motion.current[bi] ??= { state: b.state, T, x: bx, y: by, anim: null });
      box.dataset.k = b.state === 'slot' ? '1' : b.state === 'head' ? '0.5' : '0';
      if (m.state !== b.state && !reduce && typeof box.animate === 'function') {
        // a discrete moment (flies up onto his head / drops into its slot / back): a short arc that always finishes
        m.anim?.cancel();
        const up = b.state === 'slot' ? 18 : 46, mid = `translate3d(${((m.x + bx) / 2).toFixed(1)}px,${(Math.min(m.y, by) - up).toFixed(1)}px,0) rotate(${(r / 2).toFixed(1)}deg)`;
        const anim = box.animate([{ transform: m.T }, { transform: mid, offset: 0.45 }, { transform: T }], { duration: 420, easing: 'cubic-bezier(.3,.6,.5,1)', fill: 'forwards' });
        anim.onfinish = () => { if (m.anim !== anim) return; box.style.transform = m.T; anim.cancel(); m.anim = null; };
        m.anim = anim;
      } else if (!m.anim) box.style.transform = T; // riding his head (follows him every frame), or resting
      Object.assign(m, { state: b.state, T, x: bx, y: by });
    });
    actor.current?.set(a);
    setEcs(a.ecs); // React skips the re-render when the label is unchanged
  }, [reduce, order, size, L]);
  useSceneProgress((p) => { prog.current = p; apply(); });
  // boxes appear after the layout is measured, and reduced motion arrives a pass late: re-apply the current progress
  useEffect(apply, [apply]);
  return (
    <div ref={st} data-ecs data-packed="false" className={s.ecs} data-relabel-at={ECS.relabel}>
      <div aria-hidden>
        {L?.containers.map((c) => <div key={c.label} data-ctr className={s.ctr} style={{ left: c.left, width: c.width, height: c.height }}><span className="mono">{c.label}</span></div>)}
        {L?.boxes.map((b, i) => <div key={i} data-box className={s.box}>{ecs ? 'ECS' : 'EC2'}</div>)}
      </div>
      <SceneActor ref={actor} name="ecs" lines={ECS_LINES} size={ROBO} bubbleWidth={290} />
    </div>
  );
}
