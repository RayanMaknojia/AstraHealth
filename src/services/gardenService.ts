/**
 * Station Garden: the crew's shared garden.
 *
 * - Seeds are earned on this device from the astronaut's own healthy habits: each
 *   check-in, each workout day that met the goal, each good night's sleep (7 h+, last
 *   21 days), each day with a journal entry (the journal's text is never read) and each
 *   day with a Ghost Run or a solved Orbit Lab. One seed = one plant.
 * - The garden itself is shared through the server (GET /api/garden, POST
 *   /api/garden/plant), so every device on the deployment sees the same garden.
 * - Offline first: a planting is kept on the device and sent when the server is
 *   reachable (like a message waiting for the next link window).
 * - No health values ever leave the device for the garden; only who planted what, where.
 */

import { GARDEN, PLANTS, SEED_RULES, STARTER_PLANTS } from '@/data/gardenData'
import { apiBase } from '@/services/_gemini'
import { createStore, newId } from '@/services/_store'
import { listCheckins } from '@/services/checkinService'
import { listWorkouts } from '@/services/exerciseService'
import { listRuns } from '@/services/ghostRaceService'
import { labSolvedDays } from '@/services/orbitLabService'
import { listJournal } from '@/services/wellbeingService'
import type { AstronautProfile, GardenPlant, GardenView, PlantKind, SeedEarnings } from '@/types/astronaut'

interface CrewCache {
  /** Last plants the server returned. */
  plants: GardenPlant[]
  /** Plantings not yet accepted by the server. */
  pending: GardenPlant[]
  lastSync: string | null
  online: boolean
}

const store = createStore<Record<string, CrewCache>>('garden:v1', () => ({}))
/** Mission day each astronaut started gardening (seeds count from 7 days before it). */
const starts = createStore<Record<string, number>>('garden-start:v1', () => ({}))

/** Remember when this astronaut first opened the garden (call from the garden page). */
export function startGardening(profile: AstronautProfile): void {
  if (starts.get()[profile.id] === undefined) starts.update((s) => ({ ...s, [profile.id]: Math.floor(profile.missionDay) }))
}
const empty = (): CrewCache => ({ plants: [], pending: [], lastSync: null, online: false })
const cache = (crew: string): CrewCache => store.get()[crew] ?? empty()
const save = (crew: string, next: CrewCache) => store.update((s) => ({ ...s, [crew]: next }))

// ── Seeds ──────────────────────────────────────────────────────────────────

/**
 * Seeds earned from healthy habits, minus plants this astronaut already planted.
 * Each habit earns at most ONE seed a day, counted from 7 days before the astronaut
 * started gardening (a welcome bonus), so the garden grows over the whole mission.
 */
export function seedEarnings(profile: AstronautProfile, crew: string = GARDEN.crew): SeedEarnings {
  const today = Math.floor(profile.missionDay)
  const since = (starts.get()[profile.id] ?? today) - (SEED_RULES.welcomeDays - 1)
  const inWindow = (day: number) => day >= since && day <= today

  const checkins = new Set(listCheckins(profile.id, today, 10_000).filter((c) => !c.excused && inWindow(c.missionDay)).map((c) => c.missionDay)).size

  const perDay = new Map<number, number>()
  for (const w of listWorkouts(profile.id, today, today - since + 1)) if (inWindow(w.day)) perDay.set(w.day, (perDay.get(w.day) ?? 0) + w.minutes)
  const workouts = [...perDay.values()].filter((m) => m >= SEED_RULES.workoutGoalMinutes).length

  const sleep = profile.indicators.find((i) => i.id === 'sleep_hours')
  const nights = new Map<number, number>()
  for (const h of sleep?.history ?? []) if (inWindow(Math.floor(h.day))) nights.set(Math.floor(h.day), h.value)
  const goodSleep = [...nights.values()].filter((v) => v >= SEED_RULES.sleepGoodHours).length

  // Only the number of distinct days with an entry; the text is never read.
  const journalDays = new Set(listJournal(profile.id).filter((j) => inWindow(j.missionDay)).map((j) => j.missionDay)).size
  const ghostRuns = new Set(listRuns(profile.id).filter((r) => inWindow(r.missionDay)).map((r) => r.missionDay)).size

  const labDays = new Set(labSolvedDays(profile.id).filter(inWindow)).size

  const total = checkins + workouts + goodSleep + journalDays + ghostRuns + labDays
  const spent = gardenPlants(crew).filter((p) => !p.starter && p.astronautId === profile.id).length
  return { checkins, workouts, goodSleep, journalDays, ghostRuns, labDays, total, spent, available: Math.max(0, total - spent) }
}

// ── Garden state ───────────────────────────────────────────────────────────

function starterPlants(): GardenPlant[] {
  return STARTER_PLANTS.map((s, i) => ({
    id: `starter-${i}`,
    astronautId: `sim-${s.name.toLowerCase().replace(/\W+/g, '-')}`,
    name: s.name,
    kind: s.kind,
    col: s.col,
    row: s.row,
    missionDay: 0,
    plantedAt: new Date(Date.now() - s.daysAgo * 86_400_000).toISOString(),
    starter: true,
  }))
}

/** Every plant to show: the shared garden, your unsent plantings, and starter plants on free plots. */
export function gardenPlants(crew: string = GARDEN.crew): GardenPlant[] {
  const c = cache(crew)
  const real = [...c.plants]
  for (const p of c.pending) if (!real.some((r) => r.id === p.id)) real.push(p)
  const taken = new Set(real.map((p) => `${p.col}:${p.row}`))
  return [...real, ...starterPlants().filter((s) => !taken.has(`${s.col}:${s.row}`))]
}

