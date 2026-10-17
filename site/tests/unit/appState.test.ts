import { describe, it, expect, vi } from 'vitest';
import { createStore } from '@/lib/store';
import { appStore, setNight } from '@/lib/appState';

describe('store', () => {
  it('merges patches and notifies subscribers', () => {
    const s = createStore({ a: 1, b: 2 });
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.set({ a: 5 });
    expect(s.get()).toEqual({ a: 5, b: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
    off(); s.set({ b: 9 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('night mode', () => {
  it('toggles the html class and the store', () => {
    setNight(true);
    expect(document.documentElement.classList.contains('night')).toBe(true);
    expect(appStore.get().night).toBe(true);
    setNight(false);
    expect(document.documentElement.classList.contains('night')).toBe(false);
  });
});
