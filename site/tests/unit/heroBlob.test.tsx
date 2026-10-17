import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

const h = vi.hoisted(() => ({ create: vi.fn(), webgl: true }));
vi.mock('@/components/hero/blobGl', () => ({ createBlobGl: (...a: unknown[]) => h.create(...a) }));
vi.mock('@/lib/blob/webgl', () => ({ canUseWebGL: () => h.webgl }));
vi.mock('@/lib/blob/paintAlchemist', () => ({ paintAlchemist: vi.fn() }));
vi.mock('@/lib/sound', () => ({ sfx: { splash: vi.fn() } }));
// next/dynamic resolves the import on a later tick in tests: hand back the real component straight away
vi.mock('next/dynamic', async () => {
  const mod = await import('@/components/hero/LiquidBlob');
  return { default: () => mod.default };
});
import { HeroBlob } from '@/components/hero/HeroBlob';
import { appStore } from '@/lib/appState';
import { setTier } from '@/lib/tier';

const fakeGl = () => ({ width: 1, height: 1, resize: vi.fn(), upload: vi.fn(), draw: vi.fn(), warm: vi.fn(), dispose: vi.fn() });

beforeEach(() => {
  h.create.mockReset(); h.webgl = true;
  appStore.set({ blobWarm: false, blobLive: false });
  setTier('full');
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never;
  Object.defineProperty(document, 'fonts', { configurable: true, value: undefined });
});

describe('HeroBlob', () => {
  it('WebGL that fails to start (null context) falls back to the SVG blob and lets the intro go on', () => {
    h.create.mockReturnValue(null);
    const { container } = render(<HeroBlob />);
    expect(container.querySelector('[data-blob="fallback"]')).not.toBeNull();
    expect(container.querySelector('[data-blob="webgl"]')).toBeNull();
    expect(appStore.get().blobWarm).toBe(true);
  });

  it('WebGL that throws while starting also falls back', () => {
    h.create.mockImplementation(() => { throw new Error('shader'); });
    const { container } = render(<HeroBlob />);
    expect(container.querySelector('[data-blob="fallback"]')).not.toBeNull();
  });

  it('a lost WebGL context switches to the SVG blob (and the loss is claimed with preventDefault)', () => {
    h.create.mockReturnValue(fakeGl());
    const { container } = render(<HeroBlob />);
    const canvas = container.querySelector('[data-blob="webgl"] canvas')!;
    const e = new Event('webglcontextlost', { cancelable: true });
    act(() => { canvas.dispatchEvent(e); });
    expect(e.defaultPrevented).toBe(true);
    expect(container.querySelector('[data-blob="fallback"]')).not.toBeNull();
  });

  it('lite tier keeps the WebGL blob when it works (measured cheaper than the SVG one), and a tier drop mid-visit never swaps it', () => {
    h.create.mockReturnValue(fakeGl());
    setTier('lite');
    const { container } = render(<HeroBlob />);
    expect(container.querySelector('[data-blob="webgl"]')).not.toBeNull();
    setTier('full');
    const r2 = render(<HeroBlob />);
    act(() => setTier('lite'));
    expect(r2.container.querySelector('[data-blob="webgl"]')).not.toBeNull();
  });

  it('dispose never loses the context (StrictMode remounts reuse the same canvas)', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/components/hero/blobGl.ts', 'utf8')).not.toMatch(/loseContext\(\)/);
  });

  it('the warm-up before the intro uses warm() (draw then clear), never a frame with no balls at a 1 x 1 size', async () => {
    const g = fakeGl(); h.create.mockReturnValue(g);
    render(<HeroBlob />);
    await act(async () => {});
    expect(appStore.get().blobWarm).toBe(true);
    expect(g.warm).toHaveBeenCalledTimes(1);
    expect(g.draw).not.toHaveBeenCalled(); // not live yet: the loop draws nothing until the intro hands over
  });
});
