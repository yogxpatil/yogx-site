'use client';
import { useEffect, useRef, useState } from 'react';
import { RoboChibi, type Mood } from '@/components/robo/RoboChibi';
import { blobProbe } from '@/components/hero/useBlobDriver';
import { appStore, type Perch } from '@/lib/appState';
import { idleTarget } from '@/lib/blob/physics';
import { introKind, introPlan, hopFrames, type CueId, type IntroKind } from '@/lib/intro/timeline';
import { introSeen, markIntroSeen } from '@/lib/robo/persist';
import { prefersReducedMotion } from '@/lib/useReducedMotion';
import { isLite, sampleFps } from '@/lib/tier';
import s from './Intro.module.css';

type P = { x: number; y: number };
const PHONE = 760;
const SKIP = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
// the rig's jump keyframes (RoboChibi.module.css @keyframes jump): offset, translateY, scaleX, scaleY, rotate — in viewBox units
const JUMP: [number, number, number, number, number][] = [[0, 0, 1, 1, 0], [0.18, 0, 1.18, 0.8, 0], [0.45, -58, 0.9, 1.12, -6], [0.6, -62, 1, 1, 6], [0.84, 0, 1.2, 0.78, 0], [1, 0, 1, 1, 0]];
const JUMP_EASE = 'cubic-bezier(.3,.6,.4,1)';
const BULB: P = { x: 68, y: 44 }; // where Robo holds the bulb, viewBox units: at arm's length ahead of the visor, so his head never covers the socket
const tr = (x: number, y: number, k = '') => `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)${k ? ' ' + k : ''}`;

/** Where a viewBox point of the rig goes under one jump keyframe (transform-origin 32px 77px), as a px offset. */
function rigShift(p: P, [, ty, sx, sy, deg]: (typeof JUMP)[number], k: number): P {
  const a = (deg * Math.PI) / 180, dx = p.x - 32, dy = p.y - 77;
  const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
  return { x: (32 + sx * rx - p.x) * k, y: (77 + sy * ry + ty - p.y) * k };
}

