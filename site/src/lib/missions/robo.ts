export type Mood = 'calm' | 'angry' | 'happy';
export const moodStyle = (m: Mood) => ({
  light: m === 'angry' ? '#ff7a52' : '#f99e67',
  cheekOpacity: m === 'angry' ? 0.8 : 0.28,
  head: m === 'angry' ? 'rotate(-6deg)' : m === 'happy' ? 'rotate(4deg) translateY(-2px)' : 'none',
});
export const eyeOffset = (dx: number, dy: number) => { const a = Math.atan2(dy, dx); return { x: Math.cos(a) * 2.4, y: Math.sin(a) * 1.6 }; };

export type Seg = { t: string; b?: boolean };
