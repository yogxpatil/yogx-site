import { describe, it, expect } from 'vitest';
import { portalState, DIVE_AT } from '@/lib/transitions/portal';
const o = { x: 400, y: 300, fs: 200 };
describe('portal dive (proto lines 973-979)', () => {
  it('rests flat at 0: no transform, portal hidden', () => {
    const s = portalState(0, o); expect(s.heroTransform).toBe('none'); expect(s.portalOpacity).toBe(0); expect(s.tone).toBe('light');
  });
  it('halfway scales by 60^0.5 and the window grows with it', () => {
    const s = portalState(0.5, o);
    expect(s.scale).toBeCloseTo(Math.sqrt(60), 4);
    expect(s.heroTransform).toBe(`scale(${s.scale})`);
    expect(s.clip).toBe(`ellipse(${200 * 0.17 * s.scale}px ${200 * 0.22 * s.scale}px at 400px 300px)`);
    expect(s.portalOpacity).toBe(1);
  });
  it('hides the hero from 0.97 so the huge GPU layer never blanks the page', () => {
    const s = portalState(0.97, o); expect(s.heroHidden).toBe(true); expect(s.heroTransform).toBe('none');
  });
  it('label fades in after 0.55; HUD tone turns dark', () => {
    expect(portalState(0.55, o).labelOpacity).toBe(0); expect(portalState(0.8, o).labelOpacity).toBe(1); expect(portalState(0.6, o).tone).toBe('dark');
  });
  it('reduced motion: no zoom, the dark window fades in full-screen', () => {
    const s = portalState(0.5, o, true);
    expect(s.heroTransform).toBe('none'); expect(s.clip).toBe('none'); expect(s.portalOpacity).toBeCloseTo(0.5);
  });
  it('the blob stops rendering once the dive passes the threshold, and is already invisible by then', () => {
    expect(portalState(0, o).heroDiving).toBe(false);
    expect(portalState(DIVE_AT - 0.01, o).heroDiving).toBe(false);
    expect(portalState(DIVE_AT, o).heroDiving).toBe(true);
    expect(portalState(0.5, o).heroDiving).toBe(true);
    expect(portalState(0, o).blobOpacity).toBe(1); expect(portalState(0.02, o).blobOpacity).toBe(1);
    expect(portalState(0.06, o).blobOpacity).toBeCloseTo(0.5); expect(portalState(DIVE_AT, o).blobOpacity).toBe(0);
    expect(portalState(0.04, o).heroDiving).toBe(false); // scrolling back restores it
  });
  it('reduced motion never pauses or fades the blob', () => {
    const s = portalState(0.5, o, true); expect(s.heroDiving).toBe(false); expect(s.blobOpacity).toBe(1);
  });
});
