/**
 * Orbit Lab: combine elements to reach the day's target (More → Orbit Lab).
 *
 * - Every day starts fresh from the five starting elements, with one target for the
 *   whole crew (the same on every device for a given mission day).
 * - Combining two elements (in any order) makes a new one, or nothing.
 * - Up to five hints a day, each naming one combination on the shortest way to the
 *   target that can be made with what you already have.
 * - Everything ever made is also kept as a collection. Making the day's target earns a
 *   Station Garden seed. Only game results are kept, on this device.
 */

import { LAB_ELEMENTS, LAB_RECIPES, LAB_RULES, LAB_TARGETS } from '@/data/orbitLabData'
import { createStore } from '@/services/_store'
import type { LabDay, LabElement, LabProgress, LabRecipe } from '@/types/astronaut'

interface LabState {
  /** Everything each astronaut has ever made (collection). */
  collection: Record<string, string[]>
  days: LabDay[]
}

const store = createStore<LabState>('orbit-lab:v1', () => ({ collection: {}, days: [] }))

const BY_ID = new Map(LAB_ELEMENTS.map((e) => [e.id, e]))
export const BASE_IDS = LAB_ELEMENTS.filter((e) => e.base).map((e) => e.id)
const pairKey = (a: string, b: string) => (a < b ? `${a}+${b}` : `${b}+${a}`)
const COMBOS = new Map(LAB_RECIPES.map((r) => [pairKey(r.a, r.b), r.out]))

export function labElement(id: string): LabElement | undefined {
  return BY_ID.get(id)
}

/** What a and b make together (order does not matter), or null. */
export function combine(a: string, b: string): string | null {
  return COMBOS.get(pairKey(a, b)) ?? null
}

/** The target of a mission day. 5 and the number of targets share no factor. */
export function labTarget(missionDay: number): string {
  const day = Math.max(0, Math.floor(missionDay))
  return LAB_TARGETS[(day * 5 + 2) % LAB_TARGETS.length]
}

// ── Shortest recipes (for hints and the "steps" estimate) ─────────────────────

/** For each element, the recipe that reaches it in the fewest steps from the bases. */
const BEST: Map<string, { depth: number; recipe: LabRecipe | null }> = (() => {
  const best = new Map<string, { depth: number; recipe: LabRecipe | null }>()
  for (const id of BASE_IDS) best.set(id, { depth: 0, recipe: null })
  let changed = true
  while (changed) {
    changed = false
    for (const rec of LAB_RECIPES) {
      const a = best.get(rec.a)
      const b = best.get(rec.b)
      if (!a || !b) continue
      const depth = Math.max(a.depth, b.depth) + 1
      const cur = best.get(rec.out)
      if (!cur || depth < cur.depth) {
        best.set(rec.out, { depth, recipe: rec })
        changed = true
      }
    }
  }
  return best
})()

/** Recipes on the shortest way to `id`, inputs before outputs (no repeats). */
export function pathTo(id: string): LabRecipe[] {
  const out: LabRecipe[] = []
  const seen = new Set<string>()
  const walk = (x: string) => {
    if (seen.has(x)) return
    seen.add(x)
    const rec = BEST.get(x)?.recipe
    if (!rec) return
    walk(rec.a)
    walk(rec.b)
    out.push(rec)
  }
  walk(id)
  return out
}

/** True if every element can be made from the starting elements. */
export function allReachable(): boolean {
  return LAB_ELEMENTS.every((e) => BEST.has(e.id))
}

/** A combination to try next: on the way to the target, made only of what you have. */
export function nextStep(have: Set<string>, target: string): LabRecipe | null {
  if (have.has(target)) return null
  // Prefer any recipe for a needed element that is ready now (alternate recipes count).
  for (const step of pathTo(target)) {
    if (have.has(step.out)) continue
    const ready = LAB_RECIPES.find((r) => r.out === step.out && have.has(r.a) && have.has(r.b))
    if (ready) return ready
  }
  return null
}

