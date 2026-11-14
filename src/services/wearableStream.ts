/**
 * Automated 15-Minute Wearable Loop.
 *
 * Simulates a wrist/chest wearable (Bio-Monitor-style smart shirt + pulse
 * oximeter + actigraphy band) pushing heart rate, core/skin temperature,
 * SpO2, steps, HRV and — once per wake-up — last night's sleep, every 15
 * mission minutes (default: every 15 s real time). Each tick yields
 * IndicatorUpdate[] ready for healthEvaluator.applyIndicatorUpdates().
 *
 * The Mission Control bar can inject demo anomalies; each lasts a few ticks
 * so the HUD has time to show the change. Data is SIMULATED and labeled so.
 */

import { ENVIRONMENTS, mulberry32 } from '@/data/nasaSpaceflightData'
import { getPhaseForDay } from '@/services/missionTimeline'
import type {
  AnomalyKind,
  AstronautProfile,
  IndicatorId,
  IndicatorUpdate,
  WearableReadings,
  WearableStreamConfig,
  WearableStreamController,
  WearableTick,
  WearableTickListener,
} from '@/types/astronaut'

export const DEFAULT_INTERVAL_MS = 15_000
export const DEFAULT_MISSION_MINUTES_PER_TICK = 15
/** Streams start at 08:00 crew time on the profile's mission day. */
export const STREAM_START_MINUTE_OF_DAY = 8 * 60
/** Wake-up time: the first tick after this reports last night's sleep. */
export const WAKE_MINUTE_OF_DAY = 7 * 60

/** Human-readable labels for the Mission Control demo buttons. */
export const ANOMALY_LABELS: Record<AnomalyKind, string> = {
  solar_flare: 'Trigger Solar Flare Spike',
  tachycardia: 'Simulate Tachycardia',
  fever: 'Simulate Fever',
  sleep_deprivation: 'Simulate Sleep Deprivation',
  hypoxia: 'Simulate Low SpO2 (habitat O2 fault)',
}

