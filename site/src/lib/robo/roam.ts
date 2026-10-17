// Where Robo stands and how he gets there. Pure: the guide measures, this decides.
import { PHONE_MAX, overlaps, type Box } from './place';

export type Rect = Box;
export type Pt = { x: number; y: number };
export type Perch = Pt & { peek: boolean };
export type Gait = { mood: 'walk' | 'run'; cycle: number };

/** Space kept between Robo and the screen edge (left/right) and the bottom edge: inside the HUD frame. */
export const margins = (vw: number) => (vw > PHONE_MAX ? { side: 16, bottom: 44 } : { side: 18, bottom: 22 });
const TOP = 72; // the HUD's top readouts live above this
const PAD = 6; // breathing room between Robo and content
const STEP_X = 32, STEP_Y = 40, GRID = 48; // GRID: spacing of the interior spots
/** Open space around a spot counts up to this far (px), and is worth ROOM_W px of walking per px. */
const ROOM_MAX = 120, ROOM_W = 3;

const uniq = (xs: number[]) => xs.filter((x, i) => xs.indexOf(x) === i);

/**
 * Every place Robo may stand (top-left corner of his box), in no particular order: along the bottom band (a fixed
 * ladder plus, when obstacles are given, just beside each one so he can slot into gaps), up the left and right
 * gutters, and a coarse grid over the inside of the screen (open space between the content counts too). All of
 * them inside the screen, below the HUD's top row.
 */
export function perches(vw: number, vh: number, robo: { w: number; h: number }, near: Rect[] = []): Pt[] {
  const m = margins(vw), y0 = vh - m.bottom - robo.h, xMax = vw - m.side - robo.w, out: Pt[] = [];
  if (xMax < m.side || y0 < 0) return [{ x: Math.max(0, m.side), y: Math.max(0, y0) }];
  const band = near.filter((o) => o.bottom > y0 - PAD && o.top < y0 + robo.h + PAD).flatMap((o) => [o.right + PAD + 2, o.left - PAD - 2 - robo.w]);
  const xs = uniq([m.side, ...Array.from({ length: Math.floor((xMax - m.side) / STEP_X) }, (_, i) => m.side + STEP_X * (i + 1)), xMax, ...band.map(Math.round)])
    .filter((x) => x >= m.side && x <= xMax);
  for (const x of xs) out.push({ x, y: y0 });
  for (let y = y0 - STEP_Y; y >= TOP; y -= STEP_Y) {
    out.push({ x: m.side, y }); if (xMax !== m.side) out.push({ x: xMax, y });
    for (let x = m.side + GRID; x <= xMax - GRID / 2; x += GRID) out.push({ x, y });
  }
  return out;
}

const clear = (p: Pt, robo: { w: number; h: number }, obstacles: Rect[]) => {
  const b = { left: p.x - PAD, top: p.y - PAD, right: p.x + robo.w + PAD, bottom: p.y + robo.h + PAD };
  return !obstacles.some((o) => overlaps(o, b));
};

