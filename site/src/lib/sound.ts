import { appStore } from './appState';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AudioContextLike = any;
export type Sfx = { readonly on: boolean; set(v: boolean): void; click(): void; clunk(): void; whoosh(): void; splash(): void; blip(): void; beep(): void };

export function createSfx(makeCtx: () => AudioContextLike): Sfx {
  let ctx: AudioContextLike | null = null, on = false, hum: { g: any; oscs: any[] } | null = null;
  const ac = () => (ctx ??= makeCtx());
  const env = (node: any, g: number, a: number, d: number) => {
    const c = ac(), t = c.currentTime, G = c.createGain();
    G.gain.setValueAtTime(0, t); G.gain.linearRampToValueAtTime(g, t + a); G.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    node.connect(G); G.connect(c.destination); return t + a + d;
  };
  const osc = (type: string, f0: number, f1: number, dur: number, g: number) => {
    if (!on) return;
    try {
      const c = ac(), o = c.createOscillator(), t = c.currentTime;
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const end = env(o, g, 0.005, dur); o.start(t); o.stop(end + 0.05);
    } catch { /* sound is decoration; never throw into the UI */ }
  };
  const noise = (dur: number, f0: number, f1: number, g: number, q = 1) => {
    if (!on) return;
    try {
      const c = ac(), n = c.createBufferSource(), b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
      const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; n.buffer = b;
      const f = c.createBiquadFilter(), t = c.currentTime; f.type = 'bandpass'; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); n.connect(f); env(f, g, 0.02, dur); n.start(t);
    } catch { /* sound is decoration; never throw into the UI */ }
  };
  const startHum = () => {
    if (hum) return; const c = ac(), g = c.createGain(), lp = c.createBiquadFilter();
    const o1 = c.createOscillator(), o2 = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain();
    o1.type = o2.type = 'sawtooth'; o1.frequency.value = 55; o2.frequency.value = 55.4;
    lp.type = 'lowpass'; lp.frequency.value = 170; lfo.frequency.value = 0.08; lg.gain.value = 60;
    lfo.connect(lg); lg.connect(lp.frequency); o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(c.destination);
    const t = c.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 2);
    const oscs = [o1, o2, lfo]; oscs.forEach((o: any) => o.start()); hum = { g, oscs };
  };
  const stopHum = () => {
    if (!hum) return; const h = hum; hum = null; const c = ac(), t = c.currentTime;
    h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(h.g.gain.value, t); h.g.gain.linearRampToValueAtTime(0, t + 0.5);
    setTimeout(() => { h.oscs.forEach((o: any) => { try { o.stop(); } catch { /* already stopped */ } }); try { h.g.disconnect(); } catch { /* gone */ } }, 600);
  };
  return {
    get on() { return on; },
    set(v) {
      if (!v) { on = false; try { stopHum(); } catch { /* ignore */ } return; }
      on = true;
      try { Promise.resolve(ac().resume?.()).catch(() => {}); startHum(); }
      catch { on = false; hum = null; }
    },
    click: () => osc('square', 2200, 1400, 0.025, 0.03),
    clunk: () => { noise(0.12, 600, 120, 0.25, 0.7); osc('sine', 90, 40, 0.18, 0.2); },
    whoosh: () => noise(0.55, 300, 3200, 0.12, 0.8),
    splash: () => { osc('sine', 260, 900, 0.14, 0.08); setTimeout(() => osc('sine', 420, 1200, 0.1, 0.05), 60); },
    blip: () => osc('sine', 880, 1320, 0.06, 0.05),
    beep: () => osc('sine', 1046, 1046, 0.09, 0.05),
  };
}

const base = createSfx(() => new (window.AudioContext || (window as any).webkitAudioContext)());
export const sfx: Sfx = new Proxy(base, {
  get(t, k) {
    if (k === 'set') return (v: boolean) => { t.set(v); appStore.set({ sound: t.on }); };
    return Reflect.get(t, k);
  },
});
