import { describe, it, expect } from 'vitest';
import { segments } from '@/lib/blob/headlineSlots';

describe('headline segments', () => {
  it('DevOps / Digital: D is the only anchor, the rest is one segment', () => {
    expect(segments('DevOps', 'Digital')).toEqual([{ anchor: 'D' }, { page: 'EVOPS', alch: 'IGITAL' }]);
  });
  it('Architect / Alchemist: A, C, H, T are anchors; letters between them are segments', () => {
    expect(segments('Architect', 'Alchemist')).toEqual([
      { anchor: 'A' }, { page: 'R', alch: 'L' }, { anchor: 'C' }, { anchor: 'H' }, { page: 'ITEC', alch: 'EMIS' }, { anchor: 'T' },
    ]);
  });
  it('keeps the longer word\'s extra letters in the last segment', () => {
    expect(segments('AB', 'AXYZ')).toEqual([{ anchor: 'A' }, { page: 'B', alch: 'XYZ' }]);
  });
});
