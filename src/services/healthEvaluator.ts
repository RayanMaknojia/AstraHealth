/**
 * Health Evaluation & Anomaly Engine.
 *
 * Classifies astronaut vitals into nominal | caution | critical, and maps each
 * to an escalation level:
 *   nominal  → self_care       (keep routine)
 *   caution  → crew_alert      (tell crew medical officer, re-check)
 *   critical → flight_surgeon  (contact Earth flight surgeon; act now)
 *
 * Thresholds live in src/data/nasaSpaceflightData.ts (THRESHOLDS) with their
 * sources. This is a decision-support demo, not a medical device.
 */

import {
  BONE_LOSS_PCT_PER_DAY_AT_0G,
  ENVIRONMENTS,
  INDICATOR_GUIDES,
  SPACE_ADJUSTMENT_RULES as ADJ,
  STALE_AFTER_DAYS,
  THRESHOLDS as T,
  TREND_SENSITIVITY,
} from '@/data/nasaSpaceflightData'
import { continuous0gDays, escalationModeForDelay, getMissionState } from '@/services/missionTimeline'
import type {
  ActionLevel,
  ActionPlan,
  AstronautProfile,
  BodySystem,
  DataFreshness,
  DisplayStatus,
  EnvironmentType,
  EscalationMode,
  EvaluationContext,
  HealthIndicator,
  HealthReport,
  HistoryPoint,
  IndicatorEvaluation,
  IndicatorId,
  IndicatorUpdate,
  MissionState,
  PersonalBaseline,
  SpaceAdjustments,
  StatusLevel,
  SystemStatus,
  TrajectoryResult,
  TrendDirection,
  VitalsInput,
} from '@/types/astronaut'

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_RANK: Record<StatusLevel, number> = { nominal: 0, caution: 1, critical: 2 }

export const STATUS_TO_ACTION: Record<StatusLevel, ActionLevel> = {
  nominal: 'self_care',
  caution: 'crew_alert',
  critical: 'flight_surgeon',
}

/** At-a-glance HUD colours (Emerald / Amber / Crimson; grey = no data — never green). */
export const STATUS_COLORS: Record<DisplayStatus, string> = {
  nominal: '#10b981',
  caution: '#f59e0b',
  critical: '#dc2626',
  no_data: '#6b7280',
}

/** Crew-facing labels (reference doc wording). */
export const STATUS_LABELS: Record<DisplayStatus, string> = {
  nominal: 'Normal',
  caution: 'Watch',
  critical: 'Alert',
  no_data: 'No data',
}

export const ESCALATION_MODE_LABELS: Record<EscalationMode, string> = {
  contact_ground: 'Contact the flight surgeon',
  act_then_report: 'Act now with onboard guidance, then report to Earth',
}

/** What the UI should paint for an indicator: grey unless the reading is fresh. */
export function displayStatus(ind: Pick<HealthIndicator, 'status' | 'dataState' | 'value'>): DisplayStatus {
  return ind.dataState === 'fresh' && ind.value !== null ? ind.status : 'no_data'
}

/** Short delay (ISS, Moon) → contact ground; long delay (transit, Mars) → act then report. */
export const escalationModeFor: (oneWayDelaySeconds: number) => EscalationMode = escalationModeForDelay

// ── Spaceflight physiology adjustments ─────────────────────────────────────

/** Earth / no-shift adjustments (also used when no mission context is given). */
export const NO_ADJUSTMENTS: SpaceAdjustments = {
  bodyTempShiftC: 0,
  bpShiftSystolic: 0,
  bpShiftDiastolic: 0,
  sleepTargetHours: ADJ.sleep.targetHours,
  lowPressureHabitat: false,
  notes: {},
}

/**
 * Shifts for today's mission state (reference doc §6):
 *  - body temp +1 °C after 60 continuous days in 0 g
 *  - in-flight BP 8–10 mmHg lower (scaled by (1 − g) in partial gravity — estimate)
 *  - sleep target 8.5 h, Alert after 3 nights < 6 h
 *  - tighter SpO2 Watch in ≤ 10.3 psia habitats
 * Values: health_rules.md.
 */
export function getSpaceAdjustments(state?: MissionState): SpaceAdjustments {
  if (!state) return NO_ADJUSTMENTS
  const env = state.environment
  const notes: SpaceAdjustments['notes'] = {
    sleep_hours: `Target ${ADJ.sleep.targetHours} h (the scheduled ISS sleep). One night under ${ADJ.sleep.alertBelowHours} h is a Watch; 3 nights in a row is an Alert. Astronauts average ~6 h.`,
  }
  const zeroG = continuous0gDays(state.plan, state.missionDay)
  const tempShift = env.gravityG === 0 && zeroG >= ADJ.bodyTemp.after0gDays ? ADJ.bodyTemp.shiftC : 0
  if (tempShift)
    notes.body_temp = `After ${Math.round(zeroG)} days in 0 g resting temperature runs higher, so Normal now goes up to ${(T.bodyTemp.cautionHigh - 0.1 + tempShift).toFixed(1)} °C. A fever (≥ ${T.bodyTemp.criticalHigh} °C) is still an Alert.`
  else if (env.gravityG === 0)
    notes.body_temp = `Temperature slowly rises in 0 g; after day ${ADJ.bodyTemp.after0gDays} Normal goes up to ${(T.bodyTemp.cautionHigh - 0.1 + ADJ.bodyTemp.shiftC).toFixed(1)} °C (now ${Math.round(zeroG)} days).`
  // Lower BP is expected in flight, so the LOW limits relax — except just after landing (fainting risk).
  const justLanded = state.activeAlerts.some((a) => a.kind === 'landing_after_transit')
  const bpScale = env.id === 'EARTH' || justLanded ? 0 : 1 - env.gravityG
  const sys = -Math.round(ADJ.bloodPressure.inFlightSystolicRelax * bpScale)
  const dia = -Math.round(ADJ.bloodPressure.inFlightDiastolicRelax * bpScale)
  if (sys)
    notes.blood_pressure = `In flight, blood pressure runs 8–10 mmHg lower, so a top number down to ${T.bloodPressure.systolicCautionLow + sys} still counts as Normal${env.gravityG > 0 ? ' (partial-gravity estimate)' : ''}.`
  else if (justLanded)
    notes.blood_pressure = 'Just landed: Earth limits apply again — low blood pressure now means a fainting risk when standing. Do the standing BP check.'
  const lowPressureHabitat = env.cabinPsia <= ADJ.spo2.lowPressureHabitatPsia
  if (lowPressureHabitat)
    notes.spo2 = `This habitat runs at ${env.cabinPsia} psia / ${env.cabinO2Pct}% O2, close to the oxygen floor, so SpO2 limits are tighter.`
  if (env.gravityG < 1)
    notes.bone_density = `Expected loss here ≈ ${(BONE_LOSS_PCT_PER_DAY_AT_0G * (1 - env.gravityG) * 30).toFixed(2)}% per month at ${env.gravityG} g (estimate).`
  return {
    bodyTempShiftC: tempShift,
    bpShiftSystolic: sys,
    bpShiftDiastolic: dia,
    sleepTargetHours: ADJ.sleep.targetHours,
    lowPressureHabitat,
    notes,
  }
}

