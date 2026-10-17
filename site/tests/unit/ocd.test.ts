import { describe, it, expect } from 'vitest';
import { OCD_STATIONS, stationLeft } from '@/lib/missions/ocd';
import { ocd } from '@/content/site';
describe('OCD pipeline', () => {
  it('four stations at 12/37/62/87%, one log line each, fictional ticket', () => {
    expect(OCD_STATIONS).toEqual(['BUILD', 'TEST', 'SB', 'PROD']);
    expect([0, 1, 2, 3].map(stationLeft)).toEqual([12, 37, 62, 87]);
    expect(ocd.logs).toHaveLength(4); expect(ocd.ticket).toMatch(/^YX-04\d\d$/);
  });
});