export function gardenView(crew: string = GARDEN.crew): GardenView {
  const c = cache(crew)
  return { crew, plants: gardenPlants(crew), pending: c.pending.length, online: c.online, lastSync: c.lastSync }
}

/** Real (non-starter) plants: what milestones and the weekly goal count. */
export function crewPlants(crew: string = GARDEN.crew): GardenPlant[] {
  return gardenPlants(crew).filter((p) => !p.starter)
}

/** Growth stage 0-3 (sprout, young, grown, blooming), from real days since planting. */
export function growthStage(p: GardenPlant, now: number = Date.now()): 0 | 1 | 2 | 3 {
  const days = (now - Date.parse(p.plantedAt)) / 86_400_000
  const [, young, grown, bloom] = GARDEN.stageDays
  return days >= bloom ? 3 : days >= grown ? 2 : days >= young ? 1 : 0
}

export function unlockedKinds(crew: string = GARDEN.crew): Set<PlantKind> {
  const n = crewPlants(crew).length
  return new Set(PLANTS.filter((p) => n >= p.unlockAt).map((p) => p.kind))
}

/** The next biome to unlock and how many more plants it needs (null when all are open). */
export function nextUnlock(crew: string = GARDEN.crew): { biome: string; needed: number } | null {
  const n = crewPlants(crew).length
  const next = PLANTS.filter((p) => p.unlockAt > n).sort((a, b) => a.unlockAt - b.unlockAt)[0]
  return next ? { biome: next.biome, needed: next.unlockAt - n } : null
}

/** Plants the crew added in the last 7 days, toward the weekly aurora goal. */
export function weeklyProgress(crew: string = GARDEN.crew, now: number = Date.now()): { planted: number; goal: number; reached: boolean } {
  const planted = crewPlants(crew).filter((p) => now - Date.parse(p.plantedAt) < 7 * 86_400_000).length
  return { planted, goal: GARDEN.weeklyGoal, reached: planted >= GARDEN.weeklyGoal }
}

/** Distinct crewmates who have planted (real plants only). */
export function gardeners(crew: string = GARDEN.crew): string[] {
  return [...new Set(crewPlants(crew).map((p) => p.name))]
}

// ── Planting and sync ──────────────────────────────────────────────────────

export class GardenError extends Error {}

/** Plant one seed. Saved on this device at once, then sent to the shared garden. */
export function plantSeed(input: { profile: AstronautProfile; kind: PlantKind; col: number; row: number; crew?: string }): GardenPlant {
  const crew = input.crew ?? GARDEN.crew
  if (!unlockedKinds(crew).has(input.kind)) throw new GardenError('That plant is not unlocked yet.')
  if (input.col < 0 || input.col >= GARDEN.cols || input.row < 0 || input.row >= GARDEN.rows) throw new GardenError('Pick a plot inside the garden.')
  if (gardenPlants(crew).some((p) => p.col === input.col && p.row === input.row)) throw new GardenError('Something is already growing there.')
  if (seedEarnings(input.profile, crew).available < 1) throw new GardenError('No seeds left. Check in, sleep well, exercise race a Ghost Run or solve the Orbit Lab to earn more.')
  const plant: GardenPlant = {
    id: newId('plant').replace(/[^A-Za-z0-9_-]/g, '-'),
    astronautId: input.profile.id,
    name: input.profile.name,
    kind: input.kind,
    col: input.col,
    row: input.row,
    missionDay: Math.floor(input.profile.missionDay),
    plantedAt: new Date().toISOString(),
  }
  const c = cache(crew)
  save(crew, { ...c, pending: [...c.pending, plant] })
  return plant
}

async function request<T>(path: string, body?: unknown): Promise<{ status: number; data: T } | null> {
  if (typeof fetch === 'undefined') return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
    if (res.status >= 500 || res.status === 404) return null // server not running / no garden API
    const data = (await res.json()) as T & { ok?: boolean; error?: string }
    // The dev proxy answers 200 {ok:false, error:"server_unreachable"} when the Python
    // server is down (to keep the console clean): that is offline, not an answer.
    if (data?.ok === false && data.error === 'server_unreachable') return null
    return { status: res.status, data }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Send unsent plantings, then fetch the shared garden. Returns plantings that lost
 * their plot to a crewmate meanwhile (their seeds come back automatically).
 */
export async function syncGarden(crew: string = GARDEN.crew): Promise<{ online: boolean; bumped: GardenPlant[] }> {
  const bumped: GardenPlant[] = []
  let online = true
  for (const plant of [...cache(crew).pending]) {
    const res = await request<{ ok: boolean; error?: string; plants?: GardenPlant[] }>('/api/garden/plant', { crew, plant })
    if (!res) {
      online = false
      break
    }
    const accepted = res.status === 200 && res.data.ok === true
    if (accepted || res.status === 409 || res.status === 400) {
      const c = cache(crew)
      save(crew, { ...c, pending: c.pending.filter((p) => p.id !== plant.id), plants: res.data.plants ?? c.plants })
      if (!accepted) bumped.push(plant)
    } else {
      online = res.status !== 429 && online
      break // rate limited: try again on the next sync
    }
  }
  if (online) {
    const res = await request<{ ok: boolean; plants: GardenPlant[] }>(`/api/garden?crew=${encodeURIComponent(crew)}`)
    if (res?.status === 200 && Array.isArray(res.data.plants)) save(crew, { ...cache(crew), plants: res.data.plants, lastSync: new Date().toISOString(), online: true })
    else online = false
  }
  if (!online) save(crew, { ...cache(crew), online: false })
  return { online, bumped }
}

export function resetGarden(): void {
  store.reset()
  starts.reset()
}
