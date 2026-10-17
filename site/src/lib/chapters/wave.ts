export function waveD(k: number): string {
  let d = 'M0 20';
  for (let x = 0; x <= 1000; x += 8) d += ` L${x} ${20 + Math.sin(x / 18 + k) * Math.sin(x / 97) * 16}`;
  return d;
}
