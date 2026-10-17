import { describe, it, expect } from 'vitest';
import { mapPointer } from '@/components/hero/useBlobDriver';
describe('mapPointer', () => {
  it('is identity at scale 1', () => { expect(mapPointer(150, 80, { left: 100, top: 50, width: 400 }, 400)).toEqual({ x: 50, y: 30 }); });
  it('divides by the current zoom scale', () => { expect(mapPointer(300, 250, { left: 100, top: 50, width: 800 }, 400)).toEqual({ x: 100, y: 100 }); });
  it('falls back to scale 1 when unmeasured', () => { expect(mapPointer(10, 10, { left: 0, top: 0, width: 0 }, 0)).toEqual({ x: 10, y: 10 }); });
});
