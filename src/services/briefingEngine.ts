/**
 * Stateful Incremental AI Briefing.
 *
 * Takes (currentBriefing + one new BriefingEvent + updated indicators) and
 * rewrites the MissionHealthBriefing in plain English: color-coded overall
 * status, early trajectory warnings (EmergingRisk[]), preventive actions and
 * the next onboard tool checks. Only the prior briefing, the normalized event
 * and a compact indicator summary are sent to the LLM — never raw media or
 * full history.
 *
 * The deterministic layer always runs and owns every safety decision
 * (overall status, severities, escalation mode, alerts). Gemini — when a key
 * is configured and something meaningful changed — only rewrites the wording.
 */

import { HAZARD_RISK_MAP } from '@/data/nasaSpaceflightData'
import {
  ESCALATION_MODE_LABELS,
  STATUS_LABELS,
  computeTrajectory,
  formatDelay,
  getSpaceAdjustments,
  worstStatus,
} from '@/services/healthEvaluator'
import { MODALITY_LABELS } from '@/services/ingestionEngine'
import { callGeminiJson, resolveApiKey } from '@/services/_gemini'
import type {
  AIConfig,
  BriefingContext,
  BriefingEvent,
  BriefingUpdateResult,
  EmergingRisk,
  HealthIndicator,
  IndicatorId,
  MissionHealthBriefing,
  StatusLevel,
} from '@/types/astronaut'

const RANK: Record<StatusLevel, number> = { nominal: 0, caution: 1, critical: 2 }

/** What to do now to stop a drift becoming a problem (plain English). */
const PREVENTION: Record<IndicatorId, string> = {
  heart_rate: 'Rest, drink 500 mL of water, skip caffeine, and keep your daily aerobic exercise.',
  blood_pressure: 'Cut added salt, keep aerobic exercise, and do a calm 5-minute rest before measuring.',
  blood_sugar: 'Do your full exercise session, cut sugary snacks and drinks, and re-test fasting tomorrow.',
  body_temp: 'Rest, hydrate, wash hands often, and wear a mask around crewmates if you feel unwell.',
  spo2: 'Check cabin O2 and CO2 readings, avoid heavy work until it recovers, and know where the emergency O2 mask is.',
  sleep_hours: 'Protect a full 8.5 h sleep window: dim screens an hour before, eye mask and earplugs, no caffeine after mid-shift.',
  mood: 'Talk with a crewmate you trust, book a family call, and get exercise and light during your day.',
  radiation_dose: 'Sleep in the most shielded area, limit EVAs, and watch space-weather alerts.',
  bone_density: 'Do every resistive exercise session at full load, and eat your calcium, vitamin D and protein rations.',
}

const firstSentence = (s: string) => (s.match(/^[^.!?]*[.!?]/)?.[0] ?? s).trim()

function shortHowTo(ind: HealthIndicator): string {
  const steps = ind.howToMeasure.split(/\s*\d\)\s*/).map((x) => x.trim()).filter(Boolean)
  return steps.slice(0, 2).join(' ').replace(/\.?$/, '.')
}

function valueText(ind: HealthIndicator): string {
  if (ind.value === null) return 'no reading'
  const unit = ind.unit === '/5' ? '/5' : ind.unit === '%' ? '%' : ` ${ind.unit}`
  return `${ind.value}${unit}`
}

/** Per-briefing memory that survives incremental updates (feed alerts, latest log). */
interface BriefingMemory {
  feedAlerts: string[]
  feedSeverity: StatusLevel
  shelter: boolean
  latestLog?: { text: string; severity: StatusLevel; missionDay: number }
}

const memory = new WeakMap<MissionHealthBriefing, BriefingMemory>()
const emptyMemory = (): BriefingMemory => ({ feedAlerts: [], feedSeverity: 'nominal', shelter: false })

