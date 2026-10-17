// The visitor's own visit, read from their browser. null = not exposed, never guessed. Nothing here touches the network.

export type Visit = {
  bytes: number | null
  requests: number
  ttfb: number | null
  fcp: number | null
  lcp: number | null
  fps: number | null
  longTasks: number | null
  net: { type: string | null; rtt: number | null }
  memory: number | null
  cores: number | null
  screen: string
}

export type StageName = 'build' | 'ship' | 'run' | 'env'
export type StageResult = { ok: 'green' | 'amber' | 'na'; lines: string[] }

export const fmtMs = (ms: number): string => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`)

export function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${Math.round(n)} B`
}

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)

function observe(type: string, ms: number): Promise<PerformanceEntry[]> {
  return new Promise((resolve) => {
    const got: PerformanceEntry[] = []
    let po: PerformanceObserver | null = null
    try {
      if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes?.includes(type)) return resolve([])
      po = new PerformanceObserver((l) => got.push(...l.getEntries()))
      po.observe({ type, buffered: true })
    } catch {
      return resolve([])
    }
    setTimeout(() => {
      po?.takeRecords().forEach((e) => got.push(e))
      po?.disconnect()
      resolve(got)
    }, ms)
  })
}

function sampleFps(ms: number): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') return resolve(null)
    let frames = 0, t0 = 0
    const f = (t: number) => {
      if (!t0) t0 = t
      else frames++
      if (t - t0 >= ms) return resolve(Math.round((frames * 1000) / (t - t0)))
      requestAnimationFrame(f)
    }
    requestAnimationFrame(f)
    // a hidden tab never fires rAF: do not guess a number
    setTimeout(() => resolve(null), ms * 4)
  })
}

/** Read the visit. `sampleMs` is how long the live samples (frame rate, LCP, long tasks) run. */
export async function collectVisit(perf: Performance = performance, nav: Navigator = navigator, sampleMs = 700): Promise<Visit> {
  const res = perf.getEntriesByType('resource') as PerformanceResourceTiming[]
  const navEntry = (perf.getEntriesByType('navigation') as PerformanceNavigationTiming[])[0]
  const entries = navEntry ? [navEntry, ...res] : res
  const sized = entries.map((e) => num(e.transferSize)).filter((x): x is number => x !== null)
  const fcp = (perf.getEntriesByType('paint') as PerformanceEntry[]).find((e) => e.name === 'first-contentful-paint')
  const [fps, lcpE, tasks] = await Promise.all([sampleFps(sampleMs), observe('largest-contentful-paint', sampleMs), observe('longtask', sampleMs)])
  const lcp = lcpE.length ? lcpE[lcpE.length - 1].startTime : null
  const c = (nav as Navigator & { connection?: { effectiveType?: string; rtt?: number } }).connection
  const supportsTasks = typeof PerformanceObserver !== 'undefined' && !!PerformanceObserver.supportedEntryTypes?.includes('longtask')
  const w = typeof window === 'undefined' ? null : window
  return {
    bytes: sized.length && sized.reduce((a, b) => a + b, 0) > 0 ? sized.reduce((a, b) => a + b, 0) : null,
    requests: entries.length,
    ttfb: navEntry ? num(navEntry.responseStart) : null,
    fcp: fcp ? num(fcp.startTime) : null,
    lcp: num(lcp),
    fps,
    longTasks: supportsTasks ? tasks.length : null,
    net: { type: c?.effectiveType ?? null, rtt: num(c?.rtt) },
    memory: num((nav as Navigator & { deviceMemory?: number }).deviceMemory),
    cores: num(nav.hardwareConcurrency),
    screen: w ? `${w.screen?.width ?? w.innerWidth}×${w.screen?.height ?? w.innerHeight}` : '',
  }
}

/** One pipeline stage: green / amber / na plus the real readings that exist (unexposed ones are left out). */
export function stage(name: StageName, v: Visit): StageResult {
  const lines: string[] = []
  switch (name) {
    case 'build': {
      if (v.bytes !== null && v.bytes > 0) lines.push(`${fmtBytes(v.bytes)} shipped`)
      if (v.requests > 0) lines.push(`${v.requests} requests`)
      return { ok: lines.length ? 'green' : 'na', lines }
    }
    case 'ship': {
      if (v.ttfb !== null) lines.push(`first byte ${fmtMs(v.ttfb)}`)
      if (v.fcp !== null) lines.push(`first paint ${fmtMs(v.fcp)}`)
      if (v.lcp !== null) lines.push(`largest paint ${fmtMs(v.lcp)}`)
      if (v.ttfb === null && v.lcp === null) return { ok: 'na', lines }
      const bad = (v.ttfb !== null && v.ttfb > 800) || (v.lcp !== null && v.lcp > 2500)
      return { ok: bad ? 'amber' : 'green', lines }
    }
    case 'run': {
      if (v.fps !== null) lines.push(`${v.fps} fps`)
      if (v.longTasks !== null) lines.push(`${v.longTasks} long ${v.longTasks === 1 ? 'task' : 'tasks'}`)
      if (v.fps === null) return { ok: 'na', lines }
      return { ok: v.fps >= 50 ? 'green' : 'amber', lines }
    }
    case 'env': {
      // browsers report rtt 0 when they do not know it: that is "not exposed", not a real zero
      const rtt = v.net.rtt !== null && v.net.rtt > 0 ? `${Math.round(v.net.rtt)} ms rtt` : null
      if (v.net.type) lines.push(`network ${v.net.type}${rtt ? ` · ${rtt}` : ''}`)
      else if (rtt) lines.push(`network ${rtt}`)
      if (v.memory !== null) lines.push(`memory ${v.memory} GB`)
      if (v.cores !== null) lines.push(`cores ${v.cores}`)
      if (v.screen) lines.push(`screen ${v.screen}`)
      return { ok: lines.length ? 'green' : 'na', lines }
    }
  }
}
