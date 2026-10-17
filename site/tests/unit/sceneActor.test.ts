import { describe, it, expect } from 'vitest';
import { activeLine, hop, sceneRoboOnScreen, speech, stand, walk } from '@/lib/missions/actor';
import { pinnedProgress, pinTravel } from '@/lib/missions/progress';

const A = { x: 0.2, y: 0.8 }, B = { x: 0.6, y: 0.8 };
const steps = (n = 200) => Array.from({ length: n + 1 }, (_, i) => i / n);

describe('hop: an arc with squash and stretch', () => {
  it('starts at a, ends at b, rests (no squash) at both ends', () => {
    expect(hop(A, B, 0)).toMatchObject({ x: 0.2, y: 0.8, sx: 1, sy: 1, rot: 0 });
    expect(hop(A, B, 1)).toMatchObject({ x: 0.6, y: 0.8, sx: 1, sy: 1, rot: 0 });
  });
  it('crouches (squash) before take-off and squashes hardest at touch-down, then recovers', () => {
    const crouch = hop(A, B, 0.15), land = hop(A, B, 0.85), late = hop(A, B, 0.97);
    expect(crouch.x).toBe(A.x); expect(crouch.sy).toBeLessThan(0.85); expect(crouch.sx).toBeGreaterThan(1.1);
    expect(land.x).toBe(B.x); expect(land.sy).toBeLessThan(0.8);
    expect(late.sy).toBeGreaterThan(land.sy); // recovering
  });
  it('flies a parabola: highest in the middle of the air time, stretched, arms up', () => {
    const ys = steps().filter((t) => t > 0.16 && t < 0.84).map((t) => hop(A, B, t, 0.12).y);
    const top = Math.min(...ys);
    expect(top).toBeCloseTo(0.8 - 0.12, 2);
    expect(hop(A, B, 0.5).y).toBeCloseTo(top, 2);
    expect(hop(A, B, 0.5).sy).toBeGreaterThan(1.05);
    expect(hop(A, B, 0.5).mood).toBe('air');
  });
  it('travels forward only and faces where it goes; a hop back faces left', () => {
    const xs = steps().map((t) => hop(A, B, t).x);
    expect(xs.every((x, i) => i === 0 || x >= xs[i - 1])).toBe(true);
    expect(hop(A, B, 0.5).facing).toBe('right'); expect(hop(B, A, 0.5).facing).toBe('left');
  });
  it('the bubble never hops: it rises clear of the arc during the crouch, glides level, and settles as he lands', () => {
    for (const t of steps()) if (t > 0.16 && t < 0.84) expect(hop(A, B, t, 0.12).by).toBeCloseTo(0.8 - 0.12, 6);
    for (const t of steps()) expect(hop(A, B, t, 0.12).by).toBeLessThanOrEqual(hop(A, B, t, 0.12).y + 1e-9); // never below his feet
    let prev = hop(A, B, 0).by;
    for (const t of steps(2000)) { const b = hop(A, B, t, 0.12).by; expect(Math.abs(b - prev)).toBeLessThan(0.01); prev = b; }
  });
});

describe('walk: legs matched to distance', () => {
  it('step phase = distance travelled / stride, so stopping freezes the legs mid-step', () => {
    const w = walk(A, B, 0.5, 0.05);
    expect(w.mood).toBe('walk');
    expect(w.step).toBeCloseTo(Math.abs(w.x - A.x) / 0.05, 6);
    expect(walk(A, B, 0.5, 0.05)).toEqual(w); // pure
  });
  it('stands still (no step) at both ends', () => {
    expect(walk(A, B, 0)).toMatchObject({ mood: 'idle', step: null, x: A.x });
    expect(walk(A, B, 1)).toMatchObject({ mood: 'idle', step: null, x: B.x });
  });
  it('eases in and out and never overshoots', () => {
    const xs = steps().map((t) => walk(A, B, t).x);
    expect(Math.min(...xs)).toBe(A.x); expect(Math.max(...xs)).toBe(B.x);
    expect(xs[10] - xs[0]).toBeLessThan(xs[105] - xs[95]); // slower at the start than mid-way
  });
});

