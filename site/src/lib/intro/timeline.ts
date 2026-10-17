/** The automatic intro, as data: which version plays, and when each beat (cue) happens. Pure: no DOM. */

export type IntroKind = 'first' | 'return' | 'none';
export type CueId =
  | 'robo-in' | 'plug' | 'spark' | 'flicker' | 'rings' | 'swell' | 'flood' | 'settle' | 'headline' | 'robo-perch' | 'done';
export type Cue = { at: number; id: CueId };

/** reduced motion and "back from the fast lane" get no intro; a visitor who has seen it, or on a weak device (lite
 *  tier), gets the short one. */
export function introKind({ reduce, seen, returning, lite = false }: { reduce: boolean; seen: boolean; returning: boolean; lite?: boolean }): IntroKind {
  if (reduce || returning) return 'none';
  return seen || lite ? 'return' : 'first';
}

// First visit, ~3.4 s. Robo runs in (0.7 s); the rig's jump squashes for 180 ms and peaks ~480 ms after take-off,
// so the bulb meets the socket at plug + 480: the spark, flicker and rings hang off that moment. The perch leap is the
// rig's 1 s jump, finished before done (opening the site is the heaviest commit: Robo stands still through it); then he waves.
const FIRST: Cue[] = [
  { at: 0, id: 'robo-in' },
  { at: 700, id: 'plug' },
  { at: 1180, id: 'spark' },
  { at: 1240, id: 'flicker' },
  { at: 1520, id: 'rings' },
  { at: 1700, id: 'swell' },
  { at: 1900, id: 'flood' },
  { at: 2080, id: 'settle' },
  { at: 2340, id: 'headline' },
  { at: 2360, id: 'robo-perch' },
  { at: 3400, id: 'done' },
];

// Return visit, ~0.8 s: flicker, swell, settle (and the headline rise).
const RETURN: Cue[] = [
  { at: 0, id: 'flicker' },
  { at: 160, id: 'swell' },
  { at: 300, id: 'flood' },
  { at: 420, id: 'settle' },
  { at: 520, id: 'headline' },
  { at: 800, id: 'done' },
];

export function introPlan(kind: IntroKind): Cue[] {
  if (kind === 'first') return FIRST.map((c) => ({ ...c }));
  if (kind === 'return') return RETURN.map((c) => ({ ...c }));
  return [{ at: 0, id: 'done' }];
}

/** Gap between two cues of a plan (ms); 0 when either is missing. */
export function gap(plan: Cue[], from: CueId, to: CueId): number {
  const a = plan.find((c) => c.id === from), b = plan.find((c) => c.id === to);
  return a && b ? Math.max(0, b.at - a.at) : 0;
}

/** Keyframes for a hop along a parabola from (x0,y0) to (x1,y1), peaking `lift` px above the higher end.
 *  Squash on take-off, stretch in the air, squash on landing, settle: transforms only. */
export function hopFrames(x0: number, y0: number, x1: number, y1: number, lift: number, steps = 8): Keyframe[] {
  const top = Math.min(y0, y1) - lift;
  const out: Keyframe[] = [{ transform: `translate(${x0}px,${y0}px) scale(1.12,.86)`, offset: 0 }];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // quadratic Bezier through the peak: a real arc, not a straight line
    const x = x0 + (x1 - x0) * t;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (2 * top - (y0 + y1) / 2) + t * t * y1;
    const k = t < 0.5 ? `scale(.94,1.08)` : t < 1 ? `scale(.97,1.04)` : `scale(1.1,.88)`;
    out.push({ transform: `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) ${k}`, offset: 0.12 + 0.76 * t });
  }
  out.push({ transform: `translate(${x1}px,${y1}px) scale(1)`, offset: 1 });
  return out;
}
