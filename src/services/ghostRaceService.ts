/**
 * Docking Run: ghost racing that replaces the plain reaction test.
 *
 * - One course per mission day (seeded), so everyone races the same lights and a
 *   crewmate's run can be replayed beside you as a "ghost".
 * - Score = points per light (faster = more), never taken from anyone else.
 * - The run is also a reaction test: its presses become reaction trials and are scored
 *   with the existing rule (scoreReactionTrials), so the weekly check-in and the health
 *   rules keep working. The game itself shows race results, not health colours.
 * - Runs are stored on this device; crewmates who play on the same device (or, later,
 *   through the shared server) appear as ghosts. Until then, simulated crewmates race.
 */

import { RACE_RULES as R, SIMULATED_CREWMATES } from '@/data/ghostRaceData'
import { mulberry32 } from '@/data/nasaSpaceflightData'
import { createStore, newId } from '@/services/_store'
import { scoreReactionTrials } from '@/services/wellbeingService'
import type { RaceBoard, RaceCourse, RaceGateResult, RaceGhost, RaceRun } from '@/types/astronaut'

const store = createStore<{ runs: RaceRun[] }>('ghost-race:v1', () => ({ runs: [] }))

const dayOf = (day: number) => Math.floor(day)

/** Today's course: the same lights, at the same times, for everyone. */
export function dailyCourse(missionDay: number): RaceCourse {
  const day = dayOf(missionDay)
  const rand = mulberry32(day * 7919 + 1234)
  const gates = []
  let t = 1500 // a short lead-in after the countdown
  for (let i = 0; i < R.gates; i++) {
    t += R.waitMinMs + rand() * (R.waitMaxMs - R.waitMinMs)
    gates.push({ atMs: Math.round(t), lane: Math.round((0.2 + rand() * 0.6) * 100) / 100 })
    t += 600 // room for the press before the next wait starts
  }
  return { missionDay: day, gates, durationMs: Math.round(t + R.windowMs) }
}

/** Points for one light. */
export function gatePoints(rtMs: number | null, falseStarts: number): number {
  const base = rtMs === null ? 0 : Math.max(R.floorPoints, Math.min(R.maxPoints - R.floorPoints, Math.round(R.maxPoints - rtMs)))
  return Math.max(0, base - falseStarts * R.falseStartPenalty)
}

export function gateResult(rtMs: number | null, falseStarts = 0): RaceGateResult {
  // Faster than 100 ms after the light is anticipation, not a reaction: a false start.
  if (rtMs !== null && rtMs < R.falseStartBelowMs) return gateResult(null, falseStarts + 1)
  const valid = rtMs !== null && rtMs <= R.windowMs ? Math.round(rtMs) : null
  return {
    rtMs: valid,
    outcome: valid === null ? 'missed' : valid > R.lapseOverMs ? 'slow' : 'hit',
    points: gatePoints(valid, falseStarts),
    falseStarts,
  }
}

/** Reaction trials in the reaction test's format: false start = 0 ms, miss = over 1000 ms. */
export function toReactionTrials(gates: RaceGateResult[]): number[] {
  const out: number[] = []
  for (const g of gates) {
    for (let i = 0; i < g.falseStarts; i++) out.push(0)
    out.push(g.rtMs === null ? R.windowMs + 1 : g.rtMs)
  }
  return out
}

/** Score a finished run (does not save it). */
export function scoreRun(input: { astronautId: string; name: string; missionDay: number; gates: RaceGateResult[]; simulated?: boolean }): RaceRun {
  const reaction = scoreReactionTrials(toReactionTrials(input.gates))
  return {
    id: newId('race'),
    astronautId: input.astronautId,
    name: input.name,
    missionDay: dayOf(input.missionDay),
    playedAt: new Date().toISOString(),
    gates: input.gates,
    score: input.gates.reduce((a, g) => a + g.points, 0),
    medianMs: reaction.medianMs,
    lapses: input.gates.filter((g) => g.outcome === 'slow').length,
    misses: input.gates.filter((g) => g.outcome === 'missed').length,
    falseStarts: input.gates.reduce((a, g) => a + g.falseStarts, 0),
    ...(input.simulated ? { simulated: true } : {}),
  }
}

