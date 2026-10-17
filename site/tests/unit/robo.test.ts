import { describe, it, expect } from 'vitest';
import { moodStyle, eyeOffset } from '@/lib/missions/robo';
describe('Robo (port of CommandCenter Companion, proto lines 787-818)', () => {
  it('moods set lamp colour, cheeks and head tilt', () => {
    expect(moodStyle('angry')).toEqual({ light: '#ff7a52', cheekOpacity: 0.8, head: 'rotate(-6deg)' });
    expect(moodStyle('happy')).toEqual({ light: '#f99e67', cheekOpacity: 0.28, head: 'rotate(4deg) translateY(-2px)' });
    expect(moodStyle('calm').head).toBe('none');
  });
  it('eyes follow the pointer within 2.4 × 1.6 px', () => {
    const e = eyeOffset(100, 0); expect(e.x).toBeCloseTo(2.4); expect(e.y).toBeCloseTo(0);
    expect(eyeOffset(0, -50).y).toBeCloseTo(-1.6);
  });
});
