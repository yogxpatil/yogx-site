import { describe, it, expect } from 'vitest';
import { formatClock, formatCoords, toneAt, hudInk } from '@/lib/hud';

describe('hud', () => {
  it('formats IST from a UTC instant', () => {
    expect(formatClock(new Date('2026-10-15T06:51:05Z'), 330)).toBe('12:21:05');
    expect(formatClock(new Date('2026-10-15T23:59:59Z'), 330)).toBe('05:29:59');
  });
  it('maps the cursor onto the X/Y plane with Y pointing up', () => {
    expect(formatCoords(0, 1000, 1000, 1000)).toEqual({ x: '0.00', y: '0.00' });
    expect(formatCoords(340, 230, 1000, 1000)).toEqual({ x: '0.34', y: '0.77' });
  });
  it('picks the tone of the band under the probe line', () => {
    const bands = [{ top: -800, bottom: 20, tone: 'light' as const }, { top: 20, bottom: 900, tone: 'dark' as const }];
    expect(toneAt(bands, 40)).toBe('dark');
    expect(toneAt([], 40)).toBe('light');
  });
  it('auto tone follows the breaker: theme ink in day, cream at night', () => {
    expect(hudInk('auto')).toBe('theme'); expect(hudInk('auto', true)).toBe('cream');
  });
  it('maps tones to HUD ink: fixed ink on apricot, cream on dark, theme ink otherwise', () => {
    expect(hudInk('apri')).toBe('ink'); expect(hudInk('apri', true)).toBe('ink');
    expect(hudInk('dark')).toBe('cream'); expect(hudInk('light')).toBe('theme');
  });
});
