import type { Gag } from './brain';

export type Mood = 'idle' | 'walk' | 'run' | 'jump' | 'angry' | 'sad' | 'sadWalk' | 'dizzy' | 'namaste' | 'wave' | 'point' | 'sit';

/** What Robo does with his body for each gag the brain can ask for. */
export function gagMood(g: Gag): Mood {
  switch (g) {
    case 'wave': return 'wave';
    case 'sip': return 'sit';
    case 'dizzy': return 'dizzy';
    case 'painted': return 'jump';
    case 'topple': return 'sad';
    case 'spoiler': return 'point';
    default: return 'idle';
  }
}
