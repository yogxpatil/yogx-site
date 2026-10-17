'use client';
import { useEffect, useRef } from 'react';
import { stepBodies, restartSchedule, knockSet, type Body } from '@/lib/hero/letterPhysics';
import { isLite } from '@/lib/tier';
import { looseStore } from '@/lib/hero/looseStore';
import { emitRobo } from '@/lib/robo/bus';
import { useReducedMotion } from '@/lib/useReducedMotion';
import s from './BreakableHeadline.module.css';

const IDLE_MS = 3000;      // no touching this long: rollout restart
const FLY_MS = 420;        // one letter's flight home
const THROW_WINDOW = 80;   // ms of pointer moves the throw speed is taken from
const MAX_THROW = 4000;    // px/s
const KNOCK_PER_FRAME = 4; // B: letters loosened per frame
const HOLD_MS = 220;       // a finger must rest this long on a letter before it lifts (else it is a scroll)
const TICK_MS = 900;
const LITE_BODIES = 12;     // lite tier (weak device): at most this many letters loose at once

const pickFont = ({ fontSize, fontFamily, fontWeight, letterSpacing, color }: CSSStyleDeclaration) => ({ fontSize, fontFamily, fontWeight, letterSpacing, color });

type Spot = { home: { x: number; y: number }; w: number; h: number; font: ReturnType<typeof pickFont> };
type Sample = { t: number; x: number; y: number };
type Item = {
  i: number; slot: HTMLElement; copy: HTMLSpanElement; b: Body; home: { x: number; y: number };
  fly: { t0: number; x: number; y: number; rot: number } | null;
  drag: { id: number; mouse: boolean; ox: number; oy: number; samples: Sample[] } | null;
  shown: string;
  /** font size (px): places the tick just above the cap height, whatever the letter's box looks like */
  fs: number;
};

/** The hero h1, with letters you can grab and throw. The real h1 text never changes (screen readers + SEO): the
 *  flying letters are aria-hidden copies in a layer over the hero, and each slot only turns invisible (layout kept,
 *  so the painted Alchemist plane and the portal's O stay measured right). Letters to grab carry `data-letter`.
 *  Low-end budget: one rAF loop, only while a letter is loose; transforms only; every layout read happens at grab. */
