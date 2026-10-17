import { clamp, lerp } from '@/lib/math';
import type { Mood } from '@/lib/robo/moods';

/**
 * Scene Robo (phase 2): everything a scene's Robo does is a pure function of the scene's scroll progress, so scrolling
 * down plays it, scrolling up rewinds it and stopping holds it. Positions are fractions of the actor's box (0..1);
 * (x, y) is where his feet touch. Nothing here reads the DOM.
 */
export type Pt = { x: number; y: number };
export type Pose = {
  x: number; y: number;
  /** squash/stretch and tilt (1, 1, 0 = rest) */
  sx: number; sy: number; rot: number;
  mood: Mood; facing: 'left' | 'right';
  /** walk-cycle phase in steps (legs follow distance travelled); null = the mood plays on its own clock */
  step: number | null;
  /** where the speech bubble's tail points (fractions of the box); it glides, it never hops */
  bx: number; by: number;
  /** arms up, holding something on his head (ECS bricks) */
  carry?: boolean;
  /** inside a window on the stage: clipped to it (CommandCenter, before he climbs out) */
  inside?: boolean;
  /**
   * How he gets to (x, y) when it changes (owner, 2026-10-17: "like a pipeline, node to node, never stuck in between"):
   * 'hop' (default) and 'walk' are short self-contained animations that always finish, whatever the scroll does;
   * 'glide' follows the scroll continuously (posed every frame, e.g. the ECS carry walk).
   */
  move?: 'hop' | 'walk' | 'glide';
  /** hop height for this move, as a fraction of the box height (default: by distance) */
  lift?: number;
};

/** Everything a scene Robo shows at one progress value. */
export type ActorFrame = { pose: Pose; op: number[]; dy: number[]; bubble: number; active: number };

export const smooth = (a: number, b: number, p: number): number => { const t = clamp((p - a) / (b - a || 1)); return t * t * (3 - 2 * t); };
const rest = { sx: 1, sy: 1, rot: 0 };

/** Standing still at a point. */
export function stand(at: Pt, mood: Mood, facing: 'left' | 'right' = 'right'): Pose {
  return { x: at.x, y: at.y, ...rest, mood, facing, step: null, bx: at.x, by: at.y };
}

/**
 * Walk from a to b at t (0..1), eased in and out. The legs' phase is the distance covered divided by `stride` (same
 * units as x), so the feet never skate: stop scrolling and he stops mid-step.
 */
export function walk(a: Pt, b: Pt, t: number, stride = 0.05): Pose {
  const k = smooth(0, 1, t), x = lerp(a.x, b.x, k), y = lerp(a.y, b.y, k);
  const d = Math.hypot(x - a.x, y - a.y);
  const moving = t > 0 && t < 1;
  return { x, y, ...rest, mood: moving ? 'walk' : 'idle', facing: b.x < a.x ? 'left' : 'right', step: moving ? d / stride : null, bx: x, by: y, move: 'glide' };
}

/** Standing at a node; he hops (or walks) there by himself when the node changes. */
export const node = (at: Pt, mood: Mood, facing: 'left' | 'right' = 'right', move: 'hop' | 'walk' = 'hop', lift?: number): Pose =>
  ({ ...stand(at, mood, facing), move, lift });

/** Duration (ms) of a self-contained move over `dist` px: hops 460–560 ms, walks ~2.2 ms/px within 500–1500 ms. */
export const moveMs = (kind: 'hop' | 'walk', dist: number): number =>
  kind === 'hop' ? Math.round(460 + Math.min(100, dist * 0.12)) : Math.round(Math.min(1500, Math.max(500, dist * 2.2)));
/** Hop height (px) for a hop over `dist` px when the pose gives none: higher for longer hops, capped. */
export const hopLift = (dist: number): number => Math.min(90, 28 + dist * 0.22);

const CROUCH = 0.16, LAND = 0.84;
/**
 * Hop from a to b at t (0..1): crouch (squash) at a, a parabolic arc `h` high (box fractions) with a stretch in the
 * air and a small lean into the travel direction, then a landing squash at b that recovers. The bubble never hops:
 * it eases up by `h` during the crouch (so he never jumps into it), glides level along the arc's top, and eases back
 * down while he lands.
 */
