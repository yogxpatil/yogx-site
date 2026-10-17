import type { BrainState, EggId } from './brain'
import { EGGS } from './brain'

const KEY = 'yogx:robo'
type Saved = Partial<Pick<BrainState, 'seen' | 'eggs' | 'hushed'>>

function pick(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function loadRobo(storage?: Storage | null, search?: string): Saved {
  const st = pick(storage)
  try {
    if (search && /[?&]robo=reset(&|$)/.test(search)) {
      st?.removeItem(KEY)
      return {}
    }
    const raw = st?.getItem(KEY)
    if (!raw) return {}
    const d = JSON.parse(raw)
    const out: Saved = {}
    if (Array.isArray(d.seen)) out.seen = d.seen.filter((x: unknown) => typeof x === 'string')
    if (Array.isArray(d.eggs)) out.eggs = d.eggs.filter((x: unknown) => EGGS.includes(x as EggId))
    if (typeof d.hushed === 'boolean') out.hushed = d.hushed
    return out
  } catch {
    return {}
  }
}

/** The stored record as a plain object ({} when missing, broken or unavailable). */
function rawRecord(st: Storage | null): Record<string, unknown> {
  try {
    const d = JSON.parse(st?.getItem(KEY) ?? 'null')
    return d && typeof d === 'object' && !Array.isArray(d) ? d : {}
  } catch {
    return {}
  }
}

export function saveRobo(s: BrainState, storage?: Storage | null): void {
  try {
    const st = pick(storage)
    // keep fields other writers own (the intro's seen flag)
    st?.setItem(KEY, JSON.stringify({ ...rawRecord(st), seen: s.seen, eggs: s.eggs, hushed: s.hushed }))
  } catch {
    /* storage unavailable: the site works without it */
  }
}

/** Has this visitor already watched the full intro? false when storage is unavailable. */
export function introSeen(storage?: Storage | null): boolean {
  return rawRecord(pick(storage)).intro === true
}

export function markIntroSeen(storage?: Storage | null): void {
  try {
    const st = pick(storage)
    st?.setItem(KEY, JSON.stringify({ ...rawRecord(st), intro: true }))
  } catch {
    /* storage unavailable: the next visit plays the full intro again */
  }
}
