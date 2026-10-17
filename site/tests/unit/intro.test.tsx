import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup, fireEvent } from '@testing-library/react';
import { Intro } from '@/components/intro/Intro';
import { Gate } from '@/components/Gate';
import { MainShell } from '@/components/MainShell';
import { appStore } from '@/lib/appState';

vi.mock('@/components/hero/useBlobDriver', () => ({ blobProbe: () => ({ x: 500, y: 600, r: 120, active: false }) }));
vi.mock('@/lib/sound', () => ({ sfx: { on: false, set: vi.fn(), whoosh: vi.fn(), clunk: vi.fn(), blip: vi.fn() } }));

const anims: { finish: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> }[] = [];
function stubAnimate() {
  Element.prototype.animate = vi.fn(() => {
    const a = { finish: vi.fn(), cancel: vi.fn(), finished: Promise.resolve(), playState: 'running' };
    anims.push(a);
    return a;
  }) as never;
}
const motion = (reduce: boolean) => { window.matchMedia = vi.fn().mockReturnValue({ matches: reduce, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never; };
const run = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  anims.length = 0;
  stubAnimate();
  motion(false);
  localStorage.clear(); sessionStorage.clear();
  document.documentElement.className = '';
  document.body.className = 'locked';
  appStore.set({ entered: false, night: false, sound: false, blobLive: false, blobWarm: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (Element.prototype as { animate?: unknown }).animate;
});

describe('Intro', () => {
  it('renders an aria-hidden overlay that plays by itself and calls onDone exactly once at the end', async () => {
    const onDone = vi.fn();
    const { container } = render(<Intro onDone={onDone} />);
    const el = container.querySelector('[data-intro]')!;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    await run(1000);
    expect(onDone).not.toHaveBeenCalled();
    await run(3000);
    expect(onDone).toHaveBeenCalledTimes(1);
    await run(3000);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-intro]')).toBeNull(); // removes itself afterwards
  });

  it('holds the dark stage until the hero blob has finished its heavy setup (or 2 s at most)', async () => {
    appStore.set({ blobWarm: false });
    const { container } = render(<Intro onDone={() => {}} />);
    const orb = () => (container.querySelector('[data-intro]')!.children[1] as HTMLElement).style.width;
    await run(500);
    expect(orb()).toBe('');
    act(() => { appStore.set({ blobWarm: true }); });
    await run(100); // + waits for an idle moment
    expect(orb()).not.toBe('');
  });

  it('starts anyway after 2 s if the blob never reports ready', async () => {
    appStore.set({ blobWarm: false });
    const onDone = vi.fn();
    render(<Intro onDone={onDone} />);
    await run(2000 + 3500);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('uses the real Robo rig (moods), not a sprite', async () => {
    const { container } = render(<Intro onDone={() => {}} />);
    await run(100);
    expect(container.querySelector('[data-intro] [data-chibi]')).toHaveAttribute('data-mood', 'run');
    await run(700);
    expect(container.querySelector('[data-intro] [data-chibi]')).toHaveAttribute('data-mood', 'jump');
  });

  it('a key press mid-intro skips to the end at once, still calling onDone only once', async () => {
    const onDone = vi.fn();
    const { container } = render(<Intro onDone={onDone} />);
    await run(600);
    fireEvent.keyDown(window, { key: 'a' });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-intro]')).toBeNull();
    expect(appStore.get().blobLive).toBe(true);
    fireEvent.pointerDown(window);
    await run(5000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('the key that skips does only that (other key handlers never see it)', async () => {
    const other = vi.fn();
    window.addEventListener('keydown', other);
    render(<Intro onDone={() => {}} />);
    await run(300);
    fireEvent.keyDown(window, { key: '4' });
    expect(other).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: '4' }); // after the skip keys work normally
    expect(other).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', other);
  });

  it.each(['pointerDown', 'wheel', 'touchStart'] as const)('%s also skips', async (ev) => {
    const onDone = vi.fn();
    render(<Intro onDone={onDone} />);
    await run(300);
    fireEvent[ev](window);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('remembers it was seen, so the next visit plays the short version (~0.8 s)', async () => {
    const first = vi.fn();
    render(<Intro onDone={first} />);
    await run(3500);
    expect(first).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('yogx:robo')!).intro).toBe(true);
    cleanup();
    const second = vi.fn();
    const { container } = render(<Intro onDone={second} />);
    expect(container.querySelector('[data-intro]')).toHaveAttribute('data-kind', 'return');
    await run(900);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('reduced motion: no intro, done at once', async () => {
    motion(true);
    const onDone = vi.fn();
    render(<Intro onDone={onDone} />);
    await run(0);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(appStore.get().blobLive).toBe(true);
  });

  it('still works when storage throws', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const onDone = vi.fn();
    render(<Intro onDone={onDone} />);
    await run(3500);
    expect(onDone).toHaveBeenCalledTimes(1);
    get.mockRestore(); set.mockRestore();
  });
});

describe('Gate hosts the intro', () => {
  it('after the intro: body unlocked, main interactive, entered', async () => {
    const { container } = render(<><Gate /><MainShell><h1 tabIndex={-1}>Hi</h1></MainShell></>);
    expect(container.querySelector('main')).toHaveAttribute('inert');
    await run(3500);
    expect(document.body.classList.contains('locked')).toBe(false);
    expect(appStore.get().entered).toBe(true);
    expect(container.querySelector('main')).not.toHaveAttribute('inert');
  });

  it('coming back from the fast lane: no intro, night restored, flag cleared', async () => {
    sessionStorage.setItem('yogx:return', '640');
    sessionStorage.setItem('yogx:night', '1');
    document.documentElement.classList.add('yogx-returning');
    const { container } = render(<Gate />);
    await run(0);
    expect(appStore.get().entered).toBe(true);
    expect(container.querySelector('[data-intro]')).toBeNull();
    expect(appStore.get().night).toBe(true);
    expect(sessionStorage.getItem('yogx:return')).toBeNull();
    expect(document.documentElement.classList.contains('yogx-returning')).toBe(false);
    document.documentElement.classList.remove('night');
  });
});