// ── Daily game ───────────────────────────────────────────────────────────────

function freshDay(astronautId: string, missionDay: number): LabDay {
  return { astronautId, missionDay, target: labTarget(missionDay), solved: false, combos: 0, hintsUsed: 0, found: [] }
}

function getDay(astronautId: string, missionDay: number): LabDay {
  const day = Math.floor(missionDay)
  return store.get().days.find((d) => d.astronautId === astronautId && d.missionDay === day) ?? freshDay(astronautId, day)
}

function saveDay(next: LabDay): void {
  store.update((s) => ({
    ...s,
    days: [...s.days.filter((d) => !(d.astronautId === next.astronautId && d.missionDay === next.missionDay)), next],
  }))
}

/** Elements available today: the bases plus everything made today. */
export function todaysElements(day: LabDay): string[] {
  return [...BASE_IDS, ...day.found]
}

export function getLabProgress(astronautId: string, missionDay: number): LabProgress {
  const today = getDay(astronautId, missionDay)
  const solved = new Set(store.get().days.filter((d) => d.astronautId === astronautId && d.solved).map((d) => d.missionDay))
  let d = today.missionDay
  if (!solved.has(d)) d -= 1 // not solved yet today: yesterday's streak still counts
  let streak = 0
  while (solved.has(d)) {
    streak++
    d--
  }
  return { discovered: store.get().collection[astronautId] ?? [], today, streak, solvedDays: solved.size }
}

export interface CombineResult {
  /** What was made, or null if nothing happened. */
  out: LabElement | null
  /** First time today. */
  newToday: boolean
  /** First time ever (show its fact). */
  newEver: boolean
  /** This combination made today's target for the first time. */
  solvedNow: boolean
  day: LabDay
}

/** Combine two of today's elements and record the result. */
export function tryCombine(astronautId: string, missionDay: number, a: string, b: string): CombineResult {
  const day = getDay(astronautId, missionDay)
  const have = new Set(todaysElements(day))
  if (!have.has(a) || !have.has(b)) throw new Error('Use elements you have made today.')
  const outId = combine(a, b)
  const newToday = !!outId && !have.has(outId)
  const coll = store.get().collection[astronautId] ?? []
  const newEver = !!outId && !BASE_IDS.includes(outId) && !coll.includes(outId)
  const solvedNow = !day.solved && outId === day.target
  const next: LabDay = {
    ...day,
    combos: day.combos + 1,
    found: newToday && outId ? [...day.found, outId] : day.found,
    solved: day.solved || solvedNow,
  }
  saveDay(next)
  if (newEver && outId) store.update((s) => ({ ...s, collection: { ...s.collection, [astronautId]: [...coll, outId] } }))
  return { out: outId ? (labElement(outId) ?? null) : null, newToday, newEver, solvedNow, day: next }
}

/** Use one of today's hints. Returns the combination to try, or null (none left / solved). */
export function takeHint(astronautId: string, missionDay: number): { recipe: LabRecipe | null; day: LabDay } {
  const day = getDay(astronautId, missionDay)
  if (day.solved || day.hintsUsed >= LAB_RULES.hintsPerDay) return { recipe: null, day }
  const recipe = nextStep(new Set(todaysElements(day)), day.target)
  if (!recipe) return { recipe: null, day }
  const next = { ...day, hintsUsed: day.hintsUsed + 1 }
  saveDay(next)
  return { recipe, day: next }
}

/** Fewest combinations needed to make an element from the starting five. */
export function stepsTo(id: string): number {
  return pathTo(id).length
}

/** Mission days this astronaut made the daily target (for garden seeds). */
export function labSolvedDays(astronautId: string): number[] {
  return store
    .get()
    .days.filter((d) => d.astronautId === astronautId && d.solved)
    .map((d) => d.missionDay)
}

export function resetOrbitLab(): void {
  store.reset()
}
