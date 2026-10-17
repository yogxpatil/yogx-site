type P = [number, number];
/** ECG polyline: leaves the monitor at (x0, yStart), drops to the headline height y, then runs left; the 4th beat is a flat run. */
export function buildEcg(x0: number, yStart: number, y: number) {
  const pts: P[] = [[x0, yStart], [x0 - 30, y]];
  let x = x0 - 30, k = 0, flatA = 0, flatB = 0;
  const rel = (dx: number, dy: number) => { const [px, py] = pts[pts.length - 1]; pts.push([px + dx, py + dy]); };
  while (x > -40) {
    const beat = k !== 3; k++;
    if (beat) {
      pts.push([x - 60, y]); rel(-10, -8); rel(-10, 8);
      pts.push([x - 110, y]); rel(-10, -60); rel(-12, 120); rel(-10, -78); rel(-10, 18);
      pts.push([x - 200, y]);
    } else { flatA = x; pts.push([x - 260, y]); flatB = x - 260; }
    x -= beat ? 200 : 260;
  }
  return { pts, d: 'M' + pts.map((p) => `${p[0]} ${p[1]}`).join(' L'), flatA, flatB };
}
export const cumLengths = (pts: P[]) => pts.reduce<number[]>((c, p, i) => (c.push(i ? c[i - 1] + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), c), []);
export function pointAt(pts: P[], cum: number[], L: number): P {
  let i = 1; while (i < cum.length - 1 && cum[i] < L) i++;
  const k = Math.min(1, Math.max(0, (L - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)));
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
}
/** Scroll-driven draw: nothing until 8% of the scene, fully drawn by 70%; the line then stays (and rewinds on the way up). */
export const ecgAtProgress = (p: number) => {
  const drawn = Math.min(1, Math.max(0, (p - 0.08) / 0.62));
  return { drawn, opacity: drawn > 0 ? 1 : 0, headOpacity: drawn > 0 && drawn < 1 ? 1 : 0 };
};
export const isFlat = (x: number, flatA: number, flatB: number, k: number) => x < flatA && x > flatB && k < 0.8;