/** Numeric limits for an indicator after adjustments (history units; BP = systolic). */
interface Bounds {
  cautionLow?: number
  criticalLow?: number
  cautionHigh?: number
  criticalHigh?: number
}

export function boundsFor(id: IndicatorId, adj: SpaceAdjustments = NO_ADJUSTMENTS, priorCareerDoseMSv = 0): Bounds {
  switch (id) {
    case 'heart_rate':
      return { cautionLow: T.heartRate.cautionLow, criticalLow: T.heartRate.criticalLow, cautionHigh: T.heartRate.cautionHigh + 0.5, criticalHigh: T.heartRate.criticalHigh + 0.5 }
    case 'blood_pressure':
      return {
        cautionLow: T.bloodPressure.systolicCautionLow + adj.bpShiftSystolic,
        criticalLow: T.bloodPressure.systolicCriticalLow,
        cautionHigh: T.bloodPressure.systolicCautionHigh,
        criticalHigh: T.bloodPressure.systolicCriticalHigh,
      }
    case 'blood_sugar':
      return { cautionLow: T.bloodSugar.cautionLow, criticalLow: T.bloodSugar.criticalLow, cautionHigh: T.bloodSugar.nominalHighNonFasting + 0.5, criticalHigh: T.bloodSugar.criticalHigh + 0.5 }
    case 'body_temp':
      return tempBounds(adj)
    case 'spo2': {
      const o = T.spo2
      return adj.lowPressureHabitat ? { cautionLow: o.habitatCautionLow, criticalLow: o.habitatCriticalLow } : { cautionLow: o.cautionLow, criticalLow: o.criticalLow }
    }
    case 'sleep_hours':
      return { cautionLow: T.sleep.cautionLow, criticalLow: T.sleep.criticalLow, cautionHigh: T.sleep.cautionHigh + 0.05 }
    case 'mood':
      return { cautionLow: T.mood.cautionAtOrBelow + 0.5, criticalLow: T.mood.criticalAtOrBelow + 0.5 }
    case 'bone_density':
      return { cautionLow: T.boneDensity.cautionAtOrBelowPct + 0.005, criticalLow: T.boneDensity.criticalAtOrBelowPct + 0.005 }
    case 'radiation_dose': {
      const r = T.radiation
      return {
        cautionHigh: r.careerLimitMSv * r.cautionCareerFraction - priorCareerDoseMSv,
        criticalHigh: r.careerLimitMSv * r.criticalCareerFraction - priorCareerDoseMSv,
      }
    }
  }
}

function tempBounds(adj: SpaceAdjustments) {
  const t = T.bodyTemp
  const sh = adj.bodyTempShiftC
  return {
    criticalLow: t.criticalLow,
    cautionLow: round1(t.cautionLow + sh),
    cautionHigh: round1(t.cautionHigh + sh),
    criticalHigh: t.criticalHigh, // a fever is a fever — never shifted
  }
}

const round1 = (v: number) => Math.round(v * 10) / 10
const round2 = (v: number) => Math.round(v * 100) / 100

export const ACTION_LABELS: Record<ActionLevel, string> = {
  self_care: 'Self-care — keep your routine',
  crew_alert: 'Alert crew medical officer',
  flight_surgeon: 'Contact flight surgeon now',
}

export function worstStatus(statuses: StatusLevel[]): StatusLevel {
  return statuses.reduce<StatusLevel>((w, s) => (STATUS_RANK[s] > STATUS_RANK[w] ? s : w), 'nominal')
}

interface Verdict {
  status: StatusLevel
  message: string
  thresholdNote: string
  steps: string[]
}

function plan(status: StatusLevel, steps: string[], mode: EscalationMode = 'contact_ground'): ActionPlan {
  const level = STATUS_TO_ACTION[status]
  const tail: Record<ActionLevel, string[]> = {
    self_care: [],
    crew_alert: ['Tell the crew medical officer and re-measure within 4 hours.'],
    flight_surgeon:
      mode === 'act_then_report'
        ? [
            'Notify the crew medical officer immediately.',
            'Earth is too far for a live reply: start these steps now using onboard guidance.',
            'Then send this reading and the last 3 days of trends to the flight surgeon.',
          ]
        : [
            'Notify the crew medical officer immediately.',
            'Contact the flight surgeon on the private medical channel; send this reading and the last 3 days of trends.',
          ],
  }
  return { level, steps: [...steps, ...tail[level]], ...(level !== 'self_care' ? { escalationMode: mode } : {}) }
}

function toEvaluation(id: IndicatorId, value: number | string, v: Verdict, mode: EscalationMode = 'contact_ground'): IndicatorEvaluation {
  const g = INDICATOR_GUIDES[id]
  return {
    id,
    system: g.system,
    status: v.status,
    value,
    unit: g.unit,
    message: v.message,
    thresholdNote: v.thresholdNote,
    actionPlan: plan(v.status, v.steps, mode),
  }
}

// ── Individual rules ───────────────────────────────────────────────────────

export function evaluateBloodSugar(mgDl: number, fasting = false): Verdict {
  const b = T.bloodSugar
  if (mgDl < b.criticalLow)
    return {
      status: 'critical',
      message: `Blood sugar is dangerously low (${mgDl} mg/dL).`,
      thresholdNote: `< ${b.criticalLow} mg/dL`,
      steps: [
        'Take 15–20 g of fast sugar now (glucose tabs, juice pouch).',
        'Do not work alone or perform EVA / piloting tasks.',
        'Re-check in 15 minutes; repeat sugar if still below 70.',
      ],
    }
  if (mgDl > b.criticalHigh)
    return {
      status: 'critical',
      message: `Blood sugar is very high (${mgDl} mg/dL).`,
      thresholdNote: `> ${b.criticalHigh} mg/dL`,
      steps: ['Drink water.', 'Note any thirst, frequent urination, blurred vision, or nausea.', 'Re-check in 1 hour.'],
    }
  if (mgDl < b.cautionLow)
    return {
      status: 'caution',
      message: `Blood sugar is low (${mgDl} mg/dL).`,
      thresholdNote: `${b.criticalLow}–${b.cautionLow - 1} mg/dL`,
      steps: ['Eat a snack with 15 g of carbohydrate.', 'Re-check in 15 minutes.'],
    }
  const tooHigh = fasting ? mgDl >= b.nominalHighFasting : mgDl > b.nominalHighNonFasting
  if (tooHigh)
    return {
      status: 'caution',
      message: `Blood sugar is above the healthy range (${mgDl} mg/dL${fasting ? ', fasting' : ''}).`,
      thresholdNote: fasting ? `${b.nominalHighFasting}–${b.criticalHigh} mg/dL fasting` : `${b.nominalHighNonFasting + 1}–${b.criticalHigh} mg/dL`,
      steps: [
        'Complete your scheduled exercise — muscle use lowers blood sugar.',
        'Cut sugary drinks and snacks today.',
        'Re-test fasting tomorrow morning.',
      ],
    }
  return {
    status: 'nominal',
    message: `Blood sugar is in range (${mgDl} mg/dL).`,
    thresholdNote: `${b.cautionLow}–${fasting ? b.nominalHighFasting - 1 : b.nominalHighNonFasting} mg/dL${fasting ? ' fasting' : ''}`,
    steps: ['Keep to the meal plan and daily exercise.'],
  }
}

