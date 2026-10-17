import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';

const paint = vi.fn();
vi.mock('@/lib/blob/paintAlchemist', () => ({ paintAlchemist: (...a: unknown[]) => paint(...a) }));
vi.mock('@/lib/sound', () => ({ sfx: { splash: vi.fn() } }));
import { useBlobDriver } from '@/components/hero/useBlobDriver';

function Probe() { const r = useRef<HTMLDivElement>(null); useBlobDriver(r); return <div ref={r} />; }

const dpr0 = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
afterEach(() => { if (dpr0) Object.defineProperty(window, 'devicePixelRatio', dpr0); else Reflect.deleteProperty(window, 'devicePixelRatio'); });

describe('useBlobDriver', () => {
  it('repaints after fonts load and on resize', async () => {
    let resolveFonts!: () => void;
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>((r) => { resolveFonts = r; }) } });
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ canvas: document.createElement('canvas') })) as never;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    render(<Probe />);
    const first = paint.mock.calls.length;
    expect(first).toBeGreaterThanOrEqual(1);
    await act(async () => { resolveFonts(); await Promise.resolve(); });
    expect(paint.mock.calls.length).toBe(first + 1);
    await act(async () => { window.dispatchEvent(new Event('resize')); await new Promise((r) => setTimeout(r, 160)); });
    expect(paint.mock.calls.length).toBe(first + 2);
  });

  it('repaints at the new pixel ratio when only devicePixelRatio changes (no resize event)', async () => {
    Object.defineProperty(document, 'fonts', { configurable: true, value: undefined });
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ canvas: document.createElement('canvas') })) as never;
    const listeners = new Map<string, () => void>();
    window.matchMedia = vi.fn((q: string) => ({
      matches: false, media: q,
      addEventListener: (_: string, f: () => void) => listeners.set(q, f), removeEventListener: () => listeners.delete(q),
    })) as never;
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
    paint.mockClear();
    const { unmount } = render(<Probe />);
    expect(paint.mock.calls.at(-1)?.[4]).toBe(1);
    expect([...listeners.keys()]).toContain('(resolution: 1dppx)');
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1.25 });
    await act(async () => { listeners.get('(resolution: 1dppx)')!(); await new Promise((r) => setTimeout(r, 160)); });
    expect(paint.mock.calls.at(-1)?.[4]).toBe(1.25);
    expect([...listeners.keys()]).toEqual(['(resolution: 1.25dppx)']); // re-armed for the next change
    unmount();
    expect(listeners.size).toBe(0);
  });
});
