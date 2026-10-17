import { describe, it, expect } from 'vitest';
import { clamp, lerp, easeInOutCubic } from '@/lib/math';

describe('math', () => {
  it('clamps to 0..1 by default', () => {
    expect(clamp(-2)).toBe(0);
    expect(clamp(0.4)).toBe(0.4);
    expect(clamp(7)).toBe(1);
  });
  it('clamps to a custom range', () => { expect(clamp(12, 0, 10)).toBe(10); });
  it('lerps', () => { expect(lerp(10, 20, 0.25)).toBe(12.5); });
  it('eases with fixed ends and a symmetric middle', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(0.25)).toBeCloseTo(1 - easeInOutCubic(0.75));
  });
});
