import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const h = vi.hoisted(() => ({ p: 0, fns: new Set<(p: number) => void>() }));
vi.mock('@/components/missions/Scene', async () => {
  const { useEffect, useRef } = await import('react');
  return {
    useSceneProgress: (fn: (p: number) => void) => { const r = useRef(fn); r.current = fn; useEffect(() => { const f = (p: number) => r.current(p); r.current(h.p); h.fns.add(f); return () => { h.fns.delete(f); }; }, []); },
  };
});
const setProgress = (p: number) => act(() => { h.p = p; h.fns.forEach((f) => f(p)); });
import { OcdStage } from '@/components/missions/OcdStage';

describe('OCD ticket follows scroll progress', () => {
  beforeEach(() => {
    vi.useFakeTimers(); h.p = 0;
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('moves down the pipeline lighting stations, and walks back (unlighting) when progress rewinds', () => {
    const { container } = render(<OcdStage />);
    const lit = () => container.querySelectorAll('[class*="lit"]').length, ticket = () => container.querySelector('[class*="ticket"]') as HTMLElement;
    expect(lit()).toBe(0); expect(ticket().style.left).toBe('0%');
    setProgress(0.5); const mid = parseFloat(ticket().style.left); expect(mid).toBeGreaterThan(0); expect(mid).toBeLessThan(87);
    const litMid = lit(); expect(litMid).toBeGreaterThan(0); expect(litMid).toBeLessThan(4);
    setProgress(1); expect(lit()).toBe(4); expect(ticket().style.left).toBe('87%'); expect(container.textContent).toContain('→ build #812');
    setProgress(0.5); expect(lit()).toBe(litMid); expect(parseFloat(ticket().style.left)).toBeCloseTo(mid);
    setProgress(0); expect(lit()).toBe(0); expect(ticket().style.left).toBe('0%'); expect(container.textContent).not.toContain('→ build #812');
  });

  it('holds still when scrolling stops: no timer or animation moves the ticket', () => {
    const { container } = render(<OcdStage />);
    const animate = vi.fn(); (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
    setProgress(0.5); const at = (container.querySelector('[class*="ticket"]') as HTMLElement).style.left;
    act(() => { vi.advanceTimersByTime(10000); });
    expect((container.querySelector('[class*="ticket"]') as HTMLElement).style.left).toBe(at);
    expect(animate).not.toHaveBeenCalled();
  });
});
