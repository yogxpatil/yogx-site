// Robo's decisions: pure. think(state, event, now) -> new state + what to say (or nothing).
import {
  CHAPTER_LINES, DARE_CHAPTERS, DARE_DONE, DARE_WARN, EGG_FOUND, EGG_HINTS, GOSSIP, HINT_CHAPTERS, HINT_ORDER, HUSH_OFF, HUSH_ON, REACT, RESTART_LINE, VISIT_AMBER, VISIT_OFFER,
} from '@/content/robo-script'

export type EggId = 'og3' | 'yogx' | 'breaker5' | 'letterHold' | 'prod2'
export const EGGS: EggId[] = ['og3', 'yogx', 'breaker5', 'letterHold', 'prod2']
export type DareId = 'blob' | 'four' | 'up'
export type Gag = 'painted' | 'dizzy' | 'topple' | 'spoiler' | 'sip' | 'wave' | 'none'

export type ChapterId = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'c7'
export type RoboEvent =
  | { type: 'chapter'; id: ChapterId }
  /** the gap is over: say the pending chapter line if the visitor is still in that chapter, else drop it */
  | { type: 'release'; current: ChapterId | null }
  /** the guide's card went up / came down: while it is up only reactions may speak */
  | { type: 'card'; up: boolean }
  | { type: 'fastScroll' }
  | { type: 'scrollUp' }
  | { type: 'idle' }
  | { type: 'tick' }
  | { type: 'blobTouch' }
  | { type: 'jump'; index: number }
  | { type: 'egg'; id: EggId }
  | { type: 'hush' }
  /** the visit panel opened (counts as the offer taken) */
  | { type: 'visitOpen' }
  /** the visit panel finished with at least one amber stage */
  | { type: 'visitAmber' }
  /** the thrown headline letters start flying back to their slots */
  | { type: 'restart' }

export type Say = { text: string; gag: Gag; announce: boolean; link?: 'fastLane' }

export type BrainState = {
  seen: string[]
  dares: Record<DareId, 'none' | 'warned' | 'done'>
  eggs: EggId[]
  hushed: boolean
  lastAt: number
  lastKind: 'line' | 'reaction' | 'gossip' | null
  cooldown: Partial<Record<'fastScroll' | 'scrollUp' | 'idle', number>>
  rot: number
  /** at most one chapter line held back by the gap */
  pending: ChapterId | null
  cardUp: boolean
  /** the chapter of the latest chapter event */
  current: ChapterId | null
  /** egg hints already said (each is said once) */
  hinted: EggId[]
  /** the one-time 'see your own deploy' offer has been made (or taken) */
  offered: boolean
}

const LINE_GAP = 6000
const REACTION_GAP = 1500
const DARES: DareId[] = ['blob', 'four', 'up']

export function initialBrain(saved: Partial<Pick<BrainState, 'seen' | 'eggs' | 'hushed'>> = {}): BrainState {
  return {
    seen: saved.seen ?? [],
    dares: { blob: 'none', four: 'none', up: 'none' },
    eggs: saved.eggs ?? [],
    hushed: saved.hushed ?? false,
    lastAt: -Infinity,
    lastKind: null,
    cooldown: {},
    rot: 0,
    pending: null,
    cardUp: false,
    current: null,
    hinted: [],
    offered: false,
  }
}

type Out = { state: BrainState; say: Say | null }

function speak(s: BrainState, say: Say, kind: 'line' | 'reaction' | 'gossip', now: number, patch: Partial<BrainState> = {}): Out {
  return { state: { ...s, ...patch, lastAt: now, lastKind: kind }, say }
}

function allowed(s: BrainState, kind: 'line' | 'reaction' | 'gossip', now: number): boolean {
  if (kind !== 'reaction' && s.cardUp) return false
  return now - s.lastAt >= (kind === 'reaction' ? REACTION_GAP : LINE_GAP)
}

function tick(s: BrainState, now: number): Out {
  if (!allowed(s, 'line', now)) return { state: s, say: null }
  // A tick right after gossip stays quiet (never two gossip lines in a row), and lets the next one through.
  if (s.lastKind === 'gossip') return { state: { ...s, lastKind: null }, say: null }
  const here = s.current
  const d = DARES.find((x) => s.dares[x] === 'none' && here !== null && DARE_CHAPTERS[x].includes(here))
  if (d) {
    return speak(s, { text: DARE_WARN[d], gag: 'none', announce: false }, 'line', now, { dares: { ...s.dares, [d]: 'warned' } })
  }
  const h = HINT_ORDER.find((x) => !s.eggs.includes(x) && !s.hinted.includes(x) && here !== null && HINT_CHAPTERS[x].includes(here))
  if (h) return speak(s, { text: EGG_HINTS[h], gag: 'none', announce: false }, 'line', now, { hinted: [...s.hinted, h] })
  if (!s.offered && (here === 'c2' || here === 'c3')) return speak(s, { text: VISIT_OFFER, gag: 'none', announce: false }, 'line', now, { offered: true })
  return speak(s, { text: GOSSIP[s.rot % GOSSIP.length], gag: 'none', announce: false }, 'gossip', now, { rot: s.rot + 1 })
}

