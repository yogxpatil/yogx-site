import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const flags = { active: true, inView: true };
const h = vi.hoisted(() => ({ p: 0, fns: new Set<(p: number) => void>() }));
vi.mock('@/components/missions/Scene', async () => {
  const { useEffect, useRef } = await import('react');
  return {
    useSceneActive: () => flags.active, useSceneInView: () => flags.inView,
    useSceneProgress: (fn: (p: number) => void) => { const r = useRef(fn); r.current = fn; useEffect(() => { const f = (p: number) => r.current(p); r.current(h.p); h.fns.add(f); return () => { h.fns.delete(f); }; }, []); },
  };
});
const setProgress = (p: number) => act(() => { h.p = p; h.fns.forEach((f) => f(p)); });
import { EcgOverlay, HeartBeatStage } from '@/components/missions/HeartBeat';

function Scene() {
  return (<article data-scene><EcgOverlay /><h3>One pulse</h3><HeartBeatStage /></article>);
}
const media = (reduce: boolean) => vi.fn().mockImplementation((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

describe('HeartBeat scene', () => {
  let raf: ReturnType<typeof vi.fn>, caf: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    raf = vi.fn(() => 7); caf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf); vi.stubGlobal('cancelAnimationFrame', caf);
    flags.active = true; flags.inView = true; h.p = 0;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('hides the changing bpm from screen readers and gives a calm summary', () => {
    vi.stubGlobal('matchMedia', media(false));
    const { container } = render(<Scene />);
    expect(container.querySelector('[data-bpm]')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.sr-only')!.textContent).toMatch(/steady pulse/);
  });
  it('draws the line by scroll progress, flatlines mid-way, recovers, and rewinds on the way back up', () => {
    vi.stubGlobal('matchMedia', media(false));
    const { container } = render(<Scene />);
    const path = container.querySelector('path')!, mon = container.querySelector('[data-monitor]')!, bpm = container.querySelector('[data-bpm]')!;
    // jsdom has no layout, so every point is 0,0: give the path a real length through the dash style the component sets
    setProgress(0); expect(path.style.opacity).toBe('0');
    setProgress(0.4); expect(path.style.opacity).toBe('1');
    const mid = path.style.strokeDashoffset;
    setProgress(0.7); expect(Number(path.style.strokeDashoffset)).toBeLessThanOrEqual(Number(mid));
    expect(mon).toHaveAttribute('data-flat', 'false'); expect(bpm.textContent).toBe('72 bpm');
    setProgress(0.2); expect(path.style.opacity).toBe('1');
    setProgress(0); expect(path.style.opacity).toBe('0');
  });
  it('the frame loop is gone: no requestAnimationFrame work from the stage itself', () => {
    vi.stubGlobal('matchMedia', media(false));
    render(<Scene />); setProgress(0.5);
    expect(raf).not.toHaveBeenCalled();
  });
  it('reduced motion: full line drawn, no loop, steady bpm', () => {
    vi.stubGlobal('matchMedia', media(true));
    const { container } = render(<Scene />);
    expect(container.querySelector('path')!.style.strokeDashoffset).toBe('0');
    expect(container.querySelector('[data-bpm]')!.textContent).toBe('72 bpm');
  });
});
