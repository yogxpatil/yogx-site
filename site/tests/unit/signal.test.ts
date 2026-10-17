import { describe, it, expect } from 'vitest';
import { signalState } from '@/lib/chapters/signal';
describe('signal merge (proto lines 775-778)', () => {
  it('halves apart at 0', () => { expect(signalState(0)).toEqual({ left: 'translateX(0%)', right: 'translateX(0%)', merge: 0, seal: 0, sealTransform: 'rotate(-20deg) scale(0.6)' }); });
  it('fully merged with the OG seal by 1/1.3', () => {
    const s = signalState(1 / 1.3); expect(s.left).toBe('translateX(20%)'); expect(s.merge).toBe(1); expect(s.seal).toBe(1); expect(s.sealTransform).toBe('rotate(-8deg) scale(1)');
  });
});
