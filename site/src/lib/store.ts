import { useSyncExternalStore } from 'react';

export type Store<T> = { get(): T; set(patch: Partial<T>): void; subscribe(fn: () => void): () => void };

export function createStore<T extends object>(init: T): Store<T> {
  let state = init;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set: (patch) => { state = { ...state, ...patch }; subs.forEach((f) => f()); },
    subscribe: (fn) => { subs.add(fn); return () => { subs.delete(fn); }; },
  };
}

export function useStore<T extends object, S>(store: Store<T>, select: (s: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => select(store.get()), () => select(store.get()));
}
