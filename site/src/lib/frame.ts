// One seam for "do this on the next animation frame", so component tests can run it at once.
export const nextFrame = (fn: () => void): number => requestAnimationFrame(fn);
export const cancelFrame = (id: number): void => cancelAnimationFrame(id);
