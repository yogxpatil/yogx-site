import { clamp, easeInOutCubic as ez } from '@/lib/math';

/** Where the last quote becomes fully formed: it then holds for the remaining 30% of the section. */
export const LAST_FORMED = 0.7;
/** Length of one fold (the old quote folds out while the next one folds in). */
export const FOLD = 0.07;

/** Progress at which fold `i` (quote i out, quote i+1 in) is finished. Spread evenly so every quote gets the same hold. */
const foldEnd = (i: number, n: number) => (LAST_FORMED * (i + 1)) / (n - 1);

export type QuoteState = {
  /** 0 = flat and legible, 1 = fully hinged away */
  bend: number;
  phase: 'in' | 'out';
  opacity: number;
  t1: string; t3: string; t2Opacity: number; t2Transform: string;
};

/** One quote's hinge: folding in is today's tunnel (bent, close, scaling down to flat); folding out hinges back into the distance. */
function quoteAt(p: number, i: number, n: number): QuoteState {
  const kIn = i === 0 ? 1 : ez(clamp((p - (foldEnd(i - 1, n) - FOLD)) / FOLD));
  const kOut = i === n - 1 ? 0 : ez(clamp((p - (foldEnd(i, n) - FOLD)) / FOLD));
  const out = kOut > 0, u = out ? kOut : 1 - kIn, k = 1 - u;
  const sc = out ? 1 - u * 0.35 : 1 + u * 0.5;
  return {
    bend: u, phase: out ? 'out' : 'in',
    // edge-on text is unreadable, so each quote is gone before it is fully hinged: only one is legible at a time
    opacity: clamp(1 - u * 1.6),
    t1: `rotateX(${u * 78}deg) translateY(${u * -12}vh) scale(${sc})`,
    t3: `rotateX(${-u * 78}deg) translateY(${u * 12}vh) scale(${sc})`,
    t2Opacity: clamp(k * 1.6 - 0.4),
    t2Transform: `scale(${0.8 + k * 0.2})`,
  };
}

/** Which quote is the legible one at progress p (the first one past the midpoint of its fold). */
export function activeQuote(p: number, n: number): number {
  let a = 0;
  for (let i = 0; i < n - 1; i++) if (p >= foldEnd(i, n) - FOLD / 2) a = i + 1;
  return a;
}

/**
 * State of every quote at section progress p. Pure in p, so scrubbing either way gives the same picture.
 * Reduced motion: no hinge; quotes swap by opacity at the same scroll points.
 */
export function manifestoState(p: number, n: number, reduce = false): { active: number; quotes: QuoteState[] } {
  const active = activeQuote(p, n);
  const quotes = Array.from({ length: n }, (_, i): QuoteState => {
    if (!reduce) return quoteAt(p, i, n);
    return { bend: 0, phase: 'in', opacity: i === active ? 1 : 0, t1: 'none', t3: 'none', t2Opacity: 1, t2Transform: 'none' };
  });
  return { active, quotes };
}

/**
 * Font size (vw) for a quote's heavy lines so the longest fits `fitVw` of the viewport width.
 * 0.54em is the measured average advance of heavy Inter Tight capitals at -0.05em tracking (word spaces included),
 * checked in the browser: the longest quote lands at ~89vw.
 */
export function quoteSizeVw(lines: readonly string[], cap = 12.5, fitVw = 90): number {
  const longest = Math.max(...lines.map((l) => l.length));
  return Math.floor(Math.min(cap, fitVw / (longest * 0.54)) * 100) / 100;
}