function emergingRisks(ctx: BriefingContext): EmergingRisk[] {
  const adj = getSpaceAdjustments(ctx.missionState)
  const risks: EmergingRisk[] = []
  for (const ind of ctx.indicators) {
    if (ind.dataState !== 'fresh') continue
    if (ind.trend !== 'drifting_caution' && ind.trend !== 'rapid_decline') continue
    const t = computeTrajectory(ind.id, ind.history, {
      adjustments: adj,
      environment: ctx.missionState.phase.environment,
      status: ind.status,
    })
    const unit = ind.unit === '/5' ? ' points' : ` ${ind.unit}`
    const dir = t.slopePerDay > 0 ? 'rising' : 'falling'
    const rate = Math.abs(t.slopePerDay) < 0.1 ? Math.abs(t.slopePerDay).toFixed(2) : Math.abs(t.slopePerDay).toFixed(1)
    const target = t.projectedStatus ? STATUS_LABELS[t.projectedStatus] : null
    const when =
      ind.projectedDaysToThreshold !== undefined && target
        ? ` At this rate it reaches the ${target} level in about ${ind.projectedDaysToThreshold} day${ind.projectedDaysToThreshold === 1 ? '' : 's'}.`
        : ind.status === 'critical'
          ? ' It is already at the Alert level and still getting worse.'
          : ''
    const hazard = HAZARD_RISK_MAP.find((h) => h.indicators.includes(ind.id))
    risks.push({
      indicatorId: ind.id,
      severity: ind.trend === 'rapid_decline' ? 'critical' : ind.status === 'nominal' ? 'caution' : ind.status,
      explanation: `${ind.name} has been ${dir} about ${rate}${unit} per day over the last week (now ${valueText(ind)}).${when}${hazard ? ` Linked risk: ${hazard.risk.toLowerCase()}.` : ''}`,
      preventiveAction: PREVENTION[ind.id],
    })
  }
  // Cumulative "bank account" warnings even when today's numbers look fine.
  const ex = ctx.missionState.exposure
  if (ex.estBoneLossPct <= -2 && !risks.some((r) => r.indicatorId === 'bone_density'))
    risks.push({
      indicatorId: 'bone_density',
      severity: ex.estBoneLossPct <= -5 ? 'critical' : 'caution',
      explanation: `Estimated bone loss so far this mission is about ${Math.abs(ex.estBoneLossPct).toFixed(1)}% (${Math.round(ex.days0g)} days in 0 g${ex.daysPartialG ? `, ${Math.round(ex.daysPartialG)} in partial gravity` : ''}). This is an estimate — confirm with the weekly ultrasound.`,
      preventiveAction: PREVENTION.bone_density,
    })
  return risks.sort((a, b) => RANK[b.severity] - RANK[a.severity]).slice(0, 5)
}

function toolChecks(ctx: BriefingContext, risks: EmergingRisk[]): string[] {
  const checks: string[] = []
  const seen = new Set<IndicatorId>()
  const add = (ind: HealthIndicator | undefined, why: string) => {
    if (!ind || seen.has(ind.id)) return
    seen.add(ind.id)
    checks.push(`${ind.name} (${why}): ${shortHowTo(ind)}`)
  }
  const byId = new Map(ctx.indicators.map((i) => [i.id, i]))
  for (const i of ctx.indicators.filter((i) => i.dataState === 'fresh' && i.status === 'critical')) add(i, 're-check now')
  for (const i of ctx.indicators.filter((i) => i.dataState === 'fresh' && i.status === 'caution')) add(i, 're-check within 4 h')
  for (const r of risks) add(byId.get(r.indicatorId), 'trend check')
  for (const i of ctx.indicators.filter((i) => i.dataState !== 'fresh')) add(i, i.dataState === 'missing' ? 'never measured' : 'overdue')
  for (const a of ctx.missionState.activeAlerts) if (a.kind === 'landing_after_transit') checks.push(a.guidance[1])
  return checks.slice(0, 6)
}

