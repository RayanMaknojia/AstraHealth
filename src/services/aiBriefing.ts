/**
 * Full medical briefing (Home → "Full briefing").
 *
 * Built after a body scan, a check-in, a photo or file upload, or "Refresh":
 *   - Last check-in: what was entered, each value coloured by health_rules.md
 *   - Last 24 hours: every KPI's latest reading, worst colour, sources
 *   - Past 7 days: average, range, number of Watch / Alert days, trend
 *   - Concerns, recommendations, interim steps, SOS recommendation
 * The data lines and colours always come from the rules (code owns status). Gemini, via
 * the Python server, writes the headline, summary, concerns and advice, and can only make
 * the overall status MORE serious. If Gemini is unavailable, the same briefing is
 * written by the offline rules; the UI shows which engine wrote it.
 */

import { CHECKIN_INPUTS, INDICATOR_GUIDES } from '@/data/nasaSpaceflightData'
import { callGeminiJsonInfo } from '@/services/_gemini'
import { classifyReading, getReadings, listPhotoRecords, listScans, listUploads, saveBriefing } from '@/services/healthDb'
import { displayStatus, worstStatus } from '@/services/healthEvaluator'
import { newId } from '@/services/_store'
import type {
  AIConfig,
  AiBriefing,
  AstronautProfile,
  BriefingConcern,
  BriefingLine,
  CheckinRecord,
  DbReading,
  DisplayStatus,
  EmergencyAssessment,
  HealthReport,
  IndicatorId,
  MissionHealthBriefing,
  MissionState,
  StatusLevel,
} from '@/types/astronaut'

export interface BriefingInput {
  profile: AstronautProfile
  missionState: MissionState
  report: HealthReport
  /** The rules-based briefing already on screen (fallback text). */
  rulesBriefing: MissionHealthBriefing
  lastCheckin?: CheckinRecord | null
  emergency?: EmergencyAssessment | null
  trigger: string
  /** Onboard minute of day (fractional day for the 24 h window). */
  onboardMinute?: number
}

const ORDER: Record<StatusLevel, number> = { nominal: 0, caution: 1, critical: 2 }
const WORD: Record<StatusLevel, string> = { nominal: 'NORMAL', caution: 'WATCH', critical: 'ALERT' }
const KPIS: IndicatorId[] = ['heart_rate', 'blood_pressure', 'body_temp', 'spo2', 'blood_sugar', 'sleep_hours', 'mood', 'radiation_dose', 'bone_density']
const SOURCE_TEXT: Record<string, string> = {
  wearable_auto: 'wearable',
  manual_slider: 'check-in',
  lab_document: 'lab report',
  ultrasound_image: 'image',
  voice_log: 'voice log',
  environment_feed: 'sensor',
  body_scan: 'body scan',
}

const fmt = (id: IndicatorId, v: number) => (id === 'body_temp' || id === 'sleep_hours' ? v.toFixed(1) : id === 'radiation_dose' || id === 'bone_density' ? v.toFixed(2) : String(Math.round(v)))
const unit = (id: IndicatorId) => INDICATOR_GUIDES[id].unit
const name = (id: IndicatorId) => INDICATOR_GUIDES[id].name

// ── Data sections (deterministic) ──────────────────────────────────────────

