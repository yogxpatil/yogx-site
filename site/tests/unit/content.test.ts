import { describe, it, expect } from 'vitest';
import { chapters, envs, feedSeed, hero } from '@/content/site';

describe('content', () => {
  it('has the seven chapters in order with unique ids', () => {
    expect(chapters.map((c) => c.name)).toEqual(['Two planes', 'Manifesto', 'Flight path', 'Missions', 'Mission log', 'Transmissions', 'Signal']);
    expect(new Set(chapters.map((c) => c.id)).size).toBe(7);
    expect(chapters.map((c) => c.num)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('lists the six environments', () => { expect(envs).toEqual(['DEV', 'QA', 'SB', 'STG', 'PROD', 'PROD2']); });
  it('seeds at least four deploy rows', () => { expect(feedSeed.length).toBeGreaterThanOrEqual(4); });
  it('has both hero planes', () => {
    expect(hero.architect.join(' ')).toBe('DevOps Architect');
    expect(hero.alchemist.join(' ')).toBe('Digital Alchemist');
  });
});

import { missionLog, transmissions, signal, ccRows, ocd } from '@/content/site';
describe('chapters 5-7 content', () => {
  it('mission log marks years as placeholders and ends with NOW', () => {
    expect(missionLog.yearsPlaceholder).toBe(true); expect(missionLog.rows.at(-1)!.yr).toBe('NOW');
  });
  it('uses fictional ticket ids only', () => {
    [...ccRows.map((r) => r.ticket), ocd.ticket].forEach((t) => expect(t).toMatch(/^YX-04\d\d$/));
  });
  it('has three transmissions and three signal links', () => { expect(transmissions.rows).toHaveLength(3); expect(signal.links).toHaveLength(3); });
});

describe('CommandCenter scene lines', () => {
  it('are the script lines word for word (the bold split comes from the script)', async () => {
    const { roboLines } = await import('@/content/site');
    const { CC_BACKSTORY } = await import('@/content/robo-script');
    expect(roboLines.map((l) => l.map((g) => g.t).join(''))).toEqual(CC_BACKSTORY);
    expect(roboLines[1][0]).toEqual({ t: 'Har galat changelog maine check kiya.', b: true });
  });
});
