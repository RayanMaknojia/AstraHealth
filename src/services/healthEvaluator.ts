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
  ENVIRONMENTS,
  INDICATOR_GUIDES,
  THRESHOLDS as T,
} from '@/data/nasaSpaceflightData'
import type {
  ActionLevel,
  ActionPlan,
  AstronautProfile,
  BodySystem,
  EnvironmentType,
  HealthIndicator,
  HealthReport,
  IndicatorEvaluation,
  IndicatorId,
  StatusLevel,
  SystemStatus,
  VitalsInput,
} from '@/types/astronaut'

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_RANK: Record<StatusLevel, number> = { nominal: 0, caution: 1, critical: 2 }

export const STATUS_TO_ACTION: Record<StatusLevel, ActionLevel> = {
  nominal: 'self_care',
  caution: 'crew_alert',
  critical: 'flight_surgeon',
}

/** At-a-glance HUD colours (Emerald / Amber / Crimson). */
export const STATUS_COLORS: Record<StatusLevel, string> = {
  nominal: '#10b981',
  caution: '#f59e0b',
  critical: '#dc2626',
}

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

function plan(status: StatusLevel, steps: string[]): ActionPlan {
  const level = STATUS_TO_ACTION[status]
  const tail: Record<ActionLevel, string[]> = {
    self_care: [],
    crew_alert: ['Tell the crew medical officer and re-measure within 4 hours.'],
    flight_surgeon: [
      'Notify the crew medical officer immediately.',
      'Contact the flight surgeon on the private medical channel; send this reading and the last 3 days of trends.',
    ],
  }
  return { level, steps: [...steps, ...tail[level]] }
}