/** Save a finished run on this device. */
export function saveRun(run: RaceRun): RaceRun {
  store.update((s) => ({ runs: [...s.runs, run].slice(-500) }))
  return run
}

export function listRuns(astronautId?: string): RaceRun[] {
  const runs = store.get().runs
  return astronautId ? runs.filter((r) => r.astronautId === astronautId) : [...runs]
}

/** A simulated crewmate's run on a given day (deterministic, so it is the same every time). */
export function simulatedRun(crewmate: (typeof SIMULATED_CREWMATES)[number], missionDay: number): RaceRun {
  const day = dayOf(missionDay)
  let seed = day * 31
  for (const ch of crewmate.id) seed = (seed * 33 + ch.charCodeAt(0)) >>> 0
  const rand = mulberry32(seed)
  const normal = () => {
    const u = Math.max(1e-6, rand())
    const v = rand()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  const gates = dailyCourse(day).gates.map(() => {
    if (rand() < crewmate.slipChance) return gateResult(null)
    const rt = Math.max(180, Math.min(900, crewmate.meanMs + normal() * crewmate.sdMs))
    return gateResult(rt, rand() < 0.03 ? 1 : 0)
  })
  const run = scoreRun({ astronautId: crewmate.id, name: crewmate.name, missionDay: day, gates, simulated: true })
  return { ...run, id: `sim-${crewmate.id}-${day}`, playedAt: '' }
}

function bestPerAstronaut(runs: RaceRun[]): RaceRun[] {
  const best = new Map<string, RaceRun>()
  for (const r of runs) {
    const cur = best.get(r.astronautId)
    if (!cur || r.score > cur.score) best.set(r.astronautId, r)
  }
  return [...best.values()]
}

/** Ghost replay path: when each light was pressed and the running total after it. */
export function ghostPath(run: RaceRun, course: RaceCourse): RaceGhost['path'] {
  let total = 0
  return course.gates.map((g, i) => {
    const r = run.gates[i]
    total += r?.points ?? 0
    return { atMs: g.atMs + (r?.rtMs ?? R.windowMs), total }
  })
}

/**
 * Ghosts for today's course: each crewmate's best run today (real runs first),
 * topped up with simulated crewmates so there are always `count` ghosts.
 */
export function getGhosts(astronautId: string, missionDay: number, count = 3): RaceGhost[] {
  const day = dayOf(missionDay)
  const course = dailyCourse(day)
  const real = bestPerAstronaut(listRuns().filter((r) => r.missionDay === day && r.astronautId !== astronautId)).sort((a, b) => b.score - a.score)
  const sims = SIMULATED_CREWMATES.map((c) => simulatedRun(c, day))
  const picked = [...real, ...sims].slice(0, count)
  return picked.map((r) => ({ runId: r.id, name: r.name, simulated: Boolean(r.simulated), path: ghostPath(r, course), score: r.score }))
}

/** Personal best, today's station record and the crew's weekly total. */
export function getBoard(astronautId: string, missionDay: number): RaceBoard {
  const day = dayOf(missionDay)
  const mine = listRuns(astronautId)
  const personalBest = mine.length ? Math.max(...mine.map((r) => r.score)) : null
  const today = [...listRuns().filter((r) => r.missionDay === day), ...SIMULATED_CREWMATES.map((c) => simulatedRun(c, day))]
  const top = today.sort((a, b) => b.score - a.score)[0]
  const weekStart = Math.floor(day / 7) * 7
  let total = 0
  for (let d = weekStart; d <= day; d++) {
    const runs = [...listRuns().filter((r) => r.missionDay === d), ...SIMULATED_CREWMATES.map((c) => simulatedRun(c, d))]
    total += bestPerAstronaut(runs).reduce((a, r) => a + r.score, 0)
  }
  return {
    personalBest,
    stationRecord: top ? { score: top.score, name: top.name, simulated: Boolean(top.simulated) } : null,
    crewWeek: { total, target: R.crewWeeklyTarget, days: [weekStart, weekStart + 6] },
  }
}

export function resetRaces(): void {
  store.reset()
}