/** How far (px) Robo's box at `p` is from the nearest obstacle, capped at ROOM_MAX: the empty space around him. */
const room = (p: Pt, robo: { w: number; h: number }, obstacles: Rect[]) => {
  const l = p.x, t = p.y, r = p.x + robo.w, b = p.y + robo.h;
  let best = ROOM_MAX;
  for (const o of obstacles) {
    const dx = Math.max(0, o.left - r, l - o.right), dy = Math.max(0, o.top - b, t - o.bottom);
    if (dx >= best || dy >= best) continue;
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
};

/**
 * The best perch where Robo covers no obstacle (and, if given, `accept` agrees: the guide uses it to ask "does his
 * card fit beside him here too?"). Best = a short walk from `prefer` with open space around it: every px of empty
 * space around him (up to ROOM_MAX) is worth ROOM_W px of walking, so he settles in a roomy spot nearby rather than
 * squeezed into a gutter or a slot between paragraphs. Nothing free: he peeks half off-screen at the edge nearest
 * `prefer`, at the first height where the half that shows covers nothing (else on the bottom band), with `peek: true`.
 */
export function pickPerch(obstacles: Rect[], vw: number, vh: number, robo: { w: number; h: number }, prefer: Pt, accept?: (p: Pt) => boolean): Perch {
  // walking cost: sliding along the band is cheap, climbing costs more (he prefers the band)
  const d = (p: Pt) => Math.abs(p.x - prefer.x) + 3 * Math.abs(p.y - prefer.y);
  const all = perches(vw, vh, robo, obstacles);
  const list = all.filter((p) => clear(p, robo, obstacles))
    .map((p) => ({ p, score: d(p) - ROOM_W * room(p, robo, obstacles) }))
    .sort((a, b) => a.score - b.score);
  for (const { p } of list) if (!accept || accept(p)) return { ...p, peek: false };
  // peeking: half off-screen at a side edge, at any perch height, where the half that shows covers nothing
  const half = { w: robo.w / 2, h: robo.h };
  const ys = uniq(all.map((p) => p.y));
  const peeks = ys.flatMap((y) => [{ x: -robo.w / 2, y }, { x: vw - robo.w / 2, y }]).sort((a, b) => d(a) - d(b));
  const free = peeks.filter((p) => clear({ x: p.x < 0 ? 0 : p.x, y: p.y }, half, obstacles));
  const ok = accept ? free.find(accept) : free[0];
  if (ok) return { ...ok, peek: true };

  const y = vh - margins(vw).bottom - robo.h;
  return { x: prefer.x + robo.w / 2 < vw / 2 ? -robo.w / 2 : vw - robo.w / 2, y, peek: true };
}

/** Recent scroll speed → how he moves: a waddling walk (slower cycle the calmer the scroll), or a run past ~1800 px/s.
 *  `lite` (a weak device): he only ever walks, at his brisk walk: the run's extra limbs and dust cost frames. */
export const RUN_AT = 1800;
export function gaitFor(speedPxPerS: number, lite = false): Gait {
  const v = Math.min(Math.max(0, speedPxPerS), lite ? RUN_AT : Infinity);
  if (v > RUN_AT) return { mood: 'run', cycle: 0.32 };
  return { mood: 'walk', cycle: +(0.9 - 0.15 * (v / RUN_AT)).toFixed(3) };
}

/**
 * The way there, as stops after `from`: never straight across the content. From a gutter he first climbs down to the
 * bottom band, slides along it, then climbs the destination's gutter. `bandY` = the bottom band's y.
 */
export function route(from: Pt, to: Pt, bandY: number): Pt[] {
  const pts: Pt[] = [];
  const push = (p: Pt) => { const l = pts[pts.length - 1] ?? from; if (Math.abs(l.x - p.x) >= 1 || Math.abs(l.y - p.y) >= 1) pts.push(p); };
  if (Math.abs(from.x - to.x) >= 1) {
    const y = Math.max(bandY, from.y, to.y);
    push({ x: from.x, y }); push({ x: to.x, y });
  }
  push(to);
  return pts;
}

/**
 * Would walking `from` → stops sweep Robo across an obstacle? Content he is standing in at the start (he is walking
 * out of it) or at the end does not count; touching edges does not count.
 */
export function crosses(from: Pt, stops: Pt[], robo: { w: number; h: number }, obstacles: Rect[]): boolean {
  if (!stops.length) return false;
  const at = (p: Pt) => ({ left: p.x, top: p.y, right: p.x + robo.w, bottom: p.y + robo.h });
  const ends = [at(from), at(stops[stops.length - 1])];
  const live = obstacles.filter((o) => !ends.some((e) => overlaps(o, e)));
  return stops.some((q, i) => {
    const a = i ? stops[i - 1] : from;
    const sweep = { left: Math.min(a.x, q.x) + 2, top: Math.min(a.y, q.y) + 2, right: Math.max(a.x, q.x) + robo.w - 2, bottom: Math.max(a.y, q.y) + robo.h - 2 };
    return live.some((o) => overlaps(o, sweep));
  });
}

const SPEED = { walk: 260, run: 720 } as const; // px/s on screen
/** How long the trip takes: distance at his pace, never a blink and never a long trek. 0 when he stays. */
export function travelMs(from: Pt, to: Pt, mood: Gait['mood']): number {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  if (dist < 1) return 0;
  return Math.round(Math.min(2400, Math.max(250, (dist / SPEED[mood]) * 1000)));
}
