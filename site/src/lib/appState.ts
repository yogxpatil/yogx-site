import { createStore } from './store';

/** Where the intro leaves Robo (viewport px: left edge, distance from the bottom, chibi height): the guide's home spot. */
export type Perch = { left: number; bottom: number; size: number };

export const appStore = createStore({
  entered: false, night: false, sound: false,
  /** the hero blob may draw: the intro flips it at its handoff (before that the WebGL blob is mounted but paused) */
  blobLive: false,
  /** the hero blob has done its heavy one-off setup (code, paint, shaders), so the intro can start without stutter */
  blobWarm: false,
  /** back from the fast lane: the page lands mid-way where the visitor left, so focus is not moved to the headline */
  returning: false,
});

export function setNight(on: boolean): void {
  appStore.set({ night: on });
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('night', on);
}
