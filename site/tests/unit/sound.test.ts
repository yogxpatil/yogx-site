import { describe, it, expect, vi } from 'vitest';
import { createSfx } from '@/lib/sound';

function fakeCtx() {
  const counts = { osc: 0, buf: 0 };
  const oscs: { stop: ReturnType<typeof vi.fn> }[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, cancelScheduledValues() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {}, gain: param(), frequency: param(), Q: param(), type: '' });
  const ctx = {
    currentTime: 0, sampleRate: 8000, destination: {}, state: 'running', resume: async () => {},
    createOscillator: () => { counts.osc++; const o = { ...node(), start: vi.fn(), stop: vi.fn() }; oscs.push(o); return o; },
    createGain: node, createBiquadFilter: node,
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => { counts.buf++; return { ...node(), buffer: null, start() {} }; },
  };
  return { ctx, counts, oscs };
}

describe('sound', () => {
  it('stays silent and never creates a context while off', () => {
    let made = 0;
    const sfx = createSfx(() => { made++; return fakeCtx().ctx as never; });
    sfx.click(); sfx.clunk(); sfx.whoosh();
    expect(made).toBe(0);
    expect(sfx.on).toBe(false);
  });
  it('starts a hum when switched on and plays effects', () => {
    const f = fakeCtx();
    const sfx = createSfx(() => f.ctx as never);
    sfx.set(true);
    expect(f.counts.osc).toBe(3); // two detuned saws + one LFO
    sfx.click(); sfx.whoosh();
    expect(f.counts.osc).toBe(4);
    expect(f.counts.buf).toBe(1);
  });
  it('with no Web Audio, set(true) does not throw and the switch stays off', () => {
    const sfx = createSfx(() => { throw new Error('no audio'); });
    expect(() => sfx.set(true)).not.toThrow();
    expect(sfx.on).toBe(false);
    expect(() => { sfx.click(); sfx.clunk(); sfx.whoosh(); sfx.splash(); sfx.blip(); sfx.beep(); }).not.toThrow();
  });
  it('effects swallow errors thrown by the audio graph', () => {
    const f = fakeCtx();
    const sfx = createSfx(() => f.ctx as never);
    sfx.set(true);
    f.ctx.createGain = () => { throw new Error('boom'); };
    expect(() => { sfx.click(); sfx.whoosh(); }).not.toThrow();
  });
  it('stops the three hum oscillators shortly after set(false)', () => {
    vi.useFakeTimers();
    try {
      const f = fakeCtx();
      const sfx = createSfx(() => f.ctx as never);
      sfx.set(true);
      expect(f.oscs).toHaveLength(3);
      sfx.set(false);
      f.oscs.forEach((o) => expect(o.stop).not.toHaveBeenCalled());
      vi.advanceTimersByTime(700);
      f.oscs.forEach((o) => expect(o.stop).toHaveBeenCalledTimes(1));
    } finally { vi.useRealTimers(); }
  });
});