function buildBriefing(ctx: BriefingContext, mem: BriefingMemory, lastUpdated: string): MissionHealthBriefing {
  const s = ctx.missionState
  const fresh = ctx.indicators.filter((i) => i.dataState === 'fresh')
  const abnormal = fresh.filter((i) => i.status !== 'nominal').sort((a, b) => RANK[b.status] - RANK[a.status])
  const notFresh = ctx.indicators.filter((i) => i.dataState !== 'fresh')
  const risks = emergingRisks(ctx)

  const logActive = mem.latestLog && s.missionDay <= mem.latestLog.missionDay + 1 ? mem.latestLog : undefined
  const overallStatus = worstStatus([...fresh.map((i) => i.status), mem.feedSeverity, logActive?.severity ?? 'nominal', mem.shelter ? 'critical' : 'nominal'])

  const names = (xs: HealthIndicator[]) => xs.map((i) => i.name.toLowerCase())
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
  const crit = abnormal.filter((i) => i.status === 'critical')
  const headline = mem.shelter
    ? 'ALERT: Solar storm — go to the storm shelter now'
    : crit.length
      ? `ALERT: ${list(names(crit))} need${crit.length === 1 ? 's' : ''} attention now`
      : overallStatus === 'critical' && logActive
        ? 'ALERT: your latest health log needs attention now'
        : abnormal.length
          ? `WATCH: ${list(names(abnormal))} ${abnormal.length === 1 ? 'is' : 'are'} outside your normal range`
          : risks.length
            ? `NORMAL for now — ${risks.length} reading${risks.length === 1 ? ' is' : 's are'} drifting`
            : `All systems normal — Day ${s.missionDay}, ${s.phase.name}`

  const paras: string[] = []
  paras.push(
    `Day ${s.missionDay} · ${s.phase.name} (${s.environment.label}). Overall status: ${STATUS_LABELS[overallStatus]}.` +
      (abnormal.length ? '' : notFresh.length === ctx.indicators.length ? ' No readings yet.' : ' Your measured readings are in range.'),
  )
  for (const i of abnormal.slice(0, 4))
    paras.push(`${i.name} is ${valueText(i)} (${STATUS_LABELS[i.status]}). ${firstSentence(i.whyNeeded)} What to do: ${i.actionPlan.steps[0] ?? PREVENTION[i.id]}`)
  if (risks.length)
    paras.push(`Early warning: ${list(risks.map((r) => ctx.indicators.find((i) => i.id === r.indicatorId)?.name.toLowerCase() ?? r.indicatorId))} ${risks.length === 1 ? 'is' : 'are'} heading the wrong way — see the trajectory warnings.`)
  if (notFresh.length && notFresh.length < ctx.indicators.length)
    paras.push(`No recent reading for ${list(names(notFresh))} — shown in grey until you measure (missing data is never shown as normal).`)
  if (logActive) paras.push(logActive.text)
  if (overallStatus !== 'nominal')
    paras.push(
      s.escalationMode === 'act_then_report'
        ? `Earth is about ${formatDelay(s.earthDelaySeconds)} away by radio, so act now with onboard guidance, then report to Earth.`
        : `${ESCALATION_MODE_LABELS.contact_ground} if anything gets worse (signal delay ${formatDelay(s.earthDelaySeconds)}).`,
    )

  return {
    lastUpdated,
    overallStatus,
    headline,
    plainEnglishSummary: paras.join('\n\n'),
    emergingRisks: risks,
    recommendedToolChecks: toolChecks(ctx, risks),
    escalationMode: s.escalationMode,
    environmentAlerts: [...mem.feedAlerts, ...s.activeAlerts.map((a) => `${a.title}: ${a.guidance[0]}`)],
  }
}

/** Build the first briefing for a crew member from their evaluated indicators (sync, offline). */
export function createInitialBriefing(ctx: BriefingContext): MissionHealthBriefing {
  const mem = emptyMemory()
  const b = buildBriefing(ctx, mem, `Day ${ctx.missionState.missionDay}`)
  memory.set(b, mem)
  return b
}

function eventTimestamp(event: BriefingEvent, ctx: BriefingContext): string {
  switch (event.kind) {
    case 'wearable_tick':
    case 'environment_tick':
      return event.tick.timestamp
    case 'artifact':
      return event.artifact.timestamp
    case 'manual_vitals':
      return event.updates[0]?.timestamp ?? `Day ${ctx.missionState.missionDay}`
    case 'phase_change':
      return `Day ${event.to.startDay}`
    case 'mission_day_change':
      return `Day ${event.missionDay}`
  }
}

