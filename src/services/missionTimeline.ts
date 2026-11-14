/**
 * Mission Timeline Model — "Don't ask where you are going; ask what day of the mission it is."
 *
 * Given a MissionPlan (phase schedule set by admin) and a mission day, returns
 * today's phase, environment rules, current Earth delay, delay-based
 * escalation mode, the cumulative exposure "bank account" (days at 0 g /
 * partial g, total radiation, estimated bone loss) and transition alerts
 * (entering 0 g, day-60 temperature shift, landing after transit, solar
 * conjunction blackout). Solar-storm alerts come from environmentFeed.ts.
 *
 * Powers the trip bar and the judges' demo slider (drag launch → Mars).
 * Pure functions: no timers, no I/O — safe to call on every render.
 */

import {
  ACT_THEN_REPORT_DELAY_S,
  BONE_LOSS_PCT_PER_DAY_AT_0G,
  ENVIRONMENTS,
  SPACE_ADJUSTMENT_RULES,
  phaseForDay,
} from '@/data/nasaSpaceflightData'
import type {
  CumulativeExposure,
  EnvironmentType,
  EscalationMode,
  MissionPhase,
  MissionPlan,
  MissionState,
  TransitionAlert,
} from '@/types/astronaut'

const MS_PER_DAY = 86_400_000

const round = (v: number, dp = 2) => Math.round(v * 10 ** dp) / 10 ** dp
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Mission day from launch date and "now" (no manual updates). Negative = before launch (Earth mode). */
export function missionDayFromDate(launchDate: string, now: Date = new Date()): number {
  const launch = Date.parse(launchDate.length <= 10 ? `${launchDate}T00:00:00Z` : launchDate)
  if (Number.isNaN(launch)) return 0
  return Math.floor((now.getTime() - launch) / MS_PER_DAY)
}

/** Phase active on a given day. Before launch → "Pre-launch (Earth mode)"; after the end → "Back on Earth". */
export function getPhaseForDay(plan: MissionPlan, missionDay: number): MissionPhase {
  return phaseForDay(plan, missionDay)
}

function phaseIndex(plan: MissionPlan, phase: MissionPhase): number {
  return plan.phases.findIndex((p) => p.order === phase.order && p.startDay === phase.startDay)
}

/** Mid-point of the conjunction blackout during a Mars surface stay (Sun between Earth and Mars). */
function conjunctionWindow(plan: MissionPlan): { from: number; to: number; peak: number } | null {
  const surface = plan.phases.find((p) => p.environment === 'MARS_SURFACE')
  if (!surface) return null
  const peak = Math.round((surface.startDay + surface.endDay) / 2)
  return { from: peak - 7, to: peak + 7, peak }
}

/** One-way Earth delay in seconds on a given day (grows during deep-space transit). Estimate. */
export function earthDelaySecondsForDay(plan: MissionPlan, missionDay: number): number {
  const phase = getPhaseForDay(plan, missionDay)
  const env = ENVIRONMENTS[phase.environment]
  const i = phaseIndex(plan, phase)
  const frac = clamp((missionDay - phase.startDay) / Math.max(1, phase.endDay - phase.startDay), 0, 1)

  if (phase.environment === 'DEEP_SPACE' && i >= 0) {
    const next = plan.phases[i + 1]?.environment
    const prev = plan.phases[i - 1]?.environment
    const marsDelay = ENVIRONMENTS.MARS_ORBIT.commDelaySecondsMin
    const moonDelay = ENVIRONMENTS.MOON_SURFACE.commDelaySecondsMax
    // Distance (and delay) grows fastest early in the cruise → square-root ramp.
    if (next === 'MARS_ORBIT' || next === 'MARS_SURFACE') return round(1 + (marsDelay - 1) * Math.sqrt(frac), 1)
    if (prev === 'MARS_SURFACE' || prev === 'MARS_ORBIT') return round(1 + (marsDelay - 1) * Math.sqrt(1 - frac), 1)
    if (next === 'MOON_SURFACE') return round(0.1 + (moonDelay - 0.1) * frac, 2)
    if (prev === 'MOON_SURFACE') return round(moonDelay - (moonDelay - 0.1) * frac, 2)
    return env.commDelaySecondsMax
  }
  if (phase.environment === 'MARS_SURFACE') {
    // Delay grows from ~4 min toward ~24 min at solar conjunction (mid-stay), then shrinks.
    const s = Math.sin(Math.PI * frac)
    return round(env.commDelaySecondsMin + (env.commDelaySecondsMax - env.commDelaySecondsMin) * s, 0)
  }
  if (phase.environment === 'MARS_ORBIT') return env.commDelaySecondsMin
  if (phase.environment === 'EARTH_ORBIT') return 0.5
  return env.commDelaySecondsMax
}

