import { describe, it, expect } from 'vitest';
import { gritAt } from '@/lib/blob/grit';

describe('grit noise scaling', () => {
  it('mean rust wash is ~0.15 with a gentle spread', () => {
    const v: number[] = [];
    for (let y = 0; y < 300; y += 3) for (let x = 0; x < 300; x += 3) v.push(gritAt(x + 0.5, y + 0.5));
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
    expect(mean).toBeGreaterThan(0.12); expect(mean).toBeLessThan(0.18);
    expect(sd).toBeLessThan(0.08);
  });
});
