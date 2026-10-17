'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { canUseWebGL } from '@/lib/blob/webgl';
import { appStore } from '@/lib/appState';
import { useStore } from '@/lib/store';
import { BlobFallback } from './BlobFallback';

const LiquidBlob = dynamic(() => import('./LiquidBlob'), { ssr: false, loading: () => null });

/** Either blob mounts at once but draws nothing until the intro hands over (appStore.blobLive), so its heavy setup
 *  (paint, shader or image) happens before the intro moves. WebGL whenever the browser can do it, on every tier: the
 *  lite tier measured slower with the SVG blob (its goo blur + grit filter repaint every frame) than with the WebGL one,
 *  and WebGL is now only a few KB of code. The SVG blob is for browsers without WebGL, or when WebGL fails to start or
 *  its context is lost; that swap is one-way for the visit. A tier change mid-visit never swaps the blob. */
export function HeroBlob() {
  const [gl, setGl] = useState<boolean | null>(null);
  const live = useStore(appStore, (x) => x.blobLive);
  useEffect(() => { setGl(canUseWebGL()); }, []);
  const fail = useCallback(() => {
    setGl(false);
    if (!appStore.get().blobWarm) appStore.set({ blobWarm: true }); // the intro must not sit out its 2 s wait cap
  }, []);
  if (gl === null) return null;
  return gl ? <LiquidBlob onFail={fail} /> : <BlobFallback live={live} />;
}
