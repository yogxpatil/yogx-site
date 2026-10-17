import { clamp } from '@/lib/math';
import { activeLine, node, speech, stand, walk, type ActorFrame, type Pose, type Pt } from './actor';

/**
 * Each scene's Robo as a pure function of that scene's progress p (0..1). Positions are fractions of the actor box
 * (the scene stage, or the chapter); see lib/missions/actor. Every function here is reversible: same p, same answer.
 *
 * Node to node (owner, 2026-10-17: "like a pipeline it should jump node to node directly, not stop in between"):
 * scroll decides which NODE he belongs at (a row, a station, a post, the seal); the pose is him resting there, and
 * SceneActor plays a short hop / walk of its own (always finished) whenever the node changes. Only the ECS carry walk
 * still follows the scroll continuously ('glide'). Lines stay tied to scroll ranges.
 */
/** `fade` is in the same units as p: row-unit scenes (log, transmissions) pass a bigger one, a row being ~27vh, not 200. */
const frame = (pose: Pose, p: number, starts: number[], end = Infinity, fade?: number): ActorFrame => ({ pose, ...speech(p, starts, end, fade), active: activeLine(p, starts, end) });

// ---------------------------------------------------------------- CommandCenter (pinned)
/**
 * Beats on the pinned stretch. Inside the app window he hops down the failing rows, one row per slice of `hops`, and
 * each row is fixed as he lands on it (the first by a stomp at `fix0`); VERIFIED stamps, he cheers, walks to the
 * window's edge and hops out over it onto the page; only then does he talk: the "out" line, then his backstory.
 */
export const CC = { fix0: 0.03, hops: [0.03, 0.2], stamp: 0.21, edge: 0.25, out: 0.29, lines: [0.35, 0.48, 0.61, 0.74, 0.87], angry: 2, sit: 0.88 } as const;
/** Where he stands: `rows` = a spot on each failing row (inside the window), `edge` = inside the window by its left
 *  edge, `out` = on the page floor outside it. Fractions of the stage. */
export type CcGeo = { rows: Pt[]; edge: Pt; out: Pt };

/** Which row node he belongs at: 0 until the hops start, then one more per slice. */
export const ccRow = (p: number, n: number) => (p < CC.hops[0] ? 0 : Math.min(n - 1, 1 + Math.floor((p - CC.hops[0]) / ((CC.hops[1] - CC.hops[0]) / (n - 1)))));

export function ccScene(p: number, g: CcGeo) {
  const n = g.rows.length, k = ccRow(p, n);
  let pose: Pose;
  if (p < CC.hops[1]) pose = { ...node(g.rows[k], p < CC.fix0 ? 'angry' : 'point'), inside: true };
  else if (p < CC.edge) pose = { ...node(g.rows[n - 1], p >= CC.stamp ? 'jump' : 'point'), inside: true };
  else if (p < CC.out) pose = { ...node(g.edge, 'point', 'left', 'walk'), inside: true };
  else {
    const line = activeLine(p, [...CC.lines]);
    pose = { ...node(g.out, p >= CC.sit ? 'sit' : line === CC.angry ? 'angry' : 'idle', 'right', 'hop', 0.16), inside: false };
  }
  // the first row is fixed by his stomp, then each row as he lands on it
  const fixed = p < CC.fix0 ? 0 : Math.min(n, k + 1);
  return { ...frame(pose, p, [...CC.lines]), fixed, stamp: p >= CC.stamp, shake: p < CC.fix0 };
}

// ---------------------------------------------------------------- ECS: carries the EC2 boxes like bricks
/** One trip per container, each an equal slice of [from, to]; he jumps down at `down`, the label flips at `relabel`.
 *  Lines: one while he works, one once the label has flipped. */
export const ECS = { from: 0.04, to: 0.74, down: 0.8, relabel: 0.84, lines: [0.06, 0.84] } as const;
/** Box centres in actor-box fractions: where each EC2 box lies scattered (x0, y0) and its slot in a container (x1, y1). */
export type Brick = { x0: number; y0: number; x1: number; y1: number };
/** Where a box is: lying scattered, riding the tower on his head, or in its slot. A change of state is a discrete
 *  moment the stage animates (fly up / drop in); while on his head it follows him every frame. */
