import { describe, it, expect } from 'vitest';
import { collectVisit, fmtBytes, fmtMs, stage, type Visit } from '@/lib/visit/metrics';

const base: Visit = { bytes: 1_468_006, requests: 24, ttfb: 82, fcp: 900, lcp: 1800, fps: 60, longTasks: 0, net: { type: '4g', rtt: 50 }, memory: 8, cores: 8, screen: '1440×900' };
const none: Visit = { bytes: null, requests: 0, ttfb: null, fcp: null, lcp: null, fps: null, longTasks: null, net: { type: null, rtt: null }, memory: null, cores: null, screen: '1440×900' };

describe('visit formatting', () => {
  it('formats ms and bytes', () => {
    expect(fmtMs(82.4)).toBe('82 ms');
    expect(fmtMs(2500)).toBe('2.5 s');
    expect(fmtBytes(1_468_006)).toBe('1.4 MB');
    expect(fmtBytes(512)).toBe('512 B');
    expect(fmtBytes(20_480)).toBe('20 KB');
  });
});

describe('stage()', () => {
  it('is green on healthy numbers and shows the real values', () => {
    expect(stage('build', base).ok).toBe('green');
    const ship = stage('ship', base);
    expect(ship.ok).toBe('green');
    expect(ship.lines[0]).toBe('first byte 82 ms');
    expect(stage('run', base).ok).toBe('green');
    expect(stage('env', base).ok).toBe('green');
  });
  it('is amber when lcp > 4 s, ttfb > 800 ms or fps < 50', () => {
    expect(stage('ship', { ...base, lcp: 4200 }).ok).toBe('amber');
    expect(stage('ship', { ...base, ttfb: 900 }).ok).toBe('amber');
    expect(stage('run', { ...base, fps: 31 }).ok).toBe('amber');
  });
  it('is na, with no invented rows, when nothing is exposed', () => {
    for (const n of ['build', 'ship', 'run'] as const) {
      const r = stage(n, none);
      expect(r.ok).toBe('na');
      expect(r.lines.join(' ')).not.toMatch(/\b0\b/);
    }
    expect(stage('env', { ...none, screen: '' }).ok).toBe('na');
  });
  it('hides the bytes row when the transferred total is 0 (cache hits)', () => {
    expect(stage('build', { ...none, bytes: 0, requests: 5 }).lines).toEqual(['5 requests']);
  });
  it('treats rtt 0 as not exposed', () => {
    expect(stage('env', { ...none, net: { type: '4g', rtt: 0 } }).lines).toEqual(['network 4g', 'screen 1440×900']);
  });
  it('hides unexposed fields instead of printing zeros', () => {
    const env = stage('env', { ...base, memory: null, cores: null, net: { type: null, rtt: null } });
    expect(env.lines).toEqual(['screen 1440×900']);
  });
});

describe('collectVisit()', () => {
  it('reads real entries and leaves unexposed fields null', async () => {
    const perf = {
      getEntriesByType: (t: string) => t === 'resource'
        ? [{ transferSize: 1000 }, { transferSize: 2000 }]
        : t === 'navigation' ? [{ responseStart: 82, transferSize: 500 }]
        : t === 'paint' ? [{ name: 'first-contentful-paint', startTime: 300 }] : [],
    } as unknown as Performance;
    const v = await collectVisit(perf, {} as Navigator, 10);
    expect(v.requests).toBe(3);
    expect(v.bytes).toBe(3500);
    expect(v.ttfb).toBe(82);
    expect(v.fcp).toBe(300);
    expect(v.memory).toBeNull();
    expect(v.net).toEqual({ type: null, rtt: null });
  });
});
