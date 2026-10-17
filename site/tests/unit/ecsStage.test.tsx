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
import { EcsStage } from '@/components/missions/EcsStage';
import { ContainerTiles } from '@/components/transitions/ContainerTiles';

const media = (reduce: boolean) => vi.fn().mockImplementation((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

describe('ECS scene', () => {
  beforeEach(() => { flags.active = true; flags.inView = true; h.p = 0; vi.useFakeTimers(); vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn()); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('Robo carries the 12 EC2 boxes into their slots, a tower per container, then the label flips; scrolling up un-stacks', () => {
    vi.stubGlobal('matchMedia', media(false));
    const { container } = render(<EcsStage />);
    const box = () => container.querySelector('[data-box]') as HTMLElement, stage = () => container.querySelector('[data-ecs]') as HTMLElement;
    const inSlot = () => [...container.querySelectorAll<HTMLElement>('[data-box]')].filter((b) => b.dataset.k === '1').length;
    const mood = () => container.querySelector('[data-actor-bot]')!.getAttribute('data-mood');
    expect(container.querySelectorAll('[data-box]')).toHaveLength(12);
    expect(container.querySelectorAll('[data-ctr]')).toHaveLength(3);
    expect(box().textContent).toBe('EC2'); expect(inSlot()).toBe(0); expect(stage()).toHaveAttribute('data-packed', 'false');
    setProgress(0.5); const some = inSlot(); expect(some).toBeGreaterThan(3); expect(some).toBeLessThan(12); expect(box().textContent).toBe('EC2');
    setProgress(0.78); expect(inSlot()).toBe(12); expect(stage()).toHaveAttribute('data-packed', 'true'); expect(box().textContent).toBe('EC2');
    setProgress(0.95); expect(box().textContent).toBe('ECS'); expect(stage().style.getPropertyValue('--ck')).toBe('1'); expect(mood()).toBe('wave');
    // back up: relabel, un-stack, containers fade out
    setProgress(0.5); expect(box().textContent).toBe('EC2'); expect(inSlot()).toBe(some); expect(stage()).toHaveAttribute('data-packed', 'false');
    setProgress(0); expect(inSlot()).toBe(0); expect(stage().style.getPropertyValue('--ck')).toBe('0');
  });
  it('holds when progress stops: no timers move the boxes', () => {
    vi.stubGlobal('matchMedia', media(false));
    const { container } = render(<EcsStage />);
    setProgress(0.35);
    const before = (container.querySelector('[data-box]') as HTMLElement).style.transform;
    act(() => { vi.advanceTimersByTime(5000); });
    expect((container.querySelector('[data-box]') as HTMLElement).style.transform).toBe(before);
  });
  it('reduced motion: boxes already packed and labelled ECS, no tiles', () => {
    vi.stubGlobal('matchMedia', media(true));
    const { container } = render(<><ContainerTiles /><EcsStage /></>);
    expect(container.querySelectorAll('[data-tile]')).toHaveLength(0);
    expect(container.querySelector('[data-ecs]')).toHaveAttribute('data-packed', 'true');
    expect(container.querySelector('[data-box]')!.textContent).toBe('ECS');
  });
  it('tiles are hidden from screen readers', () => {
    vi.stubGlobal('matchMedia', media(false));
    const { container } = render(<ContainerTiles />);
    expect(container.querySelectorAll('[data-tile]')).toHaveLength(84);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ECS stage resize', () => {
  it('re-centres the containers when the stage width changes', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', media(false)); vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
    let cb: () => void = () => {}; const ro = { observe: vi.fn(), disconnect: vi.fn() };
    vi.stubGlobal('ResizeObserver', class { constructor(f: () => void) { cb = f; } observe = ro.observe; disconnect = ro.disconnect; });
    let w = 1000;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => w);
    const { container } = render(<EcsStage />);
    const left = () => (container.querySelector('[data-ctr]') as HTMLElement).style.left;
    expect(left()).toBe('283px');
    w = 600; act(() => cb());
    expect(left()).toBe('83px');
    // the boxes are decoration (hidden from screen readers); Robo's lines are announced by his own live region
    expect(container.querySelector('[data-box]')!.parentElement).toHaveAttribute('aria-hidden', 'true');
    vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals();
  });
});
