import type { Tone } from '@/content/site';
const pad = (n: number) => String(n).padStart(2, '0');
export function formatClock(d: Date, offsetMin: number): string {
  const t = new Date(d.getTime() + offsetMin * 60000);
  return `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`;
}
export const formatCoords = (x: number, y: number, w: number, h: number) => ({ x: (x / w).toFixed(2), y: (1 - y / h).toFixed(2) });
/** Which HUD colour a tone needs: cream on dark scenes, fixed ink on the apricot scene (it stays light in night mode), else the theme ink. 'auto' chapters are dark at night. */
export const hudInk = (tone: Tone, night = false): 'cream' | 'ink' | 'theme' =>
  tone === 'dark' || (tone === 'auto' && night) ? 'cream' : tone === 'apri' ? 'ink' : 'theme';
export function toneAt(bands: { top: number; bottom: number; tone: Tone }[], probeY = 40): Tone {
  let tone: Tone = 'light';
  for (const b of bands) if (b.top <= probeY && b.bottom > probeY) tone = b.tone;
  return tone;
}
