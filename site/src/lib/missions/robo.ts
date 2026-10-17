export type Mood = 'calm' | 'angry' | 'happy';
export const moodStyle = (m: Mood) => ({
  light: m === 'angry' ? '#ff7a52' : '#f99e67',
  cheekOpacity: m === 'angry' ? 0.8 : 0.28,
  head: m === 'angry' ? 'rotate(-6deg)' : m === 'happy' ? 'rotate(4deg) translateY(-2px)' : 'none',
});
export const eyeOffset = (dx: number, dy: number) => { const a = Math.atan2(dy, dx); return { x: Math.cos(a) * 2.4, y: Math.sin(a) * 1.6 }; };

export type Seg = { t: string; b?: boolean };

/** Robo's route: up from below the screen, then a climb over the app to his corner (left/top in %, rotation in deg). */
const CLIMB = [{ left: 66, top: 30, rot: 0 }, { left: 40, top: 2, rot: -14 }, { left: 6, top: 38, rot: 6 }, { left: 7, top: 36, rot: 0 }];
const smooth = (a: number, b: number, p: number) => { const t = Math.min(1, Math.max(0, (p - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Story thresholds on scene progress. */
export const CC_AT = { rise: [0.05, 0.2], climb: [0.2, 0.4], line0: 0.36, line1: 0.5, line2: 0.64, line3: 0.9, fix: [0.6, 0.88], stamp: 0.9, mug: 0.94 } as const;

/**
 * Everything the CommandCenter scene shows at scene progress p (0..1). Pure, so scrolling back up rewinds each part:
 * Robo rises and climbs, tells his backstory, calms, rows are fixed one by one, VERIFIED stamps, coffee.
 */
export function ccAt(p: number, rows: number) {
  const rise = smooth(CC_AT.rise[0], CC_AT.rise[1], p), climb = smooth(CC_AT.climb[0], CC_AT.climb[1], p);
  let left: number = CLIMB[0].left, top = 110 + (CLIMB[0].top - 110) * rise, rot = 0;
  if (climb > 0) {
    const seg = climb * (CLIMB.length - 1), i = Math.min(CLIMB.length - 2, Math.floor(seg)), f = seg - i, a = CLIMB[i], b = CLIMB[i + 1];
    left = a.left + (b.left - a.left) * f; top = a.top + (b.top - a.top) * f; rot = a.rot + (b.rot - a.rot) * f;
  }
  const stamp = p >= CC_AT.stamp;
  const fixed = Math.floor(Math.min(1, Math.max(0, (p - CC_AT.fix[0]) / (CC_AT.fix[1] - CC_AT.fix[0]))) * rows);
  const line = p >= CC_AT.line3 ? 3 : p >= CC_AT.line2 ? 2 : p >= CC_AT.line1 ? 1 : p >= CC_AT.line0 ? 0 : -1;
  const mood: Mood = stamp ? 'happy' : p >= CC_AT.line1 || p < CC_AT.rise[0] ? 'calm' : 'angry';
  return { left, top, rot, mood, line, fixed, stamp, mug: p >= CC_AT.mug, shake: mood === 'angry' && fixed === 0, moved: p >= CC_AT.climb[1] };
}
