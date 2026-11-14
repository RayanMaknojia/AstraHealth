/**
 * Daily Check-in schedule + Crew Streaks (pages doc §3 and §7).
 *
 *  - Schedule: morning (required, daily), evening (optional), weekly, monthly,
 *    eye exam (day 30, day 90, then every 90 days).
 *  - submitCheckin(): saves the check-in, grades vitals through ingestionEngine,
 *    logs exercise / body mass / reaction extras, and queues a sync item.
 *    A check-in with only a reported symptom STILL COUNTS — it never breaks a streak.
 *  - Streaks count the required morning check-in. Admin can excuse a missed day.
 *  - Leaderboard ranks CONSISTENCY ONLY — never BP, weight, mood or photos.
 *
 * Demo crew get a simulated history (streaks 32 / 21 / 9 days) the first time.
 */

import { BADGE_DEFS, CHECKIN_SCHEDULE, DEMO_CREW_ACTIVITY, MONTHLY_EVERY_DAYS, TEAM_GOAL_PCT, WEEK_DAYS, eyeExamDays } from '@/data/phase3Data'
import { getActiveOverrides } from '@/services/alertService'
import { getExerciseSummary, logBodyMass, logWorkout } from '@/services/exerciseService'
import { displayStatus, evaluateProfile } from '@/services/healthEvaluator'
import { ingest } from '@/services/ingestionEngine'
import { createStore, newId } from '@/services/_store'
import { enqueue } from '@/services/syncService'
import { recordReaction } from '@/services/wellbeingService'
import type {
  AstronautProfile,
  Badge,
  BadgeId,
  CheckinExtras,
  CheckinRecord,
  CheckinSlot,
  CheckinTaskDue,
  CrewOverviewRow,
  IngestionResult,
  LeaderboardRow,
  ReactionResult,
  StreakDayState,
  StreakInfo,
  TeamGoal,
  VitalsInput,
} from '@/types/astronaut'

interface CheckinState {
  records: CheckinRecord[]
  seeded: Record<string, boolean>
}

const store = createStore<CheckinState>('checkins:v1', () => ({ records: [], seeded: {} }))
const SLOTS: CheckinSlot[] = ['morning', 'evening', 'weekly', 'monthly', 'eye_exam']

function ensureSeeded(astronautId: string, today: number): void {
  const st = store.get()
  const demo = DEMO_CREW_ACTIVITY[astronautId]
  if (st.seeded[astronautId] || !demo) return
  const day = Math.floor(today)
  const records: CheckinRecord[] = []
  const rec = (d: number, slot: CheckinSlot): CheckinRecord => ({
    id: newId('chk'),
    astronautId,
    missionDay: d,
    slot,
    completedAt: new Date(Date.now() - (day - d) * 86_400_000).toISOString(),
    symptoms: [],
  })
  const from = Math.max(0, day - 60)
  for (let d = from; d < day; d++) {
    const ago = day - d
    if (!demo.missedDaysAgo.includes(ago) && (ago <= demo.streakDays || ago % 5 !== 0)) records.push(rec(d, 'morning'))
    if (d % 3 !== 0) records.push(rec(d, 'evening'))
    if (d % WEEK_DAYS === 2) records.push(rec(d, 'weekly'))
    if (d > 0 && d % MONTHLY_EVERY_DAYS === 2) records.push(rec(d, 'monthly'))
  }
  for (const e of eyeExamDays(day)) if (e + 1 < day) records.push(rec(e + 1, 'eye_exam'))
  store.update((s) => ({ records: [...s.records, ...records], seeded: { ...s.seeded, [astronautId]: true } }))
}

function recordsFor(astronautId: string, today: number): CheckinRecord[] {
  ensureSeeded(astronautId, today)
  return store.get().records.filter((r) => r.astronautId === astronautId)
}

const doneOn = (records: CheckinRecord[], slot: CheckinSlot, day: number) => records.some((r) => r.slot === slot && r.missionDay === day)

// ── Schedule ───────────────────────────────────────────────────────────────

