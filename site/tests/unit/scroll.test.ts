import { describe, it, expect, vi } from 'vitest';
import { sectionProgress, entryProgress, setLenis, scrollToId, setScrollEnabled, jumpToY } from '@/lib/scroll';

describe('scroll maths', () => {
  it('section progress runs 0..1 across the sticky range', () => {
    expect(sectionProgress(0, 2000, 1000)).toBe(0);
    expect(sectionProgress(-500, 2000, 1000)).toBe(0.5);
    expect(sectionProgress(-1000, 2000, 1000)).toBe(1);
    expect(sectionProgress(300, 2000, 1000)).toBe(0);
  });
  it('a section exactly one screen tall reports 1 once it reaches the top', () => {
    expect(sectionProgress(0, 1000, 1000)).toBe(1);
  });
  it('entry progress runs 0..1 as the top crosses the viewport', () => {
    expect(entryProgress(1000, 1000)).toBe(0);
    expect(entryProgress(500, 1000)).toBe(0.5);
    expect(entryProgress(-10, 1000)).toBe(1);
  });
});

describe('scrollToId', () => {
  it('uses Lenis when present', () => {
    const scrollTo = vi.fn();
    document.body.innerHTML = '<section id="c3"></section>';
    setLenis({ scrollTo } as never);
    scrollToId('c3');
    expect(scrollTo).toHaveBeenCalledWith(document.getElementById('c3'), expect.objectContaining({ immediate: false }));
    setLenis(null);
  });
  it('falls back to native scrolling without Lenis', () => {
    document.body.innerHTML = '<section id="c2"></section>';
    const el = document.getElementById('c2')!;
    el.scrollIntoView = vi.fn();
    scrollToId('c2', { immediate: true });
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto' });
  });
});

describe('setScrollEnabled', () => {
  it('stops and starts Lenis', () => {
    const stop = vi.fn(), start = vi.fn();
    setLenis({ scrollTo: vi.fn(), stop, start } as never);
    setScrollEnabled(false);
    expect(stop).toHaveBeenCalledTimes(1);
    setScrollEnabled(true);
    expect(start).toHaveBeenCalledTimes(1);
    setLenis(null);
  });
  it('does nothing without Lenis', () => {
    setLenis(null);
    expect(() => setScrollEnabled(false)).not.toThrow();
  });
});

describe('jumpToY', () => {
  it('asks Lenis for an immediate, forced jump (works while Lenis is stopped)', () => {
    const scrollTo = vi.fn(); setLenis({ scrollTo } as never);
    jumpToY(1234);
    expect(scrollTo).toHaveBeenCalledWith(1234, { immediate: true, force: true });
    setLenis(null);
  });
  it('falls back to window.scrollTo', () => {
    const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    jumpToY(50);
    expect(spy).toHaveBeenCalledWith({ top: 50, behavior: 'instant' });
  });
});