describe('speech: lines own scroll ranges and cross-fade', () => {
  const S = [0.1, 0.3, 0.5];
  it('a line is fully visible inside its range and alone', () => {
    const { op } = speech(0.2, S); expect(op).toEqual([1, 0, 0]);
    expect(speech(0.4, S).op).toEqual([0, 1, 0]);
    expect(speech(0.9, S).op).toEqual([0, 0, 1]); // the last one stays
  });
  it('nothing before the first line; the bubble comes up with it and stays', () => {
    expect(speech(0.05, S).op).toEqual([0, 0, 0]); expect(speech(0.05, S).bubble).toBe(0);
    expect(speech(0.2, S).bubble).toBe(1); expect(speech(0.3, S).bubble).toBe(1);
  });
  it('is never an instant swap: at every step the change is small, and two lines never show at once', () => {
    const ps = Array.from({ length: 2001 }, (_, i) => i / 2000);
    let prev = speech(0, S).op;
    for (const p of ps) {
      const { op } = speech(p, S);
      op.forEach((o, i) => expect(Math.abs(o - prev[i])).toBeLessThan(0.1));
      expect(op.filter((o) => o > 0).length).toBeLessThanOrEqual(1);
      prev = op;
    }
  });
  it('outgoing line lifts away, incoming rises in', () => {
    const out = speech(0.29, S), inc = speech(0.305, S);
    expect(out.dy[0]).toBeLessThan(0); expect(inc.dy[1]).toBeGreaterThan(0);
  });
  it('the announced line follows the ranges (and an end closes it)', () => {
    expect([0, 0.1, 0.29, 0.3, 0.6].map((p) => activeLine(p, S))).toEqual([-1, 0, 0, 1, 2]);
    expect(activeLine(0.95, S, 0.9)).toBe(-1);
  });
  it('is reversible: same progress, same speech', () => {
    const fwd = steps().map((p) => speech(p, S)), back = steps().reverse().map((p) => speech(p, S)).reverse();
    expect(back).toEqual(fwd);
  });
});

describe('helpers', () => {
  it('stand puts the bubble over his feet', () => {
    expect(stand(A, 'wave')).toMatchObject({ x: 0.2, y: 0.8, bx: 0.2, by: 0.8, mood: 'wave', step: null });
  });
  it('the guide steps aside only while a scene Robo is really on screen (40% of him or more)', () => {
    expect(sceneRoboOnScreen([], 1600, 900)).toBe(false);
    expect(sceneRoboOnScreen([{ top: 400, bottom: 500, left: 100, right: 180 }], 1600, 900)).toBe(true);
    expect(sceneRoboOnScreen([{ top: 850, bottom: 950, left: 100, right: 180 }], 1600, 900)).toBe(true); // half of him in view
    expect(sceneRoboOnScreen([{ top: 860, bottom: 960, left: 100, right: 180 }], 1600, 900)).toBe(true);
    expect(sceneRoboOnScreen([{ top: 870, bottom: 970, left: 100, right: 180 }], 1600, 900)).toBe(false);
    expect(sceneRoboOnScreen([{ top: -70, bottom: 30, left: 100, right: 180 }, { top: 2000, bottom: 2100, left: 100, right: 180 }], 1600, 900)).toBe(false);
    expect(sceneRoboOnScreen([{ top: 0, bottom: 0, left: 100, right: 180 }], 1600, 900)).toBe(false); // not laid out
    expect(sceneRoboOnScreen([{ top: 400, bottom: 500, left: -170, right: -90 }], 1600, 900)).toBe(false); // off the left edge
  });
  it('pinned progress starts only when the scene top reaches the screen top (doors open) and ends at 90% of the pin', () => {
    expect(pinnedProgress(1, 1000)).toBe(0); expect(pinnedProgress(500, 1000)).toBe(0); // doors still opening: nothing moves
    expect(pinnedProgress(0, 1000)).toBe(0);
    expect(pinnedProgress(-450, 1000)).toBeCloseTo(0.5, 6);
    expect(pinnedProgress(-900, 1000)).toBe(1); // done with 100px of pin to spare, before the scene starts to leave
    expect(pinnedProgress(-5000, 1000)).toBe(1);
  });
  it('pinTravel: content taller than the screen slides inside the frame, slower than the page, and reverses', () => {
    expect(pinTravel(100, 1700, 900, 400)).toEqual({ p: 0, shift: 0 });
    const mid = pinTravel(-540, 1700, 900, 400); // (800 travel + 400 extra) × 0.9 = 1080 of pin for the story
    expect(mid.p).toBeCloseTo(0.5, 6); expect(mid.shift).toBeCloseTo(400, 6);
    expect(pinTravel(-1080, 1700, 900, 400)).toEqual({ p: 1, shift: 800 });
    expect(pinTravel(-300, 600, 900, 400)).toEqual({ p: 300 / 360, shift: 0 }); // content fits: it never moves
  });
});