function diff(prev: MissionHealthBriefing, next: MissionHealthBriefing, event: BriefingEvent): string[] {
  const out: string[] = []
  if (prev.overallStatus !== next.overallStatus)
    out.push(`Overall status ${STATUS_LABELS[prev.overallStatus]} → ${STATUS_LABELS[next.overallStatus]}`)
  const prevRisk = new Set(prev.emergingRisks.map((r) => r.indicatorId))
  const nextRisk = new Set(next.emergingRisks.map((r) => r.indicatorId))
  for (const id of nextRisk) if (!prevRisk.has(id)) out.push(`New trajectory warning: ${id.replace('_', ' ')}`)
  for (const id of prevRisk) if (!nextRisk.has(id)) out.push(`Trajectory warning cleared: ${id.replace('_', ' ')}`)
  for (const a of next.environmentAlerts) if (!prev.environmentAlerts.includes(a)) out.push(a)
  if (event.kind === 'artifact') {
    const a = event.artifact
    out.push(a.accepted ? `${MODALITY_LABELS[a.modality]} added (${STATUS_LABELS[a.severity]})` : `File rejected: ${a.rejectionReason ?? 'non-biomedical data'}`)
  }
  if (event.kind === 'wearable_tick' && event.tick.injectedAnomaly) out.push(`Demo anomaly injected: ${event.tick.injectedAnomaly.replace('_', ' ')}`)
  if (event.kind === 'phase_change') out.push(`New mission phase: ${event.to.name}`)
  if (event.kind === 'manual_vitals' && event.updates.length) out.push(`Logged ${event.updates.length} reading${event.updates.length === 1 ? '' : 's'}`)
  return out
}

interface AiBriefingReply {
  headline?: string
  plainEnglishSummary?: string
  emergingRisks?: { indicatorId?: string; explanation?: string; preventiveAction?: string }[]
  recommendedToolChecks?: string[]
}

function compactEvent(event: BriefingEvent): unknown {
  switch (event.kind) {
    case 'wearable_tick':
      return { kind: event.kind, timestamp: event.tick.timestamp, readings: event.tick.readings, anomaly: event.tick.injectedAnomaly }
    case 'environment_tick':
      return { kind: event.kind, timestamp: event.tick.timestamp, cabin: event.tick.cabinEvaluation.status, advisories: event.tick.cabinEvaluation.advisories, solarEvent: event.tick.activeEvent?.summary }
    case 'artifact':
      return { kind: event.kind, modality: event.artifact.modality, accepted: event.artifact.accepted, summary: event.artifact.extractedSummary, severity: event.artifact.severity }
    case 'manual_vitals':
      return { kind: event.kind, updates: event.updates.map((u) => ({ id: u.id, value: u.value })) }
    case 'phase_change':
      return { kind: event.kind, from: event.from.name, to: event.to.name }
    case 'mission_day_change':
      return { kind: event.kind, missionDay: event.missionDay }
  }
}

