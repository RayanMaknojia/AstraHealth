/**
 * Mission Timeline Model — "Don't ask where you are going; ask what day of the mission it is."
 *
 * Given a MissionPlan (phase schedule set by admin) and a mission day, returns
 * today's phase, environment rules, current Earth delay, delay-based
 * escalation mode, the cumulative exposure "bank account" (days at 0 g /
 * partial g, total radiation, estimated bone loss) and transition alerts
 * (entering 0 g, day-60 temperature shift, landing after transit, solar storm).
 *
 * Powers the trip bar and the judges' demo slider (drag launch → Mars).
 *
 * STATUS: Step-1 contract stub — signatures are final, bodies come in Step 2.
 */

import type {
  CumulativeExposure,
  EscalationMode,
  MissionPhase,
  MissionPlan,
  MissionState,
  TransitionAlert,
} from '@/types/astronaut'
import { notImplemented } from './_notImplemented'

/** Mission day from launch date and "now" (no manual updates). Negative = before launch (Earth mode). */
export function missionDayFromDate(_launchDate: string, _now?: Date): number {
  return notImplemented('missionDayFromDate')
}

/** Phase active on a given day (clamped to the first/last phase). */
export function getPhaseForDay(_plan: MissionPlan, _missionDay: number): MissionPhase {
  return notImplemented('getPhaseForDay')
}

/** One-way Earth delay in seconds on a given day (grows during deep-space transit). */
export function earthDelaySecondsForDay(_plan: MissionPlan, _missionDay: number): number {
  return notImplemented('earthDelaySecondsForDay')
}

/** Short delay → 'contact_ground'; long delay → 'act_then_report'. */
export function escalationModeForDay(_plan: MissionPlan, _missionDay: number): EscalationMode {
  return notImplemented('escalationModeForDay')
}

/** Running totals from day 0 up to missionDay, phase by phase. */
export function computeExposure(_plan: MissionPlan, _missionDay: number, _priorDoseMSv?: number): CumulativeExposure {
  return notImplemented('computeExposure')
}

/** Alerts active on missionDay (phase transitions, day-60 temp shift, landing checks). */
export function getTransitionAlerts(_plan: MissionPlan, _missionDay: number): TransitionAlert[] {
  return notImplemented('getTransitionAlerts')
}

/** Everything the HUD needs for "today". Use with the demo slider by passing any day. */
export function getMissionState(_plan: MissionPlan, _missionDay?: number): MissionState {
  return notImplemented('getMissionState')
}

/** Trip-bar caption, e.g. "Day 45 · Flying to Mars · 138 days to arrival". */
export function formatTripBarLabel(_state: MissionState): string {
  return notImplemented('formatTripBarLabel')
}