export function checkinLines(profile: AstronautProfile, c: CheckinRecord | null | undefined): AiBriefing['lastCheckin'] {
  if (!c) return null
  const lines: BriefingLine[] = []
  const v = c.values ?? {}
  for (const spec of CHECKIN_INPUTS) {
    if (spec.key === 'diastolicMmHg') continue
    const raw = v[spec.key]
    if (typeof raw !== 'number') continue
    if (spec.key === 'systolicMmHg') {
      const bp = `${raw}/${v.diastolicMmHg ?? '?'}`
      lines.push({ label: 'Blood pressure', status: classifyReading(profile, 'blood_pressure', bp, c.missionDay), text: `${bp} mmHg`, indicatorId: 'blood_pressure' })
      continue
    }
    if (spec.key === 'radiationDailyMSv') {
      lines.push({ label: spec.label, status: 'nominal', text: `${raw} mSv` })
      continue
    }
    lines.push({ label: spec.label, status: classifyReading(profile, spec.indicator, raw, c.missionDay), text: `${raw} ${spec.unit}`, indicatorId: spec.indicator })
  }
  // Extra ratings the check-in form keeps in extras.notes (sleep quality, fatigue, stress...).
  try {
    const parsed = JSON.parse(c.extras?.notes ?? '{}') as { form?: Record<string, unknown> }
    const form = parsed.form && typeof parsed.form === 'object' ? parsed.form : {}
    for (const [k, val] of Object.entries(form).slice(0, 12))
      if ((typeof val === 'number' || (typeof val === 'string' && val.length < 60)) && val !== '')
        lines.push({ label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (x) => x.toUpperCase()), status: 'no_data', text: String(val) })
  } catch {
    /* plain-text notes */
  }
  const x = c.extras
  if (x?.sleepQuality) lines.push({ label: 'Sleep quality', status: x.sleepQuality <= 2 ? 'caution' : 'nominal', text: `${x.sleepQuality}/5` })
  if (x?.fatigue) lines.push({ label: 'Fatigue', status: x.fatigue >= 4 ? 'caution' : 'nominal', text: `${x.fatigue}/5` })
  if (x?.nauseaAppetite) lines.push({ label: 'Nausea / appetite', status: x.nauseaAppetite >= 4 ? 'caution' : 'nominal', text: `${x.nauseaAppetite}/5` })
  if (x?.headache) lines.push({ label: 'Headache', status: 'caution', text: 'Yes' })
  if (x?.exerciseMinutes !== undefined) lines.push({ label: 'Exercise', status: x.exerciseMinutes < 60 ? 'caution' : 'nominal', text: `${x.exerciseMinutes} min${x.exerciseType ? ` (${x.exerciseType})` : ''}` })
  if (x?.bodyMassKg) lines.push({ label: 'Body mass', status: 'no_data', text: `${x.bodyMassKg} kg` })
  if (x?.reactionMs) lines.push({ label: 'Reaction test', status: 'no_data', text: `${x.reactionMs} ms` })
  lines.push({ label: 'Symptoms', status: c.symptoms.length ? 'caution' : 'nominal', text: c.symptoms.length ? c.symptoms.join(', ') : 'None reported' })
  return { when: `Day ${c.missionDay}, ${c.slot} check-in`, lines }
}

function worstOf(rs: DbReading[]): StatusLevel {
  return worstStatus(rs.map((r) => r.status))
}

export function last24hLines(readings: DbReading[], now: number): BriefingLine[] {
  const window = readings.filter((r) => r.day > now - 1 && r.day <= now + 0.001)
  return KPIS.map((id) => {
    const rs = window.filter((r) => r.indicatorId === id)
    if (!rs.length) return { label: name(id), status: 'no_data' as DisplayStatus, text: 'No reading in the last 24 h.', indicatorId: id }
    const last = rs[rs.length - 1]
    const nums = rs.map((r) => r.numeric)
    const sources = [...new Set(rs.map((r) => SOURCE_TEXT[r.source] ?? r.source))].join(', ')
    const range = rs.length > 1 && id !== 'radiation_dose' && id !== 'bone_density' ? `, range ${fmt(id, Math.min(...nums))}-${fmt(id, Math.max(...nums))}` : ''
    return {
      label: name(id),
      status: worstOf(rs),
      text: `Latest ${last.value} ${unit(id)} (${last.timestamp})${range}. ${rs.length} reading${rs.length > 1 ? 's' : ''} from ${sources}.`,
      indicatorId: id,
    }
  })
}

