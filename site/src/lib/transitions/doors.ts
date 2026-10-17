import { clamp, easeInOutCubic as ez } from '@/lib/math';
import { chapters } from '@/content/site';
import { jumpToY, pageTop, setScrollEnabled } from '@/lib/scroll';
import { flushScrollFrame } from '@/lib/useScrollFrame';
import { prefersReducedMotion } from '@/lib/useReducedMotion';
import { wait } from '@/lib/wait';
import { appStore } from '@/lib/appState';

export type DoorLabel = { sector: string; name: string };
export type DoorsHandle = { set(pos: number, label: DoorLabel | null, unlocked: boolean): void };

export function zoneValue(top: number, height: number, vh: number) {
  if (!(top < vh && top + height > 0)) return null;
  const p = clamp((vh - top) / (height + vh));
  const c = ez(clamp(p / 0.4)), o = ez(clamp((p - 0.6) / 0.4));
  return { pos: c * (1 - o), unlocked: p > 0.5 };
}
export function pickDoor<T>(zs: { v: ReturnType<typeof zoneValue>; label: T }[]) {
  let best = { pos: 0, unlocked: false, label: null as T | null };
  for (const z of zs) if (z.v && z.v.pos > best.pos) best = { pos: z.v.pos, unlocked: z.v.unlocked, label: z.label };
  return best;
}
export const doorShift = (pos: number) => ({ top: `translateY(${-(1 - pos) * 101}%)`, bottom: `translateY(${(1 - pos) * 101}%)` });
export const isShut = (pos: number) => pos > 0.985;
export const meterLit = (pos: number) => Math.round(pos * 5);
export const sectorDigits = (sec: string) => sec.replace(/\D/g, '').slice(-2);
export const lockText = (unlocked: boolean) => (unlocked ? '◉ UNLOCKED · OPENING' : '⛒ SEALED');

let handle: DoorsHandle | null = null, timed = false, busy = false;
export const setDoorsHandle = (h: DoorsHandle | null) => { handle = h; };
export const doorsTimed = () => timed;

type Frame = (cb: (now: number) => void) => void;
const raf: Frame = (cb) => requestAnimationFrame(cb);
export function runDoors(from: number, to: number, ms: number, label: DoorLabel, frame: Frame = raf, now: () => number = () => performance.now()): Promise<void> {
  return new Promise((resolve) => {
    const t0 = now();
    const step = (n: number) => {
      const k = Math.min((n - t0) / ms, 1);
      handle?.set(from + (to - from) * ez(k), label, to < from);
      if (k < 1) frame(step); else resolve();
    };
    frame(step);
  });
}

/** Dial / key jump: doors shut on a timer, the page jumps behind them, doors reopen (proto lines 877-881).
 *  `accepted` is known immediately: a call while one is running (or to a missing / current chapter) is refused.
 *  The doors always reopen and scrolling always comes back (once the visitor has entered), even if the jump throws. */
export function beginJump(i: number, frame: Frame = raf, now: () => number = () => performance.now()): { accepted: boolean; done: Promise<void> } {
  const refused = { accepted: false, done: Promise.resolve() };
  const c = chapters[i], el = c && typeof document !== 'undefined' ? document.getElementById(c.id) : null;
  if (!el || busy) return refused;
  const vh = typeof innerHeight === 'number' ? innerHeight : 0;
  const tops = chapters.map((x) => document.getElementById(x.id)?.getBoundingClientRect().top ?? Infinity);
  let cur = 0; tops.forEach((t, k) => { if (t <= vh * 0.5 && t !== Infinity) cur = k; });
  if (cur === i && tops.filter((t) => t !== Infinity).length === chapters.length) return refused;
  busy = true; timed = true;
  const D = prefersReducedMotion() ? 150 : 520, label = { sector: String(i + 1).padStart(2, '0'), name: c.name };
  const run = async () => {
    setScrollEnabled(false);
    try {
      await runDoors(0, 1, D, label, frame, now);
      await wait(120);
      jumpToY(pageTop(el) + (i === 0 ? 0 : 2));
      flushScrollFrame();
      await wait(260);
    } finally {
      try { await runDoors(1, 0, D, label, frame, now); }
      finally {
        timed = false; busy = false; flushScrollFrame();
        if (appStore.get().entered) setScrollEnabled(true);
      }
    }
  };
  return { accepted: true, done: run() };
}
export async function jumpWithDoors(i: number, frame: Frame = raf, now: () => number = () => performance.now()): Promise<boolean> {
  const r = beginJump(i, frame, now);
  await r.done;
  return r.accepted;
}
