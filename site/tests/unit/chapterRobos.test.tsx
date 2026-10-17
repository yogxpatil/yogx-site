import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MissionLog } from '@/components/chapters/MissionLog';
import { Signal } from '@/components/chapters/Signal';
import { Transmissions } from '@/components/chapters/Transmissions';
import { CHAPTER_LINES, LOG_LINES, TX_LINES } from '@/content/robo-script';
import { missionLog, transmissions } from '@/content/site';

const mm = (reduce: boolean) => vi.fn().mockImplementation((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

describe('scene Robos in the closing chapters', () => {
  it('each chapter with a Robo marks itself as an actor zone (the guide steps aside there)', () => {
    vi.stubGlobal('matchMedia', mm(false));
    for (const C of [MissionLog, Transmissions, Signal]) {
      const { container, unmount } = render(<C />);
      expect(container.querySelector('section')).toHaveAttribute('data-actor-zone');
      expect(container.querySelector('[data-scene-actor]')).not.toBeNull();
      unmount();
    }
  });
  it('one line per entry / post, and the finale says the last chapter line', () => {
    expect(LOG_LINES).toHaveLength(missionLog.rows.length);
    expect(TX_LINES).toHaveLength(transmissions.rows.length);
    for (const l of [...LOG_LINES, ...TX_LINES]) expect(l.length).toBeLessThanOrEqual(90);
    vi.stubGlobal('matchMedia', mm(false));
    const { container } = render(<Signal />);
    expect(container.querySelector('[data-actor-line="0"]')!.textContent).toBe(CHAPTER_LINES.c7);
  });
  it('reduced motion: every mission-log entry shows its Robo line in the row itself', async () => {
    vi.stubGlobal('matchMedia', mm(true));
    const { container } = render(<MissionLog />);
    await waitFor(() => expect(container.querySelectorAll('[data-log-say]')).toHaveLength(LOG_LINES.length));
    expect([...container.querySelectorAll('[data-log-say]')].map((e) => e.textContent)).toEqual(LOG_LINES.map((l) => `Robo: ${l}`));
    expect(container.querySelector('[data-actor-bubble]')).toBeNull();
  });
  it('reduced motion: transmissions and the finale list their lines', async () => {
    vi.stubGlobal('matchMedia', mm(true));
    const tx = render(<Transmissions />);
    await waitFor(() => expect([...tx.container.querySelectorAll('[data-actor-lines] li')].map((e) => e.textContent)).toEqual(TX_LINES));
    const sig = render(<Signal />);
    await waitFor(() => expect(sig.container.querySelector('[data-actor-lines] li')!.textContent).toBe(CHAPTER_LINES.c7));
  });
});
