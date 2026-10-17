'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { layoutFor, ecsPack, boxPack, ctrOpacity, isEcsLabel, type ecsLayout } from '@/lib/missions/ecs';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { useSceneProgress } from './Scene';
import s from './Stages.module.css';

/**
 * EC2 boxes scattered across the stage pack into three containers and relabel ECS, all as a function of scroll
 * progress through the scene: scrolling down packs, scrolling up unpacks and relabels EC2, stopping holds.
 * Box positions are written as one CSS variable per box (no re-render); only the EC2/ECS label is React state.
 * Reduced motion: packed and labelled ECS from the start.
 */
export function EcsStage() {
  const reduce = useReducedMotion();
  const st = useRef<HTMLDivElement>(null);
  const [L, setL] = useState<ReturnType<typeof ecsLayout> | null>(null);
  const [ecs, setEcs] = useState(false);
  const prog = useRef(0);
  useEffect(() => {
    const el = st.current; if (!el) return;
    let w = -1;
    const fit = () => { if (el.clientWidth !== w) { w = el.clientWidth; setL(layoutFor(w)); } };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const apply = useCallback(() => {
    const el = st.current; if (!el) return;
    const p = reduce ? 1 : prog.current, pack = ecsPack(p);
    el.style.setProperty('--ck', String(ctrOpacity(pack)));
    el.dataset.packed = String(pack >= 1);
    el.querySelectorAll<HTMLElement>('[data-box]').forEach((b) => b.style.setProperty('--k', String(boxPack(pack, Number(b.dataset.d)))));
    setEcs(isEcsLabel(p)); // React skips the re-render when the label is unchanged
  }, [reduce]);
  useSceneProgress((p) => { prog.current = p; apply(); });
  // boxes appear after the layout is measured, and reduced motion arrives a pass late: re-apply the current progress
  useEffect(apply, [apply, L]);
  return (
    <div ref={st} aria-hidden data-ecs data-packed="false" className={s.ecs}>
      {L?.containers.map((c) => <div key={c.label} data-ctr className={s.ctr} style={{ left: c.left, width: c.width, height: c.height }}><span className="mono">{c.label}</span></div>)}
      {L?.boxes.map((b, i) => <div key={i} data-box data-d={b.delay} className={s.box} style={{ '--x0': `${b.x0}px`, '--y0': `${b.y0vh}vh`, '--r0': `${b.r0}deg`, '--x1': `${b.x1}px`, '--y1': `calc(22vh + ${b.y1px}px)` } as React.CSSProperties}>{ecs ? 'ECS' : 'EC2'}</div>)}
    </div>
  );
}
