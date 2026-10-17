import { describe, it, expect, vi, afterEach } from 'vitest';
import { canUseWebGL } from '@/lib/blob/webgl';
import { createBlobGl, drawable } from '@/components/hero/blobGl';
import { fragment } from '@/components/hero/blobShader';

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

  // the orange flash at the intro handoff: an unpositioned frame painted the whole Alchemist plane full screen
  it('drawable: only a measured stage with a real radius is drawn', () => {
    expect(drawable({ balls: [], res: [1, 1] })).toBe(false);                    // the old warm-up frame
    expect(drawable({ balls: [[0, 0, 0]], res: [1440, 900] })).toBe(false);       // radius not set yet
    expect(drawable({ balls: [[700, 400, 120]], res: [1, 1] })).toBe(false);      // stage not measured yet
    expect(drawable({ balls: [[700, 400, 120]], res: [1440, 900] })).toBe(true);
  });
  it('an unpositioned frame only clears to transparent (no draw call)', () => {
    const f = fakeGl();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => f.gl) as never;
    const g = createBlobGl(document.createElement('canvas'))!;
    g.draw({ balls: [], astro: [0, 0, 0], res: [1, 1], time: 0 });
    g.draw({ balls: [[0, 0, 0]], astro: [0, 0, 0], res: [1440, 900], time: 0 });
    expect(f.of('drawArrays')).toHaveLength(0);
    expect(f.of('clear').length).toBeGreaterThanOrEqual(2);
  });
  it('warm-up draws once to compile the pipeline, then clears: nothing of it stays on the canvas', () => {
    const f = fakeGl();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => f.gl) as never;
    const g = createBlobGl(document.createElement('canvas'))!;
    g.warm();
    const order = f.calls.map(([k]) => k);
    expect(f.of('drawArrays')).toHaveLength(1);
    expect(order.lastIndexOf('clear')).toBeGreaterThan(order.lastIndexOf('drawArrays'));
  });
  it('the shader outputs transparent while the main ball has no radius', () => {
    expect(fragment).toMatch(/if \(uBalls\[0\]\.z <= 0\.0\) \{ gl_FragColor = vec4\(0\.0\); return; \}/);
  });
});
