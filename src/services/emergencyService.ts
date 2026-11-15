/**
 * "Is this too severe for onboard care?" + SOS dispatch.
 *
 * assessEmergency() runs after EVERY new input (body scan, wearable tick, check-in,
 * file / text upload, skin photo). It looks at the new data together with the
 * astronaut's current readings, then decides:
 *   - level: Normal / Watch / Alert (health_rules.md colours)
 *   - sos:   true only for possibly life-threatening situations (rules below)
 *   - interimSteps: what to do right now, before help arrives
 * A single ordinary Alert (e.g. 3 short nights) is NOT an SOS: the existing full-screen
 * Critical Health alert handles it.
 *
 * sendSos() raises the O4 SOS override and queues high-priority messages to the
 * AstraHealth ground lab on Earth and the ISS (simulated: no real dispatch), each with
 * its one-way signal delay, and stores the event in the database.
 */

import { raiseSos } from '@/services/alertService'
import { saveSos } from '@/services/healthDb'
import { parseBloodPressure } from '@/services/healthEvaluator'
import { newId } from '@/services/_store'
import { enqueue } from '@/services/syncService'
import type { AstronautProfile, EmergencyAssessment, HealthReport, IndicatorId, MissionState, PhotoRecord, SosEvent, SosRecipient, StatusLevel } from '@/types/astronaut'

/** Seconds the astronaut has to cancel an automatic SOS. */
export const SOS_COUNTDOWN_SECONDS = 30
/** A cancelled automatic SOS is not raised again for the same reasons for this long. */
export const SOS_SNOOZE_MINUTES = 60

export interface EmergencyInput {
  profile: AstronautProfile
  report: HealthReport
  /** Free text the astronaut just entered (notes, uploaded text, check-in notes). */
  text?: string
  symptoms?: string[]
  photo?: PhotoRecord | null
  /** Optional second opinion, e.g. the AI briefing said SOS. */
  aiSos?: { recommended: boolean; reason?: string }
}

interface RedFlag {
  id: string
  test: RegExp
  reason: string
  steps: string[]
}

const RED_FLAGS: RedFlag[] = [
  {
    id: 'chest_pain',
    test: /chest (pain|pressure|tight)|crushing pain|pain (in|down) (my )?(left )?arm|heart attack/i,
    reason: 'Chest pain or pressure (possible heart problem).',
    steps: ['Stop all activity; sit or strap in and rest.', 'Record HR, BP and SpO2 now; repeat every 5 minutes.', 'Give oxygen if SpO2 is below 94%.', 'Crew medical officer: run the chest-pain protocol and the ECG; aspirin only if not allergic and the protocol says so.'],
  },
  {
    id: 'breathing',
    test: /can.?t breathe|cannot breathe|struggl\w* to breathe|difficulty breathing|short(ness)? of breath|choking|throat (closing|swelling)|wheez/i,
    reason: 'Trouble breathing.',
    steps: ['Sit upright; loosen anything tight.', 'Put on oxygen; check SpO2.', 'Check cabin CO2 and air (Is it me or the air?).', 'If there are hives or face/tongue swelling: use the epinephrine auto-injector from the kit.'],
  },
  {
    id: 'anaphylaxis',
    test: /anaphyla|swollen (tongue|lips|face)|tongue swell|lip swell|face swell|hives all over/i,
    reason: 'Signs of a severe allergic reaction.',
    steps: ['Use the epinephrine auto-injector (outer thigh) now.', 'Lie flat with legs raised (sit up if breathing is hard).', 'Oxygen; record vitals every 5 minutes.', 'A second dose may be needed after 5-15 minutes if no better.'],
  },
  {
    id: 'unresponsive',
    test: /unconscious|unresponsive|passed out|fainted|black(ed)? out|not waking|seizure|convuls|fitting/i,
    reason: 'Fainting, seizure or not responding.',
    steps: ['Check: responding? breathing? If not breathing, start CPR and get the AED.', 'If breathing, put them on their side and keep the airway clear.', 'Protect from hitting equipment; time any seizure.', 'Record vitals now.'],
  },
  {
    id: 'stroke',
    test: /face droop|slurred speech|one side (weak|numb)|can.?t move (my )?(arm|leg)|sudden confusion|worst headache/i,
    reason: 'Possible stroke signs (face, arm, speech).',
    steps: ['Note the exact time the symptoms started.', 'Keep them still and comfortable; nothing to eat or drink.', 'Check glucose (low sugar can look like a stroke).', 'Record vitals every 5 minutes.'],
  },
  {
    id: 'bleeding',
    test: /won.?t stop bleeding|bleeding (heavily|a lot|won.?t stop)|spurting|severe bleed|lots of blood|pulsing blood/i,
    reason: 'Bleeding that will not stop.',
    steps: ['Press hard on the wound with a dressing; do not lift to check for 10 minutes.', 'Raise the limb if possible.', 'If bleeding continues through the dressing, add more on top and keep pressing; use the tourniquet for a limb if life-threatening.', 'Watch for pale, cold, fast heart rate (shock).'],
  },
  {
    id: 'self_harm',
    test: /suicid|kill myself|self.?harm|hurt myself|end (my|it all)|don.?t want to (live|be alive)/i,
    reason: 'Thoughts of self-harm.',
    steps: ['Stay with the crew member; do not leave them alone.', 'Remove access to medications and sharp tools.', 'Listen calmly; let them talk.', 'Private conference with the flight surgeon / psychologist as soon as possible.'],
  },
]