export function evaluateHeartRate(bpm: number): Verdict {
  const h = T.heartRate
  if (bpm < h.criticalLow || bpm > h.criticalHigh)
    return {
      status: 'critical',
      message: `Resting heart rate is ${bpm < h.criticalLow ? 'very slow' : 'very fast'} (${bpm} bpm).`,
      thresholdNote: `< ${h.criticalLow} or > ${h.criticalHigh} bpm at rest`,
      steps: [
        'Stop activity and strap in / sit down.',
        'Report any chest pain, dizziness, fainting, or shortness of breath immediately.',
        'Record an ECG if available.',
      ],
    }
  if (bpm < h.cautionLow || bpm > h.cautionHigh)
    return {
      status: 'caution',
      message: `Resting heart rate is outside the usual range (${bpm} bpm).`,
      thresholdNote: `${h.criticalLow}–${h.cautionLow - 1} or ${h.cautionHigh + 1}–${h.criticalHigh} bpm`,
      steps: [
        'Rest 10 minutes and re-measure.',
        'Drink 500 mL of water (fluid shifts can cause dehydration).',
        'Avoid caffeine for the rest of the shift.',
      ],
    }
  return {
    status: 'nominal',
    message: `Resting heart rate is normal (${bpm} bpm).`,
    thresholdNote: `${h.cautionLow}–${h.cautionHigh} bpm`,
    steps: ['Keep up aerobic exercise to prevent heart de-conditioning.'],
  }
}

export function evaluateBloodPressure(systolic: number, diastolic: number, adj: SpaceAdjustments = NO_ADJUSTMENTS): Verdict {
  const base = T.bloodPressure
  // In flight the LOW limits relax (lower BP is expected); high limits stay at Earth values.
  const p = {
    ...base,
    systolicCautionLow: base.systolicCautionLow + adj.bpShiftSystolic,
    diastolicCautionLow: base.diastolicCautionLow + adj.bpShiftDiastolic,
  }
  const reading = `${systolic}/${diastolic} mmHg`
  if (systolic >= p.systolicCriticalHigh || diastolic >= p.diastolicCriticalHigh)
    return {
      status: 'critical',
      message: `Blood pressure is very high (${reading}).`,
      thresholdNote: `≥ ${p.systolicCriticalHigh} systolic or ≥ ${p.diastolicCriticalHigh} diastolic`,
      steps: [
        'Rest 5 minutes and re-measure on the other arm.',
        'Report headache, vision changes, or chest pain immediately (vision changes may also indicate SANS).',
      ],
    }
  if (systolic < p.systolicCriticalLow)
    return {
      status: 'critical',
      message: `Blood pressure is very low (${reading}).`,
      thresholdNote: `< ${p.systolicCriticalLow} systolic`,
      steps: [
        'Lie flat / strap in with legs raised if in gravity.',
        'Drink fluids with salt tablets (fluid loading).',
        'Do not stand up quickly or perform EVA.',
      ],
    }
  if (systolic < p.systolicCautionLow || diastolic < p.diastolicCautionLow)
    return {
      status: 'caution',
      message: `Blood pressure is low (${reading}).`,
      thresholdNote: `< ${p.systolicCautionLow}/${p.diastolicCautionLow} mmHg`,
      steps: [
        'Drink 1 L of fluid with electrolytes today.',
        'Wear compression garments before gravity transitions (landing, lunar descent).',
        'Rise slowly — low pressure can cause fainting in gravity.',
      ],
    }
  if (systolic >= p.systolicCautionHigh || diastolic >= p.diastolicCautionHigh)
    return {
      status: 'caution',
      message: `Blood pressure is elevated (${reading}).`,
      thresholdNote: `${p.systolicCautionHigh}–${p.systolicCriticalHigh - 1} systolic or ${p.diastolicCautionHigh}–${p.diastolicCriticalHigh - 1} diastolic`,
      steps: ['Cut added salt in meals.', 'Complete aerobic exercise.', 'Use a relaxation/breathing session; re-check tomorrow.'],
    }
  return {
    status: 'nominal',
    message: `Blood pressure is normal (${reading}).`,
    thresholdNote: `${p.systolicCautionLow}–${p.systolicCautionHigh - 1} / ${p.diastolicCautionLow}–${p.diastolicCautionHigh - 1} mmHg${adj.bpShiftSystolic ? ' (in-flight adjusted)' : ''}`,
    steps: ['Stay hydrated and keep up exercise.'],
  }
}

export function evaluateBodyTemp(c: number, adj: SpaceAdjustments = NO_ADJUSTMENTS): Verdict {
  const t = tempBounds(adj)
  const shifted = adj.bodyTempShiftC ? ` (space-adjusted +${adj.bodyTempShiftC} °C)` : ''
  if (c >= t.criticalHigh)
    return {
      status: 'critical',
      message: `High fever (${c} °C).`,
      thresholdNote: `≥ ${t.criticalHigh} °C${shifted}`,
      steps: [
        'Take fever reducer from the medical kit as directed (e.g. acetaminophen).',
        'Wear a mask and limit contact — infections spread fast in a closed cabin.',
        'Drink fluids; re-check every 2 hours.',
      ],
    }
  if (c < t.criticalLow)
    return {
      status: 'critical',
      message: `Body temperature is dangerously low (${c} °C).`,
      thresholdNote: `< ${t.criticalLow} °C`,
      steps: ['Re-measure to rule out a faulty reading.', 'Add layers / sleeping bag; check cabin temperature setting.'],
    }
  if (c >= t.cautionHigh)
    return {
      status: 'caution',
      message: `Temperature is slightly raised (${c} °C).`,
      thresholdNote: `${t.cautionHigh}–${(t.criticalHigh - 0.1).toFixed(1)} °C${shifted}`,
      steps: ['Rest and hydrate.', 'Watch for chills, cough, or sore throat.', 'Re-check in 4 hours.'],
    }
  if (c < t.cautionLow)
    return {
      status: 'caution',
      message: `Temperature is a little low (${c} °C).`,
      thresholdNote: `${t.criticalLow}–${(t.cautionLow - 0.1).toFixed(1)} °C${shifted}`,
      steps: ['Add a layer and re-measure in 30 minutes.'],
    }
  return {
    status: 'nominal',
    message: `Temperature is normal for you right now (${c} °C).`,
    thresholdNote: `${t.cautionLow}–${(t.cautionHigh - 0.1).toFixed(1)} °C${shifted}`,
    steps: ['Keep up hand hygiene.'],
  }
}