function dare(s: BrainState, d: DareId, now: number): Out | null {
  if (s.dares[d] !== 'warned') return null
  const state = { ...s, dares: { ...s.dares, [d]: 'done' as const } }
  if (s.hushed) return { state, say: null }
  if (!allowed(s, 'reaction', now)) return { state: s, say: null }
  const done = DARE_DONE[d]
  return speak(state, { text: done.text, gag: done.gag, announce: false }, 'reaction', now)
}

function behaviour(s: BrainState, k: 'fastScroll' | 'scrollUp' | 'idle', gap: number, gag: Gag, now: number): Out {
  const last = s.cooldown[k]
  if (s.hushed || !allowed(s, 'line', now) || (last !== undefined && now - last < gap)) return { state: s, say: null }
  return speak(s, { text: REACT[k], gag, announce: false }, 'line', now, { cooldown: { ...s.cooldown, [k]: now } })
}

/** When the pending chapter line may be released (ms timestamp), or null when nothing is pending. */
export function pendingDue(s: BrainState): number | null {
  return s.pending ? s.lastAt + LINE_GAP : null
}

function chapterSay(id: ChapterId): Say | null {
  const text = id === 'c4' ? undefined : CHAPTER_LINES[id]
  if (!text) return null
  const say: Say = { text, gag: 'wave', announce: true }
  if (id === 'c1') say.link = 'fastLane'
  return say
}

export function think(s: BrainState, e: RoboEvent, now: number): Out {
  switch (e.type) {
    case 'hush': {
      const hushed = !s.hushed
      return speak({ ...s, pending: null }, { text: hushed ? HUSH_ON : HUSH_OFF, gag: 'none', announce: true }, 'reaction', now, { hushed })
    }
    case 'chapter': {
      if (s.seen.includes(e.id)) return { state: s.current === e.id ? s : { ...s, current: e.id }, say: null }
      const state = { ...s, current: e.id, seen: [...s.seen, e.id] }
      const say = chapterSay(e.id)
      if (!say || s.hushed) return { state, say: null }
      // blocked by the gap: hold it (a newer blocked chapter replaces an older one)
      if (!allowed(s, 'line', now)) return { state: { ...state, pending: e.id }, say: null }
      return speak(state, say, 'line', now, { pending: null })
    }
    case 'visitOpen':
      return { state: s.offered ? s : { ...s, offered: true }, say: null }
    case 'visitAmber':
      if (s.hushed || !allowed(s, 'reaction', now)) return { state: s, say: null }
      return speak(s, { text: VISIT_AMBER, gag: 'none', announce: false }, 'reaction', now)
    case 'restart':
      if (s.hushed || !allowed(s, 'reaction', now)) return { state: s, say: null }
      return speak(s, { text: RESTART_LINE, gag: 'none', announce: false }, 'reaction', now)
    case 'card':
      return { state: { ...s, cardUp: e.up }, say: null }
    case 'release': {
      if (!s.pending || !allowed(s, 'line', now)) return { state: s, say: null }
      const say = s.pending === e.current && !s.hushed ? chapterSay(s.pending) : null
      const state = { ...s, pending: null }
      return say ? speak(state, say, 'line', now) : { state, say: null }
    }
    case 'tick':
      // a pending chapter line keeps the next slot
      return s.hushed || s.pending ? { state: s, say: null } : tick(s, now)
    case 'blobTouch':
      return dare(s, 'blob', now) ?? { state: s, say: null }
    case 'jump':
      return (e.index === 3 ? dare(s, 'four', now) : null) ?? { state: s, say: null }
    case 'scrollUp':
      return dare(s, 'up', now) ?? behaviour(s, 'scrollUp', 30000, 'none', now)
    case 'fastScroll':
      return behaviour(s, 'fastScroll', 30000, 'dizzy', now)
    case 'idle':
      return behaviour(s, 'idle', 60000, 'sip', now)
    case 'egg': {
      if (s.eggs.includes(e.id)) return { state: s, say: null }
      const eggs = [...s.eggs, e.id]
      // Found eggs always count; only the line is held back when hushed or rate-limited.
      if (s.hushed || !allowed(s, 'reaction', now)) return { state: { ...s, eggs }, say: null }
      return speak(s, { text: `${EGG_FOUND[e.id]} (${eggs.length}/${EGGS.length})`, gag: 'none', announce: true }, 'reaction', now, { eggs })
    }
  }
}