/** How many ticks each injected anomaly stays active. */
export const ANOMALY_DURATION_TICKS: Record<AnomalyKind, number> = {
  solar_flare: 6,
  tachycardia: 4,
  fever: 12,
  sleep_deprivation: 1,
  hypoxia: 4,
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Format a mission timestamp label, e.g. (45, 495) → "Day 45 08:15". */
export function formatMissionTime(missionDay: number, minuteOfDay: number): string {
  const m = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440
  return `Day ${missionDay} ${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
}

function latestNumber(profile: AstronautProfile, id: IndicatorId, fallback: number): number {
  // Continue from the latest reading so live ticks extend the real trend; fall back to baseline.
  const ind = profile.indicators.find((i) => i.id === id)
  const last = ind?.history.filter((h) => h.source !== 'wearable_auto' || Number.isInteger(h.day)).at(-1)?.value
  if (last !== undefined) return last
  if (ind && typeof ind.value === 'number') return ind.value
  return profile.baseline.values[id]?.mean ?? fallback
}

interface ActiveAnomaly {
  kind: AnomalyKind
  ticksLeft: number
  /** Ticks elapsed since injection (for ramps). */
  age: number
}

/** Internal per-stream state, threaded through generateTick for determinism. */
interface StreamState {
  active: ActiveAnomaly[]
  stepsToday: number
  dayOfSteps: number
}

const states = new WeakMap<WearableTick, StreamState>()

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp

/**
 * Pure function: generate the next tick from the previous one (no timers).
 * Pass the anomaly to START on this tick; ongoing anomalies carry over from `previous`.
 */
export function generateTick(
  profile: AstronautProfile,
  previous: WearableTick | null,
  opts: { anomaly?: AnomalyKind; missionMinutesPerTick?: number; seed?: number } = {},
): WearableTick {
  const perTick = opts.missionMinutesPerTick ?? DEFAULT_MISSION_MINUTES_PER_TICK
  const tick = (previous?.tick ?? 0) + 1
  const missionMinute = tick * perTick
  const absMinute = STREAM_START_MINUTE_OF_DAY + missionMinute
  const missionDay = profile.missionDay + Math.floor(absMinute / 1440)
  const minuteOfDay = absMinute % 1440
  const day = round(profile.missionDay + absMinute / 1440, 4)
  const rand = mulberry32((opts.seed ?? 7) * 100_003 + tick)
  const noise = (amp: number) => (rand() * 2 - 1) * amp

  // Carry anomaly state.
  const prevState = previous ? states.get(previous) : undefined
  const active: ActiveAnomaly[] = (prevState?.active ?? [])
    .map((a) => ({ ...a, ticksLeft: a.ticksLeft - 1, age: a.age + 1 }))
    .filter((a) => a.ticksLeft > 0)
  if (opts.anomaly) active.push({ kind: opts.anomaly, ticksLeft: ANOMALY_DURATION_TICKS[opts.anomaly], age: 0 })
  const has = (k: AnomalyKind) => active.find((a) => a.kind === k)

  const env = ENVIRONMENTS[getPhaseForDay(profile.mission, day).environment]

  // Baselines from the astronaut's own data.
  const hr0 = latestNumber(profile, 'heart_rate', 66)
  const temp0 = latestNumber(profile, 'body_temp', 36.9)
  const spo20 = latestNumber(profile, 'spo2', env.cabinPsia < 10 ? 96 : 98)
  const sleep0 = latestNumber(profile, 'sleep_hours', 6.5)

  // Circadian swing: HR/temp lowest ~04:00, highest ~17:00.
  const circ = Math.sin(((minuteOfDay - 11 * 60) / 1440) * 2 * Math.PI)
  const exercising = minuteOfDay >= 10 * 60 && minuteOfDay < 12 * 60 // daily 2 h exercise block

  let heartRateBpm = hr0 + 4 * circ + noise(2) + (exercising ? 35 : 0)
  let bodyTempC = temp0 + 0.25 * circ + noise(0.08) + (exercising ? 0.4 : 0)
  let spo2Pct = Math.min(100, spo20 + noise(0.7))
  let hrvMs = 55 - 6 * circ + noise(5) - (exercising ? 20 : 0)

  const tach = has('tachycardia')
  if (tach) heartRateBpm = 128 + noise(5)
  const fever = has('fever')
  if (fever) bodyTempC = Math.max(bodyTempC, Math.min(39.2, temp0 + 0.6 + fever.age * 0.25)) + noise(0.05)
  const hypoxia = has('hypoxia')
  if (hypoxia) {
    spo2Pct = 88.5 + noise(1)
    heartRateBpm += 12
  }
  const flare = has('solar_flare')
  if (flare) {
    // Acute stress response while sheltering.
    heartRateBpm += 14
    hrvMs -= 18
  }
  if (fever) heartRateBpm += 10 * Math.min(1, fever.age / 3)

  // Steps reset at midnight.
  let stepsToday = prevState && prevState.dayOfSteps === missionDay ? prevState.stepsToday : 0
  const awake = minuteOfDay >= WAKE_MINUTE_OF_DAY && minuteOfDay < 23 * 60
  stepsToday += awake ? Math.max(0, Math.round((exercising ? 900 : 120) + noise(60))) : 0

  // Sleep is reported on the first tick at/after wake-up (and on the very first tick of a stream).
  const wakeCount = (abs: number) => Math.floor((abs - WAKE_MINUTE_OF_DAY) / 1440)
  const crossedWake = !previous || wakeCount(absMinute) > wakeCount(STREAM_START_MINUTE_OF_DAY + previous.missionMinute)
  let sleepHours: number | undefined
  if (crossedWake) sleepHours = round(Math.max(3, Math.min(10, sleep0 + noise(0.5))), 1)
  if (has('sleep_deprivation')) sleepHours = round(4.2 + noise(0.3), 1)

  const readings: WearableReadings = {
    heartRateBpm: Math.round(heartRateBpm),
    bodyTempC: round(bodyTempC, 1),
    skinTempC: round(bodyTempC - 2.6 + noise(0.2), 1),
    spo2Pct: Math.round(Math.min(100, spo2Pct)),
    steps: stepsToday,
    hrvMs: Math.max(8, Math.round(hrvMs)),
    ...(sleepHours !== undefined ? { sleepHours } : {}),
  }

  const timestamp = formatMissionTime(missionDay, minuteOfDay)
  const u = (id: IndicatorId, value: number, unit: string): IndicatorUpdate => ({
    astronautId: profile.id,
    id,
    value,
    unit,
    source: 'wearable_auto',
    timestamp,
    day,
  })
  // Resting-HR and core-temp rules don't apply mid-workout, so those indicators are only
  // updated outside the exercise block (anomalies still report, so demos always show).
  const resting = !exercising || Boolean(tach || fever || hypoxia || flare)
  const updates: IndicatorUpdate[] = [u('spo2', readings.spo2Pct, '%')]
  if (resting) updates.unshift(u('heart_rate', readings.heartRateBpm, 'bpm'), u('body_temp', readings.bodyTempC, '°C'))
  if (readings.sleepHours !== undefined) updates.push(u('sleep_hours', readings.sleepHours, 'hrs'))

  const result: WearableTick = {
    tick,
    missionMinute,
    timestamp,
    day,
    readings,
    updates,
    ...(opts.anomaly ? { injectedAnomaly: opts.anomaly } : {}),
  }
  states.set(result, { active, stepsToday, dayOfSteps: missionDay })
  return result
}

/** Create a stream controller for one crew member. Call start() to begin ticking. */
export function createWearableStream(config: WearableStreamConfig): WearableStreamController {
  const intervalMs = config.intervalMs ?? DEFAULT_INTERVAL_MS
  const listeners = new Set<WearableTickListener>()
  let last: WearableTick | null = null
  let pending: AnomalyKind | undefined
  let timer: ReturnType<typeof setInterval> | null = null

  const tickOnce = (): WearableTick => {
    const t = generateTick(config.profile, last, {
      anomaly: pending,
      missionMinutesPerTick: config.missionMinutesPerTick,
      seed: config.seed,
    })
    pending = undefined
    last = t
    for (const l of listeners) {
      try {
        l(t)
      } catch (err) {
        console.error('[wearableStream] listener failed', err)
      }
    }
    return t
  }

  return {
    start() {
      if (timer) return
      timer = setInterval(tickOnce, intervalMs)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
    isRunning: () => timer !== null,
    tickOnce,
    injectAnomaly(kind) {
      pending = kind
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
