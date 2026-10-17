/** CPU mirror of the shader: Gaussian-blurred discs (σ 15) thresholded by alpha·34 − 15, as in home-v5's #goo filter. */
export const SIGMA = 15;
export const RIM = 5;
export function erfApprox(x: number): number {
  const a = 0.147, x2 = x * x;
  return Math.sign(x) * Math.sqrt(1 - Math.exp((-x2 * (4 / Math.PI + a * x2)) / (1 + a * x2)));
}
export const discCoverage = (d: number, r: number, grow = 0): number => 0.5 - 0.5 * erfApprox((d - r - grow) / (SIGMA * Math.SQRT2));
export const gooAlpha = (a: number): number => Math.min(1, Math.max(0, 34 * a - 15));
export function gooAt(x: number, y: number, balls: [number, number, number][], grow = 0): number {
  let a = 0;
  for (const [bx, by, r] of balls) a += discCoverage(Math.hypot(x - bx, y - by), r, grow);
  return gooAlpha(Math.min(a, 1));
}
