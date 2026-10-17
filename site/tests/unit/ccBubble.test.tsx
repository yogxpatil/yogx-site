import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const h = vi.hoisted(() => ({ p: 0, fns: new Set<(p: number) => void>() }));
vi.mock('@/components/missions/Scene', async () => {
  const { useEffect, useRef } = await import('react');
  return {
    useSceneInView: () => true,
    useSceneProgress: (fn: (p: number) => void) => { const r = useRef(fn); r.current = fn; useEffect(() => { const f = (p: number) => r.current(p); r.current(h.p); h.fns.add(f); return () => { h.fns.delete(f); }; }, []); },
  };
});
const setProgress = (p: number) => act(() => { h.p = p; h.fns.forEach((f) => f(p)); });
import { CommandCenterStage } from '@/components/missions/CommandCenterStage';

import { CC_BACKSTORY } from '@/content/robo-script';
const LINES = CC_BACKSTORY;

describe('CommandCenter story follows scroll progress', () => {
  beforeEach(() => {
    vi.useFakeTimers(); h.p = 0;
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('rows are fixed one by one and VERIFIED stamps going down; all of it rewinds going up', () => {
    const { container } = render(<CommandCenterStage />);
    const status = () => [...container.querySelectorAll('[data-cc-status]')].map((e) => e.textContent), stamp = () => container.querySelector('[data-stamp]')!.getAttribute('data-on');
    const passed = () => status().filter((t) => t === '✓ PASS').length;
    expect(passed()).toBe(0); expect(stamp()).toBe('false');
    setProgress(0.72); const some = passed(); expect(some).toBeGreaterThan(0); expect(some).toBeLessThan(6); expect(stamp()).toBe('false');
    setProgress(0.95); expect(passed()).toBe(6); expect(stamp()).toBe('true');
    setProgress(0.72); expect(passed()).toBe(some); expect(stamp()).toBe('false');
    setProgress(0); expect(passed()).toBe(0);
    expect((container.querySelector('[data-cc-robo]') as HTMLElement).style.top).toBe('110%');
  });

  it('Robo moves with progress and returns below the screen when rewound', () => {
    const { container } = render(<CommandCenterStage />);
    const robo = container.querySelector('[data-cc-robo]') as HTMLElement;
    setProgress(0.3); const mid = parseFloat(robo.style.top); expect(mid).toBeLessThan(110);
    setProgress(1); expect(robo.style.left).toBe('7%'); expect(robo.style.top).toBe('36%');
    setProgress(0); expect(robo.style.top).toBe('110%'); expect(robo.style.left).toBe('66%');
  });

  it('typed text is hidden from assistive tech; the live region only ever holds complete lines, and only after a line settles', () => {
    const { container } = render(<CommandCenterStage />);
    const live = container.querySelector('[data-cc-spoken]') as HTMLElement;
    expect(live.getAttribute('role')).toBe('status');
    expect(container.querySelector('[role="status"][class*="bubble"]')).toBeNull();
    const seen = new Set<string>();
    const settle = () => { act(() => { vi.advanceTimersByTime(600); }); seen.add(live.textContent ?? ''); };
    // scrubbing quickly through every line without pausing says nothing mid-way
    for (const p of [0.3, 0.45, 0.55, 0.95]) { setProgress(p); seen.add(live.textContent ?? ''); }
    expect([...seen]).toEqual(['']);
    settle(); expect(live.textContent).toBe(LINES[3]);
    setProgress(0.45); settle(); expect(live.textContent).toBe(LINES[0]);
    setProgress(0.55); settle(); expect(live.textContent).toBe(LINES[1]);
    setProgress(0.7); settle(); expect(live.textContent).toBe(LINES[2]);
    setProgress(0); settle(); expect(live.textContent).toBe('');
    expect([...seen].every((t) => t === '' || LINES.includes(t))).toBe(true);
  });

  it('the speech bubble shows the current step and hides before Robo speaks', () => {
    const { container } = render(<CommandCenterStage />);
    const bubble = container.querySelector('[class*="bubble"]') as HTMLElement;
    expect(bubble.className).not.toMatch(/\bon\b|_on/); expect(bubble.textContent).toBe('');
    setProgress(0.45); expect(bubble.textContent).toContain('CommandCenter'); setProgress(0.55); expect(bubble.textContent).toContain('galat changelog');
    setProgress(0.95); expect(bubble.textContent).toBe('Yahan sukoon hai. No tension. Bas guide karta hoon.');
    setProgress(0.1); expect(bubble.textContent).toBe('');
  });

  it('reduced motion shows the last backstory line straight away', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const { container } = render(<CommandCenterStage />);
    expect(container.querySelector('[class*="bubble"]')!.textContent).toBe(LINES[3]);
    expect(container.querySelector('[data-cc-spoken]')!.textContent).toBe(LINES[3]);
  });
});