/** What's due on `today` (pages doc §3 schedule). */
export function getDueCheckins(profile: AstronautProfile, today: number = profile.missionDay): CheckinTaskDue[] {
  const day = Math.floor(today)
  const records = recordsFor(profile.id, day)
  const inRange = (slot: CheckinSlot, from: number, to: number) => records.filter((r) => r.slot === slot && r.missionDay >= from && r.missionDay <= to)
  const out: CheckinTaskDue[] = []

  const morning = records.find((r) => r.slot === 'morning' && r.missionDay === day)
  out.push({ ...CHECKIN_SCHEDULE.morning, due: true, done: Boolean(morning && !morning.excused), excused: Boolean(morning?.excused), dueReason: 'Due today' })
  out.push({ ...CHECKIN_SCHEDULE.evening, due: true, done: doneOn(records, 'evening', day), excused: false, dueReason: 'Optional, this evening' })

  const weekStart = day - (((day % WEEK_DAYS) + WEEK_DAYS) % WEEK_DAYS)
  const weekly = inRange('weekly', weekStart, weekStart + WEEK_DAYS - 1)
  out.push({ ...CHECKIN_SCHEDULE.weekly, due: true, done: weekly.some((r) => !r.excused), excused: weekly.some((r) => r.excused), dueReason: `This week — due by day ${weekStart + WEEK_DAYS - 1}` })

  if (day >= MONTHLY_EVERY_DAYS) {
    const monthStart = day - (day % MONTHLY_EVERY_DAYS)
    const monthly = inRange('monthly', monthStart, monthStart + MONTHLY_EVERY_DAYS - 1)
    out.push({ ...CHECKIN_SCHEDULE.monthly, due: true, done: monthly.some((r) => !r.excused), excused: monthly.some((r) => r.excused), dueReason: `This month — due by day ${monthStart + MONTHLY_EVERY_DAYS - 1}` })
  } else out.push({ ...CHECKIN_SCHEDULE.monthly, due: false, done: false, excused: false, dueReason: `First exam on day ${MONTHLY_EVERY_DAYS}` })

  const examDays = eyeExamDays(Math.max(day, profile.mission.totalDays))
  const lastDue = [...examDays].reverse().find((d) => d <= day)
  const next = examDays.find((d) => d > day)
  if (lastDue !== undefined) {
    const eye = inRange('eye_exam', lastDue, day)
    const done = eye.some((r) => !r.excused)
    out.push({ ...CHECKIN_SCHEDULE.eye_exam, due: !done, done, excused: eye.some((r) => r.excused), dueReason: done ? (next ? `Done — next on day ${next}` : 'Done') : `Day ${lastDue} eye exam` })
  } else out.push({ ...CHECKIN_SCHEDULE.eye_exam, due: false, done: false, excused: false, dueReason: `First exam on day ${next ?? 30}` })
  return out
}

// ── Submit ─────────────────────────────────────────────────────────────────

export interface CheckinSubmitInput {
  profile: AstronautProfile
  slot: CheckinSlot
  day: number
  values?: VitalsInput
  extras?: CheckinExtras
  symptoms?: string[]
}

export interface CheckinSubmitResult {
  record: CheckinRecord
  /** Graded vitals (null when the check-in had no vitals). Apply result.updates with applyIndicatorUpdates. */
  ingestion: IngestionResult | null
  reaction: ReactionResult | null
  /** Plain-English line for a toast. */
  message: string
}

/**
 * Save a check-in. Throws if it's completely empty. Symptoms alone are enough —
 * reporting a symptom counts as a completed check-in.
 */