/** Everything the intro needs to know about the screen, measured once before it starts. */
function measure() {
  const w = innerWidth, h = innerHeight, phone = w <= PHONE;
  const size = phone ? 56 : 78, k = size / 92, bw = (size * 76) / 92;
  const L: P = { x: w * 0.5, y: h * 0.46 }; // socket + lamp
  // the hero blob's home: its stage box from the DOM, and the spot the physics starts the idle blob on
  const st = document.querySelector<HTMLElement>('[data-hero-sticky]');
  const r = st?.getBoundingClientRect();
  const sw = st?.offsetWidth || w, sh = st?.offsetHeight || h, z = r && r.width > 0 ? r.width / sw : 1;
  const it = idleTarget(0, { w: sw, h: sh });
  const T: P = { x: (r?.left ?? 0) + it.x * z, y: (r?.top ?? 0) + it.y * z };
  const D = Math.max(40, 2 * it.r * z);
  // the jump spot: the bulb reaches the socket at the apex (~48% of the jump)
  const a = rigShift(BULB, JUMP[2], k), b = rigShift(BULB, JUMP[3], k);
  const apex = { x: a.x + (b.x - a.x) * 0.3, y: a.y + (b.y - a.y) * 0.3 };
  const bulb: P = { x: (BULB.x + 6) * k, y: (BULB.y + 8) * k }; // bulb centre inside the robo box
  const J: P = { x: L.x - bulb.x - apex.x, y: L.y - bulb.y - apex.y };
  const H: P = { x: J.x - size * 0.75, y: J.y }; // after the startled hop back
  const perch: Perch = phone ? { left: 18, bottom: 22, size } : { left: 16, bottom: 44, size }; // the guide's spot (RoboGuide.module.css)
  const Pp: P = { x: perch.left, y: h - perch.bottom - size };
  const far = Math.max(...[[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => Math.hypot(x - L.x, y - L.y)));
  return { w, h, size, k, bw, L, T, D, J, H, Pp, perch, bulb, far };
}
type M = ReturnType<typeof measure>;

/** The perch leap rides the rig's own 1 s jump: hold still through the squash, travel on an arc while airborne, land at 84%. */
function leapFrames(a: P, b: P, lift: number): Keyframe[] {
  const top = Math.min(a.y, b.y) - lift, c = 2 * top - (a.y + b.y) / 2, out: Keyframe[] = [{ transform: tr(a.x, a.y), offset: 0 }, { transform: tr(a.x, a.y), offset: 0.18 }];
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    out.push({ transform: tr(a.x + (b.x - a.x) * t, (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c + t * t * b.y), offset: 0.18 + 0.66 * t });
  }
  out.push({ transform: tr(b.x, b.y), offset: 1 });
  return out;
}

/**
 * The automatic intro (replaces the click-to-enter gate). First visit, ~3.4 s: Robo runs in with a glowing bulb, jumps and
 * plugs it in, a spark, the lamp flickers, rings pulse, the light swells into the apricot blob and paper floods out from it;
 * the blob settles exactly on the hero blob's spot and hands over, the headline rises, Robo leaps to his perch and waves.
 * Return visit: the 0.8 s version. Reduced motion / back from the fast lane: none.
 * Every animation is WAAPI on transform, opacity or clip-path, created up front with delays so the compositor runs them.
 * Any pointer, key, wheel or touch skips to the end state at once. Calls onDone exactly once.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null), orb = useRef<HTMLDivElement>(null), robo = useRef<HTMLDivElement>(null), bulb = useRef<HTMLSpanElement>(null);
  const socket = useRef<HTMLSpanElement>(null), spark = useRef<HTMLSpanElement>(null), glow = useRef<HTMLSpanElement>(null), paper = useRef<HTMLDivElement>(null), back = useRef<HTMLDivElement>(null);
  const rings = useRef<(HTMLSpanElement | null)[]>([]);
  const doneRef = useRef(onDone); doneRef.current = onDone;
  const [kind, setKind] = useState<IntroKind | null>(null);
  const [gone, setGone] = useState(false);
  const [mood, setMood] = useState<Mood>('run');
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const [sparks, setSparks] = useState(0);
  const [size, setSize] = useState(78);

  useEffect(() => {
    const reduce = prefersReducedMotion();
    const returning = document.documentElement.classList.contains('yogx-returning');
    const k = introKind({ reduce, seen: introSeen(), returning, lite: isLite() });
    setKind(k);
    if (innerWidth <= PHONE) setSize(56);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const anims: Animation[] = [];
    let finished = false, cancelled = false, raf = 0;
    const later = (ms: number, fn: () => void) => { timers.push(setTimeout(() => { if (!cancelled) fn(); }, ms)); };
    const A = (el: Element | null | undefined, frames: Keyframe[], o: KeyframeAnimationOptions) => {
      if (!el || typeof el.animate !== 'function') return null;
      try { const a = el.animate(frames, { fill: 'forwards', ...o }); anims.push(a); return a; } catch { return null; }
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      markIntroSeen();
      appStore.set({ blobLive: true });
      // judged after the intro, not during its heaviest second (which wrongly dropped capable PCs to lite)
      if (!prefersReducedMotion()) sampleFps();
      doneRef.current();
    };
    const cleanup = () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      for (const ev of SKIP) removeEventListener(ev, skip, true);
    };
    function skip(e?: Event) {
      if (cancelled) return;
      // the input that skips does only that: no chapter jump from a number key, no scroll from the wheel
      if (e && !finished) {
        e.stopImmediatePropagation();
        if (e.type === 'wheel' || e.type === 'touchstart') e.preventDefault();
      }
      cleanup();
      anims.forEach((a) => { try { a.cancel(); } catch { /* already gone */ } });
      finish();
      setGone(true);
    }

    if (k === 'none') {
      finish();
      if (reduce && !returning) later(400, () => setGone(true)); // let the short CSS fade play
      else setGone(true);
      return cleanup;
    }

    for (const ev of SKIP) addEventListener(ev, skip, { capture: true, passive: false });

    const run = (m: M) => {
      const plan = introPlan(k), at = (id: CueId) => plan.find((c) => c.id === id)?.at ?? 0, first = k === 'first';
      const { L, T, D, J, H, Pp, size, bw, far } = m;
      const s0 = 16 / D, oc = (p: P, sc = '') => tr(p.x - D / 2, p.y - D / 2, sc);

      // static placement: one style write each, before anything moves
      const o = orb.current!, place = (el: HTMLElement | null, p: P, wh: number) => { if (el) el.style.transform = tr(p.x - wh / 2, p.y - wh / 2); };
      o.style.width = o.style.height = `${D}px`;
      o.style.transform = oc(L, `scale(${s0})`);
      place(socket.current, { x: L.x, y: L.y + 2 }, 0); place(spark.current, L, 0); place(glow.current, L, 0);
      rings.current.forEach((r) => place(r, L, 0));
      if (paper.current) paper.current.style.clipPath = `circle(0px at ${L.x}px ${L.y}px)`;

      if (first) {
        const rb = robo.current!;
        rb.style.width = `${bw}px`; rb.style.height = `${size}px`;
        if (bulb.current) bulb.current.style.transform = tr(m.bulb.x - 7, m.bulb.y - 7);
        A(socket.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 80 });
        // run in, decelerating into the jump spot
        A(rb, [{ transform: tr(-bw - 40, J.y) }, { transform: tr(J.x, J.y) }], { duration: at('plug'), easing: 'cubic-bezier(.25,.55,.35,1)' });
        later(at('plug'), () => setMood('jump'));
        // the bulb rides the rig's jump exactly (same keyframes, same per-segment easing), then becomes the lamp
        const bk = JUMP.map((j) => { const d = rigShift(BULB, j, m.k); return { transform: tr(m.bulb.x - 7 + d.x, m.bulb.y - 7 + d.y), offset: j[0], easing: JUMP_EASE }; });
        A(bulb.current, bk, { duration: 1000, delay: at('plug') });
        A(bulb.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 60, delay: at('spark') });
        A(spark.current, [{ opacity: 0, transform: tr(L.x, L.y, 'scale(.3)') }, { opacity: 1, transform: tr(L.x, L.y, 'scale(1.4)'), offset: 0.35 }, { opacity: 0, transform: tr(L.x, L.y, 'scale(2.3)') }], { duration: 380, delay: at('spark'), easing: 'ease-out' });
        later(at('spark'), () => setSparks((n) => n + 1));
        // lands at 84%, the jump ends at 100%: then the startled hop back (an arc, squash on both ends)
        const hop = at('plug') + 1000;
        later(hop, () => setMood('idle'));
        A(rb, hopFrames(J.x, J.y, H.x, H.y, size * 0.32), { duration: 360, delay: hop, easing: 'ease-in-out' });
        // the perch leap: the rig's jump again, travelling on an arc; then the wave
        const leap = at('robo-perch');
        later(leap, () => { setFacing('left'); setMood('jump'); });
        A(rb, leapFrames(H, Pp, Math.max(50, Math.hypot(Pp.x - H.x, Pp.y - H.y) * 0.16)), { duration: 1000, delay: leap });
        later(leap + 1000, () => { setFacing('right'); setMood('idle'); });
        // the wave starts once the site has opened (that commit is the heaviest moment), never frozen mid-wave
        later(at('done') + 1, () => requestAnimationFrame(() => requestAnimationFrame(() => { if (!cancelled) setMood('wave'); })));
        A(rb, [{ opacity: 1 }, { opacity: 0 }], { duration: 450, delay: at('done') + 450 }); // the guide fades in on the same spot
      }

      // flicker: the lamp catches (steps, not a fade), with its glow
      const fl = first ? 420 : 300, flick = [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0.15, offset: 0.3 }, { opacity: 1, offset: 0.45 }, { opacity: 0.3, offset: 0.6 }, { opacity: 1 }];
      A(o, flick, { duration: fl, delay: at('flicker'), easing: 'steps(1,end)' });
      A(glow.current, flick, { duration: fl, delay: at('flicker'), easing: 'steps(1,end)' });
      if (first) rings.current.forEach((r, i) => A(r, [{ opacity: 0.9, transform: tr(L.x, L.y, 'scale(1)') }, { opacity: 0, transform: tr(L.x, L.y, 'scale(10)') }], { duration: 650, delay: at('rings') + i * 130, easing: 'ease-out' }));
      // swell: the light grows into the blob, squash and stretch on the way
      const sw = first ? 520 : 360;
      A(o, [
        { transform: oc(L, `scale(${s0})`) },
        { transform: oc(L, 'scale(.44,.34)'), offset: 0.35 },
        { transform: oc(L, 'scale(.68,.8)'), offset: 0.65 },
        { transform: oc(L, 'scale(1.07,.95)'), offset: 0.85 },
        { transform: oc(L, 'scale(1)') },
      ], { duration: sw, delay: at('swell'), easing: 'cubic-bezier(.5,0,.3,1)' });
      A(glow.current, [{ opacity: 1 }, { opacity: 0 }], { duration: sw * 0.6, delay: at('swell') });
      // flood: paper pours out of the light
      A(paper.current, [{ clipPath: `circle(0px at ${L.x}px ${L.y}px)` }, { clipPath: `circle(${Math.ceil(far)}px at ${L.x}px ${L.y}px)` }], { duration: first ? 560 : 420, delay: at('flood'), easing: 'cubic-bezier(.6,0,.3,1)' });
      // settle: an arc down onto the hero blob's spot, overshoot, settle
      const d = Math.hypot(T.x - L.x, T.y - L.y) || 1, ux = (T.x - L.x) / d, uy = (T.y - L.y) / d;
      const mid = { x: (L.x + T.x) / 2, y: (L.y + T.y) / 2 - d * 0.22 }, settleMs = first ? 480 : 360;
      A(o, [
        { transform: oc(L) },
        { transform: oc(mid, 'scale(.97,1.03)'), offset: 0.5 },
        { transform: oc({ x: T.x + ux * d * 0.05, y: T.y + uy * d * 0.05 }, 'scale(1.05,.94)'), offset: 0.82 },
        { transform: oc(T) },
      ], { duration: settleMs, delay: at('settle'), easing: 'cubic-bezier(.45,.05,.35,1)' });
      // headline: the paper lifts off the real hero and the headline rises out of a slot
      const rise = first ? 560 : 420;
      A(back.current, [{ opacity: 1 }, { opacity: 0 }], { duration: first ? 320 : 260, delay: at('headline') });
      A(document.querySelector('[data-hero-sticky] h1'), [
        { transform: 'translateY(42%)', clipPath: 'inset(-30% -5% 42% -5%)', opacity: 0 },
        { opacity: 1, offset: 0.4 },
        { transform: 'none', clipPath: 'inset(-30% -5% 0% -5%)', opacity: 1 },
      ], { duration: rise, delay: at('headline'), easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'none' });
      later(at('done'), finish);
      // the real blob mounts once the light has landed and the headline has stopped moving (its painter measures the
      // headline's letters on mount); its physics starts it on this exact spot at full size, so the light just fades
      later(Math.max(at('settle') + settleMs, at('headline') + rise) + 20, () => { appStore.set({ blobLive: true }); handoff(); });

      // the handoff: once the real blob has drawn, glide the light onto its exact spot (a no-op unless the fallback blob
      // drifted elsewhere) and fade it out over the real one
      let orbOut = false, roboOut = !first;
      const end = () => { if (orbOut && roboOut && finished) setGone(true); };
      later(at('done') + 920, () => { roboOut = true; end(); });
      later(at('done'), end);
      function handoff() {
        let frames = 0, out = false;
        const go = () => {
          if (out || cancelled) return; out = true; cancelAnimationFrame(raf);
          const p = blobProbe(), to = p && p.r > 0 ? { x: p.x, y: p.y } : T;
          A(o, [{ transform: oc(T), opacity: 1 }, { transform: oc(to), opacity: 0 }], { duration: 260, easing: 'ease-out' });
          later(280, () => { orbOut = true; end(); });
        };
        const tick = () => { const p = blobProbe(); if (p && p.r > 0) frames++; if (frames >= 3) go(); else raf = requestAnimationFrame(tick); };
        if (typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(tick);
        later(900, go); // never wait forever on the blob
      }
    };

    // start once the fonts are in and the hero blob has done its one-off setup (code, paint, shader), so none of that
    // heavy work lands inside the animation; the dark stage holds meanwhile (capped)
    let offWarm = () => {};
    const warm = new Promise<void>((res) => {
      if (appStore.get().blobWarm) return res();
      offWarm = appStore.subscribe(() => { if (appStore.get().blobWarm) { offWarm(); res(); } });
    });
    const cap = new Promise((r) => setTimeout(r, 2000));
    // ...and the main thread has gone quiet (the rest of the page's start-up work is done)
    const idle = () => new Promise<void>((r) => {
      const ric = (window as { requestIdleCallback?: (f: () => void, o: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(() => r(), { timeout: 500 }); else setTimeout(r, 50);
    });
    Promise.race([Promise.all([document.fonts?.ready, warm]), cap]).then(idle).then(() => {
      offWarm();
      if (cancelled || finished) return;
      run(measure());
    });
    return () => { offWarm(); cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gone) return null;
  return (
    <div ref={root} data-intro="" data-kind={kind ?? undefined} className={s.intro} aria-hidden="true">
      <div ref={back} className={s.back}>
        <div className={s.dark} />
        <span ref={glow} className={s.glow} />
        <span ref={socket} className={s.socket} />
        {[0, 1, 2].map((i) => <span key={i} ref={(e) => { rings.current[i] = e; }} className={s.ring} />)}
        <span ref={spark} className={s.spark} />
        <div ref={paper} className={s.paper} />
        <span className={`mono ${s.hint}`}>Any key skips</span>
      </div>
      <div ref={orb} className={s.orb} />
      {kind !== 'return' && (
        <div ref={robo} className={s.robo}>
          <RoboChibi mood={mood} facing={facing} gait={0.34} size={size} sparks={sparks} />
          <span ref={bulb} className={s.bulb} />
        </div>
      )}
    </div>
  );
}