export function escalationModeForDelay(oneWayDelaySeconds: number): EscalationMode {
  return oneWayDelaySeconds > ACT_THEN_REPORT_DELAY_S ? 'act_then_report' : 'contact_ground'
}

/**
 * Reference doc §7: Short (ISS, Moon) → contact flight surgeon; Long (Mars, transit) → act now, then report.
 * Any Mars-mission phase beyond Earth orbit counts as long, even while the delay is still growing.
 */
export function escalationModeForDay(plan: MissionPlan, missionDay: number): EscalationMode {
  const env = getPhaseForDay(plan, missionDay).environment
  const marsLeg = plan.destination === 'MARS' && (env === 'DEEP_SPACE' || env === 'MARS_ORBIT' || env === 'MARS_SURFACE')
  return marsLeg ? 'act_then_report' : escalationModeForDelay(earthDelaySecondsForDay(plan, missionDay))
}

/**
 * Running totals from day 0 up to missionDay, phase by phase.
 * totalRadiationMSv is the MISSION dose; pass priorDoseMSv to get a career-to-date total instead.
 */
export function computeExposure(plan: MissionPlan, missionDay: number, priorDoseMSv = 0): CumulativeExposure {
  const end = clamp(missionDay, 0, plan.totalDays)
  let days0g = 0
  let daysPartialG = 0
  let rad = 0
  let bone = 0
  for (const ph of plan.phases) {
    const span = Math.max(0, Math.min(end, ph.endDay) - ph.startDay)
    if (span <= 0) continue
    const env = ENVIRONMENTS[ph.environment]
    if (env.gravityG === 0) days0g += span
    else if (env.gravityG < 1) daysPartialG += span
    rad += span * env.typicalDoseRateMSvPerDay
    bone -= span * BONE_LOSS_PCT_PER_DAY_AT_0G * (1 - env.gravityG)
  }
  return {
    missionDay,
    days0g: round(days0g, 1),
    daysPartialG: round(daysPartialG, 1),
    totalRadiationMSv: round(rad + priorDoseMSv, 2),
    estBoneLossPct: round(bone, 2),
  }
}

/** Continuous 0 g days ending at missionDay (for the day-60 temperature shift). */
export function continuous0gDays(plan: MissionPlan, missionDay: number): number {
  const day = Math.min(missionDay, plan.totalDays)
  let days = 0
  // Walk backwards from the phase containing `day` over contiguous 0 g phases.
  for (let i = plan.phases.length - 1; i >= 0; i--) {
    const ph = plan.phases[i]
    if (ph.startDay >= day) continue
    if (ENVIRONMENTS[ph.environment].gravityG !== 0) break
    days += Math.min(day, ph.endDay) - ph.startDay
  }
  return round(days, 1)
}