export type BoxState = 'scattered' | 'head' | 'slot';
export type BoxAt = { x: number; y: number; state: BoxState };
const PICK = [0.2, 0.5], CARRY_TO = 0.8;

/**
 * Bricks come `per` to a container, in `bricks` order, bottom slot first. On each trip he walks (following the scroll)
 * along the containers' top rims (`floor`) to under that container's scattered boxes (0–0.2 of the trip); at four
 * moments they fly up onto his head into a tower (0.2–0.5); he walks the tower to the container (0.5–0.8); then at four
 * moments they drop in, the top one into the bottom slot (0.8–1). After the last trip he hops down to `ground` and
 * waves when the label flips. `carry` = the tower base above his feet, `bh` = one box's height (box fractions).
 */
export function ecsScene(p: number, bricks: Brick[], floor: number, carry: number, ground: Pt, per = 4, bh = 0.075) {
  const n = bricks.length, trips = Math.ceil(n / per), park: Pt = { x: bricks[0].x1, y: floor }; // home: on the first container's rim
  const kk = clamp((p - ECS.from) / (ECS.to - ECS.from)) * trips, c = Math.min(trips - 1, Math.floor(kk)), t = p >= ECS.to ? 1 : kk - c;
  const tripOf = (j: number) => Math.floor(j / per);
  const done = (j: number) => tripOf(j) < c || (tripOf(j) === c && t >= 1);
  const boxes: BoxAt[] = bricks.map((b, j) => (done(j) ? { x: b.x1, y: b.y1, state: 'slot' } : { x: b.x0, y: b.y0, state: 'scattered' }));
  let pose: Pose;
  if (p < ECS.from) pose = node(park, 'idle');
  else if (p >= ECS.to) pose = p < ECS.down ? node({ x: bricks[n - 1].x1, y: floor }, 'point') : node(ground, p >= ECS.relabel ? 'wave' : 'idle', 'left', 'hop', 0.1);
  else {
    const B = bricks.slice(c * per, c * per + per), m = B.length, head = floor - carry;
    const prevX = c === 0 ? park.x : bricks[c * per - 1].x1, pickX = B.reduce((s2, b) => s2 + b.x0, 0) / m;
    const at: Pt = { x: pickX, y: floor }, slot: Pt = { x: B[0].x1, y: floor };
    const level = (d: number) => head - (m - 1 - d) * bh; // B[0] rides on top: it goes in first, into the bottom slot
    const pickAt = (d: number) => PICK[0] + ((m - 1 - d) / m) * (PICK[1] - PICK[0]); // tower built bottom up: B[m-1] first
    const dropAt = (d: number) => CARRY_TO + (d / m) * (1 - CARRY_TO);
    let rx = at.x;
    if (t < PICK[0]) { pose = walk({ x: prevX, y: floor }, at, t / PICK[0], 0.035); rx = pose.x; }
    else if (t < CARRY_TO) {
      const w = walk(at, slot, clamp((t - PICK[1]) / (CARRY_TO - PICK[1])), 0.035);
      pose = { ...w, mood: t < PICK[1] ? 'idle' : w.mood, facing: slot.x < at.x ? 'left' : 'right', carry: t >= pickAt(m - 1) }; rx = w.x;
    } else { pose = { ...stand(slot, 'point', 'right'), move: 'glide', carry: t < dropAt(m - 1) }; rx = slot.x; }
    B.forEach((b, d) => {
      const j = c * per + d;
      if (t >= dropAt(d)) boxes[j] = { x: b.x1, y: b.y1, state: 'slot' };
      else if (t >= pickAt(d)) boxes[j] = { x: rx, y: level(d), state: 'head' };
    });
  }
  return { pose, boxes, packed: done(n - 1), ecs: p >= ECS.relabel, ...speech(p, [...ECS.lines]), active: activeLine(p, [...ECS.lines]) };
}

