'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { chapters } from '@/content/site';
import { A0, SPAN, angleForIndex, indexForAngle, pointerAngle, currentIndex } from '@/lib/dial';
import { beginJump } from '@/lib/transitions/doors';
import { sfx } from '@/lib/sound';
import { appStore } from '@/lib/appState';
import { useStore } from '@/lib/store';
import { useScrollFrame } from '@/lib/useScrollFrame';
import { clamp } from '@/lib/math';
import { emitRobo } from '@/lib/robo/bus';
import s from './Dial.module.css';

const N = chapters.length;
const LOCK_MS = 600;
const defaultJump = (i: number): boolean => { const r = beginJump(i); r.done.catch(() => {}); return r.accepted; };

export function Dial({ onJump = defaultJump }: { onJump?: (i: number) => boolean | void }) {
  const entered = useStore(appStore, (x) => x.entered);
  const [idx, setIdx] = useState(0);
  const [dragAngle, setDragAngle] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const last = useRef(0);
  const target = useRef(0);      // last chapter we asked for; wheel steps advance from here
  const lastWheel = useRef(0);
  const lockUntil = useRef(0);   // wheel events are ignored until this time (one gesture = one step)
  const onJumpRef = useRef(onJump);
  onJumpRef.current = onJump;

  const jump = useCallback((i: number) => {
    lockUntil.current = Date.now() + LOCK_MS;
    if (onJumpRef.current(i) !== false) { target.current = i; emitRobo({ type: 'jump', index: i }); } // a refused jump must not move the wheel target, and Robo never hears about it
  }, []);

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const set = () => setReduced(mq.matches);
    set();
    mq.addEventListener?.('change', set);
    return () => mq.removeEventListener?.('change', set);
  }, []);

  useScrollFrame(() => {
    const tops = chapters.map((c) => document.getElementById(c.id)?.getBoundingClientRect().top ?? Infinity);
    const i = currentIndex(tops, innerHeight);
    if (i !== last.current) { last.current = i; sfx.click(); }
    if (Date.now() >= lockUntil.current) target.current = i;
    setIdx(i);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!appStore.get().entered) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= N) jump(n - 1);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [jump]);

  // Native, non-passive listener so preventDefault stops the page scrolling too.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      const gap = now - lastWheel.current; lastWheel.current = now;
      if (now < lockUntil.current || gap < 200) return; // still the same gesture (trackpad inertia keeps firing)
      const next = clamp(target.current + (e.deltaY > 0 ? 1 : -1), 0, N - 1);
      if (next === target.current) return;
      jump(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [jump]);

  const angleOf = (e: React.PointerEvent) => { const r = wrap.current!.getBoundingClientRect(); return clamp(pointerAngle(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)), A0, A0 + SPAN); };
  const knobAngle = dragAngle ?? angleForIndex(idx, N);
  const springy = dragAngle === null && !reduced;

  return (
    <div className={s.dial} data-dial="" inert={!entered} aria-hidden={!entered ? true : undefined}>
      <nav aria-label="Chapters" className={s.links}>
        {chapters.map((c, i) => <a key={c.id} href={`#${c.id}`} onClick={(e) => { e.preventDefault(); jump(i); }}>{c.num} {c.name}</a>)}
      </nav>
      <div className={`mono ${s.label}`} aria-hidden><span>{String(idx + 1).padStart(2, '0')} / {String(N).padStart(2, '0')}</span><b className="serif">{chapters[idx].name}</b></div>
      <div ref={wrap} className={s.knobwrap} aria-hidden data-lenis-prevent
        onPointerDown={(e) => { if (e.button !== 0) return; if ((e.target as Element).closest('[data-tick]')) return; wrap.current!.setPointerCapture(e.pointerId); setDragAngle(angleOf(e)); }}
        onPointerMove={(e) => { if (dragAngle !== null) setDragAngle(angleOf(e)); }}
        onPointerUp={(e) => { if (dragAngle === null) return; const i = indexForAngle(angleOf(e), N); setDragAngle(null); jump(i); }}
        onPointerCancel={() => setDragAngle(null)}
        onLostPointerCapture={() => setDragAngle(null)}>
        <svg viewBox="-52 -52 104 104">
          {chapters.map((c, i) => { const a = (angleForIndex(i, N) * Math.PI) / 180; const x = Math.sin(a) * 44, y = -Math.cos(a) * 44;
            return (<g key={c.id} data-tick className={`${s.tick} ${i === idx ? s.on : ''}`} onClick={() => jump(i)}>
              <circle cx={x} cy={y} r={7} /><text x={x} y={y + 3} textAnchor="middle">{i + 1}</text></g>); })}
          <g style={{ transform: `rotate(${knobAngle}deg)`, transition: springy ? 'transform .35s cubic-bezier(.3,1.5,.5,1)' : 'none' }}>
            <circle r={30} className={s.knob} />
            {Array.from({ length: 24 }, (_, k) => <line key={k} x1={0} y1={-22} x2={0} y2={-18} className={s.grip} transform={`rotate(${k * 15})`} />)}
            <rect x={-2} y={-27} width={4} height={13} rx={2} fill="var(--apricot)" />
          </g>
        </svg>
      </div>
    </div>
  );
}