/** All transition alerts for a plan (each with its active window). */
export function getAllTransitionAlerts(plan: MissionPlan): TransitionAlert[] {
  const out: TransitionAlert[] = []
  const g = (env: EnvironmentType) => ENVIRONMENTS[env].gravityG
  const rule = SPACE_ADJUSTMENT_RULES.bodyTemp

  plan.phases.forEach((ph, i) => {
    const prevG = i === 0 ? 1 : g(plan.phases[i - 1].environment)
    const curG = g(ph.environment)
    if (curG === 0 && prevG > 0) {
      out.push({
        kind: 'entering_0g',
        severity: 'caution',
        title: 'Entering weightlessness',
        guidance: [
          'Space motion sickness is common in the first 2–3 days: move your head slowly, use anti-nausea meds from the kit if needed.',
          'Fluids shift to your head (puffy face, stuffy nose, headache) — drink to schedule even if not thirsty.',
          'Report severe headache or vision changes.',
        ],
        activeFromDay: ph.startDay,
        activeToDay: ph.startDay + 3,
      })
    }
    // Landing after a long 0 g stretch.
    if (curG > 0 && prevG === 0) {
      const zeroGBefore = continuous0gDays(plan, ph.startDay)
      if (zeroGBefore >= 30)
        out.push({
          kind: 'landing_after_transit',
          severity: 'caution',
          title: `Gravity re-adaptation after ${Math.round(zeroGBefore)} days in 0 g`,
          guidance: [
            'Dizziness on standing, poor balance and fall risk are expected for 1–2 weeks.',
            'Do a daily standing blood-pressure check (lie 5 min, stand, measure at 1 and 3 min).',
            'Do a daily balance check; rise slowly; wear compression garments.',
          ],
          activeFromDay: ph.startDay,
          activeToDay: ph.startDay + 14,
        })
    }
  })

  // Day-60 temperature shift: first day continuous 0 g reaches 60.
  for (let d = 0; d < plan.totalDays; d++) {
    if (continuous0gDays(plan, d) >= rule.after0gDays && g(phaseForDay(plan, d).environment) === 0) {
      out.push({
        kind: 'temp_baseline_shift',
        severity: 'nominal',
        title: `Day ${d}: body temperature baseline raised by ~${rule.shiftC} °C`,
        guidance: [
          `After ${rule.after0gDays} days in weightlessness, resting body temperature runs about ${rule.shiftC} °C higher.`,
          'The app has moved your normal range up; a true fever is still flagged.',
          'Exercise raises temperature faster in space — cool down and hydrate after sessions.',
        ],
        activeFromDay: d,
        activeToDay: d + 7,
      })
      break
    }
  }

  // Return to Earth gravity after the mission.
  const last = plan.phases[plan.phases.length - 1]
  if (last && g(last.environment) === 0) {
    const zeroG = continuous0gDays(plan, plan.totalDays)
    if (zeroG >= 30)
      out.push({
        kind: 'landing_after_transit',
        severity: 'caution',
        title: `Back in Earth gravity after ${Math.round(zeroG)} days in 0 g`,
        guidance: [
          'Expect dizziness on standing and poor balance for 1–2 weeks.',
          'Daily standing blood-pressure and balance checks; rise slowly.',
        ],
        activeFromDay: plan.totalDays,
        activeToDay: plan.totalDays + 14,
      })
  }

  const conj = conjunctionWindow(plan)
  if (conj)
    out.push({
      kind: 'comm_blackout',
      severity: 'caution',
      title: 'Solar conjunction: communication blackout with Earth',
      guidance: [
        'The Sun sits between Earth and Mars — expect no contact for about 2 weeks.',
        'All medical decisions are made onboard: follow the action plans and log everything for later.',
        'Check medical-kit stock before the blackout starts.',
      ],
      activeFromDay: conj.from,
      activeToDay: conj.to,
    })

  return out.sort((a, b) => a.activeFromDay - b.activeFromDay)
}

/** Alerts active on missionDay (phase transitions, day-60 temp shift, landing checks, blackout). */
export function getTransitionAlerts(plan: MissionPlan, missionDay: number): TransitionAlert[] {
  return getAllTransitionAlerts(plan).filter((a) => missionDay >= a.activeFromDay && missionDay < a.activeToDay)
}

/** Everything the HUD needs for "today". Use with the demo slider by passing any day. */
export function getMissionState(plan: MissionPlan, missionDay?: number): MissionState {
  const day = missionDay ?? missionDayFromDate(plan.launchDate)
  const phase = getPhaseForDay(plan, day)
  const environment = ENVIRONMENTS[phase.environment]
  const earthDelaySeconds = earthDelaySecondsForDay(plan, day)
  const i = phaseIndex(plan, phase)
  const nextPhase: MissionPhase | null =
    day < 0 ? plan.phases[0] ?? null : i >= 0 ? plan.phases[i + 1] ?? null : null
  return {
    plan,
    missionDay: day,
    phase,
    environment,
    earthDelaySeconds,
    escalationMode: escalationModeForDay(plan, day),
    exposure: computeExposure(plan, day),
    daysToNextPhase: nextPhase ? Math.max(0, Math.ceil(nextPhase.startDay - day)) : null,
    nextPhase,
    progress: clamp(day / Math.max(1, plan.totalDays), 0, 1),
    activeAlerts: getTransitionAlerts(plan, day),
  }
}

function arrivalWord(state: MissionState): string {
  const next = state.nextPhase
  if (!next) return 'mission end'
  if (state.phase.environment === 'DEEP_SPACE' && ['MARS_ORBIT', 'MARS_SURFACE', 'MOON_SURFACE'].includes(next.environment))
    return 'arrival'
  if (next === state.plan.phases[state.plan.phases.length - 1] && next.environment === 'DEEP_SPACE') return 'departure for home'
  return next.name.toLowerCase()
}

/** Trip-bar caption, e.g. "Day 45 · Flying to Mars · 138 days to arrival". */
export function formatTripBarLabel(state: MissionState): string {
  const { missionDay: day, plan } = state
  if (day < 0) return `T−${-day} days to launch · Earth mode (collecting your baseline)`
  if (day >= plan.totalDays) return `Day ${day} · Mission complete · Back on Earth`
  const parts = [`Day ${day}`, state.phase.name]
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
  if (state.daysToNextPhase !== null) parts.push(`${days(state.daysToNextPhase)} to ${arrivalWord(state)}`)
  else parts.push(`${days(Math.max(0, Math.ceil(plan.totalDays - day)))} to splashdown`)
  return parts.join(' · ')
}
