export type Sat = { x: number; y: number; k: number; w: number; ph: number; rf: number };
export type Blob = { mx: number; my: number; R: number; pulse: number; sats: Sat[]; lastT?: number };

// The constants below were tuned per 60 Hz frame; FRAME_MS converts them to real time.
const FRAME_MS = 16.67;
const MAX_DT = 100;

export function createBlob(n = 7): Blob {
  return { mx: 0, my: 0, R: 0, pulse: 0,
    sats: Array.from({ length: n - 1 }, (_, i) => ({ x: 0, y: 0, k: 0.05 + i * 0.018, w: 0.0006 + i * 0.00017, ph: i * 1.9, rf: 0.4 + ((i * 37) % 5) * 0.06 })) };
}

/** Where the idle blob wants to be at time `now` (ms), and its idle radius, in stage coordinates. */
export function idleTarget(now: number, size: { w: number; h: number }): { x: number; y: number; r: number } {
  return { x: size.w * (0.36 + 0.2 * Math.sin(now / 2600)), y: size.h * (0.62 + 0.08 * Math.cos(now / 1900)), r: Math.min(size.w, size.h) * 0.15 };
}

export function stepBlob(b: Blob, t: number, target: { x: number; y: number; active: boolean; touch?: boolean }, size: { w: number; h: number }): void {
  const now = Number.isFinite(t) ? t : 0;
  const first = b.lastT === undefined;
  // Time since the last call, in ms. A repeated or backwards t (e.g. t = 0 in a settle loop) counts as one frame.
  let dt = first ? FRAME_MS : now - (b.lastT as number);
  if (!Number.isFinite(dt) || dt <= 0) dt = FRAME_MS;
  dt = Math.min(dt, MAX_DT);
  b.lastT = now;
  const step = dt / FRAME_MS;
  const ease = (k: number) => 1 - Math.pow(1 - k, step);

  const short = Math.min(size.w, size.h);
  const live = target.active && Number.isFinite(target.x) && Number.isFinite(target.y);
  let tx: number, ty: number, TR: number;
  if (live) { tx = target.x; ty = target.y; TR = short * (target.touch ? 0.24 : 0.2); }
  else ({ x: tx, y: ty, r: TR } = idleTarget(now, size));

  // First call: start the blob on its target, at full size, instead of flying in from (0, 0) and growing from nothing
  // (the intro hands its own blob over at exactly this spot and size).
  if (first) { b.mx = tx; b.my = ty; if (b.R === 0) b.R = TR; }
  b.mx += (tx - b.mx) * ease(0.15); b.my += (ty - b.my) * ease(0.15);
  b.pulse *= Math.pow(0.94, step); b.R += (TR * (1 + b.pulse * 0.7) - b.R) * ease(0.08);
  for (const s of b.sats) {
    const gx = b.mx + Math.cos(now * s.w * 6 + s.ph) * b.R * 0.88, gy = b.my + Math.sin(now * s.w * 7.8 + s.ph) * b.R * 0.72;
    if (first) { s.x = gx; s.y = gy; }
    else { s.x += (gx - s.x) * ease(s.k); s.y += (gy - s.y) * ease(s.k); }
  }
}

export function splashBlob(b: Blob, rand: () => number): void {
  b.pulse = 1;
  for (const s of b.sats) { const a = rand() * Math.PI * 2; s.x += Math.cos(a) * b.R * 2.2; s.y += Math.sin(a) * b.R * 2.2; }
}

export const ballsOf = (b: Blob): [number, number, number][] => [[b.mx, b.my, b.R], ...b.sats.map((s) => [s.x, s.y, b.R * s.rf] as [number, number, number])];

/** Run the idle physics to rest (used for reduced motion, where nothing animates). */
export function settleBlob(b: Blob, size: { w: number; h: number }): void {
  delete b.lastT;
  for (let k = 0; k < 120; k++) stepBlob(b, 0, { x: 0, y: 0, active: false }, size);
}