async function aiRewrite(prev: MissionHealthBriefing, draft: MissionHealthBriefing, event: BriefingEvent, ctx: BriefingContext, ai?: AIConfig): Promise<MissionHealthBriefing | null> {
  const payload = {
    previousBriefing: { headline: prev.headline, summary: prev.plainEnglishSummary },
    newEvent: compactEvent(event),
    mission: { day: ctx.missionState.missionDay, phase: ctx.missionState.phase.name, environment: ctx.missionState.environment.label, escalation: ESCALATION_MODE_LABELS[draft.escalationMode] },
    indicators: ctx.indicators.map((i) => ({ id: i.id, name: i.name, value: i.value, unit: i.unit, status: i.dataState === 'fresh' ? i.status : 'no_data', trend: i.trend, projectedDaysToThreshold: i.projectedDaysToThreshold })),
    draft: { overallStatus: draft.overallStatus, headline: draft.headline, summary: draft.plainEnglishSummary, emergingRisks: draft.emergingRisks, recommendedToolChecks: draft.recommendedToolChecks, alerts: draft.environmentAlerts },
  }
  const reply = await callGeminiJson<AiBriefingReply>(
    [
      {
        text: `You update a running health briefing for an astronaut who is NOT a doctor. Rewrite the draft so it reads clearly and kindly, mentions what changed because of the new event, and keeps every fact, number, status and instruction from the draft. Do not change any status level, do not add diagnoses, do not remove alerts. Short sentences, no jargon.
Reply with JSON only: {"headline":s,"plainEnglishSummary":s,"emergingRisks":[{"indicatorId":s,"explanation":s,"preventiveAction":s}],"recommendedToolChecks":[s]}
Input:
${JSON.stringify(payload)}`,
      },
    ],
    ai,
  )
  if (!reply || typeof reply.plainEnglishSummary !== 'string' || typeof reply.headline !== 'string') return null
  const aiRisk = new Map((reply.emergingRisks ?? []).filter((r) => r.indicatorId).map((r) => [r.indicatorId!, r]))
  return {
    ...draft,
    headline: reply.headline.slice(0, 140) || draft.headline,
    plainEnglishSummary: reply.plainEnglishSummary.slice(0, 2500) || draft.plainEnglishSummary,
    // Same risks and severities as the deterministic draft; only the wording may change.
    emergingRisks: draft.emergingRisks.map((r) => {
      const x = aiRisk.get(r.indicatorId)
      return x ? { ...r, explanation: x.explanation || r.explanation, preventiveAction: x.preventiveAction || r.preventiveAction } : r
    }),
    recommendedToolChecks:
      Array.isArray(reply.recommendedToolChecks) && reply.recommendedToolChecks.length && reply.recommendedToolChecks.every((x) => typeof x === 'string')
        ? reply.recommendedToolChecks.slice(0, 6)
        : draft.recommendedToolChecks,
  }
}

/** Incrementally update the briefing after a single new event. Never throws. */
export async function updateBriefing(
  current: MissionHealthBriefing,
  event: BriefingEvent,
  ctx: BriefingContext,
  ai?: AIConfig,
): Promise<BriefingUpdateResult> {
  const prevMem = memory.get(current) ?? emptyMemory()
  const mem: BriefingMemory = { ...prevMem, feedAlerts: [...prevMem.feedAlerts] }

  if (event.kind === 'environment_tick') {
    const t = event.tick
    const alerts = [...t.cabinEvaluation.advisories]
    const ev = t.activeEvent
    if (ev) alerts.unshift(ev.shelterAdvised ? `Radiation: GO TO SHELTER — ${ev.summary}` : `Radiation: ${ev.summary}`)
    mem.feedAlerts = alerts
    mem.shelter = Boolean(ev?.shelterAdvised)
    mem.feedSeverity = worstStatus([t.cabinEvaluation.status, ev ? 'caution' : 'nominal'])
  }
  if (event.kind === 'artifact' && event.artifact.accepted) {
    const a = event.artifact
    mem.latestLog = { text: `Latest ${MODALITY_LABELS[a.modality].toLowerCase()} (${a.timestamp}): ${a.extractedSummary}`, severity: a.severity, missionDay: ctx.missionState.missionDay }
  }

  const draft = buildBriefing(ctx, mem, eventTimestamp(event, ctx))
  const changes = diff(current, draft, event)

  // Only spend an LLM call when something a human would notice changed.
  const meaningful =
    draft.overallStatus !== current.overallStatus ||
    draft.headline !== current.headline ||
    changes.some((c) => c.startsWith('New trajectory') || c.startsWith('Radiation:')) ||
    (event.kind === 'artifact' && event.artifact.accepted)
  let briefing = draft
  let engine: BriefingUpdateResult['engine'] = 'offline_mock'
  if (meaningful && resolveApiKey(ai)) {
    try {
      const rewritten = await aiRewrite(current, draft, event, ctx, ai)
      if (rewritten) {
        briefing = rewritten
        engine = 'gemini'
      }
    } catch {
      /* keep the deterministic draft */
    }
  }
  memory.set(briefing, mem)
  return { briefing, changes, engine }
}
