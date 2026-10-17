import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Scene } from '@/components/missions/Scene';
import { OcdStage } from '@/components/missions/OcdStage';
import { missions, ocd } from '@/content/site';

const mm = (reduce: boolean) => vi.fn().mockImplementation((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

describe('Missions reduced motion', () => {
  it('scene is revealed at once, OCD stations lit and every log line shown', () => {
    vi.stubGlobal('matchMedia', mm(true));
    const { container } = render(<Scene mission={missions[3]} stage={<OcdStage />} />);
    expect(container.querySelector('[data-scene]')).toHaveAttribute('data-in', 'true');
    expect(container.textContent).toContain(ocd.logs[3]);
    expect(container.textContent).toContain(ocd.logs[0]);
    vi.unstubAllGlobals();
  });
});
