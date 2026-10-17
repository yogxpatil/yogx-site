import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { FlightPath } from '@/components/chapters/FlightPath';
import { flight } from '@/content/site';

const mm = (reduce: boolean) => vi.fn().mockImplementation((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

describe('FlightPath reduced motion', () => {
  it('is fully drawn and static: route complete, every milestone and the OG seal on', () => {
    vi.stubGlobal('matchMedia', mm(true));
    const { container } = render(<FlightPath />);
    const ms = container.querySelectorAll('[data-ms]');
    expect(ms).toHaveLength(flight.milestones.length);
    ms.forEach((g) => expect(g).toHaveAttribute('data-on', 'true'));
    expect(container.querySelector('[data-og]')).toHaveAttribute('data-on', 'true');
    expect((container.querySelector('path[d^="M110"]') as SVGPathElement).style.strokeDashoffset).toBe('0');
    expect(Number(container.querySelector('[data-dot]')!.getAttribute('cx'))).toBeCloseTo(920, 0);
    vi.unstubAllGlobals();
  });
  it('labels the screen-reader milestone list', () => {
    vi.stubGlobal('matchMedia', mm(false));
    const { getByLabelText } = render(<FlightPath />);
    expect(getByLabelText('Career milestones')).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
