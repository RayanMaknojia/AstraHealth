/**
 * Tiny persistence helper shared by the Phase 3 services.
 * localStorage when available (works offline, survives reloads), in-memory otherwise
 * (tests, private mode, storage full). Data is per-device; nothing here syncs by itself.
 */

export interface Store<T> {
  get(): T
  set(value: T): void
  update(fn: (value: T) => T): T
  /** Back to the seed (e.g. before a judging run). */
  reset(): void
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function createStore<T>(key: string, seed: () => T): Store<T> {
  let memory: T | null = null
  const fullKey = `space-medic:${key}`
  const load = (): T => {
    if (memory !== null) return memory
    try {
      const raw = storage()?.getItem(fullKey)
      if (raw) return (memory = JSON.parse(raw) as T)
    } catch {
      /* corrupted → reseed */
    }
    return (memory = seed())
  }
  const save = (value: T) => {
    memory = value
    try {
      storage()?.setItem(fullKey, JSON.stringify(value))
    } catch {
      /* storage full / private mode → memory only */
    }
  }
  return {
    get: load,
    set: save,
    update(fn) {
      const next = fn(load())
      save(next)
      return next
    },
    reset() {
      save(seed())
    },
  }
}

let seq = 0
/** Short unique id, e.g. "chk-lz3k9a-4". */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`
}

/** "Day 45 08:15"-style label for a fractional mission day. */
export function missionTimestamp(day: number): string {
  const d = Math.floor(day)
  const minutes = Math.round((day - d) * 1440)
  const hh = String(Math.floor(minutes / 60) % 24).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `Day ${d} ${hh}:${mm}`
}
