import { describe, expect, it } from 'vitest'
import { EGGS, initialBrain, pendingDue, think, type BrainState, type ChapterId, type RoboEvent } from '@/lib/robo/brain'
import {
  CC_BACKSTORY, CHAPTER_LINES, DARE_DONE, DARE_WARN, EGG_HINTS, GOSSIP, HUSH_OFF, HUSH_ON, REACT, RESTART_LINE, VISIT_AMBER, VISIT_OFFER,
} from '@/content/robo-script'

function run(s: BrainState, e: RoboEvent, now: number) {
  return think(s, e, now)
}

describe('robo brain', () => {
  it("chapter c1 says the fast-lane line once with link 'fastLane'", () => {
    const a = run(initialBrain(), { type: 'chapter', id: 'c1' }, 10000)
    expect(a.say).toEqual({ text: CHAPTER_LINES.c1, gag: 'wave', announce: true, link: 'fastLane' })
    expect(run(a.state, { type: 'chapter', id: 'c1' }, 20000).say).toBeNull()
    expect(run(initialBrain(), { type: 'chapter', id: 'c4' }, 10000).say).toBeNull()
  })

  const inChapter = (id: ChapterId, s: BrainState = initialBrain()): BrainState => ({ ...s, current: id, seen: [...s.seen, id] })
  function ticks(s: BrainState, n: number, start = 10000) {
    const said: string[] = []
    let t = start
    for (let i = 0; i < n; i++) {
      const r = run(s, { type: 'tick' }, t)
      s = r.state
      said.push(r.say?.text ?? '<null>')
      t += 7000
    }
    return { said, state: s }
  }

  it('on c1 ticks give the blob dare, then four, then letterHold and prod2 hints in order, never og3', () => {
    const { said } = ticks(inChapter('c1'), 8)
    expect(said.slice(0, 4)).toEqual([DARE_WARN.blob, DARE_WARN.four, EGG_HINTS.letterHold, EGG_HINTS.prod2])
    expect(said).not.toContain(EGG_HINTS.og3)
    expect(said).not.toContain(DARE_WARN.up)
    expect(said[4]).toBe(GOSSIP[0])
    expect(said[5]).toBe('<null>') // never two gossip in a row
    expect(said[6]).toBe(GOSSIP[1])
  })

  it('on c6 a tick never gives the blob dare; it gives the up dare then the og3 hint', () => {
    const { said } = ticks(inChapter('c6'), 4)
    expect(said.slice(0, 2)).toEqual([DARE_WARN.up, EGG_HINTS.og3])
    expect(said).not.toContain(DARE_WARN.blob)
  })

  it('the yogx keyboard hint arrives in c2 before any gossip', () => {
    const { said } = ticks(inChapter('c2'), 5)
    expect(said[0]).toBe(DARE_WARN.four)
    expect(said[1]).toBe(EGG_HINTS.yogx)
    expect(said[2]).toBe(EGG_HINTS.breaker5)
    expect(said.indexOf(EGG_HINTS.yogx)).toBeLessThan(said.findIndex((x) => GOSSIP.includes(x)))
  })

  it('offers the visit panel once, in c2 or c3, after the hints and before gossip; never on c1', () => {
    const c2 = ticks(inChapter('c2'), 6).said
    expect(c2.filter((x) => x === VISIT_OFFER)).toHaveLength(1)
    expect(c2[3]).toBe(VISIT_OFFER)
    expect(ticks(inChapter('c1'), 8).said).not.toContain(VISIT_OFFER)
    expect(ticks({ ...inChapter('c3'), offered: true }, 6).said).not.toContain(VISIT_OFFER)
  })

  it('opening the panel counts as the offer taken, and an amber visit gets one reaction', () => {
    const s = run(inChapter('c2'), { type: 'visitOpen' }, 10000).state
    expect(s.offered).toBe(true)
    expect(ticks(s, 6).said).not.toContain(VISIT_OFFER)
    expect(run(initialBrain(), { type: 'visitAmber' }, 10000).say?.text).toBe(VISIT_AMBER)
    expect(run({ ...initialBrain(), hushed: true }, { type: 'visitAmber' }, 10000).say).toBeNull()
  })

  it('found eggs are not hinted; gossip is all there is before any chapter is known', () => {
    const s = { ...inChapter('c1'), eggs: ['prod2' as const, 'letterHold' as const], dares: { blob: 'done' as const, four: 'done' as const, up: 'done' as const } }
    expect(ticks(s, 1).said[0]).toBe(GOSSIP[0])
    expect(ticks(initialBrain(), 1).said[0]).toBe(GOSSIP[0])
  })

  it('hints start with "Hint: "', () => {
    for (const id of EGGS) expect(EGG_HINTS[id].startsWith('Hint: ')).toBe(true)
  })

  it('a chapter event updates the current chapter even when already seen', () => {
    const s = { ...inChapter('c1'), seen: ['c1', 'c2'] }
    expect(run(s, { type: 'chapter', id: 'c2' }, 20000).state.current).toBe('c2')
  })

  it('a rate-blocked tick does not advance anything', () => {
    let s = inChapter('c1')
    s = run(s, { type: 'tick' }, 10000).state
    const blocked = run(s, { type: 'tick' }, 11000)
    expect(blocked.say).toBeNull()
    expect(run(blocked.state, { type: 'tick' }, 20000).say?.text).toBe(DARE_WARN.four)
  })

  it('dare consequence only after warning', () => {
    let s = inChapter('c1')
    expect(run(s, { type: 'blobTouch' }, 10000).say).toBeNull()
    s = run(s, { type: 'tick' }, 10000).state // warns blob
    const hit = run(s, { type: 'blobTouch' }, 20000)
    expect(hit.say).toEqual({ text: 'Bola tha na!', gag: 'painted', announce: false })
    expect(run(hit.state, { type: 'blobTouch' }, 40000).say).toBeNull()

    s = run(hit.state, { type: 'tick' }, 50000).state // warns four
    expect(run(s, { type: 'jump', index: 2 }, 60000).say).toBeNull()
    expect(run(s, { type: 'jump', index: 3 }, 60000).say?.text).toBe('SPOILER!')

    s = run({ ...s, current: 'c3' }, { type: 'tick' }, 70000).state // warns up (c3)
    const up = run(s, { type: 'scrollUp' }, 80000)
    expect(up.say).toEqual({ text: DARE_DONE.up.text, gag: 'topple', announce: false })
    const later = run(up.state, { type: 'scrollUp' }, 90000)
    expect(later.say?.text).toBe(REACT.scrollUp)
    expect(run(later.state, { type: 'scrollUp' }, 100000).say).toBeNull()
  })

  it('egg found counts and announces', () => {
    let s = initialBrain()
    const a = run(s, { type: 'egg', id: 'og3' }, 10000)
    expect(a.say?.text.endsWith('(1/5)')).toBe(true)
    expect(a.say?.announce).toBe(true)
    expect(run(a.state, { type: 'egg', id: 'og3' }, 20000).say).toBeNull()
    s = a.state
    let t = 20000
    let last = null as ReturnType<typeof think>['say']
    for (const id of EGGS.slice(1)) {
      const r = run(s, { type: 'egg', id }, (t += 5000))
      s = r.state
      last = r.say
    }
    expect(last?.text.endsWith('(5/5)')).toBe(true)
  })

  it('rate limit', () => {
    const a = run(initialBrain(), { type: 'chapter', id: 'c2' }, 10000)
    const b = run(a.state, { type: 'chapter', id: 'c3' }, 11000)
    expect(b.say).toBeNull()
    expect(b.state.seen).toEqual(['c2', 'c3'])

    let s = initialBrain()
    let n = 0
    for (let i = 0; i < 50; i++) {
      const r = run(s, { type: 'fastScroll' }, 10000 + i * 20)
      s = r.state
      if (r.say) n++
    }
    expect(n).toBe(1)
  })

  it('a chapter line blocked by the gap waits (one slot) and plays after the gap if the visitor is still there', () => {
    const a = run(initialBrain(), { type: 'chapter', id: 'c1' }, 10000)
    const b = run(a.state, { type: 'chapter', id: 'c2' }, 11500)
    expect(b.say).toBeNull()
    expect(b.state.pending).toBe('c2')
    expect(pendingDue(b.state)).toBe(16000)
    expect(run(b.state, { type: 'release', current: 'c2' }, 15000).say).toBeNull() // gap not over yet
    expect(run(b.state, { type: 'tick' }, 16000).say).toBeNull() // gossip does not take the pending line's slot
    const c = run(b.state, { type: 'release', current: 'c2' }, 16000)
    expect(c.say).toEqual({ text: CHAPTER_LINES.c2, gag: 'wave', announce: true })
    expect(c.state.pending).toBeNull()
    expect(pendingDue(c.state)).toBeNull()
  })

  it('a pending chapter line is dropped if the visitor moved on; a newer blocked chapter replaces it', () => {
    const a = run(initialBrain(), { type: 'chapter', id: 'c1' }, 10000)
    const b = run(a.state, { type: 'chapter', id: 'c2' }, 11000)
    const gone = run(b.state, { type: 'release', current: 'c3' }, 16000)
    expect(gone.say).toBeNull()
    expect(gone.state.pending).toBeNull()
    const c = run(b.state, { type: 'chapter', id: 'c3' }, 12000)
    expect(c.state.pending).toBe('c3')
    const d = run(c.state, { type: 'release', current: 'c3' }, 16000)
    expect(d.say?.text).toBe(CHAPTER_LINES.c3)
  })

  it('while a card is up only reactions speak; a chapter line waits and is released after the card is down', () => {
    let s = run(initialBrain(), { type: 'card', up: true }, 0).state
    const ch = run(s, { type: 'chapter', id: 'c2' }, 20000)
    expect(ch.say).toBeNull()
    expect(ch.state.pending).toBe('c2')
    expect(run(ch.state, { type: 'fastScroll' }, 20000).say).toBeNull()
    expect(run(ch.state, { type: 'release', current: 'c2' }, 30000).say).toBeNull() // card still up
    s = ch.state
    s = { ...s, dares: { ...s.dares, blob: 'warned' } }
    expect(run(s, { type: 'blobTouch' }, 20000).say?.text).toBe(DARE_DONE.blob.text)
    expect(run(s, { type: 'egg', id: 'prod2' }, 20000).say).not.toBeNull()
    const down = run(s, { type: 'card', up: false }, 21000)
    expect(down.say).toBeNull()
    expect(run(down.state, { type: 'release', current: 'c2' }, 21000).say?.text).toBe(CHAPTER_LINES.c2)
  })

  it('no pending chapter line while hushed', () => {
    const a = run(initialBrain(), { type: 'hush' }, 10000)
    expect(run(a.state, { type: 'chapter', id: 'c2' }, 11000).state.pending).toBeNull()
  })

  it('hush', () => {
    const a = run(initialBrain(), { type: 'hush' }, 10000)
    expect(a.say?.text).toBe(HUSH_ON)
    const c = run(a.state, { type: 'chapter', id: 'c2' }, 30000)
    expect(c.say).toBeNull()
    const e = run(c.state, { type: 'egg', id: 'yogx' }, 40000)
    expect(e.say).toBeNull()
    expect(e.state.eggs).toEqual(['yogx'])
    expect(run(e.state, { type: 'hush' }, 50000).say?.text).toBe(HUSH_OFF)
  })

  it('an egg blocked by the rate limit is still recorded, with no line said', () => {
    const a = run(initialBrain(), { type: 'egg', id: 'og3' }, 10000)
    const b = run(a.state, { type: 'egg', id: 'yogx' }, 10500)
    expect(b.say).toBeNull()
    expect(b.state.eggs).toEqual(['og3', 'yogx'])
    expect(run(b.state, { type: 'egg', id: 'yogx' }, 30000).say).toBeNull()
  })

  it('script copy is exact', () => {
    expect(CC_BACKSTORY).toEqual([
      'Main pehle CommandCenter mein kaam karta tha.',
      'Har galat changelog maine check kiya. System khud likh sakta tha, phir bhi.',
      'Phir boss impress hua, aur yahan bhi hire kar liya.',
      'Yahan sukoon hai. No tension. Bas guide karta hoon.',
    ])
    expect(CHAPTER_LINES.c1).toBe('Namaste! Main Robo. Iss bande ka tour guide. Jaldi hai? Fast lane le lo →')
  })

  it("headline restart says 'rollout restart…' as a reaction (1.5 s gap), silent when hushed", () => {
    expect(RESTART_LINE).toBe('rollout restart…')
    const a = run(initialBrain(), { type: 'restart' }, 10000)
    expect(a.say).toEqual({ text: RESTART_LINE, gag: 'none', announce: false })
    expect(run(a.state, { type: 'restart' }, 11000).say).toBeNull()
    expect(run(a.state, { type: 'restart' }, 11600).say?.text).toBe(RESTART_LINE)
    expect(run({ ...initialBrain(), hushed: true }, { type: 'restart' }, 10000).say).toBeNull()
  })
})
