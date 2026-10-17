/** How much motion this device gets. Pure: no DOM (the live value sits in lib/tier.ts).
 *  full  = everything (WebGL blob, grain, every loop).
 *  lite  = a weak device: SVG blob, no grain, scenery loops still, Robo walks, short intro, fewer flying letters.
 *  still = the visitor asked for reduced motion. */
export type Tier = 'full' | 'lite' | 'still';
export type TierInput = { cores?: number; memory?: number; saveData?: boolean; reduce: boolean; fps?: number };

/** Below this many frames a second (measured over 1 s) the device is weak whatever its hardware says. */
export const MIN_FPS = 45;
const WEAK = 4; // ≤ 4 cores or ≤ 4 GB of memory

/** A hint the browser did not give (undefined, or 0) never makes a device weak. */
const weak = (n?: number) => !!n && n > 0 && n <= WEAK;

export function perfTier({ cores, memory, saveData, reduce, fps }: TierInput): Tier {
  if (reduce) return 'still';
  if (weak(cores) || weak(memory) || saveData || (fps !== undefined && fps < MIN_FPS)) return 'lite';
  return 'full';
}

/** Frames per second from rAF timestamps (ms); undefined with fewer than two. */
export function fpsOver(stamps: number[]): number | undefined {
  if (stamps.length < 2) return undefined;
  const span = stamps[stamps.length - 1] - stamps[0];
  return span > 0 ? ((stamps.length - 1) * 1000) / span : undefined;
}

/** Frame gaps longer than this (ms) are not counted: a hidden tab, a stall while the page loads something. */
export const MAX_GAP = 100;

/** One sampling window: is it a sign of a weak device? Frames per second over the gaps up to MAX_GAP only; a steady
 *  ~30 fps (a battery saver or a 30 Hz display capping the frame rate, not a slow device) never counts as weak.
 *  undefined = too little to tell (mostly long gaps). */
export function weakWindow(stamps: number[]): boolean | undefined {
  const gaps: number[] = [];
  for (let i = 1; i < stamps.length; i++) { const d = stamps[i] - stamps[i - 1]; if (d > 0 && d <= MAX_GAP) gaps.push(d); }
  if (gaps.length < 10) return undefined;
  const fps = (gaps.length * 1000) / gaps.reduce((a, b) => a + b, 0);
  if (fps >= MIN_FPS) return false;
  const capped = gaps.filter((d) => Math.abs(d - 1000 / 30) <= 3).length >= gaps.length * 0.9;
  return !capped;
}

/** Runs in <head> before first paint, so the first frame is already the right tier (no WebGL mounted on a weak PC,
 *  no grain flash). It repeats perfTier's hardware rule (the fps part comes later); a unit test keeps them in step. */
export const TIER_SCRIPT =
  "var t='full';try{var n=navigator,c=n.hardwareConcurrency,m=n.deviceMemory,k=n.connection;" +
  "if(matchMedia('(prefers-reduced-motion: reduce)').matches)t='still';" +
  "else if((c>0&&c<=4)||(m>0&&m<=4)||(k&&k.saveData))t='lite'}catch(e){}document.documentElement.dataset.tier=t;";
