import { describe, it, expect } from 'vitest';
import { CC, ccScene, ccRow, ECS, ecsScene, ocdScene, logScene, logRow, txScene, txRow, signalScene, SIGNAL, readingPos, type Brick, type CcGeo } from '@/lib/missions/scenes';
import type { Pt } from '@/lib/missions/actor';

const grid = (n = 400) => Array.from({ length: n + 1 }, (_, i) => i / n);
/** Same progress, same frame whichever way you arrive: scrolling up rewinds exactly. */
const reversible = <T,>(f: (p: number) => T, ps = grid()) => {
  const fwd = ps.map(f), back = [...ps].reverse().map(f).reverse();
  expect(back).toEqual(fwd);
};
/** Line opacities never jump: each scroll step changes them a little at most. */
const smoothLines = (f: (p: number) => { op: number[] }, ps = Array.from({ length: 4001 }, (_, i) => i / 4000)) => {
  let prev = f(ps[0]).op;
  for (const p of ps) { const { op } = f(p); op.forEach((o, i) => expect(Math.abs(o - prev[i])).toBeLessThan(0.12)); prev = op; }
};
/** Node to node: the pose is always one of the scene's nodes (never somewhere in between, never mid-air), and he
 *  gets there with a self-contained hop or walk (SceneActor plays it). */
const onNodes = (f: (p: number) => { pose: { x: number; y: number; move?: string } }, nodes: Pt[], ps = grid(1000)) => {
  for (const p of ps) {
    const { pose } = f(p);
    expect(pose.move === 'hop' || pose.move === 'walk').toBe(true);
    expect(nodes.some((n) => Math.abs(n.x - pose.x) < 1e-9 && Math.abs(n.y - pose.y) < 1e-9)).toBe(true);
  }
};

