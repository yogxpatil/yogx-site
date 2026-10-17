import { vertex, fragment, N_BALLS } from './blobShader';

/** The blob's whole GPU side: one full-screen quad, one shader, one texture (the painted Alchemist plane). Plain WebGL2:
 *  it replaces three.js + react-three-fiber, which were ~220 KB of gzipped JavaScript to draw these two triangles.
 *  It reproduces what three did for this material: GLSL ES 1.00 shaders, `transparent` blending, a non-premultiplied,
 *  unconverted, mipmapped RGBA texture with flipY off, cleared to transparent before every draw. */
export type BlobGl = {
  /** canvas buffer size for this css size (device pixel ratio clamped to 1..2, like the old Canvas dpr={[1, 2]}) */
  resize(cssW: number, cssH: number): void;
  upload(paint: HTMLCanvasElement): void;
  draw(u: { balls: [number, number, number][]; astro: [number, number, number]; res: [number, number]; time: number }): void;
  readonly width: number; readonly height: number;
  dispose(): void;
};

function shader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s) ?? 'blob shader');
  return s;
}

export function createBlobGl(canvas: HTMLCanvasElement): BlobGl | null {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true, depth: false, stencil: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  // the same GLSL 3.00 wrapping three gave a ShaderMaterial on WebGL2 (so the shader source stays as it was)
  const vs = shader(gl, gl.VERTEX_SHADER, `#version 300 es\n#define attribute in\n#define varying out\nprecision highp float;\nprecision highp int;\nattribute vec3 position;\n${vertex}`);
  const fs = shader(gl, gl.FRAGMENT_SHADER, `#version 300 es\n#define varying in\nlayout(location = 0) out highp vec4 pc_fragColor;\n#define gl_FragColor pc_fragColor\n#define texture2D texture\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\n${fragment}`);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(prog) ?? 'blob program');
  gl.useProgram(prog);
  // the old planeGeometry(2, 2): two triangles over clip space
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, 0, 1, 1, 0, -1, -1, 0, 1, -1, 0]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(prog, 'position');
  gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 0, 0);
  const at = (n: string) => gl.getUniformLocation(prog, n);
  const uBalls = at('uBalls'), uAstro = at('uAstro'), uRes = at('uRes'), uBuf = at('uBuf'), uTime = at('uTime'), uTex = at('uTex');
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(uTex, 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // three's `transparent` material: NormalBlending, straight (non-premultiplied) alpha
  gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  const balls = new Float32Array(N_BALLS * 3);

  return {
    get width() { return canvas.width; }, get height() { return canvas.height; },
    resize(w, h) {
      const dpr = Math.min(Math.max(devicePixelRatio || 1, 1), 2);
      const bw = Math.floor(w * dpr), bh = Math.floor(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    upload(paint) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, paint);
      gl.generateMipmap(gl.TEXTURE_2D);
    },
    draw({ balls: bs, astro, res, time }) {
      bs.forEach(([x, y, r], i) => { balls[i * 3] = x; balls[i * 3 + 1] = y; balls[i * 3 + 2] = r; });
      gl.uniform3fv(uBalls, balls);
      gl.uniform3f(uAstro, astro[0], astro[1], astro[2]);
      gl.uniform2f(uRes, res[0], res[1]);
      gl.uniform2f(uBuf, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      // frees the GPU objects but never loses the context: a remount (StrictMode, next dev) gets the same canvas's
      // context back, and a lost one would leave the blob blank
      gl.deleteTexture(tex); gl.deleteBuffer(buf); gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
    },
  };
}
