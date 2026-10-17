import { describe, it, expect } from 'vitest';
import { patchRing, patchMark, PATCH_PATH } from '@/lib/missions/patch';
describe('mission patch', () => {
  it('ring text and centre mark match the prototype', () => {
    expect(patchRing('CC-01', 'COMMANDCENTER')).toBe('MISSION CC-01 · COMMANDCENTER · YOGX ·');
    expect(patchMark('OCD-04')).toBe('OCD');
    expect(PATCH_PATH).toBe('M52 52 m-40 0 a40 40 0 1 1 80 0 a40 40 0 1 1 -80 0');
  });
});
