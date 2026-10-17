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

/**
 * A pinned chapter whose content may be taller than the screen (mission log, transmissions): the section is
 * `contentH + extra` tall, its frame sticks, and the content slides up inside the frame by `shift` px, slower than the
 * page scrolls, so each part gets more scroll. p: 0 when the section top reaches the screen top (doors open, the
 * previous scene's peel done), 1 at PIN_END of the way, before the section starts to leave. Pure and reversible.
 */
export function pinTravel(top: number, contentH: number, vh: number, extra: number): { p: number; shift: number } {
  const travel = Math.max(0, contentH - vh), p = clamp(-top / ((travel + extra) * PIN_END || 1));
  return { p, shift: p * travel };
}

/** The story ends this far into the pin, so it is finished a little before the scene starts to scroll away. */
export const PIN_END = 0.9;
/**
 * Progress through a pinned (sticky) scene whose pin lasts `extra` px: 0 while its top is at or below the screen top
 * (a door zone before it has only just finished opening there), 1 at PIN_END of the pin, comfortably before the
 * scene starts to leave and before the next door zone starts closing. Pure, so scrolling up gives the same values.
 */
export function pinnedProgress(top: number, extra: number): number {
  return clamp(-top / (extra * PIN_END || 1));
}
