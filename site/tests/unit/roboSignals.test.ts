import { describe, expect, it } from 'vitest'
import { holdOver, keyAllowed, speedTracker, tapCounter, typedWord, upTracker } from '@/lib/robo/signals'

describe('speedTracker', () => {
  it('fires once for a 200 ms burst at 6000 px/s', () => {
    const f = speedTracker()
    let y = 0, t = 0, fired = 0
    f(y, t)
    for (let i = 0; i < 20; i++) { t += 10; y += 60; if (f(y, t) === 'fast') fired++ }
    expect(fired).toBe(1)
  })
  it('does not fire for a 100 ms burst', () => {
    const f = speedTracker()
    let y = 0, t = 0, fired = 0
    f(y, t)
    for (let i = 0; i < 10; i++) { t += 10; y += 60; if (f(y, t) === 'fast') fired++ }
    for (let i = 0; i < 10; i++) { t += 10; if (f(y, t) === 'fast') fired++ }
    expect(fired).toBe(0)
  })
  it('re-arms after slowing', () => {
    const f = speedTracker()
    let y = 0, t = 0, fired = 0
    const burst = () => { for (let i = 0; i < 20; i++) { t += 10; y += 60; if (f(y, t) === 'fast') fired++ } }
    f(y, t)
    burst()
    for (let i = 0; i < 10; i++) { t += 10; y += 1; f(y, t) }
    burst()
    expect(fired).toBe(2)
  })
})

describe('upTracker', () => {
  it('true once for a 300 px upward run, false for 100 px', () => {
    const f = upTracker()
    let y = 1000, hits = 0
    f(y)
    for (let i = 0; i < 30; i++) { y -= 10; if (f(y)) hits++ }
    expect(hits).toBe(1)
    const g = upTracker()
    y = 1000; g(y)
    let h = 0
    for (let i = 0; i < 10; i++) { y -= 10; if (g(y)) h++ }
    expect(h).toBe(0)
  })
  it('a downward move starts a new run', () => {
    const f = upTracker()
    let y = 1000; f(y)
    for (let i = 0; i < 30; i++) { y -= 10; f(y) }
    y += 10; f(y)
    let hits = 0
    for (let i = 0; i < 30; i++) { y -= 10; if (f(y)) hits++ }
    expect(hits).toBe(1)
  })
})

describe('tapCounter', () => {
  it('true on the 5th tap within 3 s, then resets', () => {
    const f = tapCounter(5, 3000)
    expect([0, 500, 1000, 1500].map(f)).toEqual([false, false, false, false])
    expect(f(2000)).toBe(true)
    expect(f(2100)).toBe(false)
  })
  it('false when spread over 4 s', () => {
    const f = tapCounter(5, 3000)
    expect([0, 1000, 2000, 3000, 4000].map(f).some(Boolean)).toBe(false)
  })
})

describe('typedWord', () => {
  it('matches Y o g x mixed case inside other keys', () => {
    const f = typedWord('yogx')
    const hits = ['a', 'Y', 'o', 'G', 'q', 'y', 'o', 'g', 'X'].map(f)
    expect(hits.filter(Boolean).length).toBe(1)
    expect(hits[hits.length - 1]).toBe(true)
  })
  it('ignores non-character keys', () => {
    const f = typedWord('yogx')
    expect(['y', 'o', 'Shift', 'g', 'x'].map(f).pop()).toBe(true)
  })
})

describe('holdOver', () => {
  it('true once after 3000 ms continuous, re-arms after false', () => {
    const f = holdOver(3000)
    expect(f(true, 0)).toBe(false)
    expect(f(true, 2999)).toBe(false)
    expect(f(true, 3000)).toBe(true)
    expect(f(true, 4000)).toBe(false)
    expect(f(false, 4100)).toBe(false)
    expect(f(true, 5000)).toBe(false)
    expect(f(true, 8000)).toBe(true)
  })
  it('an interruption resets the clock', () => {
    const f = holdOver(3000)
    f(true, 0); f(false, 2000)
    expect(f(true, 2500)).toBe(false)
    expect(f(true, 4000)).toBe(false)
  })
})

describe('keyAllowed', () => {
  const base = { key: 'r', ctrlKey: false, metaKey: false, altKey: false, target: null as EventTarget | null }
  it('false before entered', () => expect(keyAllowed(base, false)).toBe(false))
  it('true when entered and plain', () => expect(keyAllowed(base, true)).toBe(true))
  it('false with ctrl/meta/alt', () => {
    expect(keyAllowed({ ...base, ctrlKey: true }, true)).toBe(false)
    expect(keyAllowed({ ...base, metaKey: true }, true)).toBe(false)
    expect(keyAllowed({ ...base, altKey: true }, true)).toBe(false)
  })
  it('false in INPUT / TEXTAREA / contentEditable', () => {
    expect(keyAllowed({ ...base, target: document.createElement('input') }, true)).toBe(false)
    expect(keyAllowed({ ...base, target: document.createElement('textarea') }, true)).toBe(false)
    const d = document.createElement('div')
    Object.defineProperty(d, 'isContentEditable', { value: true })
    expect(keyAllowed({ ...base, target: d }, true)).toBe(false)
  })
})
