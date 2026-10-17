import { describe, it, expect } from 'vitest';
import { peelState, riseState } from '@/lib/transitions/peel';
import { waveD } from '@/lib/chapters/wave';
describe('stack peel (proto lines 989-994)', () => {
  it('flat while the OCD scene still reaches the screen bottom', () => { expect(peelState(1000, 1000).transform).toBe('none'); });
  it('tilts back, shrinks and darkens as it lifts away', () => {
    const s = peelState(500, 1000);
    expect(s.transform).toBe('perspective(1400px) rotateX(17deg) scale(0.95)'); expect(s.filter).toBe('brightness(0.825)');
    expect(s.boxShadow).toBe('0 20px 40px -10px rgba(22,19,8,0.275)');
  });
  it('the log header rises from beneath', () => {
    expect(riseState(1000, 1000)).toEqual({ transform: 'scale(0.9) translateY(40px)', opacity: 0.4 });
    expect(riseState(0, 1000)).toEqual({ transform: 'scale(1) translateY(0px)', opacity: 1 });
  });
  it('waveform spans 0..1000 in 8 px steps', () => { const d = waveD(0); expect(d.startsWith('M0 20 L0 20')).toBe(true); expect(d.split(' L')).toHaveLength(127); });
});
