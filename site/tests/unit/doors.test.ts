import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/lib/sound', () => ({ sfx: { clunk: vi.fn() } }));
const jump = vi.fn();
const enable = vi.fn();
vi.mock('@/lib/scroll', () => ({ jumpToY: (y: number) => jump(y), pageTop: () => 5000, setScrollEnabled: (on: boolean) => enable(on) }));
import { appStore } from '@/lib/appState';
vi.mock('@/lib/useScrollFrame', () => ({ flushScrollFrame: vi.fn() }));
vi.mock('@/lib/wait', () => ({ wait: () => Promise.resolve() }));
import { zoneValue, pickDoor, doorShift, isShut, meterLit, sectorDigits, lockText, runDoors, setDoorsHandle, jumpWithDoors, doorsTimed } from '@/lib/transitions/doors';

describe('door zone maths (proto lines 982-983)', () => {
  it('is null until the zone enters the screen', () => { expect(zoneValue(1000, 1000, 1000)).toBeNull(); expect(zoneValue(-1000, 1000, 1000)).toBeNull(); });
  it('closes over the first 40%, holds shut, opens over the last 40%', () => {
    expect(zoneValue(600, 1000, 1000)!.pos).toBeCloseTo(0.5);
    expect(zoneValue(200, 1000, 1000)).toEqual({ pos: 1, unlocked: false });
    expect(zoneValue(-200, 1000, 1000)).toEqual({ pos: 1, unlocked: true });
    expect(zoneValue(-600, 1000, 1000)!.pos).toBeCloseTo(0.5);
  });
  it('the most closed zone wins and brings its label', () => {
    const r = pickDoor([{ v: { pos: 0.3, unlocked: false }, label: 'a' }, { v: null, label: 'b' }, { v: { pos: 0.9, unlocked: true }, label: 'c' }]);
    expect(r).toEqual({ pos: 0.9, unlocked: true, label: 'c' });
    expect(pickDoor([{ v: null, label: 'x' }])).toEqual({ pos: 0, unlocked: false, label: null });
  });
  it('door transforms, seal meter, sector digits, lock text', () => {
    expect(doorShift(0)).toEqual({ top: 'translateY(-101%)', bottom: 'translateY(101%)' });
    expect(doorShift(1)).toEqual({ top: 'translateY(0%)', bottom: 'translateY(0%)' });
    expect(isShut(0.99)).toBe(true); expect(isShut(0.98)).toBe(false);
    expect(meterLit(0.5)).toBe(3); expect(sectorDigits('HB-02')).toBe('02'); expect(sectorDigits('03')).toBe('03');
    expect(lockText(false)).toBe('⛒ SEALED'); expect(lockText(true)).toBe('◉ UNLOCKED · OPENING');
  });
});

/** Fake clock: every frame advances 100 ms and runs the callback synchronously-ish (microtask), so no real rAF is used. */
function fakeClock() {
  let t = 0;
  return { now: () => t, frame: (cb: (n: number) => void) => { t += 100; queueMicrotask(() => cb(t)); } };
}
describe('timed doors', () => {
  const clock = () => fakeClock();
  let fc = clock();
  const J = (i: number) => jumpWithDoors(i, fc.frame, fc.now);
  beforeEach(() => { fc = clock(); jump.mockReset(); enable.mockReset(); appStore.set({ entered: true }); document.body.innerHTML = '<section id="c1"></section><section id="c3"></section>'; });
  it('runDoors eases from → to and ends exactly on the target', async () => {
    const set = vi.fn(); setDoorsHandle({ set });
    let t = 0; const frame = (cb: (n: number) => void) => { t += 100; cb(t); };
    await runDoors(0, 1, 500, { sector: '03', name: 'Flight path' }, frame, () => 0);
    expect(set.mock.calls.at(-1)).toEqual([1, { sector: '03', name: 'Flight path' }, false]);
    setDoorsHandle(null);
  });
  it('jumpWithDoors closes, jumps 2px past the chapter top, reopens; a second call meanwhile is ignored', async () => {
    const set = vi.fn(); setDoorsHandle({ set });
    const a = J(2), b = J(4);
    expect(doorsTimed()).toBe(true);
    await Promise.all([a, b]);
    expect(jump).toHaveBeenCalledTimes(1); expect(jump).toHaveBeenCalledWith(5002);
    expect(set.mock.calls.at(-1)![0]).toBe(0); expect(doorsTimed()).toBe(false);
    setDoorsHandle(null);
  });
  it('a second call to a chapter that exists is also ignored while busy', async () => {
    const set = vi.fn(); setDoorsHandle({ set });
    document.body.innerHTML = '<section id="c1"></section><section id="c3"></section><section id="c4"></section>';
    await Promise.all([J(2), J(3)]);
    expect(jump).toHaveBeenCalledTimes(1);
    setDoorsHandle(null);
  });
  it('reopens the doors even if the jump throws', async () => {
    const set = vi.fn(); setDoorsHandle({ set }); jump.mockImplementationOnce(() => { throw new Error('boom'); });
    await expect(J(2)).rejects.toThrow('boom');
    expect(set.mock.calls.at(-1)![0]).toBe(0); expect(doorsTimed()).toBe(false);
    setDoorsHandle(null);
  });
  it('reports whether the jump was accepted', async () => {
    const set = vi.fn(); setDoorsHandle({ set });
    const a = J(2), b = J(4);
    expect(await a).toBe(true); expect(await b).toBe(false);
    expect(await J(9)).toBe(false);
    setDoorsHandle(null);
  });
  it('stops scrolling during the run and starts it again after', async () => {
    const set = vi.fn(); setDoorsHandle({ set });
    await J(2);
    expect(enable.mock.calls.map((c) => c[0])).toEqual([false, true]);
    setDoorsHandle(null);
  });
  it('starts scrolling again even if the jump throws', async () => {
    const set = vi.fn(); setDoorsHandle({ set }); jump.mockImplementationOnce(() => { throw new Error('boom'); });
    await expect(J(2)).rejects.toThrow('boom');
    expect(enable.mock.calls.map((c) => c[0])).toEqual([false, true]);
    setDoorsHandle(null);
  });
  it('does not re-enable scrolling before the visitor has entered', async () => {
    const set = vi.fn(); setDoorsHandle({ set }); appStore.set({ entered: false });
    await J(2);
    expect(enable).not.toHaveBeenCalledWith(true);
    setDoorsHandle(null);
  });
});
