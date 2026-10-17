import { describe, expect, it } from 'vitest'
import { initialBrain } from '@/lib/robo/brain'
import { loadRobo, saveRobo, introSeen, markIntroSeen } from '@/lib/robo/persist'

function mem(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size },
  } as Storage
}

describe('robo persistence', () => {
  it('round-trips seen, eggs and hushed', () => {
    const st = mem()
    saveRobo({ ...initialBrain(), seen: ['c1'], eggs: ['og3'], hushed: true }, st)
    expect(loadRobo(st)).toEqual({ seen: ['c1'], eggs: ['og3'], hushed: true })
  })

  it('?robo=reset returns {} and removes the key', () => {
    const st = mem()
    saveRobo({ ...initialBrain(), eggs: ['yogx'] }, st)
    expect(loadRobo(st, '?robo=reset')).toEqual({})
    expect(st.getItem('yogx:robo')).toBeNull()
  })

  it('swallows storage errors', () => {
    const bad = {
      getItem: () => { throw new Error('x') },
      setItem: () => { throw new Error('x') },
      removeItem: () => { throw new Error('x') },
    } as unknown as Storage
    expect(loadRobo(bad)).toEqual({})
    expect(loadRobo(bad, '?robo=reset')).toEqual({})
    expect(() => saveRobo(initialBrain(), bad)).not.toThrow()
  })

  it('works with null storage', () => {
    expect(loadRobo(null)).toEqual({})
    expect(() => saveRobo(initialBrain(), null)).not.toThrow()
  })
})

describe('intro seen flag (same yogx:robo record)', () => {
  it('is false until marked, then true', () => {
    const st = mem()
    expect(introSeen(st)).toBe(false)
    markIntroSeen(st)
    expect(introSeen(st)).toBe(true)
  })
  it('survives the brain saving its own fields, and marking keeps the brain fields', () => {
    const st = mem()
    saveRobo({ ...initialBrain(), seen: ['c1'] }, st)
    markIntroSeen(st)
    saveRobo({ ...initialBrain(), seen: ['c1', 'c2'] }, st)
    expect(introSeen(st)).toBe(true)
    expect(loadRobo(st).seen).toEqual(['c1', 'c2'])
  })
  it('a broken record or throwing storage reads as not seen and never throws', () => {
    const st = mem()
    st.setItem('yogx:robo', '[1,2]')
    expect(introSeen(st)).toBe(false)
    const bad = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } } as unknown as Storage
    expect(introSeen(bad)).toBe(false)
    expect(() => markIntroSeen(bad)).not.toThrow()
  })
})
