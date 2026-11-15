/**
 * Exercise and Bone (pages doc §9): workout log, daily exercise status, weekly
 * goal days, body mass vs preflight and a bone-loss projection (no exercise vs
 * your actual compliance).
 *
 * Rules (docs/health_rules.md, Phase 3 table):
 *  - Exercise: Normal ≥ 120 min/day, Watch 60-119, Alert < 60 for 3 days in a row
 *  - Body mass: Normal within 3% of preflight, Watch 3-5% loss, Alert > 5% loss
 * Demo crew get a simulated history the first time they are looked up.
 */

import { BONE_LOSS_PCT_PER_DAY_AT_0G, ENVIRONMENTS, mulberry32, phaseForDay } from '@/data/nasaSpaceflightData'
import { BODY_MASS_RULES as BM, BONE_NO_EXERCISE_MULTIPLIER, DEMO_CREW_ACTIVITY, EXERCISE_RULES as EX } from '@/data/phase3Data'
import { createStore, newId } from '@/services/_store'
import type {
  BodyMassReading,
  BodyMassSummary,
  BoneProjection,
  ExerciseSummary,
  MissionPlan,
  Rating5,
  StatusLevel,
  WorkoutLog,
  WorkoutType,
} from '@/types/astronaut'

interface ExerciseState {
  workouts: WorkoutLog[]
  mass: Record<string, { preflightKg: number | null; readings: BodyMassReading[] }>
  seeded: Record<string, boolean>
}

