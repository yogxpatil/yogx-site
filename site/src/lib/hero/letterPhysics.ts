/** Tiny letter physics for the breakable headline. Pure: no DOM. Boxes are axis-aligned; `rot` is for the look only.
 *  Units: px and seconds. `still` is how long (s) the body has been slower than REST_SPEED. */
export type Body = { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; rest: boolean; still?: number };

const E = 0.35;            // restitution
const KILL = 90;           // an impact slower than this (px/s) does not bounce: it settles
const REST_SPEED = 8;      // px/s
const REST_TIME = 0.3;     // s
const GROUND_FRICTION = 6; // 1/s: how fast sliding stops on the floor or on another letter
const AIR = 0.15;          // 1/s
const MAX_SUB = 1 / 120;   // substep (s): a 100 ms frame on a slow PC still cannot tunnel through the floor
const MAX_DT = 0.1;        // longer gaps (tab switch) are clamped

const overlapX = (a: Body, b: Body) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
const overlapY = (a: Body, b: Body) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

/** A resting body stays at rest only while something holds it up (the floor, or another letter right under it). */
function supported(b: Body, bs: Body[], box: { h: number }): boolean {
  if (b.y + b.h >= box.h - 0.5) return true;
  return bs.some((o) => o !== b && overlapX(b, o) > 0.5 && Math.abs(b.y + b.h - o.y) <= 1);
}

function bounce(v: number): number { return Math.abs(v) < KILL ? 0 : -v * E; }

function sub(bs: Body[], dt: number, box: { w: number; h: number }, g: number): void {
  for (const b of bs) {
    if (b.rest) continue;
    b.vy += g * dt;
    const air = 1 - AIR * dt; b.vx *= air; b.vr *= air;
    b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
    if (b.y + b.h > box.h) { b.y = box.h - b.h; if (b.vy > 0) b.vy = bounce(b.vy); b.vx *= 1 - Math.min(1, GROUND_FRICTION * dt); b.vr *= 1 - Math.min(1, GROUND_FRICTION * dt); }
    if (b.x < 0) { b.x = 0; if (b.vx < 0) b.vx = bounce(b.vx); }
    if (b.x + b.w > box.w) { b.x = box.w - b.w; if (b.vx > 0) b.vx = bounce(b.vx); }
    if (b.y < -box.h) { b.y = -box.h; if (b.vy < 0) b.vy = 0; } // thrown far up: a ceiling well above the hero
  }
  // AABB stacking: push apart along the smaller overlap. Resting bodies act as solid ground.
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i], b = bs[j];
    if (a.rest && b.rest) continue;
    const ox = overlapX(a, b), oy = overlapY(a, b);
    if (ox <= 0 || oy <= 0) continue;
    const wa = a.rest ? 0 : b.rest ? 1 : 0.5, wb = 1 - wa; // share of the push each one takes
    if (oy <= ox) {
      const [up, lo, wu, wl] = a.y + a.h / 2 < b.y + b.h / 2 ? [a, b, wa, wb] : [b, a, wb, wa];
      // never push the lower one through the floor
      const room = Math.max(0, box.h - (lo.y + lo.h)), down = Math.min(oy * wl, room);
      up.y -= oy - down; lo.y += down;
      const rel = up.vy - lo.vy;
      if (rel > 0) {
        const back = rel < KILL ? 0 : rel * E; // the closing speed that comes back as a bounce
        if (lo.rest || wu === 1 || room <= 0.01) up.vy = lo.vy - back; // the lower one cannot give way: it acts as ground
        else { const m = (up.vy + lo.vy) / 2; up.vy = m - back / 2; lo.vy = m + back / 2; }
      }
      const f = 1 - Math.min(1, GROUND_FRICTION * dt); up.vx = lo.vx + (up.vx - lo.vx) * f; up.vr *= f;
    } else {
      const [l, r, wl, wr] = a.x < b.x ? [a, b, wa, wb] : [b, a, wb, wa];
      l.x -= ox * wl; r.x += ox * wr;
      if (l.x < 0) { r.x -= l.x; l.x = 0; }
      if (r.x + r.w > box.w) { l.x -= r.x + r.w - box.w; r.x = box.w - r.w; }
      const rel = l.vx - r.vx;
      if (rel > 0) { const k = rel * (1 + E) / 2; if (!l.rest) l.vx -= k; if (!r.rest) r.vx += k; }
    }
  }
  for (const b of bs) {
    if (b.rest) { if (!supported(b, bs, box)) { b.rest = false; b.still = 0; } continue; }
    const grounded = supported(b, bs, box);
    if (grounded && Math.hypot(b.vx, b.vy) < REST_SPEED) {
      b.still = (b.still ?? 0) + dt;
      if (b.still >= REST_TIME) { b.rest = true; b.vx = b.vy = b.vr = 0; }
    } else b.still = 0;
  }
}

/** Advance all bodies by `dt` seconds inside `box` (gravity `g` px/s²): floor + wall bounce, friction, stacking. */
export function stepBodies(bs: Body[], dt: number, box: { w: number; h: number }, g = 2400): void {
  const t = Math.min(Math.max(dt, 0), MAX_DT);
  const n = Math.max(1, Math.ceil(t / MAX_SUB));
  for (let i = 0; i < n; i++) sub(bs, t / n, box, g);
}

/** Per-letter delays (ms) for the fly-back, like pods coming back one by one. */
export function restartSchedule(n: number, stagger = 90): number[] {
  return Array.from({ length: n }, (_, i) => i * stagger);
}

/** Which letters (indices) B knocks down: all of them, or at most `cap` spread evenly from the first to the last
 *  (lite tier: a weak device simulates at most 12 bodies). */
export function knockSet(n: number, cap: number): number[] {
  if (n <= cap) return Array.from({ length: n }, (_, i) => i);
  if (cap <= 1) return cap === 1 ? [0] : [];
  return Array.from({ length: cap }, (_, i) => Math.round((i * (n - 1)) / (cap - 1)));
}
