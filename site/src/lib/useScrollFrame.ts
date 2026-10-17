'use client';
import { useEffect, useRef } from 'react';

type Fn = () => void;
const subs = new Set<Fn>();
let raf = 0, bound = false;
const flush = () => { raf = 0; subs.forEach((f) => f()); };
const request = () => { if (!raf) raf = requestAnimationFrame(flush); };

/** Run `fn` at most once per animation frame after any scroll or resize (and once right away).
 *  With `watch`: only while that element is near the screen (within one screen height): a chapter far away has
 *  nothing to update, and skipping its layout reads keeps every frame cheaper on a weak PC. Coming near runs it at once. */
export function subscribeScrollFrame(fn: Fn, watch?: Element | null): () => void {
  let near = true, io: IntersectionObserver | null = null;
  const run = () => { if (near) fn(); };
  if (watch && typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver((es) => {
      const was = near; near = es[es.length - 1].isIntersecting;
      if (near && !was) request();
    }, { rootMargin: '100% 0px' });
    io.observe(watch);
  }
  subs.add(run);
  if (!bound && typeof window !== 'undefined') {
    bound = true;
    addEventListener('scroll', request, { passive: true });
    addEventListener('resize', request);
  }
  request();
  return () => { subs.delete(run); io?.disconnect(); };
}

/** Run every subscriber now (after an instant jump behind closed doors). */
export function flushScrollFrame(): void {
  if (raf) cancelAnimationFrame(raf);
  flush();
}

/** `watch`: the chapter element this frame work belongs to (see subscribeScrollFrame). */
export function useScrollFrame(fn: Fn, watch?: React.RefObject<Element | null>): void {
  const ref = useRef(fn);
  ref.current = fn;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => subscribeScrollFrame(() => ref.current(), watch?.current), []);
}
