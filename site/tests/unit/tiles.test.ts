import { describe, it, expect } from 'vitest';
import { TILES, tilesProgress, tileState } from '@/lib/transitions/tiles';
describe('container tiles', () => {
  it('12 × 7 grid, some labelled c-NN', () => {
    expect(TILES).toHaveLength(84); expect(TILES[0].label).toBe('c-00'); expect(TILES.filter((t) => t.label).length).toBe(10);
  });
  it('flip in a diagonal wave from bottom-left', () => {
    expect(tilesProgress(1000, 1000)).toBe(0); expect(tilesProgress(100, 1000)).toBe(1);
    // not flipped yet: a flat tile, no 3D transform (84 of them would each become a GPU layer before the wave even starts)
    expect(tileState(0, 0, 6)).toEqual({ transform: 'none', opacity: 1 });
    expect(tileState(0.3, 0, 6).transform).toMatch(/^rotateX\(-/);
    expect(tileState(0.6, 0, 6).opacity).toBe(0);
    expect(tileState(0.6, 11, 0).opacity).toBe(1);
  });
});