describe('CommandCenter: hops row to row inside the app, climbs out, then talks', () => {
  const geo: CcGeo = { rows: Array.from({ length: 6 }, (_, i) => ({ x: i % 2 ? 0.6 : 0.5, y: 0.15 + i * 0.065 })), edge: { x: 0.3, y: 0.475 }, out: { x: 0.1, y: 0.97 } };
  const at = (p: number) => ccScene(p, geo);
  it('is reversible, lines never swap instantly, and he is only ever on a node', () => {
    reversible(at); smoothLines(at); onNodes(at, [...geo.rows, geo.edge, geo.out]);
  });
  it('row node follows scroll, one row per slice; each row is fixed as he reaches it; VERIFIED once all six pass', () => {
    expect([0, 0.04, 0.08, 0.12, 0.16, 0.199].map((p) => ccRow(p, 6))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(at(0)).toMatchObject({ fixed: 0, stamp: false, shake: true }); expect(at(0).pose).toMatchObject({ inside: true, mood: 'angry' });
    for (const p of grid()) { const a = at(p); if (p >= CC.fix0 && p < CC.hops[1]) expect(a.fixed).toBe(ccRow(p, 6) + 1); }
    expect(at(CC.stamp - 0.005).stamp).toBe(false); expect(at(CC.stamp)).toMatchObject({ fixed: 6, stamp: true });
    expect(at(0.23).pose.mood).toBe('jump');
  });
  it('walks to the window edge (inside), then hops out over it high, unclipped, onto the page floor', () => {
    expect(at(0.27).pose).toMatchObject({ x: 0.3, inside: true, move: 'walk' });
    expect(at(0.3).pose).toMatchObject({ x: 0.1, y: 0.97, inside: false, move: 'hop', lift: 0.16 });
  });
  it('says nothing until he is out; then the out line and the backstory, one range each, in order', () => {
    for (const p of [0, 0.1, 0.2, 0.3, 0.34]) expect(at(p).active).toBe(-1);
    expect([0.4, 0.5, 0.65, 0.8, 0.95].map((p) => at(p).active)).toEqual([0, 1, 2, 3, 4]);
    expect(at(0.65).pose.mood).toBe('angry'); // "Har galat changelog maine check kiya"
    expect(at(1).pose.mood).toBe('sit');
  });
});

describe('ECS: towers of bricks; picks and drops are discrete moments', () => {
  const bricks: Brick[] = Array.from({ length: 12 }, (_, i) => ({ x0: 0.05 + (i % 6) * 0.15, y0: i < 6 ? 0.1 : 0.6, x1: 0.3 + Math.floor(i / 4) * 0.2, y1: 0.7 - (i % 4) * 0.08 }));
  const at = (p: number) => ecsScene(p, bricks, 0.3, 0.17, { x: 0.9, y: 0.9 });
  const trip = (ECS.to - ECS.from) / 3;
  it('is reversible; a box is always scattered, on his head or in its slot (never part-way: the stage animates the change)', () => {
    reversible(at);
    for (const p of grid(800)) at(p).boxes.forEach((b, i) => {
      if (b.state === 'scattered') expect(b).toMatchObject({ x: bricks[i].x0, y: bricks[i].y0 });
      if (b.state === 'slot') expect(b).toMatchObject({ x: bricks[i].x1, y: bricks[i].y1 });
    });
  });
  it('one trip per container: earlier containers full, later boxes still scattered', () => {
    const mid = at(ECS.from + trip * 1.65); // carrying the second tower
    expect(mid.boxes.slice(0, 4).every((b) => b.state === 'slot')).toBe(true);
    expect(mid.boxes.slice(4, 8).every((b) => b.state === 'head')).toBe(true);
    expect(mid.boxes.slice(8).every((b) => b.state === 'scattered')).toBe(true);
  });
  it('the tower is built bottom up one box at a time, rides his head while he walks (following the scroll), and the top box drops first', () => {
    const states = (p: number) => at(ECS.from + trip * p).boxes.slice(0, 4).map((b) => b.state);
    expect(states(0.1)).toEqual(['scattered', 'scattered', 'scattered', 'scattered']);
    expect(states(0.21)).toEqual(['scattered', 'scattered', 'scattered', 'head']); // bricks[3] (tower bottom) first
    expect(states(0.45)).toEqual(['head', 'head', 'head', 'head']);
    const w = at(ECS.from + trip * 0.65);
    expect(w.pose).toMatchObject({ carry: true, mood: 'walk', move: 'glide' }); expect(w.pose.step).not.toBeNull();
    w.boxes.slice(0, 4).forEach((b) => expect(b.x).toBeCloseTo(w.pose.x, 6));
    expect(w.boxes[0].y).toBeLessThan(w.boxes[3].y); // bricks[0] (bottom slot) rides on top
    expect(states(0.81)).toEqual(['slot', 'head', 'head', 'head']); // top of the tower goes in first, into the bottom slot
  });
  it('all packed, then he hops down to the ground, the label flips and he waves; scrolling up un-stacks', () => {
    expect(at(ECS.to).packed).toBe(true); expect(at(ECS.to).ecs).toBe(false);
    expect(at(1)).toMatchObject({ packed: true, ecs: true }); expect(at(1).pose).toMatchObject({ x: 0.9, y: 0.9, mood: 'wave', move: 'hop' });
    expect(at(0).boxes.every((b) => b.state === 'scattered')).toBe(true); expect(at(0).packed).toBe(false);
  });
  it('one line while he works, one once the label has flipped', () => {
    expect(at(0.5).active).toBe(0); expect(at(0.95).active).toBe(1); expect(at(0.03).active).toBe(-1);
    smoothLines(at);
  });
});

describe('OCD: hops station to station as the ticket arrives', () => {
  const XS = [0.12, 0.37, 0.62, 0.87], at = (p: number) => ocdScene(p, XS, 0.25);
  it('is reversible, smooth, and only ever on a station (or the start)', () => {
    reversible(at); smoothLines(at); onNodes(at, [{ x: 0.02, y: 0.25 }, ...XS.map((x) => ({ x, y: 0.25 }))]);
  });
  it('his node is the station the ticket has reached (it reaches station i at 0.08 + (i + 0.7) × 0.2)', () => {
    XS.forEach((x, i) => {
      const arrive = 0.08 + (i + 0.7) * 0.2;
      expect(at(arrive - 0.005).pose.x).toBe(i === 0 ? 0.02 : XS[i - 1]);
      expect(at(arrive + 0.005).pose.x).toBe(x);
    });
  });
  it('one line per station, in order; cheers at PROD', () => {
    expect([0.25, 0.45, 0.65, 0.85].map((p) => at(p).active)).toEqual([0, 1, 2, 3]);
    expect(at(1).pose.mood).toBe('jump');
  });
});

describe('Mission log: hops entry to entry', () => {
  const tops = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.84], at = (pos: number) => logScene(pos, tops, 0.15);
  const ps = Array.from({ length: 801 }, (_, i) => -0.5 + (i / 800) * 7);
  it('is reversible, smooth, and only ever on an entry', () => { reversible(at, ps); smoothLines(at, ps); onNodes(at, tops.map((y) => ({ x: 0.15, y })), ps); });
  it('belongs at the entry being read, moving on once it is past 55% of it', () => {
    expect([-0.5, 0.5, 0.6, 2.2, 2.6, 6.4].map((p) => logRow(p, 7))).toEqual([0, 0, 1, 2, 3, 6]);
    expect(at(2.2).pose).toMatchObject({ y: 0.28, mood: 'point' });
    expect(at(6.4).pose.mood).toBe('wave');
  });
  it('the entry he is at has its line up', () => {
    for (const p of [-0.9, 0.2, 0.7, 1.7, 3.2, 6.2]) expect(at(p).active).toBe(logRow(p, 7));
  });
  it('readingPos: row units of a reading line along the rows', () => {
    const t = [0, 100, 300];
    expect(readingPos(-50, t, 400)).toBeCloseTo(-0.5, 6);
    expect(readingPos(50, t, 400)).toBeCloseTo(0.5, 6);
    expect(readingPos(200, t, 400)).toBeCloseTo(1.5, 6);
    expect(readingPos(350, t, 400)).toBeCloseTo(2.5, 6);
  });
});