interface VitalRule {
  id: IndicatorId
  test: (v: number | string) => string | null
  steps: string[]
}

const num = (v: number | string) => (typeof v === 'number' ? v : Number(v))
const VITAL_RULES: VitalRule[] = [
  { id: 'spo2', test: (v) => (num(v) < 85 ? `Blood oxygen ${v}% (dangerously low).` : null), steps: ['Put on oxygen now.', 'Check the cabin air (CO2 / O2) and the sensor fit.', 'Sit upright; re-measure in 2 minutes.'] },
  { id: 'heart_rate', test: (v) => (num(v) > 150 ? `Heart rate ${v} bpm at rest (very fast).` : num(v) < 35 ? `Heart rate ${v} bpm (very slow).` : null), steps: ['Stop activity; sit or lie down.', 'Re-measure manually for 30 s.', 'Record BP and SpO2; check for dizziness or chest pain.'] },
  { id: 'body_temp', test: (v) => (num(v) >= 40 ? `Temperature ${v} °C (very high fever).` : num(v) < 35 ? `Temperature ${v} °C (too cold).` : null), steps: ['Re-measure with the clinical thermometer.', 'High fever: cool cloths, fluids, paracetamol per kit; look for infection (skin, urine, chest).', 'Too cold: warm layers, warm drinks if awake.'] },
  {
    id: 'blood_pressure',
    test: (v) => {
      const bp = typeof v === 'string' ? parseBloodPressure(v) : null
      if (!bp) return null
      if (bp[0] >= 180 || bp[1] >= 120) return `Blood pressure ${v} (dangerously high).`
      if (bp[0] < 80) return `Blood pressure ${v} (very low, fainting / shock risk).`
      return null
    },
    steps: ['Sit or lie still for 5 minutes and re-measure.', 'Very low: lie flat, legs up, fluids if awake.', 'Very high: rest, check for headache, chest pain or vision change.'],
  },
  { id: 'blood_sugar', test: (v) => (num(v) < 54 ? `Blood sugar ${v} mg/dL (dangerously low).` : num(v) > 300 ? `Blood sugar ${v} mg/dL (very high).` : null), steps: ['Low: take 15 g fast sugar now, re-check in 15 minutes.', 'High: drink water, re-check, look for nausea or confusion.'] },
]

