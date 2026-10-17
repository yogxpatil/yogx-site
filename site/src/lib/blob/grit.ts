/** JS mirror of the shader's grit noise (sin-free Hoskins hash, smooth 2-octave value noise). */
const fract = (x: number) => x - Math.floor(x);
export function hash12(px: number, py: number): number {
  let a = fract(px * 0.1031), b = fract(py * 0.1031), c = fract(px * 0.1031);
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  a += d; b += d; c += d;
  return fract((a + b) * c);
}
export function vnoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const t = hash12(ix, iy) + (hash12(ix + 1, iy) - hash12(ix, iy)) * ux;
  const bt = hash12(ix, iy + 1) + (hash12(ix + 1, iy + 1) - hash12(ix, iy + 1)) * ux;
  return t + (bt - t) * uy;
}
export const fbm = (x: number, y: number): number => (0.6 * vnoise(x, y) + 0.4 * vnoise(x * 2.03 + 17.1, y * 2.03 + 5.3));
/** Rust wash strength at a CSS-pixel position (prototype: .55 * noise - .12). */
export function gritAt(x: number, y: number): number {
  const n = 0.5 + 0.6 * (fbm(x * 0.75, y * 0.75) - 0.5);
  return Math.min(1, Math.max(0, 0.55 * n - 0.12));
}