/** How many of the most recent values (newest last) satisfy `pred` without a break. */
function streak(values: number[] | undefined, pred: (v: number) => boolean): number {
  let n = 0
  for (let i = (values?.length ?? 0) - 1; i >= 0 && pred(values![i]); i--) n++
  return n
}

/**
 * Sleep (health_rules.md): Normal ≥ 7 h (target 8.5). Watch 6–6.9 h or a single night < 6 h.
 * Alert: < 6 h for 3 nights in a row, or any night < 4 h. Pass recent nights for the pattern rule.
 */
export function evaluateSleep(hours: number, adj: SpaceAdjustments = NO_ADJUSTMENTS, recentNights?: number[]): Verdict {
  const s = T.sleep
  const target = adj.sleepTargetHours
  const nights = recentNights?.length ? recentNights : [hours]
  const shortRun = streak(nights, (h) => h < s.criticalLow)
  if (hours < s.severeSingleNight)
    return {
      status: 'critical',
      message: `Severe sleep loss (${hours} h) — not fit for EVA, robotics or piloting today.`,
      thresholdNote: `< ${s.severeSingleNight} h in one night`,
      steps: [
        'Do not perform EVA, robotics, or piloting tasks until rested.',
        'Schedule a nap (max 30 min) and an early sleep window tonight.',
        'Tell the crew medical officer.',
      ],
    }
  if (hours < s.criticalLow && shortRun >= s.consecutiveNightsForAlert)
    return {
      status: 'critical',
      message: `${shortRun} nights in a row under ${s.criticalLow} h (last night ${hours} h) — sleep debt is building.`,
      thresholdNote: `< ${s.criticalLow} h for ${s.consecutiveNightsForAlert} nights in a row`,
      steps: [
        'Avoid EVA, robotics, and piloting tasks until you have had a full night.',
        'Protect a full 8.5 h sleep window tonight: dim screens 1 h before, eye mask, earplugs.',
        'Discuss sleep aid options and schedule changes with the flight surgeon.',
      ],
    }
  if (hours < s.cautionLow)
    return {
      status: 'caution',
      message:
        hours < s.criticalLow
          ? `Short night (${hours} h)${shortRun > 1 ? ` — ${shortRun} nights in a row` : ''}. Alert if it happens ${s.consecutiveNightsForAlert} nights in a row.`
          : `Short sleep (${hours} h) — astronauts average ~6 h; your target is ${target} h.`,
      thresholdNote: hours < s.criticalLow ? `< ${s.criticalLow} h (night ${shortRun} of ${s.consecutiveNightsForAlert})` : `${s.criticalLow}–${s.cautionLow} h (target ${target} h)`,
      steps: [
        'Dim lights and screens 1 hour before your sleep window.',
        'Use eye mask and earplugs; secure sleeping bag.',
        'Avoid caffeine after mid-shift.',
      ],
    }
  if (hours > s.cautionHigh)
    return {
      status: 'caution',
      message: `Unusually long sleep (${hours} h) — can signal illness or low mood.`,
      thresholdNote: `> ${s.cautionHigh} h`,
      steps: ['Check temperature and mood today.', 'Keep a fixed wake time.'],
    }
  return {
    status: 'nominal',
    message: hours < target ? `OK sleep (${hours} h) — a little under your ${target} h target.` : `Good sleep (${hours} h).`,
    thresholdNote: `≥ ${s.cautionLow} h (target ${target} h)`,
    steps: hours < target ? ['Try to protect a full 8.5 h sleep window tonight.'] : ['Keep the same sleep window each day.'],
  }
}

/**
 * Mood, 1–5 (health_rules.md): Normal 4–5. Watch 3, or a single day at 1–2.
 * Alert: 1–2 for 3 days in a row. (Self-harm mentions are an immediate Alert in ingestionEngine.)
 */
export function evaluateMood(score: number, recentDays?: number[]): Verdict {
  const m = T.mood
  const days = recentDays?.length ? recentDays : [score]
  const lowRun = streak(days, (v) => v <= m.criticalAtOrBelow)
  if (score <= m.criticalAtOrBelow && lowRun >= m.consecutiveDaysForAlert)
    return {
      status: 'critical',
      message: `Mood has been very low for ${lowRun} days in a row (${score}/${m.scaleMax} today).`,
      thresholdNote: `≤ ${m.criticalAtOrBelow}/${m.scaleMax} for ${m.consecutiveDaysForAlert} days in a row`,
      steps: [
        'You are not alone — talk to a crewmate you trust today.',
        'Request a private session with the behavioural health team.',
        'If you have thoughts of harming yourself, tell the commander or crew medical officer right away.',
      ],
    }
  if (score <= m.cautionAtOrBelow)
    return {
      status: 'caution',
      message:
        score <= m.criticalAtOrBelow
          ? `Mood is very low today (${score}/${m.scaleMax})${lowRun > 1 ? ` — ${lowRun} days in a row` : ''}.`
          : `Mood is lower than usual (${score}/${m.scaleMax}).`,
      thresholdNote: score <= m.criticalAtOrBelow ? `≤ ${m.criticalAtOrBelow}/${m.scaleMax} (day ${lowRun} of ${m.consecutiveDaysForAlert})` : `${m.cautionAtOrBelow}/${m.scaleMax}`,
      steps: ['Schedule a family call or leisure time.', 'Exercise and get light exposure during your day window.', 'Talk to a crewmate; check in again tomorrow.'],
    }
  return {
    status: 'nominal',
    message: `Mood is good (${score}/${m.scaleMax}).`,
    thresholdNote: `≥ ${m.cautionAtOrBelow + 1}/${m.scaleMax}`,
    steps: ['Keep up team meals and personal time.'],
  }
}

export interface RadiationContext {
  environment: EnvironmentType
  /** Career dose before the current mission, mSv. */
  priorCareerDoseMSv?: number
}

