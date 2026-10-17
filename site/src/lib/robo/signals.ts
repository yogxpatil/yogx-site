// Pure detectors for Robo's signals. No DOM access except reading the event target in keyAllowed.

/** Fires 'fast' once per burst: speed above `threshold` px/s held for `holdMs`; re-arms once speed < threshold/2. */
export function speedTracker(threshold = 4500, holdMs = 150): (y: number, t: number) => 'fast' | null {
  let lastY: number | null = null
  let lastT = 0
  let since: number | null = null
  let armed = true
  return (y, t) => {
    if (lastY === null || t <= lastT) { lastY = y; lastT = t; return null }
    const v = (Math.abs(y - lastY) / (t - lastT)) * 1000
    lastY = y
    lastT = t
    if (v < threshold / 2) armed = true
    if (v > threshold) {
      if (since === null) since = t
      if (armed && t - since >= holdMs) { armed = false; return 'fast' }
    } else {
      since = null
    }
    return null
  }
}

/** True once per continuous upward run of at least `minDy` px. */
export function upTracker(minDy = 240): (y: number) => boolean {
  let last: number | null = null
  let run = 0
  let fired = false
  return (y) => {
    if (last === null) { last = y; return false }
    const d = y - last
    last = y
    if (d < 0) {
      run -= d
      if (!fired && run >= minDy) { fired = true; return true }
    } else if (d > 0) {
      run = 0
      fired = false
    }
    return false
  }
}

/** True when `n` taps fall within `windowMs`; resets after firing. */
export function tapCounter(n: number, windowMs: number): (t: number) => boolean {
  let taps: number[] = []
  return (t) => {
    taps = taps.filter((x) => t - x < windowMs)
    taps.push(t)
    if (taps.length >= n) { taps = []; return true }
    return false
  }
}

/** True when the last typed characters spell `word` (case-insensitive). Non-character keys are ignored. */
export function typedWord(word = 'yogx'): (key: string) => boolean {
  const w = word.toLowerCase()
  let buf = ''
  return (key) => {
    if (key.length !== 1) return false
    buf = (buf + key.toLowerCase()).slice(-w.length)
    if (buf === w) { buf = ''; return true }
    return false
  }
}

/** True once after `inside` has stayed true for `ms`; re-arms when it goes false. */
export function holdOver(ms = 3000): (inside: boolean, t: number) => boolean {
  let start: number | null = null
  let fired = false
  return (inside, t) => {
    if (!inside) { start = null; fired = false; return false }
    if (start === null) start = t
    if (!fired && t - start >= ms) { fired = true; return true }
    return false
  }
}

export function keyAllowed(
  e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; target: EventTarget | null },
  entered: boolean,
): boolean {
  if (!entered || e.ctrlKey || e.metaKey || e.altKey) return false
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return false
  return true
}
