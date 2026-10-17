'use client';
import { appStore } from '@/lib/appState';
import { useStore } from '@/lib/store';

/** <main> that nothing can focus or read until the visitor has passed the gate. */
export function MainShell({ children }: { children: React.ReactNode }) {
  const entered = useStore(appStore, (x) => x.entered);
  return <main inert={!entered} aria-hidden={!entered ? true : undefined}>{children}</main>;
}