export async function submitCheckin(input: CheckinSubmitInput): Promise<CheckinSubmitResult> {
  const { profile, slot, extras = {} } = input
  const day = Math.floor(input.day)
  const symptoms = [...new Set([...(input.symptoms ?? []), ...(extras.headache ? ['headache'] : [])])]
  const values = input.values ?? {}
  const hasValues = Object.entries(values).some(([k, v]) => v !== undefined && k !== 'fasting')
  const hasExtras = Object.values(extras).some((v) => v !== undefined && v !== false && v !== '')
  if (!hasValues && !hasExtras && !symptoms.length) throw new Error('Nothing entered yet — fill at least one field or tick a symptom.')

  const ingestion = hasValues || symptoms.length ? await ingest({ manualValues: { ...values, symptoms }, astronautId: profile.id, day, environment: profile.environment }) : null
  if (extras.exerciseMinutes) logWorkout({ astronautId: profile.id, day, type: extras.exerciseType ?? 'other', minutes: extras.exerciseMinutes, effort: 3 })
  if (extras.bodyMassKg) logBodyMass(profile.id, day, extras.bodyMassKg)
  const reaction = extras.reactionMs ? recordReaction(profile.id, day, extras.reactionMs) : null

  const record: CheckinRecord = {
    id: newId('chk'),
    astronautId: profile.id,
    missionDay: day,
    slot,
    completedAt: new Date().toISOString(),
    ...(hasValues ? { values } : {}),
    ...(hasExtras ? { extras } : {}),
    symptoms,
  }
  store.update((s) => ({ ...s, records: [...s.records.filter((r) => !(r.astronautId === profile.id && r.slot === slot && r.missionDay === day && r.excused)), record] }))
  enqueue({ astronautId: profile.id, type: 'checkin', title: `${CHECKIN_SCHEDULE[slot].title} (day ${day})`, summary: symptoms.length ? `Symptoms: ${symptoms.join(', ')}` : 'Routine check-in', missionDay: day, priority: 'low', refId: record.id })

  const streak = getStreak(profile.id, day).current
  const graded = ingestion?.artifact.accepted ? ` Status: ${ingestion.artifact.severity === 'nominal' ? 'Normal' : ingestion.artifact.severity === 'caution' ? 'Watch' : 'Alert'}.` : ''
  return { record, ingestion, reaction, message: `${CHECKIN_SCHEDULE[slot].title} saved.${graded}${slot === 'morning' ? ` 🔥 ${streak}-day streak.` : ''}` }
}

/** Admin: excuse a missed check-in (medical issue, emergency, EVA) so it doesn't break the streak. */
export function excuseCheckin(astronautId: string, day: number, slot: CheckinSlot, reason: string, by: string): CheckinRecord {
  const d = Math.floor(day)
  const record: CheckinRecord = { id: newId('chk'), astronautId, missionDay: d, slot, completedAt: new Date().toISOString(), symptoms: [], excused: { by, reason } }
  store.update((s) => ({ ...s, records: [...s.records, record] }))
  return record
}

export function listCheckins(astronautId: string, today: number, days = 30): CheckinRecord[] {
  return recordsFor(astronautId, today)
    .filter((r) => r.missionDay > today - days)
    .sort((a, b) => b.missionDay - a.missionDay || b.completedAt.localeCompare(a.completedAt))
}

// ── Streaks, badges, leaderboard ───────────────────────────────────────────

/** Morning-check-in streak. Today counts once it's done; an unfinished today doesn't break the streak. */
export function getStreak(astronautId: string, today: number): StreakInfo {
  const day = Math.floor(today)
  const records = recordsFor(astronautId, day).filter((r) => r.slot === 'morning')
  const ok = new Set(records.map((r) => r.missionDay))
  const excused = new Set(records.filter((r) => r.excused).map((r) => r.missionDay))
  let current = ok.has(day) ? 1 : 0
  for (let d = day - 1; ok.has(d); d--) current++
  const days = [...ok].sort((a, b) => a - b)
  let best = 0
  let run = 0
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1
    best = Math.max(best, run)
  }
  const calendar = [...Array(28)].map((_, i) => {
    const d = day - 27 + i
    const state: StreakDayState = d > day ? 'future' : excused.has(d) ? 'excused' : ok.has(d) ? 'done' : d === day ? 'today' : 'missed'
    return { day: d, state }
  })
  return { current, best: Math.max(best, current), calendar }
}

/** % of required check-ins done in the last 7 days (morning × 7 + this week's weekly). */
export function weekCompletionPct(astronautId: string, today: number): number {
  const day = Math.floor(today)
  const records = recordsFor(astronautId, day)
  let due = 0
  let done = 0
  for (let d = day - 6; d <= day; d++) {
    if (d < 0) continue
    const has = doneOn(records, 'morning', d)
    if (d === day && !has) continue // today still open
    due++
    if (has) done++
  }
  due++
  if (records.some((r) => r.slot === 'weekly' && r.missionDay > day - WEEK_DAYS && r.missionDay <= day)) done++
  return due ? Math.round((done / due) * 100) : 0
}

