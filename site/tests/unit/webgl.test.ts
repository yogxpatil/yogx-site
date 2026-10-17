import { describe, it, expect, vi, afterEach } from 'vitest';
import { canUseWebGL } from '@/lib/blob/webgl';
import { createBlobGl } from '@/components/hero/blobGl';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('canUseWebGL', () => {
  it('false when webgl2 is unavailable', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
    expect(canUseWebGL()).toBe(false);
  });
  it('true with webgl2 and releases the probe context', () => {
    const loseContext = vi.fn();
    const gl = { getExtension: vi.fn(() => ({ loseContext })) };
    HTMLCanvasElement.prototype.getContext = vi.fn((k: string) => (k === 'webgl2' ? gl : null)) as never;
    expect(canUseWebGL()).toBe(true);
    expect(loseContext).toHaveBeenCalled();
  });
});

// a stand-in WebGL2 context: every call is recorded, constants are their own names
function fakeGl() {
  const calls: [string, unknown[]][] = [];
  const gl = new Proxy({} as Record<string, unknown>, {
    get: (_t, k: string) => {
      if (/^[A-Z0-9_]+$/.test(k)) return k;
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'isContextLost') return () => false;
      if (k === 'getExtension') return () => ({ loseContext: () => calls.push(['loseContext', []]) });
      return (...a: unknown[]) => { calls.push([k, a]); return {}; };
    },
  });
  return { gl, calls, of: (n: string) => calls.filter(([k]) => k === n).map(([, a]) => a) };
}

describe('blobGl (the hero blob on plain WebGL2, drawn the way three drew it)', () => {
  it('no webgl2: no blob GL (the SVG blob takes over)', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
    expect(createBlobGl(document.createElement('canvas'))).toBeNull();
  });
  it('painted plane: no Y flip, raw colours (no premultiply, no colour-space conversion), mipmapped; straight-alpha blending', () => {
    const f = fakeGl();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => f.gl) as never;
    const g = createBlobGl(document.createElement('canvas'))!;
    g.upload(document.createElement('canvas'));
    expect(f.of('pixelStorei')).toEqual(expect.arrayContaining([['UNPACK_FLIP_Y_WEBGL', false], ['UNPACK_PREMULTIPLY_ALPHA_WEBGL', false], ['UNPACK_COLORSPACE_CONVERSION_WEBGL', 'NONE']]));
    expect(f.of('generateMipmap')).toHaveLength(1);
    expect(f.of('blendFuncSeparate')).toEqual([['SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA', 'ONE', 'ONE_MINUS_SRC_ALPHA']]);
  });
  it('buffer size = css size x device pixel ratio clamped to 1..2; every draw clears to transparent first', () => {
    const f = fakeGl();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => f.gl) as never;
    const c = document.createElement('canvas'), g = createBlobGl(c)!;
    vi.stubGlobal('devicePixelRatio', 3);
    g.resize(800.6, 450.2);
    expect([c.width, c.height]).toEqual([1601, 900]);
    vi.stubGlobal('devicePixelRatio', 0.5);
    g.resize(800, 450);
    expect([c.width, c.height]).toEqual([800, 450]);
    g.draw({ balls: [[1, 2, 3]], astro: [0, 0, 0], res: [800, 450], time: 1 });
    const order = f.calls.map(([k]) => k);
    expect(order.lastIndexOf('clear')).toBeLessThan(order.lastIndexOf('drawArrays'));
    expect(f.of('uniform2f')).toContainEqual([{}, 800, 450]);
  });
});
