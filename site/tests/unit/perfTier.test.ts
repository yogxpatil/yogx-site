import { describe, it, expect } from 'vitest';
import { vi, afterEach } from 'vitest';
import { perfTier, fpsOver, weakWindow, TIER_SCRIPT, type TierInput } from '@/lib/perfTier';
import { sampleFps, resetFpsSample, setTier, tierStore } from '@/lib/tier';

const MATRIX: [TierInput, 'full' | 'lite' | 'still'][] = [
  [{ reduce: true }, 'still'],
  [{ reduce: true, cores: 2, memory: 2, saveData: true, fps: 20 }, 'still'], // reduced motion wins over everything
  [{ reduce: false }, 'full'], // nothing known: assume a capable device
  [{ reduce: false, cores: 8, memory: 8 }, 'full'],
  [{ reduce: false, cores: 5, memory: 8, fps: 60 }, 'full'],
  [{ reduce: false, cores: 4, memory: 8 }, 'lite'],
  [{ reduce: false, cores: 2 }, 'lite'],
  [{ reduce: false, cores: 8, memory: 4 }, 'lite'],
  [{ reduce: false, cores: 8, memory: 0.5 }, 'lite'],
  [{ reduce: false, cores: 8, memory: 8, saveData: true }, 'lite'],
  [{ reduce: false, cores: 8, memory: 8, fps: 44.9 }, 'lite'],
  [{ reduce: false, cores: 8, memory: 8, fps: 45 }, 'full'],
  [{ reduce: false, cores: 0, memory: 0 }, 'full'], // 0 = the browser did not say: not a hint
];

describe('perfTier', () => {
  it.each(MATRIX)('%o → %s', (input, want) => {
    expect(perfTier(input)).toBe(want);
  });
});

describe('fpsOver', () => {
  it('counts frames per second over the sampled span', () => {
    const t = Array.from({ length: 61 }, (_, i) => i * (1000 / 60)); // 60 frames in 1 s
    expect(fpsOver(t)).toBeCloseTo(60, 5);
  });
  it('a 400 ms stall inside the second drags it down', () => {
    const t = [...Array.from({ length: 37 }, (_, i) => i * 16.67), 600 + 400, 1016.7];
    expect(fpsOver(t)).toBeLessThan(45);
  });
  it('too few frames to tell: no sample', () => {
    expect(fpsOver([])).toBeUndefined();
    expect(fpsOver([5])).toBeUndefined();
  });
});

describe('TIER_SCRIPT (runs in <head> before first paint)', () => {
  // the inline script cannot import the module, so it repeats the hardware rule: it must agree with perfTier
  const run = (nav: { hardwareConcurrency?: number; deviceMemory?: number; connection?: { saveData?: boolean } }, reduce: boolean) => {
    const el = { dataset: {} as Record<string, string> };
    const fn = new Function('navigator', 'matchMedia', 'document', TIER_SCRIPT);
    fn(nav, () => ({ matches: reduce }), { documentElement: el });
    return el.dataset.tier;
  };
  it.each(MATRIX.filter(([i]) => i.fps === undefined))('%o → %s', (i, want) => {
    expect(run({ hardwareConcurrency: i.cores, deviceMemory: i.memory, connection: { saveData: i.saveData } }, i.reduce)).toBe(want);
  });
  it('a browser that throws on any of it still gets a tier', () => {
    const el = { dataset: {} as Record<string, string> };
    new Function('navigator', 'matchMedia', 'document', TIER_SCRIPT)({}, () => { throw new Error('no'); }, { documentElement: el });
    expect(el.dataset.tier).toBe('full');
  });
});

const every = (ms: number, n: number, t0 = 0) => Array.from({ length: n }, (_, i) => t0 + i * ms);

describe('weakWindow (one sampling window)', () => {
  it('60 fps is fine; a slow, uneven 35 fps is weak', () => {
    expect(weakWindow(every(1000 / 60, 61))).toBe(false);
    const uneven = [0]; for (let i = 1; i < 36; i++) uneven.push(uneven[i - 1] + (i % 2 ? 20 : 37));
    expect(weakWindow(uneven)).toBe(true);
  });
  it('gaps over 100 ms (a hidden tab, a load stall) are not counted', () => {
    expect(weakWindow([...every(1000 / 60, 30), 3000, ...every(1000 / 60, 30, 3010)])).toBe(false);
  });
  it('a steady 30 fps (battery saver cap) is not weak', () => {
    expect(weakWindow(every(1000 / 30, 31))).toBe(false);
  });
  it('mostly long gaps: too little to tell', () => {
    expect(weakWindow(every(500, 3))).toBeUndefined();
  });
});

describe('sampleFps (after the intro)', () => {
  let frames: ((t: number) => void)[] = [];
  const pump = (dt: number, n: number) => { for (let i = 0; i < n && frames.length; i++) frames.shift()!((clock += dt)); };
  let clock = 0;
  afterEach(() => { vi.unstubAllGlobals(); resetFpsSample(); setTier('full'); });
  const setup = () => { frames = []; clock = 0; vi.stubGlobal('requestAnimationFrame', (f: (t: number) => void) => { frames.push(f); return frames.length; }); resetFpsSample(); setTier('full'); };

  it('one weak window is not enough; two in a row drop a full-tier device to lite', () => {
    setup(); sampleFps(1000);
    pump(40, 27); // a steady 25 fps: below 45 and not the 30 fps cap
    expect(tierStore.get().tier).toBe('full');
    pump(40, 27);
    expect(tierStore.get().tier).toBe('lite');
  });

  it('a good window ends the watch: a later slow patch never drops it', () => {
    setup(); sampleFps(1000);
    pump(40, 27); pump(1000 / 60, 62); pump(40, 60);
    expect(tierStore.get().tier).toBe('full');
    expect(frames.length).toBe(0);
  });

  it('a capped 30 fps device stays full', () => {
    setup(); sampleFps(1000);
    pump(1000 / 30, 100);
    expect(tierStore.get().tier).toBe('full');
  });
});
