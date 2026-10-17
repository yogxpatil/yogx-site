import { clamp } from './math';

export type LenisLike = {
  scrollTo(target: HTMLElement | number, opts: { immediate: boolean; duration?: number; force?: boolean }): void;
  stop?(): void; start?(): void;
};

export const sectionProgress = (top: number, height: number, vh: number): number =>
  height <= vh ? (top <= 0 ? 1 : 0) : clamp(-top / (height - vh));
export const entryProgress = (top: number, vh: number): number => clamp((vh - top) / vh);

let lenis: LenisLike | null = null;
export const setLenis = (l: LenisLike | null) => { lenis = l; };

export function scrollToId(id: string, opts: { immediate?: boolean } = {}): void {
  const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
  if (!el) return;
  const immediate = !!opts.immediate;
  if (lenis) lenis.scrollTo(el, { immediate, duration: 1.2 });
  else el.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth' });
}

/** Pause or resume smooth scrolling (Lenis ignores body.locked and would scroll behind the gate). */
export function setScrollEnabled(on: boolean): void {
  if (!lenis) return;
  if (on) lenis.start?.(); else lenis.stop?.();
}

/** Jump instantly to an absolute page offset (used behind closed blast doors). */
export function jumpToY(y: number): void {
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else if (typeof window !== 'undefined') window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
}

export const pageTop = (el: HTMLElement): number => el.getBoundingClientRect().top + window.scrollY;