describe('Transmissions: hops post to post', () => {
  const ys = [0, 0.35, 0.65], at = (pos: number) => txScene(pos, ys, 0.8);
  const ps = Array.from({ length: 601 }, (_, i) => -0.5 + (i / 600) * 3);
  it('is reversible, smooth, and only ever sitting on a post', () => { reversible(at, ps); smoothLines(at, ps); onNodes(at, ys.map((y) => ({ x: 0.8, y })), ps); });
  it('sits on the post being read and moves on past 60% of it; each post has its line as he lands', () => {
    expect([0.3, 0.7, 1.5, 1.7, 2.4].map((p) => txRow(p, 3))).toEqual([0, 1, 1, 2, 2]);
    expect(at(0.3).pose).toMatchObject({ y: 0, mood: 'sit' });
    for (const p of [0.2, 0.7, 1.2, 1.7, 2.2]) expect(at(p).active).toBe(txRow(p, 3));
  });
});

describe('Signal: the finale', () => {
  const from = { x: -0.08, y: 0.9 }, to = { x: 0.8, y: 0.9 }, at = (p: number) => signalScene(p, from, to);
  it('is reversible, smooth, and is either off the left edge or by the seal (he walks there by himself)', () => {
    reversible(at); smoothLines(at); onNodes(at, [from, to]);
    expect(at(0.6).pose.move).toBe('walk');
  });
  it('walks in to the OG seal, sits, waves while he says the last line, then stays with his chai', () => {
    expect(at(0.2).pose.x).toBe(from.x); expect(at(0.2).active).toBe(-1);
    expect(at(SIGNAL.walk).pose.x).toBe(to.x);
    expect(at(SIGNAL.sit + 0.02).pose.mood).toBe('sit');
    expect(at(0.85).pose.mood).toBe('wave'); expect(at(0.85).active).toBe(0);
    expect(at(1).pose.mood).toBe('sit'); expect(at(1).op).toEqual([1]);
  });
});
