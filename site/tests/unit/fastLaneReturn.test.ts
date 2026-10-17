import { describe, it, expect, vi, afterEach } from 'vitest';
import { goFastLane, consumeReturn } from '@/lib/fastLane';

afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); document.documentElement.classList.remove('night'); });

describe('goFastLane', () => {
  it('stores the scroll position and goes to /fast-lane', () => {
    Object.defineProperty(window, 'scrollY', { value: 1234, configurable: true });
    const assign = vi.fn();
    goFastLane(assign);
    expect(sessionStorage.getItem('yogx:return')).toBe('1234');
    expect(assign).toHaveBeenCalledWith('/fast-lane/');
  });
  it('carries night mode across', () => {
    document.documentElement.classList.add('night');
    goFastLane(vi.fn());
    expect(sessionStorage.getItem('yogx:night')).toBe('1');
  });
  it('still navigates when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const assign = vi.fn();
    expect(() => goFastLane(assign)).not.toThrow();
    expect(assign).toHaveBeenCalledWith('/fast-lane/');
  });
});

describe('consumeReturn', () => {
  it('returns the saved position once, then null', () => {
    sessionStorage.setItem('yogx:return', '980');
    expect(consumeReturn()).toBe(980);
    expect(sessionStorage.getItem('yogx:return')).toBeNull();
    expect(consumeReturn()).toBeNull();
  });
  it('returns 0 for a saved top-of-page position', () => {
    sessionStorage.setItem('yogx:return', '0');
    expect(consumeReturn()).toBe(0);
  });
  it('returns null for junk', () => {
    sessionStorage.setItem('yogx:return', 'abc');
    expect(consumeReturn()).toBeNull();
  });
  it('returns null without throwing when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(consumeReturn()).toBeNull();
  });
});
