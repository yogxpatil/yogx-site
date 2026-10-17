import type { RoboEvent } from './brain'

const listeners = new Set<(e: RoboEvent) => void>()

export function emitRobo(e: RoboEvent): void {
  for (const fn of Array.from(listeners)) fn(e)
}

export function onRobo(fn: (e: RoboEvent) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