const store = createStore<ExerciseState>('exercise:v1', () => ({ workouts: [], mass: {}, seeded: {} }))
const round = (v: number, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp

/** Seed a simulated history for the demo crew (once per device). */
function ensureSeeded(astronautId: string, today: number): void {
  const st = store.get()
  const demo = DEMO_CREW_ACTIVITY[astronautId]
  if (st.seeded[astronautId] || !demo) return
  const rand = mulberry32(astronautId.length * 7919 + 17)
  const workouts: WorkoutLog[] = []
  for (let d = Math.max(1, today - 35); d < today; d++) {
    const met = rand() < demo.exerciseCompliance
    const total = met ? 120 + Math.round(rand() * 20) : 35 + Math.round(rand() * 65)
    const resistance = Math.round(total * 0.5)
    const treadmill = Math.round(total * 0.35)
    const add = (type: WorkoutType, minutes: number, effort: Rating5) => minutes > 0 && workouts.push({ id: newId('wo'), astronautId, day: d, type, minutes, effort })
    add('resistance', resistance, 4)
    add('treadmill', treadmill, 3)
    add('bike', total - resistance - treadmill, 2)
  }
  workouts.push({ id: newId('wo'), astronautId, day: today, type: 'resistance', minutes: 45, effort: 4 })
  const readings: BodyMassReading[] = []
  for (let d = 0; d <= today; d += 7) {
    const weeks = d / 7
    readings.push({ day: d, kg: round(demo.preflightKg * (1 + (demo.massTrendPctPerWeek * weeks) / 100) + (rand() * 2 - 1) * 0.2) })
  }
  store.update((s) => ({
    workouts: [...s.workouts, ...workouts],
    mass: { ...s.mass, [astronautId]: { preflightKg: demo.preflightKg, readings } },
    seeded: { ...s.seeded, [astronautId]: true },
  }))
}

// ── Workouts ───────────────────────────────────────────────────────────────

export const WORKOUT_LABELS: Record<WorkoutType, string> = {
  treadmill: 'Treadmill',
  bike: 'Bike',
  resistance: 'Resistance (ARED)',
  other: 'Other',
}

export function logWorkout(input: { astronautId: string; day: number; type: WorkoutType; minutes: number; effort: Rating5 }): WorkoutLog {
  if (!(input.minutes > 0 && input.minutes <= 600)) throw new Error('Minutes must be between 1 and 600.')
  const log: WorkoutLog = { ...input, day: Math.floor(input.day), minutes: Math.round(input.minutes), id: newId('wo') }
  store.update((s) => ({ ...s, workouts: [...s.workouts, log] }))
  return log
}

export function listWorkouts(astronautId: string, today: number, days = 30): WorkoutLog[] {
  ensureSeeded(astronautId, today)
  return store
    .get()
    .workouts.filter((w) => w.astronautId === astronautId && w.day > today - days && w.day <= today)
    .sort((a, b) => b.day - a.day)
}

function minutesByDay(astronautId: string, from: number, to: number): Map<number, number> {
  const m = new Map<number, number>()
  for (let d = from; d <= to; d++) m.set(d, 0)
  for (const w of store.get().workouts) if (w.astronautId === astronautId && w.day >= from && w.day <= to) m.set(w.day, (m.get(w.day) ?? 0) + w.minutes)
  return m
}

/** Today's progress plus status from completed days (today is still in progress). */
export function getExerciseSummary(astronautId: string, today: number): ExerciseSummary {
  ensureSeeded(astronautId, today)
  const day = Math.floor(today)
  const byDay = minutesByDay(astronautId, day - 30, day)
  const last7 = [...Array(7)].map((_, i) => ({ day: day - 6 + i, minutes: byDay.get(day - 6 + i) ?? 0 }))
  const todayMinutes = byDay.get(day) ?? 0
  const completed = [1, 2, 3].map((k) => byDay.get(day - k) ?? 0)
  const hasHistory = store.get().workouts.some((w) => w.astronautId === astronautId && w.day < day)

  let status: StatusLevel = 'nominal'
  let message = todayMinutes >= EX.goalMinutes ? `Goal met today (${todayMinutes} min).` : `${todayMinutes} of ${EX.goalMinutes} min today.`
  if (!hasHistory) {
    status = 'caution'
    message = `No workouts logged yet. Goal: ${EX.goalMinutes} min a day.`
  } else if (completed.every((m) => m < EX.alertBelowMinutes)) {
    status = 'critical'
    message = `Under ${EX.alertBelowMinutes} min for ${EX.alertConsecutiveDays} days in a row - bones and muscles need daily loading. ${message}`
  } else if (completed[0] < EX.watchBelowMinutes) {
    status = 'caution'
    message = `Yesterday: ${completed[0]} of ${EX.goalMinutes} min. ${message}`
  }

  let streakDays = todayMinutes >= EX.goalMinutes ? 1 : 0
  for (let d = day - 1; (byDay.get(d) ?? 0) >= EX.goalMinutes; d--) streakDays++
  const byType: Record<WorkoutType, number> = { treadmill: 0, bike: 0, resistance: 0, other: 0 }
  for (const w of store.get().workouts) if (w.astronautId === astronautId && w.day > day - 7 && w.day <= day) byType[w.type] += w.minutes

  return {
    todayMinutes,
    goalMinutes: EX.goalMinutes,
    status,
    message,
    weeklyDays: last7.filter((d) => d.minutes >= EX.goalMinutes).length,
    exerciseDaysGoal: EX.daysPerWeekGoal,
    streakDays,
    last7,
    byType,
  }
}

/** Share of the last 30 completed days that met the goal (0-1). */
export function exerciseCompliance(astronautId: string, today: number): number {
  ensureSeeded(astronautId, today)
  const day = Math.floor(today)
  const byDay = minutesByDay(astronautId, day - 30, day - 1)
  const logged = [...byDay.values()]
  const firstLogged = store.get().workouts.filter((w) => w.astronautId === astronautId).reduce((m, w) => Math.min(m, w.day), Infinity)
  const window = logged.filter((_, i) => day - 30 + i >= firstLogged)
  return window.length ? round(window.filter((m) => m >= EX.goalMinutes).length / window.length, 2) : 0
}

// ── Body mass ──────────────────────────────────────────────────────────────

export function setPreflightMass(astronautId: string, kg: number): void {
  store.update((s) => ({ ...s, mass: { ...s.mass, [astronautId]: { preflightKg: kg, readings: s.mass[astronautId]?.readings ?? [] } } }))
}

export function logBodyMass(astronautId: string, day: number, kg: number): BodyMassReading {
  if (!(kg > 20 && kg < 250)) throw new Error('Body mass must be between 20 and 250 kg.')
  const r = { day: Math.floor(day), kg: round(kg) }
  store.update((s) => {
    const cur = s.mass[astronautId] ?? { preflightKg: null, readings: [] }
    return { ...s, mass: { ...s.mass, [astronautId]: { preflightKg: cur.preflightKg ?? (day <= 0 ? r.kg : null), readings: [...cur.readings.filter((x) => x.day !== r.day), r].sort((a, b) => a.day - b.day) } } }
  })
  return r
}

/** % change from preflight with status (Normal within 3%, Watch 3-5% loss, Alert > 5% loss). */
export function evaluateBodyMass(preflightKg: number | null, kg: number | null): { changePct: number | null; status: BodyMassSummary['status']; message: string } {
  if (preflightKg === null || kg === null) return { changePct: null, status: 'no_data', message: preflightKg === null ? 'No preflight weight on file.' : 'No body-mass reading yet.' }
  const change = round(((kg - preflightKg) / preflightKg) * 100, 1)
  if (change < -BM.alertLossPct) return { changePct: change, status: 'critical', message: `Lost ${Math.abs(change)}% since preflight - more than ${BM.alertLossPct}%. Increase calories and protein; tell the crew medical officer.` }
  if (change <= -BM.watchLossPct) return { changePct: change, status: 'caution', message: `Lost ${Math.abs(change)}% since preflight. Eat your full ration and add a snack.` }
  if (change >= BM.watchGainPct) return { changePct: change, status: 'caution', message: `Up ${change}% since preflight - check for fluid retention and diet.` }
  return { changePct: change, status: 'nominal', message: `${change > 0 ? '+' : ''}${change}% from preflight - within ${BM.watchLossPct}%.` }
}

export function getBodyMassSummary(astronautId: string, today: number): BodyMassSummary {
  ensureSeeded(astronautId, today)
  const m = store.get().mass[astronautId] ?? { preflightKg: null, readings: [] }
  const latest = m.readings[m.readings.length - 1]?.kg ?? null
  const e = evaluateBodyMass(m.preflightKg, latest)
  return { preflightKg: m.preflightKg, latestKg: latest, changePct: e.changePct, status: e.status, message: e.message, history: m.readings }
}

// ── Bone-loss projection ───────────────────────────────────────────────────

/**
 * Estimated bone change over the whole mission: no exercise (BONE_NO_EXERCISE_MULTIPLIER × the countermeasure rate)
 * vs your actual exercise compliance (1× at full compliance). Uses the reference-doc
 * formula (1.25/30)·(1 − g) %/day per phase. Estimate - label it so in the UI.
 */
export function projectBoneLoss(plan: MissionPlan, astronautId: string, today: number, stepDays = 7): BoneProjection {
  const compliance = exerciseCompliance(astronautId, today)
  const actualMult = BONE_NO_EXERCISE_MULTIPLIER - compliance * (BONE_NO_EXERCISE_MULTIPLIER - 1)
  const points: BoneProjection['points'] = []
  let noEx = 0
  let actual = 0
  for (let d = 0; d <= plan.totalDays; d++) {
    if (d % stepDays === 0 || d === plan.totalDays) points.push({ day: d, noExercisePct: round(noEx, 2), actualPct: round(actual, 2) })
    const g = ENVIRONMENTS[phaseForDay(plan, d).environment].gravityG
    const rate = BONE_LOSS_PCT_PER_DAY_AT_0G * (1 - g)
    noEx -= rate * BONE_NO_EXERCISE_MULTIPLIER
    actual -= rate * actualMult
  }
  const end = points[points.length - 1]?.actualPct ?? 0
  return {
    compliance,
    points,
    endOfMissionPct: end,
    note: `Estimate. At your current exercise (${Math.round(compliance * 100)}% of days on goal) bone change by mission end ≈ ${end}% vs ≈ ${points[points.length - 1]?.noExercisePct ?? 0}% with no exercise.`,
  }
}

export function resetExercise(): void {
  store.reset()
}
