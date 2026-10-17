'use client';
import { useEffect, useState } from 'react';

/** True while the hero stage containing `ref` is on screen and not hidden or mid-dive in the portal. Defaults to true. */
export function useOnScreen(ref: React.RefObject<HTMLElement | null>): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const host = ref.current;
    const el = host?.closest<HTMLElement>('[data-hero-sticky]') ?? host?.closest('section') ?? host;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let inView = true;
    const hidden = () => el.dataset.heroHidden === '1' || el.dataset.heroDiving === '1';
    const sync = () => setOn(inView && !hidden());
    const io = new IntersectionObserver((entries) => { const e = entries[entries.length - 1]; if (e) { inView = e.isIntersecting; sync(); } });
    io.observe(el);
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(sync) : null;
    mo?.observe(el, { attributes: true, attributeFilter: ['data-hero-hidden', 'data-hero-diving'] });
    return () => { io.disconnect(); mo?.disconnect(); };
  }, [ref]);
  return on;
}