export function evaluateRadiation(dailyMSv: number | undefined, missionMSv: number | undefined, ctx: RadiationContext): Verdict {
  const r = T.radiation
  const env = ENVIRONMENTS[ctx.environment]
  const career = (ctx.priorCareerDoseMSv ?? 0) + (missionMSv ?? 0)
  const fraction = career / r.careerLimitMSv
  const pct = Math.round(fraction * 100)
  const daily = dailyMSv ?? 0
  const notes = `career ${Math.round(career)} / ${r.careerLimitMSv} mSv (${pct}%)` + (dailyMSv !== undefined ? `, today ${daily} mSv` : '')

  if (daily >= r.dailyCriticalMSv || fraction >= r.criticalCareerFraction)
    return {
      status: 'critical',
      message:
        daily >= r.dailyCriticalMSv
          ? `Radiation spike: ${daily} mSv today — possible solar particle event.`
          : `Career radiation dose at ${pct}% of NASA’s 600 mSv limit.`,
      thresholdNote: `≥ ${r.dailyCriticalMSv} mSv/day or ≥ ${r.criticalCareerFraction * 100}% career limit — ${notes}`,
      steps: [
        'Move to the storm shelter / most shielded module now.',
        'Cancel or postpone EVAs and rover traverses.',
        'Keep your dosimeter on and log readings hourly.',
      ],
    }
  if (daily >= r.dailyCautionMSv || daily > env.typicalDoseRateMSvPerDay * 2 || fraction >= r.cautionCareerFraction)
    return {
      status: 'caution',
      message:
        fraction >= r.cautionCareerFraction
          ? `Career radiation dose has passed half the limit (${pct}%).`
          : `Today’s dose (${daily} mSv) is above normal for ${env.label} (~${env.typicalDoseRateMSvPerDay} mSv/day).`,
      thresholdNote: `> 2× environment baseline, ≥ ${r.dailyCautionMSv} mSv/day, or ≥ ${r.cautionCareerFraction * 100}% career limit — ${notes}`,
      steps: [
        'Check space-weather alerts.',
        'Spend sleep and rest periods in the most shielded area.',
        'Limit time outside shielding.',
      ],
    }
  return {
    status: 'nominal',
    message: `Radiation exposure is within expected levels for ${env.label}.`,
    thresholdNote: notes,
    steps: ['Keep wearing your dosimeter and log it daily.'],
  }
}

export function evaluateBoneDensity(changePct: number): Verdict {
  const b = T.boneDensity
  if (changePct <= b.criticalAtOrBelowPct)
    return {
      status: 'critical',
      message: `Significant bone loss (${changePct}% vs pre-flight).`,
      thresholdNote: `≤ ${b.criticalAtOrBelowPct}%`,
      steps: [
        'Avoid high-impact loads and falls; take care in gravity transitions.',
        'Increase resistive exercise load under trainer guidance.',
        'Review calcium, vitamin D, and drink extra water (kidney-stone risk).',
      ],
    }
  if (changePct <= b.cautionAtOrBelowPct)
    return {
      status: 'caution',
      message: `Bone density is dropping (${changePct}% vs pre-flight).`,
      thresholdNote: `${b.criticalAtOrBelowPct}% to ${b.cautionAtOrBelowPct}%`,
      steps: ['Do not skip resistive exercise sessions.', 'Check that you are eating your full calcium and vitamin D ration.'],
    }
  return {
    status: 'nominal',
    message: `Bone density is stable (${changePct}% vs pre-flight).`,
    thresholdNote: `> ${b.cautionAtOrBelowPct}%`,
    steps: ['Keep up daily resistive exercise.'],
  }
}

export function evaluateSpO2(pct: number, cabinPsia = 14.7): Verdict {
  const o = T.spo2
  const lowPressure = cabinPsia <= o.lowPressureHabitatPsia
  const cautionLow = lowPressure ? o.habitatCautionLow : o.cautionLow
  const criticalLow = lowPressure ? o.habitatCriticalLow : o.criticalLow
  const where = lowPressure ? ` (tighter limits: ${cabinPsia} psia habitat)` : ''
  if (pct < criticalLow)
    return {
      status: 'critical',
      message: `Low blood oxygen: ${pct}%${where}.`,
      thresholdNote: `< ${criticalLow}%`,
      steps: [
        'Stop all exertion and sit or strap in.',
        'Put on the emergency oxygen mask.',
        'Check the cabin O2 / pressure display for a life-support fault.',
      ],
    }
  if (pct < cautionLow)
    return {
      status: 'caution',
      message: `Blood oxygen is a little low: ${pct}%${where}.`,
      thresholdNote: `${criticalLow}–${cautionLow - 1}%`,
      steps: ['Rest 10 minutes, warm your hands and re-measure.', 'Check the cabin CO2 and O2 readings.'],
    }
  return {
    status: 'nominal',
    message: `Blood oxygen is normal (${pct}%).`,
    thresholdNote: `≥ ${cautionLow}%`,
    steps: ['Keep up your daily SpO2 check.'],
  }
}

// ── Aggregation ────────────────────────────────────────────────────────────

const ALL_SYSTEMS: BodySystem[] = ['cardiovascular', 'musculoskeletal', 'radiation_immune', 'metabolic', 'behavioral']

export function rollupSystems(evals: Pick<IndicatorEvaluation, 'id' | 'system' | 'status'>[]): SystemStatus[] {
  return ALL_SYSTEMS.map((system) => {
    const mine = evals.filter((e) => e.system === system)
    const status = worstStatus(mine.map((e) => e.status))
    return {
      system,
      status,
      drivers: mine.filter((e) => e.status === status && status !== 'nominal').map((e) => e.id),
    }
  })
}

export function readinessScore(statuses: StatusLevel[]): number {
  const penalty = statuses.reduce((sum, s) => sum + (s === 'critical' ? 30 : s === 'caution' ? 10 : 0), 0)
  return Math.max(0, Math.min(100, 100 - penalty))
}

function environmentAdvisories(env: EnvironmentType, overall: StatusLevel, mode: EscalationMode, state?: MissionState): string[] {
  const e = ENVIRONMENTS[env]
  const out: string[] = []
  const delay = state?.earthDelaySeconds ?? e.commDelaySecondsMax
  if (overall !== 'nominal' && mode === 'act_then_report')
    out.push(
      `Signal delay to Earth is about ${formatDelay(delay)} one way. Begin the action plan now with your crew medical officer — do not wait for a reply from the flight surgeon.`,
    )
  if (e.gravityG === 0) out.push('Microgravity: complete daily resistive exercise to protect bones and muscles.')
  else if (e.gravityG < 1) out.push(`Partial gravity (${e.gravityG} g): rise slowly after rest; bones still need resistive loading.`)
  if (e.typicalDoseRateMSvPerDay >= 1)
    out.push(`Higher background radiation here (~${e.typicalDoseRateMSvPerDay} mSv/day). Sleep in the shielded area.`)
  if (e.dustRisk === 'high') out.push('Lunar dust: clean suits in the airlock; report sneezing, watery eyes or sore throat ("lunar hay fever").')
  else if (e.dustRisk === 'moderate') out.push('Fine surface dust: keep airlock hygiene and report any cough.')
  if (e.cabinPsia <= ADJ.spo2.lowPressureHabitatPsia)
    out.push(`Habitat air is ${e.cabinPsia} psia / ${e.cabinO2Pct}% O2 — check SpO2 daily and after heavy work.`)
  for (const a of state?.activeAlerts ?? []) out.push(`${a.title}: ${a.guidance[0]}`)
  return out
}

