import { describe, it, expect, vi } from 'vitest';

describe('scroll frame dispatcher', () => {
  it('runs each subscriber once per frame, however many scroll events fire', async () => {
    const q: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { q.push(cb); return q.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const { subscribeScrollFrame, flushScrollFrame } = await import('@/lib/useScrollFrame');
    const fn = vi.fn();
    const off = subscribeScrollFrame(fn);
    q.splice(0).forEach((cb) => cb(0));
    expect(fn).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('resize'));
    q.splice(0).forEach((cb) => cb(0));
    expect(fn).toHaveBeenCalledTimes(2);
    flushScrollFrame();
    expect(fn).toHaveBeenCalledTimes(3);
    off(); window.dispatchEvent(new Event('scroll')); q.splice(0).forEach((cb) => cb(0));
    expect(fn).toHaveBeenCalledTimes(3);
    vi.unstubAllGlobals();
  });

  it('with a watched element: skips frames while it is far off screen, catches up the moment it comes near', async () => {
    const q: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { q.push(cb); return q.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    let report: (near: boolean) => void = () => {};
    let margin = '';
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: (e: { isIntersecting: boolean }[]) => void, o: { rootMargin: string }) { report = (n) => cb([{ isIntersecting: n }]); margin = o.rootMargin; }
      observe() {} disconnect() {}
    });
    const { subscribeScrollFrame } = await import('@/lib/useScrollFrame');
    const fn = vi.fn();
    const off = subscribeScrollFrame(fn, document.createElement('section'));
    expect(margin).toBe('100% 0px'); // "near" = within one screen height above or below
    q.splice(0).forEach((cb) => cb(0));
    expect(fn).toHaveBeenCalledTimes(1); // runs until the observer has said anything
    report(false);
    window.dispatchEvent(new Event('scroll')); q.splice(0).forEach((cb) => cb(0));
    expect(fn).toHaveBeenCalledTimes(1);
    report(true); q.splice(0).forEach((cb) => cb(0)); // no scroll needed: coming near schedules a frame
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    vi.unstubAllGlobals();
  });
});
