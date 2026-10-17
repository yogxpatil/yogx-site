'use client';
import { useEffect, useRef } from 'react';
import { TILES, TC, TR, tilesProgress, tileState } from '@/lib/transitions/tiles';
import { useScrollFrame } from '@/lib/useScrollFrame';
import { useReducedMotion } from '@/lib/useReducedMotion';
import s from '@/components/missions/Stages.module.css';

export function ContainerTiles() {
  const root = useRef<HTMLDivElement>(null), els = useRef<(HTMLElement | null)[]>([]);
  const last = useRef(-1), reduce = useReducedMotion();
  // frame work is gated on the scene, not on the tiles themselves: they go display:none once flipped
  const scene = useRef<Element | null>(null);
  useEffect(() => { scene.current = root.current?.parentElement ?? null; }, []);
  useScrollFrame(() => {
    const scene = root.current?.parentElement; if (!scene) return;
    const tp = Math.round(tilesProgress(scene.getBoundingClientRect().top, innerHeight) * 1000) / 1000;
    if (tp === last.current) return; // nothing moved since the last frame
    last.current = tp;
    root.current!.style.display = tp >= 1 ? 'none' : ''; // fully flipped: gone (hidden 3D tiles would still be GPU layers)
    TILES.forEach((t, i) => { const e = els.current[i]; if (!e) return; const st = tileState(tp, t.x, t.y); e.style.transform = st.transform; e.style.opacity = String(st.opacity); });
  }, scene);
  if (reduce) return null;
  return (
    <div ref={root} className={s.tiles} aria-hidden>
      {TILES.map((t, i) => <i key={i} data-tile ref={(e) => { els.current[i] = e; }} style={{ left: `${(t.x * 100) / TC}%`, top: `${(t.y * 100) / TR}%`, width: `${100 / TC + 0.05}%`, height: `${100 / TR + 0.05}%` }}>{t.label}</i>)}
    </div>
  );
}