export function BreakableHeadline({ className, children }: { className?: string; children: React.ReactNode }) {
  const h1 = useRef<HTMLHeadingElement>(null), layer = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const h = h1.current, ov = layer.current; if (!h || !ov || reduce) return;
    h.classList.add(s.on);
    const sticky = h.closest<HTMLElement>('[data-hero-sticky]');
    // the flag sits on the blob layer itself, not the hero: an attribute on the hero would restyle the whole hero subtree
    const blobLayer = sticky?.querySelector<HTMLElement>('[data-blob-layer]') ?? null;
    const letters = [...h.querySelectorAll<HTMLElement>('[data-letter]')];
    const items = new Map<number, Item>();
    const sim: Body[] = [];
    const knock: { i: number; m: Spot }[] = [];
    let raf = 0, last = 0, idle: ReturnType<typeof setTimeout> | undefined, hold: ReturnType<typeof setTimeout> | undefined;
    let frame = { left: 0, top: 0, k: 1 }, box = { w: 1, h: 1 }, swallowClick = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (f: () => void, ms: number) => { const t = setTimeout(() => { timers.delete(t); f(); }, ms); timers.add(t); };

    const setLoose = (on: boolean) => {
      if (on) blobLayer?.setAttribute('data-letters-loose', ''); else blobLayer?.removeAttribute('data-letters-loose');
      if (looseStore.get().loose !== on) looseStore.set({ loose: on });
    };
    /** Layer position and the portal zoom factor: read once per grab, never inside the loop. */
    const measureFrame = () => {
      const r = ov.getBoundingClientRect();
      frame = { left: r.left, top: r.top, k: ov.offsetWidth > 0 && r.width > 0 ? r.width / ov.offsetWidth : 1 };
      box = { w: ov.offsetWidth || innerWidth, h: ov.offsetHeight || innerHeight };
    };
    const toStage = (cx: number, cy: number) => ({ x: (cx - frame.left) / frame.k, y: (cy - frame.top) / frame.k });

    /** Read a slot's box and font (layout reads only: do all of them before any write, or each one forces a layout). */
    const measure = (i: number): Spot => {
      const r = letters[i].getBoundingClientRect(), k = frame.k;
      return { home: { x: (r.left - frame.left) / k, y: (r.top - frame.top) / k }, w: Math.max(1, r.width / k), h: Math.max(1, r.height / k), font: pickFont(getComputedStyle(letters[i])) };
    };
    const loosen = (i: number, m: Spot = measure(i)): Item => {
      const have = items.get(i); if (have) return have;
      const slot = letters[i], { home, w, h: hh, font } = m;
      const copy = document.createElement('span');
      copy.className = s.copy; copy.dataset.copy = String(i); copy.textContent = (slot.textContent ?? '').trim();
      // the line box is the letter's own height, so the glyph sits exactly where the slot's glyph sat
      Object.assign(copy.style, font, { width: `${w}px`, height: `${hh}px`, lineHeight: `${hh}px`, transform: `translate3d(${home.x}px,${home.y}px,0)` });
      ov.appendChild(copy);
      slot.style.visibility = 'hidden';
      const it: Item = { i, slot, copy, home, fly: null, drag: null, shown: '', fs: parseFloat(font.fontSize) || hh, b: { x: home.x, y: home.y, vx: 0, vy: 0, w, h: hh, rot: 0, vr: 0, rest: false } };
      items.set(i, it);
      setLoose(true);
      return it;
    };

    const land = (it: Item) => {
      it.slot.style.visibility = ''; it.copy.remove(); items.delete(it.i);
      const tick = document.createElement('span'); tick.className = s.tick; tick.dataset.tick = '';
      // anchor letters have a taller box than the others: centre on the box, then rise by about half a cap height
      tick.style.transform = `translate3d(${it.home.x + it.b.w * 0.5 - 6}px,${it.home.y + it.b.h * 0.5 - it.fs * 0.42 - 18}px,0)`;
      tick.appendChild(document.createElement('i')).textContent = '✓';
      ov.appendChild(tick); later(() => tick.remove(), TICK_MS);
      if (!items.size) setLoose(false);
    };

    const loop = () => {
      const now = performance.now(), dt = (now - last) / 1000; last = now;
      for (const q of knock.splice(0, KNOCK_PER_FRAME)) kick(loosen(q.i, q.m));
      sim.length = 0;
      let busy = knock.length > 0;
      items.forEach((it) => {
        if (it.drag) { busy = true; return; }
        if (it.fly) {
          busy = true;
          const p = Math.min(1, Math.max(0, (now - it.fly.t0) / FLY_MS)), e = 1 - (1 - p) ** 3;
          const lift = Math.sin(Math.PI * p) * Math.min(140, Math.hypot(it.home.x - it.fly.x, it.home.y - it.fly.y) * 0.25);
          it.b.x = it.fly.x + (it.home.x - it.fly.x) * e; it.b.y = it.fly.y + (it.home.y - it.fly.y) * e - lift; it.b.rot = it.fly.rot * (1 - e);
          return;
        }
        sim.push(it.b);
      });
      if (sim.length) stepBodies(sim, dt, box);
      items.forEach((it) => {
        if (!it.b.rest || it.drag) busy = true;
        const tf = `translate3d(${it.b.x.toFixed(1)}px,${it.b.y.toFixed(1)}px,0) rotate(${it.b.rot.toFixed(3)}rad)`;
        if (tf !== it.shown) { it.copy.style.transform = tf; it.shown = tf; }
        if (it.fly && now - it.fly.t0 >= FLY_MS) land(it);
      });
      raf = busy && items.size ? requestAnimationFrame(loop) : 0; // everything at rest: the loop stops
    };
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };

    const kick = (it: Item) => {
      if (it.drag) return;
      it.fly = null; it.b.rest = false; it.b.still = 0;
      it.b.vx = (Math.random() - 0.5) * 700; it.b.vy = -(100 + Math.random() * 450); it.b.vr = (Math.random() - 0.5) * 9;
    };
    const armIdle = () => { clearTimeout(idle); idle = setTimeout(restart, IDLE_MS); };
    function restart() {
      knock.length = 0;
      if ([...items.values()].some((it) => it.drag)) return; // the release arms it again
      const order = [...items.values()].filter((it) => !it.fly).sort((a, b) => a.i - b.i); if (!order.length) return;
      emitRobo({ type: 'restart' });
      const now = performance.now(), delays = restartSchedule(order.length);
      order.forEach((it, j) => { it.fly = { t0: now + delays[j], x: it.b.x, y: it.b.y, rot: it.b.rot }; it.b.rest = true; });
      wake();
    }

    const grab = (i: number, e: PointerEvent) => {
      if (!items.size) measureFrame();
      // lite tier at its cap: the longest-loose letter snaps home to make room
      if (isLite() && !items.has(i) && items.size >= LITE_BODIES) { const old = [...items.values()].find((x) => !x.drag); if (old) land(old); }
      const it = loosen(i), p = toStage(e.clientX ?? 0, e.clientY ?? 0);
      clearTimeout(idle);
      it.fly = null; it.b.rest = false; it.b.vx = it.b.vy = it.b.vr = 0; it.b.still = 0;
      it.drag = { id: e.pointerId ?? 0, mouse: e.pointerType !== 'touch' && e.pointerType !== 'pen', ox: p.x - it.b.x, oy: p.y - it.b.y, samples: [{ t: performance.now(), x: p.x, y: p.y }] };
      try { it.copy.setPointerCapture?.(e.pointerId); } catch { /* the pointer is already gone */ }
      swallowClick = true;
      wake();
    };
    const dragged = (id: number) => [...items.values()].find((it) => it.drag?.id === id);

    const onDown = (e: PointerEvent) => {
      if (e.button !== undefined && e.button !== 0) return;
      const t = e.target as Element | null, copy = t?.closest?.<HTMLElement>('[data-copy]'), slot = t?.closest?.<HTMLElement>('[data-letter]');
      const i = copy ? Number(copy.dataset.copy) : slot ? letters.indexOf(slot) : -1; if (i < 0) return;
      if (e.pointerType === 'touch') {
        // a finger that moves before the hold is a scroll: the browser takes it and sends pointercancel
        clearTimeout(hold); hold = setTimeout(() => grab(i, e), HOLD_MS);
        return;
      }
      e.preventDefault(); // no text selection while dragging
      grab(i, e);
    };
    const onMove = (e: PointerEvent) => {
      const it = dragged(e.pointerId ?? 0); if (!it?.drag) return;
      const p = toStage(e.clientX ?? 0, e.clientY ?? 0), now = performance.now(), d = it.drag;
      it.b.x = Math.min(Math.max(p.x - d.ox, 0), box.w - it.b.w); it.b.y = Math.min(p.y - d.oy, box.h - it.b.h);
      d.samples.push({ t: now, x: p.x, y: p.y });
      while (d.samples.length > 2 && now - d.samples[0].t > THROW_WINDOW) d.samples.shift();
      it.b.rot = Math.max(-0.5, Math.min(0.5, (p.x - d.samples[0].x) * 0.004)); // a little lean into the drag
    };
    const onUp = (e: PointerEvent) => {
      clearTimeout(hold);
      // there is only one mouse: its release ends a mouse drag even if the ids disagree (a lost capture must not leave a
      // letter stuck in the hand, which would also block the restart forever)
      const it = dragged(e.pointerId ?? 0) ?? (e.pointerType === 'mouse' ? [...items.values()].find((x) => x.drag?.mouse) : undefined);
      if (!it?.drag) return;
      const d = it.drag, now = performance.now(), p = toStage(e.clientX ?? 0, e.clientY ?? 0);
      d.samples.push({ t: now, x: p.x, y: p.y });
      const recent = d.samples.filter((q) => now - q.t <= THROW_WINDOW), a = recent[0] ?? d.samples[0], span = (now - a.t) / 1000;
      const clamp = (v: number) => Math.max(-MAX_THROW, Math.min(MAX_THROW, v));
      if (e.type !== 'pointercancel' && span > 0.004) { it.b.vx = clamp((p.x - a.x) / span); it.b.vy = clamp((p.y - a.y) / span); }
      it.b.vr = it.b.vx * 0.004;
      it.drag = null;
      armIdle(); wake();
      setTimeout(() => { swallowClick = false; }, 0);
    };
    // the hero's own click splashes the blob (with a sound): a grab is not that click
    const onClick = (e: MouseEvent) => { if (swallowClick) { e.stopPropagation(); swallowClick = false; } };
    const onTouchMove = (e: TouchEvent) => { if ([...items.values()].some((it) => it.drag)) e.preventDefault(); };
    const onTouchEnd = () => clearTimeout(hold);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'b' && e.key !== 'B') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (sticky?.dataset.heroHidden === '1') return;
      const r = h.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; // only on the hero
      if (!items.size) measureFrame();
      // every read now, in one layout; the writes ripple out a few letters per frame (a domino knock, and no single
      // frame has to build all the copies at once)
      knock.length = 0;
      const cap = isLite() ? LITE_BODIES : Infinity;
      items.forEach(kick);
      knockSet(letters.length, cap).filter((i) => !items.has(i)).slice(0, Math.max(0, cap - items.size)).forEach((i) => knock.push({ i, m: measure(i) }));
      armIdle(); wake();
    };
    // a resize moves every slot: put the letters straight back rather than fly them to stale spots
    const onResize = () => { clearTimeout(idle); knock.length = 0; items.forEach((it) => { if (!it.drag) land(it); }); };

    stepBodies([{ x: 0, y: 0, vx: 0, vy: 0, w: 1, h: 1, rot: 0, vr: 0, rest: false }], 1 / 60, { w: 10, h: 10 }); // warm-up: the first throw does not pay to compile it
    h.addEventListener('pointerdown', onDown); ov.addEventListener('pointerdown', onDown);
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
    addEventListener('click', onClick, true); addEventListener('keydown', onKey); addEventListener('resize', onResize);
    h.addEventListener('touchmove', onTouchMove, { passive: false }); ov.addEventListener('touchmove', onTouchMove, { passive: false });
    h.addEventListener('touchend', onTouchEnd);
    return () => {
      h.classList.remove(s.on);
      cancelAnimationFrame(raf); clearTimeout(idle); clearTimeout(hold); timers.forEach(clearTimeout);
      items.forEach((it) => { it.slot.style.visibility = ''; it.copy.remove(); }); items.clear();
      ov.querySelectorAll('[data-tick]').forEach((n) => n.remove());
      setLoose(false);
      h.removeEventListener('pointerdown', onDown); ov.removeEventListener('pointerdown', onDown);
      removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
      removeEventListener('click', onClick, true); removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      h.removeEventListener('touchmove', onTouchMove); ov.removeEventListener('touchmove', onTouchMove); h.removeEventListener('touchend', onTouchEnd);
    };
  }, [reduce]);

  return (
    <>
      <h1 ref={h1} className={className} tabIndex={-1}>{children}</h1>
      <div ref={layer} className={s.layer} aria-hidden data-letter-layer />
    </>
  );
}
