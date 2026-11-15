/**
 * Sleep, Mood and Journal (pages doc §10).
 *
 *  - Private journal: stored on THIS DEVICE ONLY. Never synced, never shown on
 *    Streaks, never sent to an AI. There is deliberately no export function.
 *  - 60-second reaction test scoring + status vs personal baseline
 *    (Normal ≤ 10% slower, Watch 10-20%, Alert > 20% - health_rules.md).
 *  - Sleep / mood averages, mood calendar, circadian note (Mars sol = 24 h 39 min).
 *  - "Request private talk with ground" (queued with no content).
 */

import { REACTION_RULES as RR, DEMO_CREW_ACTIVITY } from '@/data/phase3Data'
import { displayStatus, evaluateProfile } from '@/services/healthEvaluator'
import { createStore, newId } from '@/services/_store'
import { enqueue } from '@/services/syncService'
import type { AstronautProfile, JournalEntry, MissionState, ReactionResult, SleepMoodSummary, SyncItem } from '@/types/astronaut'

const round = (v: number, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp

// ── Private journal (device only) ──────────────────────────────────────────

const journal = createStore<JournalEntry[]>('journal:device-only:v1', () => [])

export function addJournalEntry(astronautId: string, missionDay: number, text: string): JournalEntry {
  const t = text.trim()
  if (!t) throw new Error('Journal entry is empty.')
  const e: JournalEntry = { id: newId('jr'), astronautId, at: new Date().toISOString(), missionDay, text: t.slice(0, 10_000) }
  journal.update((xs) => [...xs, e])
  return e
}

export function listJournal(astronautId: string): JournalEntry[] {
  return journal.get().filter((e) => e.astronautId === astronautId).sort((a, b) => b.at.localeCompare(a.at))
}

export function deleteJournalEntry(id: string): void {
  journal.update((xs) => xs.filter((e) => e.id !== id))
}

// ── Reaction test ──────────────────────────────────────────────────────────

const reactions = createStore<Record<string, { day: number; ms: number }[]>>('reaction:v1', () => {
  const seeded: Record<string, { day: number; ms: number }[]> = {}
  for (const [id, d] of Object.entries(DEMO_CREW_ACTIVITY)) seeded[id] = [0, 1, 2].map((day, i) => ({ day: day - 3, ms: d.reactionBaselineMs + (i - 1) * 6 }))
  return seeded
})

/**
 * Score a 60-second test: trials in ms → median, ignoring false starts (< 100 ms) and
 * lapses (> 1000 ms, counted separately).
 */
export function scoreReactionTrials(trialsMs: number[]): { medianMs: number | null; validTrials: number; falseStarts: number; lapses: number } {
  const falseStarts = trialsMs.filter((t) => t < 100).length
  const lapses = trialsMs.filter((t) => t > 1000).length
  const valid = trialsMs.filter((t) => t >= 100 && t <= 1000).sort((a, b) => a - b)
  const mid = Math.floor(valid.length / 2)
  const medianMs = valid.length ? Math.round(valid.length % 2 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2) : null
  return { medianMs, validTrials: valid.length, falseStarts, lapses }
}

export function getReactionBaseline(astronautId: string): number | null {
  const xs = (reactions.get()[astronautId] ?? []).slice(0, RR.baselineTests)
  return xs.length >= RR.baselineTests ? Math.round(xs.reduce((a, x) => a + x.ms, 0) / xs.length) : null
}

export function evaluateReaction(ms: number, baselineMs: number | null): ReactionResult {
  if (baselineMs === null)
    return { ms, baselineMs, slowerPct: null, status: 'no_data', message: `Recorded ${ms} ms. Do ${RR.baselineTests} tests to set your baseline.` }
  const slowerPct = round(((ms - baselineMs) / baselineMs) * 100)
  if (slowerPct > RR.alertSlowerPct)
    return { ms, baselineMs, slowerPct, status: 'critical', message: `${ms} ms - ${slowerPct}% slower than your ${baselineMs} ms baseline. Avoid EVA, robotics and piloting; check sleep, CO2 and medicines.` }
  if (slowerPct > RR.watchSlowerPct)
    return { ms, baselineMs, slowerPct, status: 'caution', message: `${ms} ms - ${slowerPct}% slower than your baseline. Often from short sleep or fatigue; re-test after rest.` }
  return { ms, baselineMs, slowerPct, status: 'nominal', message: `${ms} ms - ${slowerPct > 0 ? `${slowerPct}% slower than` : 'as fast as or faster than'} your ${baselineMs} ms baseline.` }
}

export function recordReaction(astronautId: string, day: number, ms: number): ReactionResult {
  if (!(ms >= 100 && ms <= 2000)) throw new Error('Reaction time must be between 100 and 2000 ms.')
  reactions.update((r) => ({ ...r, [astronautId]: [...(r[astronautId] ?? []), { day, ms: Math.round(ms) }] }))
  return evaluateReaction(Math.round(ms), getReactionBaseline(astronautId))
}

export function listReactions(astronautId: string): { day: number; ms: number }[] {
  return [...(reactions.get()[astronautId] ?? [])]
}

// ── Sleep and mood summary ─────────────────────────────────────────────────

function dailyLast(history: { day: number; value: number }[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const h of history) m.set(Math.floor(h.day), h.value)
  return m
}

/** Averages, 14-day mood calendar, circadian note and tips for the Sleep/Mood page. */
export function getSleepMoodSummary(profile: AstronautProfile, missionState: MissionState): SleepMoodSummary {
  const { indicators } = evaluateProfile(profile, { missionState })
  const sleep = indicators.find((i) => i.id === 'sleep_hours')
  const mood = indicators.find((i) => i.id === 'mood')
  const today = Math.floor(missionState.missionDay)
  const sleepByDay = dailyLast(sleep?.history ?? [])
  const moodByDay = dailyLast(mood?.history ?? [])
  const last = (m: Map<number, number>, n: number) => [...m.entries()].filter(([d]) => d > today - n && d <= today).map(([, v]) => v)
  const avg = (xs: number[]) => (xs.length ? round(xs.reduce((a, v) => a + v, 0) / xs.length) : null)

  const dayLength = missionState.environment.dayLengthHours
  const sol = dayLength !== null && Math.abs(dayLength - 24) > 0.2 && dayLength < 48
  const noDay = dayLength === null || dayLength > 48 || dayLength < 6
  const circadian: SleepMoodSummary['circadian'] = sol || noDay ? 'shifted' : 'on_schedule'
  const circadianNote = sol
    ? `A local day here is ${dayLength} h - your sleep window shifts about ${Math.round((dayLength! - 24) * 60)} min later each day. Use scheduled lighting.`
    : noDay
      ? 'No natural 24 h day here - keep a fixed sleep window with scheduled cabin lighting.'
      : 'On a 24 h schedule. Keep the same sleep window every day.'

  const sleep7 = avg(last(sleepByDay, 7))
  const mood7 = avg(last(moodByDay, 7))
  const tips: string[] = []
  if (sleep7 !== null && sleep7 < 7) tips.push('Wind down: dim screens 1 h before bed, eye mask and earplugs, no caffeine after mid-shift.', 'Use blue-enriched light in the morning and warm dim light in the evening.')
  if (mood7 !== null && mood7 < 4) tips.push('Talk with a crewmate you trust today.', 'Book a family call or private time; exercise and daylight-spectrum lighting help mood.', 'You can request a private talk with the ground below.')
  if (!tips.length) tips.push('Keep your routine: same sleep window, daily exercise, team meals.')

  const calendar = [...Array(14)].map((_, i) => {
    const d = today - 13 + i
    const v = moodByDay.get(d) ?? null
    const status = v === null ? ('no_data' as const) : v <= 2 ? ('caution' as const) : v === 3 ? ('caution' as const) : ('nominal' as const)
    return { day: d, value: v, status: d === today && mood ? displayStatus(mood) : status }
  })

  return {
    sleepLastNight: sleep && typeof sleep.value === 'number' ? sleep.value : null,
    sleep7DayAvg: sleep7,
    sleepTargetHours: 8.5,
    dayLengthHours: dayLength,
    mood7DayAvg: mood7,
    moodCalendar: calendar,
    circadian,
    circadianNote,
    tips,
  }
}

/** Queue a private conference request. Content is never included. */
export function requestPrivateTalk(astronautId: string, missionDay: number): SyncItem {
  return enqueue({ astronautId, type: 'private_request', title: 'Private talk with ground', summary: '', missionDay, priority: 'normal' })
}

export function resetWellbeing(options: { includeJournal?: boolean } = {}): void {
  reactions.reset()
  if (options.includeJournal) journal.reset()
}