/** Assess the newest data. Pure and synchronous (rules only). */
export function assessEmergency(input: EmergencyInput): EmergencyAssessment {
  const reasons: string[] = []
  const steps: string[] = []
  let sos = false
  let level: StatusLevel = input.report.overallStatus
  const keyParts: string[] = []

  const text = `${input.text ?? ''} ${(input.symptoms ?? []).join(' ')} ${input.photo?.notes ?? ''}`
  for (const f of RED_FLAGS)
    if (f.test.test(text)) {
      sos = true
      reasons.push(f.reason)
      steps.push(...f.steps)
      keyParts.push(f.id)
    }

  const fresh = input.profile.indicators.filter((i) => i.dataState === 'fresh' && i.value !== null)
  for (const r of VITAL_RULES) {
    const ind = fresh.find((i) => i.id === r.id)
    const hit = ind ? r.test(ind.value as number | string) : null
    if (hit) {
      sos = true
      reasons.push(hit)
      steps.push(...r.steps)
      keyParts.push(r.id)
    }
  }

  // Two or more vital signs at Alert at the same time (not the slow pattern rules).
  const acute: IndicatorId[] = ['heart_rate', 'blood_pressure', 'body_temp', 'spo2', 'blood_sugar']
  const critical = input.report.indicators.filter((e) => e.status === 'critical' && acute.includes(e.id) && fresh.some((i) => i.id === e.id))
  if (critical.length >= 2) {
    sos = true
    reasons.push(`${critical.length} vital signs at Alert at once (${critical.map((c) => `${c.id.replace('_', ' ')} ${c.value}`).join(', ')}).`)
    steps.push(...critical.flatMap((c) => c.actionPlan.steps.slice(0, 1)))
    keyParts.push(`multi:${critical.map((c) => c.id).sort().join('+')}`)
  }

  if (input.photo?.status === 'critical') {
    level = 'critical'
    if (input.photo.sosRecommended) {
      sos = true
      reasons.push(...(input.photo.severityReasons ?? ['Skin photo judged an emergency.']))
      keyParts.push(`photo:${input.photo.id}`)
    }
    steps.push(...(input.photo.interimSteps ?? input.photo.firstAid ?? []))
  }

  let source: EmergencyAssessment['source'] = 'rules'
  if (input.aiSos?.recommended && (level === 'critical' || sos)) {
    sos = true
    source = 'rules+gemini'
    if (input.aiSos.reason) reasons.push(`Gemini: ${input.aiSos.reason}`)
    keyParts.push('ai')
  }
  if (sos) level = 'critical'
  return {
    level,
    sos,
    reasons: [...new Set(reasons)],
    interimSteps: [...new Set(steps)].slice(0, 8),
    source,
    key: keyParts.sort().join('|'),
  }
}

// ── SOS recipients and dispatch ────────────────────────────────────────────

const ISS_ENVS = new Set(['EARTH_ORBIT'])

/** Who receives an SOS from here, and the one-way signal time to each. */
export function sosRecipients(state: MissionState): SosRecipient[] {
  const delay = Math.max(0, Math.round(state.earthDelaySeconds))
  const onIss = ISS_ENVS.has(state.environment.id) && /iss|station/i.test(`${state.phase.name} ${state.phase.habitat}`)
  return [
    { id: 'astrahealth_earth', name: 'AstraHealth Station (Earth medical lab)', etaSeconds: Math.max(1, delay), status: 'queued' },
    onIss
      ? { id: 'crew', name: 'ISS crewmates (onboard, immediate)', etaSeconds: 0, status: 'queued' }
      : { id: 'iss', name: 'International Space Station (nearest crewed station)', etaSeconds: Math.max(1, delay), status: 'queued' },
    ...(onIss ? [] : [{ id: 'crew' as const, name: 'Your crewmates (onboard, immediate)', etaSeconds: 0, status: 'queued' as const }]),
  ]
}

export function formatEta(s: number): string {
  if (s <= 0) return 'now'
  if (s < 60) return `${s} s`
  return `${Math.round(s / 60)} min`
}

/** Send an SOS (manual button or finished countdown). Simulated dispatch, stored in the database. */
export async function sendSos(input: {
  profile: AstronautProfile
  missionState: MissionState
  trigger: 'manual' | 'auto'
  reasons: string[]
  interimSteps: string[]
}): Promise<SosEvent> {
  const { profile, missionState } = input
  const day = Math.floor(profile.missionDay)
  const reasonText = input.reasons.length ? input.reasons.join(' ') : 'SOS button pressed.'
  const override = raiseSos({ astronautId: profile.id, name: profile.name, location: missionState.phase.name, missionDay: day, reason: `${input.trigger === 'auto' ? 'Automatic SOS: ' : ''}${reasonText}` })
  const recipients = sosRecipients(missionState).map((r) => ({ ...r, status: 'sent' as const }))
  const vitals = profile.indicators.filter((i) => i.value !== null).map((i) => `${i.name}: ${i.value} ${i.unit} (${i.status})`)
  for (const r of recipients.filter((x) => x.id !== 'crew'))
    enqueue({ astronautId: profile.id, type: 'sos', title: `SOS → ${r.name}`, summary: `${profile.name}, day ${day}, ${missionState.phase.name}. ${reasonText} Arrives in ${formatEta(r.etaSeconds)}.`, missionDay: day, priority: 'high', refId: override.id })
  const event: SosEvent = {
    id: newId('sos'),
    astronautId: profile.id,
    name: profile.name,
    createdAt: new Date().toISOString(),
    missionDay: day,
    location: missionState.phase.name,
    trigger: input.trigger,
    reasons: input.reasons.length ? input.reasons : ['SOS button pressed.'],
    interimSteps: input.interimSteps,
    recipients,
    vitalsSnapshot: vitals,
    overrideId: override.id,
  }
  await saveSos(event).catch(() => undefined)
  return event
}