export function formatDelay(seconds: number): string {
  if (seconds < 1) return '< 1 s'
  if (seconds < 90) return `${Math.round(seconds * 10) / 10} s`
  return `${Math.round(seconds / 60)} min`
}

const ALL_INDICATORS: IndicatorId[] = [
  'heart_rate',
  'blood_pressure',
  'blood_sugar',
  'body_temp',
  'spo2',
  'sleep_hours',
  'mood',
  'radiation_dose',
  'bone_density',
]

/** Indicators whose personal-baseline deviation alone can raise a Watch. */
const BASELINE_SENSITIVE: IndicatorId[] = ['spo2', 'blood_sugar'] // heart rate uses the 15% rule
const BASELINE_Z_WATCH = 3.5

function baselineZ(id: IndicatorId, value: number, baseline?: PersonalBaseline): number | undefined {
  const b = baseline?.values[id]
  if (!b || b.n < 3) return undefined
  const sd = Math.max(b.sd, TREND_SENSITIVITY[id].sdFloor)
  return sd > 0 ? round2((value - b.mean) / sd) : undefined
}

/**
 * Evaluate raw values from the Log Vitals panel. Missing fields are skipped and listed in missingIndicators.
 * Pass `opts.missionState` to apply spaceflight shifts and delay-based escalation; `opts.baseline` for
 * personal-baseline scoring.
 */
export function evaluateVitals(input: VitalsInput, environment: EnvironmentType, opts: EvaluationContext = {}): HealthReport {
  const evals: IndicatorEvaluation[] = []
  const env = ENVIRONMENTS[environment]
  const state = opts.missionState
  const adj = getSpaceAdjustments(state)
  const mode = state?.escalationMode ?? escalationModeFor(env.commDelaySecondsMax)

  const push = (id: IndicatorId, value: number | string, v: Verdict, numeric?: number) => {
    const z = numeric !== undefined ? baselineZ(id, numeric, opts.baseline) : undefined
    let verdict = v
    const mean = opts.baseline?.values[id]?.mean
    const hrOff = id === 'heart_rate' && numeric !== undefined && mean ? (numeric - mean) / mean : 0
    if (v.status === 'nominal' && Math.abs(hrOff) >= T.heartRate.baselineWatchFraction)
      verdict = {
        status: 'caution',
        message: `${v.message.replace(/\.$/, '')} — but ${Math.round(Math.abs(hrOff) * 100)}% ${hrOff > 0 ? 'above' : 'below'} your usual ${Math.round(mean!)} bpm.`,
        thresholdNote: `${v.thresholdNote}; ≥ ${T.heartRate.baselineWatchFraction * 100}% from your baseline`,
        steps: ['Rest 10 minutes and re-measure.', ...v.steps],
      }
    else if (z !== undefined && v.status === 'nominal' && BASELINE_SENSITIVE.includes(id) && Math.abs(z) >= BASELINE_Z_WATCH)
      verdict = {
        status: 'caution',
        message: `${v.message.replace(/\.$/, '')} — but unusual for you (${z > 0 ? '+' : ''}${z} SD from your baseline).`,
        thresholdNote: `${v.thresholdNote}; personal baseline |z| ≥ ${BASELINE_Z_WATCH}`,
        steps: ['Re-measure in 30 minutes to confirm.', ...v.steps],
      }
    const e = toEvaluation(id, value, verdict, mode)
    evals.push(z !== undefined ? { ...e, baselineZ: z } : e)
  }

  if (input.bloodSugarMgDl !== undefined)
    push('blood_sugar', input.bloodSugarMgDl, evaluateBloodSugar(input.bloodSugarMgDl, input.fasting), input.bloodSugarMgDl)
  if (input.heartRateBpm !== undefined) push('heart_rate', input.heartRateBpm, evaluateHeartRate(input.heartRateBpm), input.heartRateBpm)
  if (input.systolicMmHg !== undefined && input.diastolicMmHg !== undefined)
    push(
      'blood_pressure',
      `${input.systolicMmHg}/${input.diastolicMmHg}`,
      evaluateBloodPressure(input.systolicMmHg, input.diastolicMmHg, adj),
      input.systolicMmHg,
    )
  if (input.bodyTempC !== undefined) push('body_temp', input.bodyTempC, evaluateBodyTemp(input.bodyTempC, adj), input.bodyTempC)
  if (input.spo2Pct !== undefined) push('spo2', input.spo2Pct, evaluateSpO2(input.spo2Pct, env.cabinPsia), input.spo2Pct)
  if (input.sleepHours !== undefined)
    push('sleep_hours', input.sleepHours, evaluateSleep(input.sleepHours, adj, input.sleepRecentNights), input.sleepHours)
  if (input.mood !== undefined) push('mood', input.mood, evaluateMood(input.mood, input.moodRecentDays), input.mood)
  if (input.radiationDailyMSv !== undefined || input.radiationMissionMSv !== undefined)
    push(
      'radiation_dose',
      input.radiationMissionMSv ?? input.radiationDailyMSv ?? 0,
      evaluateRadiation(input.radiationDailyMSv, input.radiationMissionMSv, {
        environment,
        priorCareerDoseMSv: opts.priorCareerDoseMSv,
      }),
    )
  if (input.boneDensityChangePct !== undefined)
    push('bone_density', input.boneDensityChangePct, evaluateBoneDensity(input.boneDensityChangePct))

  const statuses = evals.map((e) => e.status)
  const overallStatus = worstStatus(statuses)
  const seen = new Set(evals.map((e) => e.id))
  const missingIndicators = ALL_INDICATORS.filter((id) => !seen.has(id))
  return {
    environment,
    overallStatus,
    escalation: STATUS_TO_ACTION[overallStatus],
    escalationMode: mode,
    readinessScore: Math.max(0, readinessScore(statuses) - missingIndicators.length * 2),
    indicators: evals,
    systems: rollupSystems(evals),
    missingIndicators,
    environmentAdvisories: environmentAdvisories(environment, overallStatus, mode, state),
  }
}

// ── Trajectory (slope) detection ───────────────────────────────────────────

/** Days of history used for the slope. */
export const TRAJECTORY_WINDOW_DAYS = 7
/** Projections further out than this are not shown. */
export const PROJECTION_HORIZON_DAYS = 90

