import { describe, it, expect } from 'vitest';
import { tokens, textPairs } from '@/theme/tokens';
import { contrast } from '@/theme/contrast';

describe('theme', () => {
  it('computes known contrast ratios', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1);
  });
  it.each(textPairs)('%s on %s (%s) is readable', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('never uses pure black or white', () => {
    for (const v of Object.values(tokens)) {
      expect(v.toLowerCase()).not.toBe('#000000');
      expect(v.toLowerCase()).not.toBe('#ffffff');
    }
  });
});