export function sevenDayLines(profile: AstronautProfile, readings: DbReading[], today: number): BriefingLine[] {
  const from = Math.floor(today) - 6
  return KPIS.map((id) => {
    const rs = readings.filter((r) => r.indicatorId === id && Math.floor(r.day) >= from && r.day <= today + 0.001)
    const ind = profile.indicators.find((i) => i.id === id)
    if (!rs.length) return { label: name(id), status: 'no_data' as DisplayStatus, text: 'No readings in the past 7 days.', indicatorId: id }
    const byDay = new Map<number, DbReading[]>()
    for (const r of rs) byDay.set(Math.floor(r.day), [...(byDay.get(Math.floor(r.day)) ?? []), r])
    const dayStatus = [...byDay.values()].map(worstOf)
    const watch = dayStatus.filter((s) => s === 'caution').length
    const alert = dayStatus.filter((s) => s === 'critical').length
    const nums = rs.map((r) => r.numeric)
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length
    const trend = ind?.trend === 'rapid_decline' ? 'getting worse fast' : ind?.trend === 'drifting_caution' ? `drifting toward a limit${ind.projectedDaysToThreshold ? ` (about ${ind.projectedDaysToThreshold} days)` : ''}` : ind?.trend === 'improving' ? 'improving' : 'steady'
    const cur = ind ? displayStatus(ind) : 'no_data'
    const bad = alert ? 'critical' : watch ? 'caution' : 'nominal'
    const status: DisplayStatus = cur === 'no_data' ? bad : ORDER[cur] >= ORDER[bad] ? cur : bad === 'critical' ? 'caution' : cur
    const summary =
      id === 'radiation_dose'
        ? `Total ${fmt(id, Math.max(...nums))} mSv (+${fmt(id, Math.max(...nums) - Math.min(...nums))} this week)`
        : id === 'bone_density'
          ? `Estimated ${fmt(id, nums[nums.length - 1])}% vs preflight`
          : `Average ${fmt(id, mean)} ${unit(id)}, range ${fmt(id, Math.min(...nums))}-${fmt(id, Math.max(...nums))}`
    return {
      label: name(id),
      status,
      text: `${summary}. ${byDay.size} day${byDay.size > 1 ? 's' : ''} measured: ${watch} Watch, ${alert} Alert. Trend ${trend}.`,
      indicatorId: id,
    }
  })
}

function rulesConcerns(input: BriefingInput, photos: { label: string; status: StatusLevel; detail: string; steps: string[] }[]): BriefingConcern[] {
  const out: BriefingConcern[] = []
  for (const e of input.report.indicators)
    if (e.status !== 'nominal') out.push({ title: `${name(e.id)}: ${e.value} ${e.unit}`, status: e.status, detail: e.message, action: e.actionPlan.steps[0] ?? 'Re-measure and monitor.' })
  for (const r of input.rulesBriefing.emergingRisks)
    if (!out.some((c) => c.title.startsWith(name(r.indicatorId)))) out.push({ title: `${name(r.indicatorId)} trend`, status: r.severity, detail: r.explanation, action: r.preventiveAction })
  for (const p of photos) out.push({ title: p.label, status: p.status, detail: p.detail, action: p.steps[0] ?? 'Keep clean and covered; re-photograph tomorrow.' })
  for (const a of input.rulesBriefing.environmentAlerts.slice(0, 3)) out.push({ title: 'Environment', status: 'caution', detail: a, action: 'Follow the cabin / shelter guidance.' })
  return out.sort((a, b) => ORDER[b.status] - ORDER[a.status]).slice(0, 8)
}

// ── Gemini ─────────────────────────────────────────────────────────────────

interface GeminiBriefingReply {
  overallStatus?: string
  headline?: string
  summary?: string
  concerns?: { title?: string; status?: string; detail?: string; action?: string }[]
  recommendations?: string[]
  interimSteps?: string[]
  sosRecommended?: boolean
  sosReason?: string
  checkinNote?: string
  last24hNote?: string
  sevenDayNote?: string
}

const SYSTEM =
  'You are the onboard medical decision-support assistant of a spacecraft. You write a short medical briefing for an astronaut who is not a doctor. ' +
  'Use plain English, no jargon. Be calm and specific. This is decision support, not a diagnosis. ' +
  'Status words: Normal (green), Watch (yellow), Alert (red). Never call something Normal if the data line says Watch or Alert. Reply with JSON only.'

const str = (x: unknown, max: number) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : undefined)
const strs = (x: unknown, n: number, max = 220) => (Array.isArray(x) ? x.map((v) => str(v, max)).filter((v): v is string => !!v).slice(0, n) : [])
const status = (x: unknown): StatusLevel | undefined => (x === 'nominal' || x === 'caution' || x === 'critical' ? x : undefined)

function lineText(l: BriefingLine) {
  const s = l.status === 'nominal' ? 'Normal' : l.status === 'caution' ? 'Watch' : l.status === 'critical' ? 'Alert' : 'No data'
  return `- ${l.label} [${s}]: ${l.text}`
}

// ── Main ───────────────────────────────────────────────────────────────────