function linearFit(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length
  const mx = points.reduce((a, p) => a + p.x, 0) / n
  const my = points.reduce((a, p) => a + p.y, 0) / n
  let num = 0
  let den = 0
  for (const p of points) {
    num += (p.x - mx) * (p.y - my)
    den += (p.x - mx) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  return { slope, intercept: my - slope * mx }
}

export interface TrajectoryContext {
  adjustments?: SpaceAdjustments
  /** Environment for expected radiation-rate / bone-loss rate. */
  environment?: EnvironmentType
  priorCareerDoseMSv?: number
  /** Current status, if already evaluated (chooses which boundary is "next"). */
  status?: StatusLevel
}

function statusFromBounds(v: number, b: Bounds): StatusLevel {
  if ((b.criticalLow !== undefined && v < b.criticalLow) || (b.criticalHigh !== undefined && v >= b.criticalHigh)) return 'critical'
  if ((b.cautionLow !== undefined && v < b.cautionLow) || (b.cautionHigh !== undefined && v >= b.cautionHigh)) return 'caution'
  return 'nominal'
}

/**
 * Slope-based trajectory over the last TRAJECTORY_WINDOW_DAYS of history.
 * Flags drifting_caution / rapid_decline BEFORE a hard limit is crossed and
 * estimates days until the next limit (projectedDaysToThreshold).
 */
export function computeTrajectory(id: IndicatorId, history: HistoryPoint[], ctx: TrajectoryContext = {}): TrajectoryResult {
  const stable: TrajectoryResult = { trend: 'stable', slopePerDay: 0 }
  if (history.length < 3) return stable
  const lastDay = history[history.length - 1].day
  // One point per mission day (mean; last value for cumulative series) so 15-minute
  // wearable ticks and circadian swings don't masquerade as a multi-day trend.
  const cumulativeSeries = id === 'radiation_dose' || id === 'bone_density'
  const byDay = new Map<number, number[]>()
  for (const h of history) {
    if (h.day < lastDay - TRAJECTORY_WINDOW_DAYS) continue
    const d = Math.floor(h.day)
    byDay.set(d, [...(byDay.get(d) ?? []), h.value])
  }
  const pts = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([d, vs]) => ({ x: d, y: cumulativeSeries ? vs[vs.length - 1] : vs.reduce((a, v) => a + v, 0) / vs.length }))
  if (pts.length < 3 || pts[pts.length - 1].x - pts[0].x < 2) return stable

  const { slope, intercept } = linearFit(pts)
  const fitted = intercept + slope * lastDay
  const bounds = boundsFor(id, ctx.adjustments, ctx.priorCareerDoseMSv)
  const status = ctx.status ?? statusFromBounds(fitted, bounds)
  const env = ENVIRONMENTS[ctx.environment ?? 'EARTH_ORBIT']
  const slopePerDay = Math.round(slope * 1000) / 1000

  // Which way is "bad", and is the change meaningful?
  let worsening: boolean
  let meaningful: number
  if (id === 'radiation_dose') {
    meaningful = env.typicalDoseRateMSvPerDay * 0.5 + 0.02
    worsening = slope > env.typicalDoseRateMSvPerDay * 1.5 + 0.02
  } else if (id === 'bone_density') {
    const expected = -BONE_LOSS_PCT_PER_DAY_AT_0G * (1 - env.gravityG)
    meaningful = Math.abs(expected) * 0.5 + 0.005
    worsening = slope < expected * 1.5 - 0.005
  } else {
    meaningful = TREND_SENSITIVITY[id].meaningfulPerDay
    const lo = bounds.cautionLow
    const hi = bounds.cautionHigh
    const center = lo !== undefined && hi !== undefined ? (lo + hi) / 2 : lo !== undefined ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
    const towardBad = (slope > 0 && fitted >= center) || (slope < 0 && fitted <= center)
    if (Math.abs(slope) < meaningful) return { ...stable, slopePerDay }
    worsening = towardBad
  }

  // Cumulative metrics (dose, bone) always move toward their limit; project even when the rate is normal.
  const cumulative = id === 'radiation_dose' || id === 'bone_density'
  if (!worsening && !cumulative) return { trend: status !== 'nominal' ? 'improving' : 'stable', slopePerDay }

  const goingUp = slope > 0
  const next =
    status === 'nominal'
      ? goingUp ? bounds.cautionHigh : bounds.cautionLow
      : status === 'caution'
        ? goingUp ? bounds.criticalHigh : bounds.criticalLow
        : undefined
  const projectedStatus: TrajectoryResult['projectedStatus'] = status === 'nominal' ? 'caution' : status === 'caution' ? 'critical' : undefined
  let projected: number | undefined
  if (next !== undefined && slope !== 0) {
    const d = (next - fitted) / slope
    projected = d <= 0 ? 0.5 : d
  }
  const inHorizon = projected !== undefined && projected <= PROJECTION_HORIZON_DAYS
  const result = (trend: TrendDirection): TrajectoryResult => ({
    trend,
    slopePerDay,
    ...(inHorizon ? { projectedDaysToThreshold: Math.max(1, Math.round(projected!)), projectedStatus } : {}),
  })

  if (cumulative && !worsening) return inHorizon && projected! <= 30 ? result('drifting_caution') : { ...result('stable') }
  if (status === 'critical' || (inHorizon && projected! <= 3) || Math.abs(slope) >= 3 * meaningful) return result('rapid_decline')
  return result('drifting_caution')
}

// ── Profile-level evaluation ───────────────────────────────────────────────

function parseBloodPressure(v: number | string): [number, number] | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(String(v))
  return m ? [Number(m[1]), Number(m[2])] : null
}

/** Value of a cumulative series ~24 h before its last point (linear interpolation). */
function valueOneDayEarlier(h: HistoryPoint[]): number | undefined {
  if (h.length < 2) return undefined
  const last = h[h.length - 1]
  const target = last.day - 1
  for (let i = h.length - 2; i >= 0; i--) {
    if (h[i].day <= target) {
      const a = h[i]
      const b = h[i + 1]
      const f = b.day === a.day ? 0 : (target - a.day) / (b.day - a.day)
      return a.value + (b.value - a.value) * f
    }
  }
  // Less than a day of history: scale what we have to a 24 h rate.
  const first = h[0]
  const span = last.day - first.day
  return span > 0 ? last.value - (last.value - first.value) / span : undefined
}

/** Last value per mission day for the last 7 days (oldest → newest), ending with `current`. */
function dailyValues(h: HistoryPoint[], current: number): number[] {
  const byDay = new Map<number, number>()
  for (const p of h) byDay.set(Math.floor(p.day), p.value)
  const vals = [...byDay.entries()].sort((a, b) => a[0] - b[0]).slice(-7).map(([, v]) => v)
  if (!vals.length || vals[vals.length - 1] !== current) vals.push(current)
  return vals
}

