'use client';
import { useEffect } from 'react';
import { clearNight, savedNight } from '@/lib/fastLane';

/** The root layout locks the body for the gate; this route has no gate. Also carries day/night over from the main page. */
export function Unlock() {
  useEffect(() => {
    document.body.classList.remove('locked');
    document.documentElement.classList.toggle('night', savedNight());
    clearNight();
  }, []);
  return null;
}