/** Build (and store) the full briefing. Never throws; falls back to the rules. */
export async function generateBriefing(input: BriefingInput, ai?: AIConfig): Promise<AiBriefing> {
  const { profile, missionState, report } = input
  const today = profile.missionDay
  const now = Math.floor(today) + (input.onboardMinute ?? 1439) / 1440
  const [readings, photos, uploads, scans] = await Promise.all([
    getReadings(profile.id, Math.floor(today) - 7, Infinity).catch(() => []),
    listPhotoRecords(profile.id).catch(() => []),
    listUploads(profile.id).catch(() => []),
    listScans(profile.id).catch(() => []),
  ])
  const recentPhotos = photos.filter((p) => p.mode === 'skin' && p.missionDay > today - 7)
  const photoConcerns = recentPhotos
    .filter((p) => p.status && p.status !== 'nominal')
    .map((p) => ({ label: `Skin photo, ${p.bodyLocation} (day ${p.missionDay})`, status: p.status as StatusLevel, detail: `${p.aiSummary ?? p.aiLabel}. ${(p.severityReasons ?? []).join(' ')}`.trim(), steps: p.interimSteps ?? p.firstAid ?? [] }))
  const recentUploads = uploads.filter((u) => u.day > today - 7)
  const lastScan = scans.at(-1)

  const lastCheckin = checkinLines(profile, input.lastCheckin)
  const last24h = last24hLines(readings, now)
  if (lastScan && lastScan.day > now - 1)
    last24h.push({ label: 'Body scan extras', status: lastScan.extras.respiratory_rate > 20 ? 'caution' : 'nominal', text: `Breathing rate ${lastScan.extras.respiratory_rate}/min, heart-rate variability ${lastScan.extras.hrv_ms} ms (${lastScan.generator === 'python' ? 'Python scan' : 'browser scan'}).` })
  for (const p of recentPhotos.filter((p) => p.missionDay >= Math.floor(today)))
    last24h.push({ label: `Photo: ${p.bodyLocation}`, status: p.status ?? 'caution', text: p.aiSummary ?? String(p.aiLabel) })
  for (const u of recentUploads.filter((u) => u.day >= Math.floor(today)))
    last24h.push({ label: 'Upload', status: u.artifact.accepted ? u.artifact.severity : 'no_data', text: u.artifact.accepted ? u.artifact.extractedSummary : `Rejected: ${u.artifact.rejectionReason ?? 'not medical data'}` })
  const sevenDay = sevenDayLines(profile, readings, now)

  const rulesStatus = worstStatus([report.overallStatus, ...photoConcerns.map((p) => p.status), input.emergency?.level ?? 'nominal'])
  const concerns = rulesConcerns(input, photoConcerns)
  const recommendations = [...new Set([...input.rulesBriefing.recommendedToolChecks, ...report.indicators.filter((e) => e.status !== 'nominal').flatMap((e) => e.actionPlan.steps.slice(0, 1))])].slice(0, 6)
  const interim = input.emergency?.interimSteps?.length ? input.emergency.interimSteps : concerns.find((c) => c.status === 'critical') ? [concerns.find((c) => c.status === 'critical')!.action] : []

  const base: AiBriefing = {
    id: newId('brf'),
    astronautId: profile.id,
    createdAt: new Date().toISOString(),
    missionDay: Math.floor(today),
    engine: 'offline_rules',
    trigger: input.trigger,
    overallStatus: rulesStatus,
    headline: `${WORD[rulesStatus]}: ${input.rulesBriefing.headline.replace(/^[A-Z]+:\s*/, '')}`,
    summary: input.rulesBriefing.plainEnglishSummary,
    lastCheckin,
    last24h,
    sevenDay,
    concerns,
    recommendations,
    interimSteps: interim,
    sosRecommended: input.emergency?.sos ?? false,
    ...(input.emergency?.sos ? { sosReason: input.emergency.reasons.join(' ') } : {}),
    basedOn: { readings: readings.length, checkins: input.lastCheckin ? 1 : 0, uploads: recentUploads.length + recentPhotos.length },
    rulesStatusAtCreation: report.overallStatus,
  }

  const prompt = [
    `Astronaut: ${profile.name}, ${profile.role}, age ${profile.age}. Medical notes: ${profile.notes.join(' ') || 'none'}.`,
    `Mission day ${Math.floor(today)} of ${profile.missionLengthDays}, ${missionState.phase.name} (${missionState.environment.label}, ${missionState.environment.gravityG} g). Earth delay ${Math.round(missionState.earthDelaySeconds)} s one way: ${missionState.escalationMode === 'act_then_report' ? 'act onboard first, then report' : 'contact the flight surgeon'}.`,
    `What triggered this briefing: ${input.trigger}.`,
    `Rules-based overall status: ${WORD[rulesStatus]}. Rules briefing: ${input.rulesBriefing.headline} ${input.rulesBriefing.plainEnglishSummary}`,
    lastCheckin ? `LAST CHECK-IN (${lastCheckin.when}):\n${lastCheckin.lines.map(lineText).join('\n')}` : 'LAST CHECK-IN: none recorded.',
    `LAST 24 HOURS:\n${last24h.map(lineText).join('\n')}`,
    `PAST 7 DAYS:\n${sevenDay.map(lineText).join('\n')}`,
    concerns.length ? `RULE FLAGS:\n${concerns.map((c) => `- [${WORD[c.status]}] ${c.title}: ${c.detail}`).join('\n')}` : 'RULE FLAGS: none.',
    input.emergency?.sos ? `EMERGENCY RULES SAY SOS: ${input.emergency.reasons.join(' ')}` : '',
    'Write the briefing. Reply JSON: {"overallStatus":"nominal"|"caution"|"critical","headline":"<= 90 chars, no status prefix","summary":"3-5 plain sentences covering the scan / last check-in, the last 24 h and the 7-day pattern","concerns":[{"title","status","detail","action"}],"recommendations":[up to 6 short next checks],"interimSteps":[steps to do now if anything is Alert, else []],"sosRecommended":boolean,"sosReason":string,"checkinNote":one sentence,"last24hNote":one sentence,"sevenDayNote":one sentence}.',
    'sosRecommended only if the data suggest a life-threatening problem that onboard care cannot handle alone.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const { json: reply, info } = await callGeminiJsonInfo<GeminiBriefingReply>([{ text: prompt }], ai, SYSTEM)
  let out: AiBriefing
  if (reply && str(reply.headline, 120) && str(reply.summary, 1200)) {
    const aiStatus = status(reply.overallStatus) ?? rulesStatus
    const final = ORDER[aiStatus] > ORDER[rulesStatus] ? aiStatus : rulesStatus
    const aiConcerns = (Array.isArray(reply.concerns) ? reply.concerns : [])
      .map((c) => ({ title: str(c.title, 100), status: status(c.status) ?? 'caution', detail: str(c.detail, 400) ?? '', action: str(c.action, 300) ?? '' }))
      .filter((c): c is BriefingConcern => !!c.title)
      .slice(0, 8)
    out = {
      ...base,
      engine: 'gemini',
      model: info.model,
      overallStatus: final,
      headline: `${WORD[final]}: ${str(reply.headline, 120)!.replace(/^(alert|watch|normal|optimal|borderline)\s*:\s*/i, '')}`,
      summary: str(reply.summary, 1200)!,
      // Rule flags always stay; Gemini's extra concerns are added after them.
      concerns: [...concerns, ...aiConcerns.filter((c) => !concerns.some((r) => r.title.toLowerCase() === c.title.toLowerCase()))].slice(0, 10),
      recommendations: strs(reply.recommendations, 6).length ? strs(reply.recommendations, 6) : recommendations,
      interimSteps: [...new Set([...interim, ...strs(reply.interimSteps, 6)])].slice(0, 8),
      sosRecommended: base.sosRecommended || (reply.sosRecommended === true && final === 'critical'),
      ...(base.sosRecommended || (reply.sosRecommended === true && final === 'critical') ? { sosReason: [base.sosReason, str(reply.sosReason, 300)].filter(Boolean).join(' ') } : {}),
      sectionNotes: { checkin: str(reply.checkinNote, 300), last24h: str(reply.last24hNote, 300), sevenDay: str(reply.sevenDayNote, 300) },
    }
  } else {
    out = { ...base, fallbackReason: info.error === 'server_unreachable' ? 'Python server not running' : info.error === 'no_api_key' ? 'No Gemini key on the server' : info.error === 'offline_mode' ? 'Offline mode' : info.error ? `Gemini unavailable (${info.error})` : 'Gemini reply was unusable' }
  }
  await saveBriefing(out).catch(() => undefined)
  return out
}