/** Convert a stored indicator list (e.g. a crew profile) into VitalsInput. Missing values are skipped. */
export function indicatorsToVitals(indicators: HealthIndicator[]): VitalsInput {
  const input: VitalsInput = {}
  for (const ind of indicators) {
    if (ind.value === null || ind.dataState === 'missing') continue
    const n = typeof ind.value === 'number' ? ind.value : Number(ind.value)
    switch (ind.id) {
      case 'blood_sugar': input.bloodSugarMgDl = n; break
      case 'heart_rate': input.heartRateBpm = n; break
      case 'body_temp': input.bodyTempC = n; break
      case 'sleep_hours': input.sleepHours = n; input.sleepRecentNights = dailyValues(ind.history, n); break
      case 'mood': input.mood = n; input.moodRecentDays = dailyValues(ind.history, n); break
      case 'spo2': input.spo2Pct = n; break
      case 'radiation_dose': {
        input.radiationMissionMSv = n
        const prev = valueOneDayEarlier(ind.history)
        if (prev !== undefined) input.radiationDailyMSv = round2(ind.history[ind.history.length - 1].value - prev)
        break
      }
      case 'bone_density': input.boneDensityChangePct = n; break
      case 'blood_pressure': {
        const bp = parseBloodPressure(ind.value)
        if (bp) [input.systolicMmHg, input.diastolicMmHg] = bp
        break
      }
    }
  }
  return input
}

function freshness(ind: HealthIndicator, today: number, ignoreStaleness: boolean): { state: DataFreshness; lastDay?: number } {
  const lastDay = ind.history.length ? ind.history[ind.history.length - 1].day : ind.lastMeasuredDay
  if (ind.value === null || lastDay === undefined) return { state: 'missing' }
  if (!ignoreStaleness && today - lastDay > STALE_AFTER_DAYS[ind.id]) return { state: 'stale', lastDay }
  return { state: 'fresh', lastDay }
}

export interface EvaluateProfileOptions {
  /** Mission state to evaluate against (e.g. from the demo slider). Default: state on profile.missionDay. */
  missionState?: MissionState
  /** Demo slider: don't grey out readings just because the slider moved past them. */
  ignoreStaleness?: boolean
}

/**
 * Re-evaluate every indicator on a profile: status, action plan (with escalation mode),
 * trend + projectedDaysToThreshold, data freshness and space-shift notes.
 * Use this to hydrate CREW_PROFILES before rendering, and after every new reading.
 */
export function evaluateProfile(
  profile: AstronautProfile,
  options: EvaluateProfileOptions = {},
): { indicators: HealthIndicator[]; report: HealthReport; missionState: MissionState } {
  const state = options.missionState ?? getMissionState(profile.mission, profile.missionDay)
  const adj = getSpaceAdjustments(state)
  const ignore = options.ignoreStaleness ?? false

  const withFreshness = profile.indicators.map((ind) => {
    const f = freshness(ind, state.missionDay, ignore)
    return { ...ind, dataState: f.state, lastMeasuredDay: f.lastDay }
  })
  const report = evaluateVitals(indicatorsToVitals(withFreshness), state.phase.environment, {
    missionState: state,
    baseline: profile.baseline,
    priorCareerDoseMSv: profile.priorCareerDoseMSv,
  })
  const byId = new Map(report.indicators.map((e) => [e.id, e]))
  const indicators = withFreshness.map((ind): HealthIndicator => {
    const e = byId.get(ind.id)
    const traj = computeTrajectory(ind.id, ind.history, {
      adjustments: adj,
      environment: state.phase.environment,
      priorCareerDoseMSv: profile.priorCareerDoseMSv,
      status: e?.status,
    })
    const { projectedDaysToThreshold: _drop, ...rest } = ind
    void _drop
    return {
      ...rest,
      status: e?.status ?? ind.status,
      actionPlan: e?.actionPlan ?? ind.actionPlan,
      trend: ind.dataState === 'missing' ? 'stable' : traj.trend,
      ...(traj.projectedDaysToThreshold !== undefined ? { projectedDaysToThreshold: traj.projectedDaysToThreshold } : {}),
      spaceShiftNote: adj.notes[ind.id],
    }
  })
  // Stale readings count as missing in the report (painted grey).
  const stale = indicators.filter((i) => i.dataState === 'stale').map((i) => i.id)
  return {
    indicators,
    report: { ...report, missingIndicators: [...new Set([...report.missingIndicators, ...stale])] },
    missionState: state,
  }
}

/** Max history points kept per indicator (15-minute ticks add up fast). */
export const MAX_HISTORY_POINTS = 400

function numericValue(u: IndicatorUpdate): number | null {
  if (typeof u.value === 'number') return u.value
  if (u.id === 'blood_pressure') return parseBloodPressure(u.value)?.[0] ?? null
  const n = Number(u.value)
  return Number.isFinite(n) ? n : null
}

/**
 * Merge new readings (wearable tick, environment tick, manual check-in, ingested file)
 * into a profile and re-evaluate. Returns a NEW profile; the input is not mutated.
 */
export function applyIndicatorUpdates(
  profile: AstronautProfile,
  updates: IndicatorUpdate[],
  options: EvaluateProfileOptions = {},
): { profile: AstronautProfile; report: HealthReport; missionState: MissionState } {
  const byId = new Map<IndicatorId, IndicatorUpdate[]>()
  for (const u of updates) byId.set(u.id, [...(byId.get(u.id) ?? []), u])
  let maxDay = profile.missionDay

  const indicators = profile.indicators.map((ind) => {
    const ups = byId.get(ind.id)
    if (!ups?.length) return ind
    const history = [...ind.history]
    let value = ind.value
    for (const u of [...ups].sort((a, b) => a.day - b.day)) {
      const n = numericValue(u)
      if (n === null) continue
      const baseline = profile.baseline.values[ind.id]?.mean ?? history[history.length - 1]?.baseline ?? n
      history.push({ timestamp: u.timestamp, value: n, baseline, source: u.source, day: u.day })
      value = u.value
      maxDay = Math.max(maxDay, Math.floor(u.day))
    }
    history.sort((a, b) => a.day - b.day)
    return {
      ...ind,
      value,
      dataState: 'fresh' as const,
      lastMeasuredDay: history[history.length - 1]?.day,
      history: history.slice(-MAX_HISTORY_POINTS),
      simulated: ind.simulated || ups.some((u) => u.source === 'wearable_auto' || u.source === 'environment_feed'),
    }
  })

  const next: AstronautProfile = { ...profile, missionDay: maxDay, indicators }
  const state = options.missionState ?? getMissionState(next.mission, maxDay)
  const { indicators: evaluated, report, missionState } = evaluateProfile(next, { ...options, missionState: state })
  return { profile: { ...next, environment: missionState.phase.environment, habitat: missionState.phase.habitat, indicators: evaluated }, report, missionState }
}
