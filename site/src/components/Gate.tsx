'use client';
import { useCallback, useEffect, useRef } from 'react';
import { appStore, setNight } from '@/lib/appState';
import { setScrollEnabled, jumpToY } from '@/lib/scroll';
import { clearNight, consumeReturn, savedNight } from '@/lib/fastLane';
import { Intro } from './intro/Intro';

/** No click-to-enter any more: hosts the automatic intro and opens the site when it ends (or is skipped). */
export function Gate({ onEntered }: { onEntered?: () => void }) {
  const opened = useRef(false);
  // what the gate used to do on click: unlock scrolling, make the page interactive (HeroWrap focuses the headline)
  const open = useCallback(() => {
    if (opened.current) return;
    opened.current = true;
    document.body.classList.remove('locked');
    appStore.set({ entered: true });
    setScrollEnabled(true);
    onEntered?.();
  }, [onEntered]);

  // coming back from the fast lane: no intro (it sees the class and ends at once), land where the visitor left
  useEffect(() => {
    const y = consumeReturn();
    // the head script's flag has done its job (the intro has read it): never leave it behind, even with no saved spot
    document.documentElement.classList.remove('yogx-returning');
    if (y === null) return;
    // night: the saved flag, or the class the fast lane already put on <html> (client-side navigation keeps it)
    setNight(savedNight() || document.documentElement.classList.contains('night'));
    clearNight();
    appStore.set({ returning: true });
    open();
    requestAnimationFrame(() => jumpToY(y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Intro onDone={open} />;
}