export function hop(a: Pt, b: Pt, t: number, h = 0.12): Pose {
  const facing = b.x < a.x ? 'left' : 'right', dir = facing === 'left' ? -1 : 1;
  t = clamp(t);
  if (t <= 0 || t >= 1) { const at = t >= 1 ? b : a; return { ...stand(at, 'idle', facing) }; }
  if (t < CROUCH) {
    const k = Math.sin((t / CROUCH) * Math.PI * 0.5); // squash deepens until take-off
    return { x: a.x, y: a.y, sx: 1 + 0.16 * k, sy: 1 - 0.2 * k, rot: 0, mood: 'idle', facing, step: null, bx: a.x, by: a.y - h * smooth(0, CROUCH, t) };
  }
  if (t > LAND) {
    const c = (t - LAND) / (1 - LAND), k = Math.cos(c * Math.PI * 0.5); // hardest squash at touch-down, then recovers
    return { x: b.x, y: b.y, sx: 1 + 0.2 * k, sy: 1 - 0.24 * k, rot: 0, mood: 'idle', facing, step: null, bx: b.x, by: b.y - h * (1 - smooth(LAND, 1, t)) };
  }
  const u = (t - CROUCH) / (LAND - CROUCH), arc = 4 * u * (1 - u);
  const gx = lerp(a.x, b.x, u), gy = lerp(a.y, b.y, u);
  const s = Math.sin(u * Math.PI);
  return { x: gx, y: gy - h * arc, sx: 1 - 0.07 * s, sy: 1 + 0.1 * s, rot: dir * 9 * Math.cos(u * Math.PI), mood: 'air', facing, step: null, bx: gx, by: gy - h };
}

/**
 * Speech, tied to scroll. Line i owns [starts[i], starts[i+1]) (the last one runs to `end`). Inside its range it is
 * fully visible; at each boundary the outgoing line fades and lifts away over the last `fade` of its range and the
 * incoming one rises in over the first `fade` of its own (a cross-fade through the bubble, never an instant swap; the
 * two never overlap, so the text is never a double exposure). The bubble itself stays up from the first line to `end`.
 * Returns per-line opacity, a small vertical drift (px) and the bubble's opacity.
 */
export function speech(p: number, starts: number[], end = Infinity, fade = 0.025): { op: number[]; dy: number[]; bubble: number } {
  const op: number[] = [], dy: number[] = [];
  starts.forEach((s, i) => {
    const e = i + 1 < starts.length ? starts[i + 1] : end;
    const up = smooth(s, s + fade, p), down = e === Infinity ? 1 : 1 - smooth(e - fade, e, p);
    op.push(Math.round(Math.min(up, down) * 1000) / 1000);
    dy.push(Math.round(((1 - up) * 10 - (1 - down) * 10) * 10) / 10);
  });
  const bubble = starts.length ? smooth(starts[0] - fade, starts[0], p) * (end === Infinity ? 1 : 1 - smooth(end - fade, end, p)) : 0;
  return { op, dy, bubble: Math.round(bubble * 1000) / 1000 };
}

/** The line that owns `p` (-1 before the first, or after `end`). Used for the screen-reader announcement. */
export function activeLine(p: number, starts: number[], end = Infinity): number {
  let i = -1;
  for (let k = 0; k < starts.length; k++) if (p >= starts[k]) i = k;
  return i >= 0 && p >= end ? -1 : i;
}

/**
 * True while any scene Robo is really on screen (at least 40% of his height and of his width inside the viewport): the
 * guide then steps aside, so there is one Robo on screen at a time. `bots` are the scene Robos' boxes in viewport px.
 */
type Box = { top: number; bottom: number; left: number; right: number };
const seen = (a: number, b: number, size: number) => b > a && Math.min(b, size) - Math.max(a, 0) >= 0.4 * (b - a);
export const sceneRoboOnScreen = (bots: Box[], vw: number, vh: number): boolean => bots.some((b) => seen(b.top, b.bottom, vh) && seen(b.left, b.right, vw));
