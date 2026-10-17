import { describe, it, expect, vi } from 'vitest';
import { wait } from '@/lib/wait';

describe('wait', () => {
  it('resolves after the delay', async () => {
    vi.useFakeTimers(); const p = wait(100); vi.advanceTimersByTime(100); await expect(p).resolves.toBeUndefined(); vi.useRealTimers();
  });
  it('rejects with AbortError when aborted', async () => {
    const ac = new AbortController(); const p = wait(10_000, ac.signal); ac.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('rejects at once when the signal is already aborted', async () => {
    const ac = new AbortController(); ac.abort();
    await expect(wait(5, ac.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('drops its abort listener once the timer has resolved', async () => {
    vi.useFakeTimers(); const ac = new AbortController();
    const add = vi.spyOn(ac.signal, 'addEventListener'), rem = vi.spyOn(ac.signal, 'removeEventListener');
    const p = wait(50, ac.signal); vi.advanceTimersByTime(50); await p;
    expect(add).toHaveBeenCalledTimes(1); expect(rem).toHaveBeenCalledWith('abort', add.mock.calls[0][1]);
    vi.useRealTimers();
  });
});
