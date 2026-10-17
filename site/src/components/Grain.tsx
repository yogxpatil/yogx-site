const noise = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .4 0 0 0 0 .35 0 0 0 0 .25 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
export function Grain() {
  return <div aria-hidden data-grain style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 90, opacity: 'var(--grain-op, .13)' as unknown as number, mixBlendMode: 'var(--grain-blend, multiply)' as never, backgroundImage: noise }} />;
}