// ---------------------------------------------------------------- OCD: hops station to station with the ticket
/** Station i's x (fraction of the track); he hops to a station the moment the ticket arrives there (ocdAt's lit). */
export function ocdScene(p: number, xs: number[], ground: number) {
  // the ticket's legs: progress 0.08..0.88 over 4 legs, each leg = travel 70% then hold 30% (lib/missions/ocd)
  const t = clamp((p - 0.08) / 0.8) * 4, i = Math.min(3, Math.floor(t)), lit = i + (t - i >= 0.7 || t >= 4 ? 1 : 0);
  const at: Pt = { x: lit === 0 ? 0.02 : xs[lit - 1], y: ground };
  const pose = node(at, lit === 0 ? 'idle' : lit === 4 && p >= 0.88 ? 'jump' : 'point', 'right', 'hop', 0.16);
  // one short line per station, from the landing until the next one
  const starts = [0, 1, 2, 3].map((k) => Math.round((0.08 + (k + 0.72) * 0.2) * 1000) / 1000);
  return frame(pose, p, starts);
}

// ---------------------------------------------------------------- Mission log: walks down the timeline
/**
 * `pos` = where the reading line is along the rows, in row units (0 = first row's top at the reading line, 1 = the
 * second row's, ...). `tops` = each row's top (fraction of the actor box), `rail` = his x. He belongs at the row being
 * read and hops down to the next once the reading line is past 55% of the row; each row's line comes in as he arrives.
 */
export const logRow = (pos: number, n: number) => { const q = clamp(pos, 0, n - 1), i = Math.floor(q); return Math.min(n - 1, q - i > 0.55 ? i + 1 : i); };
export function logScene(pos: number, tops: number[], rail: number) {
  const n = tops.length, k = logRow(pos, n);
  const pose = node({ x: rail, y: tops[k] }, k === n - 1 ? 'wave' : 'point', 'right');
  // the first entry's line is up whenever he is (the chapter is pinned before any of it can be read); the others come
  // in as he arrives at their entry
  const starts = tops.map((_, j) => (j === 0 ? -1e6 : j - 0.45));
  return frame(pose, pos, starts, Infinity, 0.15);
}

// ---------------------------------------------------------------- Transmissions: hops line to line
/**
 * `pos` = the reading position in row units, `ys` = each post line's y (fraction of the box), `x` his perch. He sits
 * on the post being read (with his chai) and hops to the next once the reading position is past 60% of it.
 */
export const txRow = (pos: number, n: number) => { const q = clamp(pos, 0, n - 1), i = Math.floor(q); return Math.min(n - 1, q - i > 0.6 ? i + 1 : i); };
export function txScene(pos: number, ys: number[], x: number) {
  const k = txRow(pos, ys.length);
  const pose = node({ x, y: ys[k] }, 'sit', 'left', 'hop', 0.06);
  const starts = ys.map((_, j) => (j === 0 ? -0.4 : j - 0.4));
  return frame(pose, pos, starts, Infinity, 0.15);
}

/** Row-unit position of a reading line (px from the list top) along rows whose tops are `tops` (px) in a list `height`
 *  px tall: i + the fraction between row i's top and the next; negative above the first row. Pure. */
export function readingPos(line: number, tops: number[], height: number): number {
  const n = tops.length; if (!n) return 0;
  if (line < tops[0]) return (line - tops[0]) / ((tops[1] ?? height) - tops[0] || 1);
  for (let i = 0; i < n; i++) { const next = i + 1 < n ? tops[i + 1] : height; if (line < next || i === n - 1) return i + (line - tops[i]) / (next - tops[i] || 1); }
  return n - 1;
}

// ---------------------------------------------------------------- Signal: walks to the OG seal, sits, waves, last line
/** Beats on Signal's section progress (the OG seal is fully in by ~0.77, see signalState). */
export const SIGNAL = { walk: 0.5, sit: 0.73, wave: [0.79, 0.93], line: 0.8 } as const;
/**
 * The finale: once the planes start merging he walks in by himself from off the left edge (`from`) to beside the OG
 * seal (`to`), sits, waves while he says the last line, then settles with his chai and stays (the line stays too).
 */
export function signalScene(p: number, from: Pt, to: Pt) {
  const pose = p < SIGNAL.walk ? node(from, 'idle', 'right', 'walk')
    : node(to, p >= SIGNAL.wave[0] && p < SIGNAL.wave[1] ? 'wave' : p >= SIGNAL.sit ? 'sit' : 'idle', 'right', 'walk');
  return frame(pose, p, [SIGNAL.line]);
}
