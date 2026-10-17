import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';

let frame: () => void = () => {};
vi.mock('@/lib/useScrollFrame', () => ({ useScrollFrame: (cb: () => void) => { frame = cb; } }));
import { ContainerTiles } from '@/components/transitions/ContainerTiles';

afterEach(() => vi.unstubAllGlobals());
describe('ContainerTiles frame work', () => {
  it('skips style writes when progress is unchanged and removes the tiles once fully flipped', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.stubGlobal('innerHeight', 1000);
    let top = 900;
    const { container } = render(<article data-scene><ContainerTiles /></article>);
    const art = container.querySelector('article')!; art.getBoundingClientRect = () => ({ top } as DOMRect);
    const root = container.querySelector('[aria-hidden]') as HTMLElement;
    const tile = container.querySelector('[data-tile]') as HTMLElement;
    frame(); const t1 = tile.style.transform;
    tile.style.transform = 'scale(9)'; frame();
    expect(tile.style.transform).toBe('scale(9)'); // unchanged progress: no writes
    top = 0; frame();
    expect(root.style.display).toBe('none'); // gone, not just invisible: hidden 3D tiles still cost GPU layers
    top = 500; frame();
    expect(root.style.display).toBe('');
    expect(tile.style.transform).not.toBe('scale(9)'); expect(t1).toBeTruthy();
  });
});
