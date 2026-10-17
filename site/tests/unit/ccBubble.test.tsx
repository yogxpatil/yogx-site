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
import { CC_BACKSTORY, CC_OUT_LINE } from '@/content/robo-script';

const LINES = [CC_OUT_LINE, ...CC_BACKSTORY];
const media = (reduce: boolean) => vi.fn().mockImplementation((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

describe('CommandCenter: scene Robo follows scroll progress', () => {
  beforeEach(() => { vi.useFakeTimers(); h.p = 0; vi.stubGlobal('matchMedia', media(false)); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('rows are fixed one by one and VERIFIED stamps going down; all of it rewinds going up', () => {
    const { container } = render(<CommandCenterStage />);
    const status = () => [...container.querySelectorAll('[data-cc-status]')].map((e) => e.textContent), stamp = () => container.querySelector('[data-stamp]')!.getAttribute('data-on');
    const passed = () => status().filter((t) => t === '✓ PASS').length;
    expect(passed()).toBe(0); expect(stamp()).toBe('false');
    setProgress(0.11); const some = passed(); expect(some).toBeGreaterThan(0); expect(some).toBeLessThan(6); expect(stamp()).toBe('false');
    setProgress(0.95); expect(passed()).toBe(6); expect(stamp()).toBe('true');
    setProgress(0.11); expect(passed()).toBe(some); expect(stamp()).toBe('false');
    setProgress(0); expect(passed()).toBe(0);
  });

  it('silent while he works inside the window; then each line holds its range at full opacity, alone, cross-fading between', () => {
    const { container } = render(<CommandCenterStage />);
    const op = () => [...container.querySelectorAll<HTMLElement>('[data-actor-line]')].map((e) => Number(e.style.opacity));
    const bubble = container.querySelector<HTMLElement>('[data-actor-bubble]')!;
    expect(bubble.getAttribute('aria-hidden')).toBe('true');
    setProgress(0.2); expect(op()).toEqual([0, 0, 0, 0, 0]); expect(bubble.style.opacity).toBe('0');
    setProgress(0.4); expect(op()).toEqual([1, 0, 0, 0, 0]); expect(bubble.style.opacity).toBe('1');
    setProgress(0.47); const a = op(); expect(a[0]).toBeGreaterThan(0); expect(a[0]).toBeLessThan(1); expect(a[1]).toBe(0); // fading out, not swapped
    setProgress(0.55); expect(op()).toEqual([0, 1, 0, 0, 0]);
    setProgress(0.95); expect(op()).toEqual([0, 0, 0, 0, 1]);
    setProgress(0.4); expect(op()).toEqual([1, 0, 0, 0, 0]); // rewinds
  });

  it('Robo starts inside the window (clipped), cheers at VERIFIED, climbs out, stomps on the changelog line, sits at the end; and back', () => {
    const { container } = render(<CommandCenterStage />);
    const mood = () => container.querySelector('[data-actor-bot]')!.getAttribute('data-mood');
    const inside = () => container.querySelector<HTMLElement>('[data-scene-actor]')!.dataset.inside;
    setProgress(0); expect(mood()).toBe('angry'); expect(inside()).toBe('true');
    setProgress(0.23); expect(mood()).toBe('jump'); expect(inside()).toBe('true');
    setProgress(0.4); expect(inside()).toBe('false');
    setProgress(0.65); expect(mood()).toBe('angry');
    setProgress(1); expect(mood()).toBe('sit');
    setProgress(0.23); expect(inside()).toBe('true');
  });

  it('the live region only holds complete lines, and only once the visitor settles in a range', () => {
    const { container } = render(<CommandCenterStage />);
    const live = container.querySelector('[data-actor-spoken]') as HTMLElement;
    expect(live.getAttribute('role')).toBe('status');
    for (const p of [0.4, 0.5, 0.65, 0.8]) setProgress(p); // a quick scrub says nothing
    expect(live.textContent).toBe('');
    act(() => { vi.advanceTimersByTime(600); }); expect(live.textContent).toBe(LINES[3]);
    setProgress(0.4); act(() => { vi.advanceTimersByTime(600); }); expect(live.textContent).toBe(LINES[0]);
    setProgress(0); act(() => { vi.advanceTimersByTime(600); }); expect(live.textContent).toBe('');
  });

  it('reduced motion: finished scene, Robo sitting, every line readable as a list', () => {
    vi.stubGlobal('matchMedia', media(true));
    const { container } = render(<CommandCenterStage />);
    const items = [...container.querySelectorAll('[data-actor-lines] li')].map((e) => e.textContent);
    expect(items).toEqual(LINES);
    expect(container.querySelector('[data-actor-bubble]')).toBeNull();
    expect(container.querySelector('[data-stamp]')!.getAttribute('data-on')).toBe('true');
    expect(container.querySelector('[data-actor-bot]')!.getAttribute('data-mood')).toBe('sit');
  });
});
