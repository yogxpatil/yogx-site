import { clamp } from '@/lib/math';

/**
 * 0..1 progress through a scene from its viewport box. 0 while the top edge is still at 80% of the viewport (the
 * scene is just peeking in); 1 once the top has scrolled 40% of a viewport above the screen top (the scene is still
 * 60% on screen, so every story ends comfortably visible and the middle of it gets about a screen of scroll). A taller
 * (stacked, mobile) scene gets extra distance so the stage in its lower half is on screen when the story ends. A pure
 * function of position, so scrolling back up gives the same numbers in reverse.
 */
export function sceneProgress(top: number, height: number, vh: number): number {
  const from = vh * 0.8, to = -vh * 0.4 - Math.max(0, height - vh) * 0.6;
  return clamp((from - top) / (from - to || 1));
}
