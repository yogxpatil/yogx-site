import { describe, it, expect } from 'vitest';
import { sceneProgress } from '@/lib/missions/progress';
import { ecsPack, boxPack, ctrOpacity, isEcsLabel } from '@/lib/missions/ecs';
import { ecgAtProgress } from '@/lib/missions/ecg';
import { ocdAt, stationLeft } from '@/lib/missions/ocd';

const steps = (n = 200) => Array.from({ length: n + 1 }, (_, i) => i / n);
/** f sampled walking from 1 down to 0, then flipped: equals the forward walk only if f depends on progress alone. */
const back = <T,>(f: (p: number) => T, n = 200) => Array.from({ length: n + 1 }, (_, i) => f((n - i) / n)).reverse();

describe('scene progress', () => {
  it('0 while the scene is just peeking in, 1 once its top is 40% of a viewport above the screen (one-screen scene)', () => {
    expect(sceneProgress(900, 800, 800)).toBe(0); expect(sceneProgress(640, 800, 800)).toBe(0);
    expect(sceneProgress(160, 800, 800)).toBeCloseTo(0.5); expect(sceneProgress(-320, 800, 800)).toBe(1); expect(sceneProgress(-600, 800, 800)).toBe(1);
    expect(sceneProgress(0, 800, 800)).toBeCloseTo(2 / 3);
  });
  it('a taller (stacked) scene needs more scroll before the story ends', () => {
    expect(sceneProgress(-320, 1600, 800)).toBeLessThan(1); expect(sceneProgress(-320 - 480, 1600, 800)).toBe(1);
  });
  it('is a pure function of position: the same top gives the same progress going either way', () => {
    const tops = Array.from({ length: 50 }, (_, i) => 900 - i * 20);
    expect([...tops].reverse().map((t) => sceneProgress(t, 800, 800))).toEqual(tops.map((t) => sceneProgress(t, 800, 800)).reverse());
  });
});

describe('ECS story by progress', () => {
  it('scattered at the start, every box home by 60%, label flips EC2 to ECS at 72% and flips back below it', () => {
    expect(ecsPack(0)).toBe(0); expect(ecsPack(0.6)).toBe(1); expect(ecsPack(1)).toBe(1);
    expect(boxPack(0, 0)).toBe(0); expect(boxPack(1, 0.66)).toBe(1); expect(boxPack(1, 0)).toBe(1);
    expect(ctrOpacity(0.4)).toBe(0); expect(ctrOpacity(1)).toBe(1);
    expect(isEcsLabel(0.71)).toBe(false); expect(isEcsLabel(0.72)).toBe(true); expect(isEcsLabel(0.5)).toBe(false);
  });
  it('boxes leave in a stagger: the box with the biggest delay is behind the first one mid-way', () => {
    expect(boxPack(0.5, 0.66)).toBeLessThan(boxPack(0.5, 0));
  });
  it('is monotonic going down, so the reverse walk is the same curve backwards (unpack)', () => {
    const v = steps().map((p) => boxPack(ecsPack(p), 0.3));
    v.forEach((x, i) => { if (i) expect(x).toBeGreaterThanOrEqual(v[i - 1]); });
    expect(back(ecsPack)).toEqual(steps().map(ecsPack));
  });
  it('the story is complete (packed and relabelled) before the end of the scroll range', () => {
    expect(ecsPack(0.9)).toBe(1); expect(isEcsLabel(0.9)).toBe(true);
  });
});

describe('ECG story by progress', () => {
  it('nothing drawn at first, line complete and head gone at the end, drawn amount only grows with progress', () => {
    expect(ecgAtProgress(0)).toEqual({ drawn: 0, opacity: 0, headOpacity: 0 });
    expect(ecgAtProgress(1)).toEqual({ drawn: 1, opacity: 1, headOpacity: 0 });
    expect(ecgAtProgress(0.4)).toMatchObject({ opacity: 1, headOpacity: 1 });
    const d = steps().map((p) => ecgAtProgress(p).drawn);
    d.forEach((x, i) => { if (i) expect(x).toBeGreaterThanOrEqual(d[i - 1]); });
  });
  it('is reversible', () => { expect(back(ecgAtProgress)).toEqual(steps().map(ecgAtProgress)); });
});

describe('OCD story by progress', () => {
  it('ticket starts at 0% with nothing lit, ends on PROD with all four lit', () => {
    expect(ocdAt(0)).toEqual({ left: 0, lit: 0 }); expect(ocdAt(1)).toEqual({ left: stationLeft(3), lit: 4 });
  });
  it('lights stations one by one as the ticket reaches each, never skipping', () => {
    const seen: number[] = [];
    for (const p of steps(1000)) { const l = ocdAt(p).lit; if (seen[seen.length - 1] !== l) seen.push(l); }
    expect(seen).toEqual([0, 1, 2, 3, 4]);
  });
  it('ticket sits exactly on a station when it lights it, and moves forward only with progress', () => {
    const l = steps(1000).map((p) => ocdAt(p));
    l.forEach((x, i) => { if (i) expect(x.left).toBeGreaterThanOrEqual(l[i - 1].left); if (x.lit) expect(x.left).toBeGreaterThanOrEqual(stationLeft(x.lit - 1) - 1e-9); });
  });
  it('is reversible: scrolling up carries the ticket back and unlights stations', () => {
    expect(back(ocdAt)).toEqual(steps().map(ocdAt));
    expect(ocdAt(0.5).lit).toBeLessThan(4); expect(ocdAt(0.5).left).toBeLessThan(stationLeft(3));
  });
});
