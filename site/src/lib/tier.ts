'use client';
import { useSyncExternalStore } from 'react';
import { createStore } from './store';
import { weakWindow, type Tier } from './perfTier';

const initial = (): Tier => {
  const t = typeof document !== 'undefined' ? document.documentElement.dataset.tier : undefined;
  return t === 'lite' || t === 'still' ? t : 'full';
};

/** The live tier. Starts from what the <head> script decided (hardware hints); frame-rate sampling after the intro
 *  may then drop a full-tier device to lite if it cannot hold 45 fps. It never goes back up during a visit. */
export const tierStore = createStore({ tier: initial() });

export function setTier(tier: Tier): void {
  if (tierStore.get().tier === tier) return;
  if (typeof document !== 'undefined') document.documentElement.dataset.tier = tier;
  tierStore.set({ tier });
}

/** Server render (and hydration) always sees 'full'; the client's real tier follows right after. */
export function useTier(): Tier {
  return useSyncExternalStore(tierStore.subscribe, () => tierStore.get().tier, () => 'full');
}

export const isLite = (): boolean => tierStore.get().tier === 'lite';

let sampled = false;
/** Watch the frame rate in windows of `ms` (once per visit, called after the intro has finished so its heaviest
 *  second is not what is judged). Windows while the tab is hidden are thrown away; gaps over MAX_GAP do not count;
 *  a frame rate capped at 30 (battery saver) is not weak. Only two weak windows in a row drop a full-tier device to
 *  lite; one good window ends the watch. Lite never swaps the hero blob (see HeroBlob), so this is safe mid-visit. */
export function sampleFps(ms = 1000, maxWindows = 6): void {
  if (sampled || typeof requestAnimationFrame !== 'function') return;
  sampled = true;
  let stamps: number[] = [], bad = 0, windows = 0, hidden = false;
  const tick = (t: number) => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') hidden = true;
    stamps.push(t);
    if (t - stamps[0] < ms) { requestAnimationFrame(tick); return; }
    if (tierStore.get().tier !== 'full') return;
    const weak = hidden ? undefined : weakWindow(stamps);
    windows++;
    if (weak === false) return; // a good window: this device is fine
    if (weak === true) bad++;
    if (bad >= 2) { setTier('lite'); return; }
    if (windows >= maxWindows) return;
    stamps = []; hidden = false;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** For tests: allow another sampling run. */
export function resetFpsSample(): void { sampled = false; }
