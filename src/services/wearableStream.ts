/**
 * Automated 15-Minute Wearable Loop.
 *
 * Simulates a wrist/chest wearable pushing heart_rate, body_temp, sleep_hours,
 * HRV and dosimeter deltas every 15 mission minutes (default: 15 s real time).
 * Each tick yields IndicatorUpdate[] ready for healthEvaluator, and the
 * Mission Control bar can inject demo anomalies (solar flare, fever, ...).
 *
 * STATUS: Step-1 contract stub — signatures are final, bodies come in Step 2.
 */

import type {
  AnomalyKind,
  AstronautProfile,
  WearableStreamConfig,
  WearableStreamController,
  WearableTick,
} from '@/types/astronaut'
import { notImplemented } from './_notImplemented'

export const DEFAULT_INTERVAL_MS = 15_000
export const DEFAULT_MISSION_MINUTES_PER_TICK = 15

/** Human-readable labels for the Mission Control demo buttons. */
export const ANOMALY_LABELS: Record<AnomalyKind, string> = {
  solar_flare: 'Trigger Solar Flare Spike',
  tachycardia: 'Simulate Tachycardia',
  fever: 'Simulate Fever',
  sleep_deprivation: 'Simulate Sleep Deprivation',
  hypoxia: 'Simulate Low SpO2 (habitat O2 fault)',
}

/** Create a stream controller for one crew member. Call start() to begin ticking. */
export function createWearableStream(_config: WearableStreamConfig): WearableStreamController {
  return notImplemented('createWearableStream')
}

/** Pure function: generate the next tick from the previous one (no timers). */
export function generateTick(
  _profile: AstronautProfile,
  _previous: WearableTick | null,
  _opts?: { anomaly?: AnomalyKind; missionMinutesPerTick?: number; seed?: number },
): WearableTick {
  return notImplemented('generateTick')
}

/** Format a mission timestamp label, e.g. (45, 495) → "Day 45 08:15". */
export function formatMissionTime(_missionDay: number, _minuteOfDay: number): string {
  return notImplemented('formatMissionTime')
}
