import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Instruments } from '@/components/hero/Instruments';
import { hero } from '@/content/site';
import { appStore } from '@/lib/appState';

const mockMatchMedia = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduce && q.includes('reduce'),
    media: q,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
    onchange: null, dispatchEvent: () => false,
  }));

describe('Instruments accessibility', () => {
  beforeEach(() => mockMatchMedia(false));
  afterEach(() => {
    vi.unstubAllGlobals();
    appStore.set({ entered: false });
  });

  it('exposes the instruments as a named group', () => {
    render(<Instruments />);
    expect(screen.getByRole('group', { name: 'Live infrastructure instruments' })).toBeInTheDocument();
  });

  it('speaks the final saving and the environment list', () => {
    render(<Instruments />);
    expect(screen.getByText(`Client cost cut by ECS rightsizing: ${hero.savingsPct}%`)).toBeInTheDocument();
    expect(screen.getByText('Environments online: DEV, QA, SB, STG, PROD, PROD2')).toBeInTheDocument();
  });

  it('renders no h5 headings (panel titles are plain divs)', () => {
    const { container } = render(<Instruments />);
    expect(container.querySelector('h5')).toBeNull();
  });

  it('jumps the ring straight to the final value under reduced motion', () => {
    mockMatchMedia(true);
    appStore.set({ entered: true });
    render(<Instruments />);
    expect(screen.getByText(`−${hero.savingsPct}%`)).toBeInTheDocument();
  });
  it('renders the four panels in prototype order: fleet, feed, radar, ring', () => {
    const { container } = render(<Instruments />);
    const ids = [...container.querySelectorAll('[data-panel]')].map((p) => p.getAttribute('data-panel'));
    expect(ids).toEqual(['0', '1', '2', '3']);
    expect(container.querySelector('[data-panel="1"]')!.textContent).toContain('PNL-02 · DEPLOY FEED');
    expect(container.querySelector('[data-panel="2"]')!.textContent).toContain('PNL-03 · ENV RADAR');
  });
  it('shows 0% on the ring before entering (prototype), with a 150px ring', () => {
    const { container } = render(<Instruments />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(container.querySelector('[data-panel="3"] svg')).toHaveAttribute('width', '150');
  });
});