function toEvaluation(id: IndicatorId, value: number | string, v: Verdict): IndicatorEvaluation {
  const g = INDICATOR_GUIDES[id]
  return {
    id,
    system: g.system,
    status: v.status,
    value,
    unit: g.unit,
    message: v.message,
    thresholdNote: v.thresholdNote,
    actionPlan: plan(v.status, v.steps),
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
  if (mgDl >= b.cautionHigh)
    return {
      status: 'critical',
      message: `Blood sugar is very high (${mgDl} mg/dL).`,
      thresholdNote: `≥ ${b.cautionHigh} mg/dL`,
      steps: ['Drink water.', 'Note any thirst, frequent urination, blurred vision, or nausea.', 'Re-check in 1 hour.'],
    }
  if (mgDl < b.cautionLow)
    return {
      status: 'caution',
      message: `Blood sugar is low (${mgDl} mg/dL).`,
      thresholdNote: `${b.criticalLow}–${b.cautionLow - 1} mg/dL`,
      steps: ['Eat a snack with 15 g of carbohydrate.', 'Re-check in 15 minutes.'],
    }
  const high = fasting ? b.fastingCautionHigh : b.nominalHighNonFasting + 1
  if (mgDl >= high)
    return {
      status: 'caution',
      message: `Blood sugar is above the healthy range (${mgDl} mg/dL${fasting ? ', fasting' : ''}).`,
      thresholdNote: fasting ? `≥ ${b.fastingCautionHigh} mg/dL fasting` : `> ${b.nominalHighNonFasting} mg/dL`,
      steps: [
        'Complete your scheduled exercise — muscle use lowers blood sugar.',
        'Cut sugary drinks and snacks today.',
        'Re-test fasting tomorrow morning.',
      ],
    }
  return {
    status: 'nominal',
    message: `Blood sugar is in range (${mgDl} mg/dL).`,
    thresholdNote: `${b.cautionLow}–${fasting ? b.fastingCautionHigh - 1 : b.nominalHighNonFasting} mg/dL`,
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

export function evaluateBloodPressure(systolic: number, diastolic: number): Verdict {
  const p = T.bloodPressure
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
    thresholdNote: `${p.systolicCautionLow}–${p.systolicCautionHigh - 1} / ${p.diastolicCautionLow}–${p.diastolicCautionHigh - 1} mmHg`,
    steps: ['Stay hydrated and keep up exercise.'],
  }
}

export function evaluateBodyTemp(c: number): Verdict {
  const t = T.bodyTemp
  if (c >= t.criticalHigh)
    return {
      status: 'critical',
      message: `High fever (${c} °C).`,
      thresholdNote: `≥ ${t.criticalHigh} °C`,
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
      thresholdNote: `${t.cautionHigh}–${(t.criticalHigh - 0.1).toFixed(1)} °C (note: core temp runs ~1 °C high in space)`,
      steps: ['Rest and hydrate.', 'Watch for chills, cough, or sore throat.', 'Re-check in 4 hours.'],
    }
  if (c < t.cautionLow)
    return {
      status: 'caution',
      message: `Temperature is a little low (${c} °C).`,
      thresholdNote: `${t.criticalLow}–${(t.cautionLow - 0.1).toFixed(1)} °C`,
      steps: ['Add a layer and re-measure in 30 minutes.'],
    }
  return {
    status: 'nominal',
    message: `Temperature is normal (${c} °C).`,
    thresholdNote: `${t.cautionLow}–${(t.cautionHigh - 0.1).toFixed(1)} °C`,
    steps: ['Keep up hand hygiene.'],
  }
}

export function evaluateSleep(hours: number): Verdict {
  const s = T.sleep
  if (hours < s.criticalLow)
    return {
      status: 'critical',
      message: `Severe sleep loss (${hours} h).`,
      thresholdNote: `< ${s.criticalLow} h`,
      steps: [
        'Do not perform EVA, robotics, or piloting tasks until rested.',
        'Schedule a nap (max 30 min) and an early sleep window tonight.',
        'Discuss sleep aid options with the flight surgeon.',
      ],
    }
  if (hours < s.cautionLow)
    return {
      status: 'caution',
      message: `Short sleep (${hours} h) — astronauts average ~6 h, aim for 7–9 h.`,
      thresholdNote: `${s.criticalLow}–${s.cautionLow} h`,
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
    message: `Good sleep (${hours} h).`,
    thresholdNote: `${s.cautionLow}–${s.cautionHigh} h`,
    steps: ['Keep the same sleep window each day.'],
  }
}

export function evaluateMood(score: number): Verdict {
  const m = T.mood
  if (score <= m.criticalAtOrBelow)
    return {
      status: 'critical',
      message: `Mood is very low (${score}/10).`,
      thresholdNote: `≤ ${m.criticalAtOrBelow}/10`,
      steps: [
        'You are not alone — talk to a crewmate you trust today.',
        'Request a private session with the behavioural health team.',
        'If you have thoughts of harming yourself, tell the commander or crew medical officer right away.',
      ],
    }
  if (score <= m.cautionAtOrBelow)
    return {
      status: 'caution',
      message: `Mood is lower than usual (${score}/10).`,
      thresholdNote: `${m.criticalAtOrBelow + 1}–${m.cautionAtOrBelow}/10`,
      steps: ['Schedule a family call or leisure time.', 'Exercise and get light exposure during your day window.', 'Check in again tomorrow.'],
    }
  return {
    status: 'nominal',
    message: `Mood is good (${score}/10).`,
    thresholdNote: `≥ ${m.cautionAtOrBelow + 1}/10`,
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

function environmentAdvisories(env: EnvironmentType, overall: StatusLevel): string[] {
  const e = ENVIRONMENTS[env]
  const out: string[] = []
  if (overall === 'critical' && e.commDelaySecondsMax > 60)
    out.push(
      `Signal delay to Earth is ${e.commDelay}. Begin the action plan now with your crew medical officer — do not wait for a reply from the flight surgeon.`,
    )
  if (e.gravityG === 0) out.push('Microgravity: complete daily resistive exercise to protect bones and muscles.')
  else if (e.gravityG < 1) out.push(`Partial gravity (${e.gravityG} g): rise slowly after rest; bones still need resistive loading.`)
  if (e.typicalDoseRateMSvPerDay >= 1)
    out.push(`Higher background radiation here (~${e.typicalDoseRateMSvPerDay} mSv/day). Sleep in the shielded area.`)
  return out
}

/** Evaluate raw values from the Log Vitals panel. Missing fields are skipped. */
export function evaluateVitals(
  input: VitalsInput,
  environment: EnvironmentType,
  opts: { priorCareerDoseMSv?: number } = {},
): HealthReport {
  const evals: IndicatorEvaluation[] = []

  if (input.bloodSugarMgDl !== undefined)
    evals.push(toEvaluation('blood_sugar', input.bloodSugarMgDl, evaluateBloodSugar(input.bloodSugarMgDl, input.fasting)))
  if (input.heartRateBpm !== undefined)
    evals.push(toEvaluation('heart_rate', input.heartRateBpm, evaluateHeartRate(input.heartRateBpm)))
  if (input.systolicMmHg !== undefined && input.diastolicMmHg !== undefined)
    evals.push(
      toEvaluation(
        'blood_pressure',
        `${input.systolicMmHg}/${input.diastolicMmHg}`,
        evaluateBloodPressure(input.systolicMmHg, input.diastolicMmHg),
      ),
    )
  if (input.bodyTempC !== undefined) evals.push(toEvaluation('body_temp', input.bodyTempC, evaluateBodyTemp(input.bodyTempC)))
  if (input.sleepHours !== undefined) evals.push(toEvaluation('sleep_hours', input.sleepHours, evaluateSleep(input.sleepHours)))
  if (input.mood !== undefined) evals.push(toEvaluation('mood', input.mood, evaluateMood(input.mood)))
  if (input.radiationDailyMSv !== undefined || input.radiationMissionMSv !== undefined)
    evals.push(
      toEvaluation(
        'radiation_dose',
        input.radiationMissionMSv ?? input.radiationDailyMSv ?? 0,
        evaluateRadiation(input.radiationDailyMSv, input.radiationMissionMSv, {
          environment,
          priorCareerDoseMSv: opts.priorCareerDoseMSv,
        }),
      ),
    )
  if (input.boneDensityChangePct !== undefined)
    evals.push(toEvaluation('bone_density', input.boneDensityChangePct, evaluateBoneDensity(input.boneDensityChangePct)))

  const statuses = evals.map((e) => e.status)
  const overallStatus = worstStatus(statuses)
  return {
    environment,
    overallStatus,
    escalation: STATUS_TO_ACTION[overallStatus],
    readinessScore: readinessScore(statuses),
    indicators: evals,
    systems: rollupSystems(evals),
    environmentAdvisories: environmentAdvisories(environment, overallStatus),
  }
}

function parseBloodPressure(v: number | string): [number, number] | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(String(v))
  return m ? [Number(m[1]), Number(m[2])] : null
}

/** Convert a stored indicator list (e.g. a crew profile) into VitalsInput. */
export function indicatorsToVitals(indicators: HealthIndicator[]): VitalsInput {
  const input: VitalsInput = {}
  for (const ind of indicators) {
    const n = typeof ind.value === 'number' ? ind.value : Number(ind.value)
    switch (ind.id) {
      case 'blood_sugar': input.bloodSugarMgDl = n; break
      case 'heart_rate': input.heartRateBpm = n; break
      case 'body_temp': input.bodyTempC = n; break
      case 'sleep_hours': input.sleepHours = n; break
      case 'mood': input.mood = n; break
      case 'radiation_dose': {
        input.radiationMissionMSv = n
        const h = ind.history
        if (h.length >= 2) input.radiationDailyMSv = Math.round((h[h.length - 1].value - h[h.length - 2].value) * 100) / 100
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

/**
 * Re-evaluate every indicator on a profile, returning new HealthIndicator
 * objects with `status` and `actionPlan` filled in. Use this to hydrate
 * CREW_PROFILES before rendering.
 */
export function evaluateProfile(profile: AstronautProfile): { indicators: HealthIndicator[]; report: HealthReport } {
  const report = evaluateVitals(indicatorsToVitals(profile.indicators), profile.environment, {
    priorCareerDoseMSv: profile.priorCareerDoseMSv,
  })
  const byId = new Map(report.indicators.map((e) => [e.id, e]))
  const indicators = profile.indicators.map((ind) => {
    const e = byId.get(ind.id)
    return e ? { ...ind, status: e.status, actionPlan: e.actionPlan } : ind
  })
  return { indicators, report }
}