export function getTeamGoal(profiles: AstronautProfile[]): TeamGoal {
  const pcts = profiles.map((p) => weekCompletionPct(p.id, p.missionDay))
  const weekPct = pcts.length ? Math.round(pcts.reduce((a, v) => a + v, 0) / pcts.length) : 0
  return { weekPct, goalPct: TEAM_GOAL_PCT, met: weekPct >= TEAM_GOAL_PCT, badgeLabel: BADGE_DEFS.team_steady_orbit.label }
}

export function getBadges(profile: AstronautProfile, team?: TeamGoal): Badge[] {
  const day = Math.floor(profile.missionDay)
  const streak = getStreak(profile.id, day)
  const records = recordsFor(profile.id, day)
  const ex = getExerciseSummary(profile.id, day)
  const due = getDueCheckins(profile, day)
  const make = (id: BadgeId, progress: number, progressText: string): Badge => {
    const p = Math.max(0, Math.min(1, progress))
    return { id, ...BADGE_DEFS[id], earned: p >= 1, progress: p, progressText: p >= 1 ? 'Earned' : progressText }
  }
  const streakBadge = (id: BadgeId, n: number) => make(id, streak.best / n, `${Math.max(0, n - streak.current)} more days`)
  const weeklyDone = due.find((t) => t.slot === 'weekly')?.done ?? false
  const monthlyDone = records.some((r) => r.slot === 'monthly' && !r.excused)
  const out = [
    streakBadge('streak_7', 7),
    streakBadge('streak_30', 30),
    streakBadge('streak_100', 100),
    make('weekly_all', weeklyDone ? 1 : 0, 'Finish this week’s weekly check'),
    make('monthly_exam', monthlyDone ? 1 : 0, day < MONTHLY_EVERY_DAYS ? `Available from day ${MONTHLY_EVERY_DAYS}` : 'Do this month’s exam'),
    make('exercise_6', ex.weeklyDays / ex.exerciseDaysGoal, `${Math.max(0, ex.exerciseDaysGoal - ex.weeklyDays)} more goal days this week`),
  ]
  if (team) out.push(make('team_steady_orbit', team.weekPct / team.goalPct, `Crew at ${team.weekPct}% of ${team.goalPct}%`))
  return out
}

/** Consistency-only leaderboard (streak, then week %). Never includes health values. */
export function getLeaderboard(profiles: AstronautProfile[]): LeaderboardRow[] {
  const team = getTeamGoal(profiles)
  return profiles
    .map((p) => {
      const ex = getExerciseSummary(p.id, p.missionDay)
      return {
        rank: 0,
        astronautId: p.id,
        displayName: p.name,
        role: p.role,
        currentStreak: getStreak(p.id, p.missionDay).current,
        weekPct: weekCompletionPct(p.id, p.missionDay),
        exerciseDays: ex.weeklyDays,
        exerciseDaysGoal: ex.exerciseDaysGoal,
        badgeCount: getBadges(p, team).filter((b) => b.earned).length,
      }
    })
    .sort((a, b) => b.currentStreak - a.currentStreak || b.weekPct - a.weekPct || a.displayName.localeCompare(b.displayName))
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

/** Admin crew overview (pages doc §14C). */
export function getCrewOverview(profiles: AstronautProfile[]): CrewOverviewRow[] {
  return profiles.map((p) => {
    const { report, indicators } = evaluateProfile(p)
    const fresh = indicators.filter((i) => displayStatus(i) !== 'no_data')
    const last = recordsFor(p.id, p.missionDay).reduce<number | null>((m, r) => (r.excused ? m : m === null ? r.missionDay : Math.max(m, r.missionDay)), null)
    return {
      astronautId: p.id,
      displayName: p.name,
      role: p.role,
      status: fresh.length ? report.overallStatus : 'no_data',
      lastCheckinDay: last,
      currentStreak: getStreak(p.id, p.missionDay).current,
      openAlerts: getActiveOverrides(p.id).length,
    }
  })
}

export const CHECKIN_SLOTS = SLOTS

export function resetCheckins(): void {
  store.reset()
}
