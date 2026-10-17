'use client';
import { useEffect } from 'react';
import { chapters } from '@/content/site';
import { appStore } from '@/lib/appState';
import { emitRobo } from '@/lib/robo/bus';
import type { RoboEvent } from '@/lib/robo/brain';
import { holdOver, keyAllowed, speedTracker, tapCounter, typedWord, upTracker } from '@/lib/robo/signals';
import { subscribeScrollFrame } from '@/lib/useScrollFrame';
import { blobProbe } from '@/components/hero/useBlobDriver';
import { goFastLane } from '@/lib/fastLane';
import { doorsTimed } from '@/lib/transitions/doors';

const IDLE_MS = 15000, TICK_MS = 20000, SAMPLE_MS = 250;

/** Feeds the Robo bus from the page. Call once (RoboGuide). Does nothing until the visitor has entered. */
export function useRoboSignals(): void {
  useEffect(() => {
    const entered = () => appStore.get().entered;
    const cleanups: Array<() => void> = [];
    const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

    // scroll: fast / up, and chapter arrival (first time 40% of the viewport height is inside the section)
    const speed = speedTracker(), up = upTracker(), arrived = new Set<string>();
    // what a frame found goes to Robo just after that frame, not inside it: his reaction (a line, a walk) is real work,
    // and inside the scroll frame it made a ~70 ms frame on a weak PC as each chapter arrived
    const posted = new Set<ReturnType<typeof setTimeout>>();
    const post = (e: RoboEvent) => { const t = setTimeout(() => { posted.delete(t); emitRobo(e); }, 0); posted.add(t); };
    cleanups.push(() => posted.forEach(clearTimeout));
    const onFrame = () => {
      if (!entered()) return;
      // A Dial / number-key jump moves the page behind closed doors: the trackers still see the move (so it is not
      // counted on the next frame), but it is not the visitor scrolling, and the chapters passed stay unmarked.
      // The doors' last flush runs after the jump ends, so the landing chapter arrives then.
      const fast = speed(scrollY, performance.now()) === 'fast', wentUp = up(scrollY);
      if (doorsTimed()) return;
      if (fast) post({ type: 'fastScroll' });
      if (wentUp) post({ type: 'scrollUp' });
      for (const c of chapters) {
        if (arrived.has(c.id)) continue;
        const el = document.getElementById(c.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const shown = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
        if (shown >= Math.min(innerHeight * 0.4, r.height) && shown > 0) {
          arrived.add(c.id);
          post({ type: 'chapter', id: c.id } as RoboEvent);
        }
      }
    };
    cleanups.push(subscribeScrollFrame(onFrame));
    // The hero is already on screen when the gate opens: check once on entry, without waiting for a scroll.
    let wasEntered = entered();
    cleanups.push(appStore.subscribe(() => {
      const now = entered();
      if (now && !wasEntered) onFrame();
      wasEntered = now;
    }));

    // idle + tick
    let lastAct = Date.now(), idleSent = false;
    const act = () => { lastAct = Date.now(); idleSent = false; };
    const events = ['scroll', 'pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((n) => addEventListener(n, act, { passive: true }));
    cleanups.push(() => events.forEach((n) => removeEventListener(n, act)));
    const idleIv = setInterval(() => {
      if (!entered() || !visible() || idleSent || Date.now() - lastAct < IDLE_MS) return;
      idleSent = true;
      emitRobo({ type: 'idle' });
    }, 1000);
    const tickIv = setInterval(() => { if (entered() && visible() && !idleSent) emitRobo({ type: 'tick' }); }, TICK_MS);
    cleanups.push(() => { clearInterval(idleIv); clearInterval(tickIv); });

    // breaker: five flips within 3 s
    const flips = tapCounter(5, 3000);
    let night = appStore.get().night;
    cleanups.push(appStore.subscribe(() => {
      const n = appStore.get().night;
      if (n === night) return;
      night = n;
      if (entered() && flips(Date.now())) emitRobo({ type: 'egg', id: 'breaker5' });
    }));

    // keys: type "yogx" for an egg, R for the fast lane
    const word = typedWord('yogx');
    const onKey = (e: KeyboardEvent) => {
      if (!keyAllowed(e, entered())) return;
      if (word(e.key)) emitRobo({ type: 'egg', id: 'yogx' });
      if (e.key === 'r' || e.key === 'R') goFastLane();
    };
    addEventListener('keydown', onKey);
    cleanups.push(() => removeEventListener('keydown', onKey));

    // letter hold: blob centre sitting on a letter both headlines share, for 3 s
    // (sampled on a short timer, not per frame: the pointer can rest without any scroll or frame callback firing)
    const hold = holdOver(3000);
    const holdIv = setInterval(() => {
      // reset while away, so a hold does not finish the instant the visitor comes back
      if (!entered() || !visible()) { hold(false, performance.now()); return; }
      const p = blobProbe();
      let inside = false;
      if (p && p.active) {
        for (const el of document.querySelectorAll<HTMLElement>('[data-anchor]')) {
          const r = el.getBoundingClientRect();
          if (p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) { inside = true; break; }
        }
      }
      if (hold(inside, performance.now())) emitRobo({ type: 'egg', id: 'letterHold' });
    }, SAMPLE_MS);
    cleanups.push(() => clearInterval(holdIv));

    return () => cleanups.forEach((f) => f());
  }, []);
}
