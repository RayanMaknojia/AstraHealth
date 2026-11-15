/**
 * Multimodal Gatekeeper & Extract-Once Normalizer.
 *
 * Step 1 (Validate): decide whether an uploaded image / document / audio /
 *   text / slider input is biomedical. Non-health inputs are rejected with a
 *   clear, user-facing reason.
 * Step 2 (Normalize once): convert an accepted input into a single
 *   IngestedArtifact (extractedSummary, mappedIndicators, severity) plus
 *   IndicatorUpdate[]. Raw media is discarded and never re-sent to the LLM.
 *
 * Uses Gemini Flash when an API key is configured (ONE call per input does
 * both steps); otherwise deterministic offline parsers (keyword gatekeeper +
 * regex extraction from file names, text, CSV, transcripts and simple PDFs)
 * so the hackathon demo always works. Severity is always re-graded locally
 * with healthEvaluator - the AI can add findings but cannot downgrade them.
 */

import { CREW_PROFILES } from '@/data/nasaSpaceflightData'
import { evaluateVitals, worstStatus } from '@/services/healthEvaluator'
import { getMissionState } from '@/services/missionTimeline'
import { blobToBase64, callGeminiJson, resolveApiKey } from '@/services/_gemini'
import type {
  AIConfig,
  DataModality,
  DemoIngestionCase,
  EnvironmentType,
  GatekeeperVerdict,
  IndicatorId,
  IndicatorUpdate,
  IngestedArtifact,
  IngestionInput,
  IngestionResult,
  StatusLevel,
  VitalsInput,
} from '@/types/astronaut'

/** File types the dropzone should accept (pass to the <input accept> attr). */
export const ACCEPTED_FILE_TYPES = 'image/*,application/pdf,text/csv,text/plain,audio/*'

export const MODALITY_LABELS: Record<DataModality, string> = {
  wearable_auto: 'Wearable reading',
  manual_slider: 'Manual check-in',
  lab_document: 'Lab report',
  ultrasound_image: 'Medical image',
  voice_log: 'Voice log',
  environment_feed: 'Environment sensor',
}

// ── Vocabulary ─────────────────────────────────────────────────────────────

const MEDICAL_TERMS = [
  'ultrasound', 'sonograph', 'scan', 'echo', 'doppler', 'bmd', 'bone', 'density', 'calcaneus', 'heel', 'femur', 'tibia',
  'dosimeter', 'msv', 'radiation', 'dose', 'blood', 'glucose', 'sugar', 'hba1c', 'cbc', 'wbc', 'rbc', 'hemoglobin',
  'haemoglobin', 'hgb', 'platelet', 'lymphocyte', 'cytokine', 'metabolic', 'panel', 'lab', 'mg/dl', 'mmol', 'bpm',
  'mmhg', 'pressure', 'pulse', 'heart', 'ecg', 'ekg', 'spo2', 'oxygen', 'saturation', 'temperature', 'temp', 'fever',
  'sleep', 'slept', 'actigraphy', 'mood', 'headache', 'nausea', 'dizzy', 'dizziness', 'symptom', 'pain', 'rash', 'skin',
  'wound', 'eye', 'vision', 'oct', 'retina', 'urine', 'saliva', 'biomarker', 'vitals', 'medical', 'health', 'cough',
  'sneez', 'throat', 'fatigue', 'tired', 'anxious', 'insomnia', 'osdr',
]

const NON_MEDICAL_TERMS = [
  'invoice', 'receipt', 'recipe', 'menu', 'meme', 'selfie', 'vacation', 'holiday', 'wallpaper', 'screenshot_game',
  'playlist', 'song', 'music', 'movie', 'poster', 'trailer', 'podcast', 'game', 'cat', 'dog', 'pizza', 'birthday',
  'party', 'resume', 'cv', 'spreadsheet_budget', 'budget', 'tax', 'contract', 'slides', 'presentation', 'homework',
]

function termHits(haystack: string, terms: string[]): string[] {
  const h = haystack.toLowerCase()
  return terms.filter((t) => new RegExp(`(^|[^a-z])${t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`, 'i').test(h))
}

// ── Reading inputs (once) ──────────────────────────────────────────────────

const TEXT_EXT = /\.(csv|txt|tsv|json|md)$/i

async function readText(input: IngestionInput): Promise<string> {
  if (input.text) return input.text.slice(0, 200_000)
  const f = input.file
  if (!f) return ''
  const mime = input.mimeType ?? f.type ?? ''
  try {
    if (mime.startsWith('text/') || mime.includes('csv') || mime.includes('json') || TEXT_EXT.test(input.fileName ?? ''))
      return (await f.text()).slice(0, 200_000)
    if (mime === 'application/pdf' || /\.pdf$/i.test(input.fileName ?? '')) {
      // Simple uncompressed PDFs keep text in (...) Tj operators; compressed PDFs need Gemini.
      const bytes = new Uint8Array(await f.slice(0, 2_000_000).arrayBuffer())
      let latin = ''
      for (let i = 0; i < bytes.length; i++) latin += String.fromCharCode(bytes[i])
      return [...latin.matchAll(/\(([^()]{1,200})\)\s*Tj/g)].map((m) => m[1]).join(' ').slice(0, 200_000)
    }
  } catch {
    /* unreadable → filename heuristics only */
  }
  return ''
}

function detectModality(input: IngestionInput, text: string): DataModality {
  if (input.manualValues) return 'manual_slider'
  const mime = (input.mimeType ?? input.file?.type ?? '').toLowerCase()
  const name = (input.fileName ?? '').toLowerCase()
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|bmp|webp|heic|dcm)$/.test(name)) return 'ultrasound_image'
  if (mime.startsWith('audio/') || /\.(mp3|m4a|wav|webm|ogg|aac)$/.test(name)) return 'voice_log'
  if (input.modality && input.modality !== 'wearable_auto' && input.modality !== 'environment_feed') return input.modality
  if (mime === 'application/pdf' || /\.(pdf|csv|tsv)$/.test(name) || /,|\t/.test(text.split('\n')[0] ?? '')) return 'lab_document'
  return text ? 'voice_log' : 'lab_document'
}

// ── Offline value extraction ──────────────────────────────────────────────

interface LabFinding {
  analyte: string
  value: number
  unit: string
  status: StatusLevel
  note: string
}

interface SymptomFinding {
  label: string
  status: StatusLevel
  indicator?: IndicatorId
}

interface Extraction {
  verdict: GatekeeperVerdict
  values: VitalsInput
  labs: LabFinding[]
  symptoms: SymptomFinding[]
  /** Free-text finding from the AI (or offline image note). */
  note?: string
  aiSeverity?: StatusLevel
  engine: IngestionResult['engine']
}

const num = (s: string) => Number(s.replace('−', '-').replace(',', '.'))

/** Physiologically possible ranges - values outside are rejected as bad input, not graded. */
const PLAUSIBLE: Record<keyof Omit<VitalsInput, 'fasting' | 'symptoms' | 'sleepRecentNights' | 'moodRecentDays'>, [number, number]> = {
  bloodSugarMgDl: [20, 600],
  heartRateBpm: [20, 250],
  systolicMmHg: [50, 260],
  diastolicMmHg: [30, 160],
  bodyTempC: [30, 43],
  sleepHours: [0, 24],
  mood: [1, 5],
  spo2Pct: [50, 100],
  radiationDailyMSv: [0, 1000],
  radiationMissionMSv: [0, 2000],
  boneDensityChangePct: [-30, 10],
}

function implausible(values: VitalsInput): string[] {
  const bad: string[] = []
  for (const [k, [lo, hi]] of Object.entries(PLAUSIBLE) as [keyof typeof PLAUSIBLE, [number, number]][]) {
    const v = values[k]
    if (v !== undefined && (!Number.isFinite(v) || v < lo || v > hi)) bad.push(`${k} = ${v} (expected ${lo}-${hi})`)
  }
  return bad
}

function extractVitals(text: string): VitalsInput {
  const t = text.replace(/−/g, '-')
  const v: VitalsInput = {}
  const m = (re: RegExp) => re.exec(t)
  let r: RegExpExecArray | null

  if ((r = m(/\b(?:glucose|blood sugar|bg)\b[^\d\n]{0,25}(\d{2,3}(?:\.\d+)?)/i))) v.bloodSugarMgDl = num(r[1])
  if (/\bfasting\b/i.test(t) && v.bloodSugarMgDl !== undefined) v.fasting = true
  if ((r = m(/\b(?:bp|blood pressure)\b[^\d\n]{0,20}(\d{2,3})\s*\/\s*(\d{2,3})/i)) || (r = m(/\b(\d{2,3})\s*\/\s*(\d{2,3})\s*mm\s*hg/i))) {
    v.systolicMmHg = num(r[1])
    v.diastolicMmHg = num(r[2])
  }
  if ((r = m(/\b(?:heart rate|hr|pulse)\b[^\d\n]{0,15}(\d{2,3})/i)) || (r = m(/\b(\d{2,3})\s*bpm\b/i))) v.heartRateBpm = num(r[1])
  if ((r = m(/\b(?:temp|temperature)\b[^\d\n]{0,15}(\d{2}(?:[.,]\d)?)/i)) || (r = m(/\b(\d{2}[.,]\d)\s*°\s*c\b/i))) v.bodyTempC = num(r[1])
  if ((r = m(/\b(?:spo2|sp02|oxygen saturation|o2 sat)\b[^\d\n]{0,15}(\d{2,3})/i))) v.spo2Pct = num(r[1])
  if ((r = m(/\b(?:slept|sleep)\b[^\d\n]{0,25}(\d{1,2}(?:[.,]\d)?)\s*(?:h|hr|hrs|hours)\b/i))) v.sleepHours = num(r[1])
  // Mood is 1-5 (health_rules.md); answers given out of 10 are converted.
  if ((r = m(/\b(?:mood|feeling)\b[^\d\n]{0,30}(\d{1,2})\s*(?:\/\s*|out of\s*)(5|10)\b/i)))
    v.mood = r[2] === '10' ? Math.max(1, Math.round(num(r[1]) / 2)) : num(r[1])
  if ((r = m(/\b(?:24\s*h|daily|today)\b[^\d\n]{0,15}(\d+(?:[.,]\d+)?)\s*msv/i))) v.radiationDailyMSv = num(r[1])
  if ((r = m(/\b(?:mission|total|cumulative)\b[^\d\n]{0,15}(\d+(?:[.,]\d+)?)\s*msv/i))) v.radiationMissionMSv = num(r[1])
  if (v.radiationDailyMSv === undefined && v.radiationMissionMSv === undefined && (r = m(/(\d+(?:[.,]\d+)?)\s*msv/i))) {
    const d = num(r[1])
    if (d < 5) v.radiationDailyMSv = d
    else v.radiationMissionMSv = d
  }
  if ((r = m(/\b(?:bmd|bone(?: mineral)? density)\b[^%\n]{0,60}?([-+]?\d+(?:[.,]\d+)?)\s*%/i))) v.boneDensityChangePct = num(r[1])
  return v
}

const LAB_RULES: { analyte: string; re: RegExp; unit: string; low: number; high: number; lowNote: string; highNote: string }[] = [
  { analyte: 'White blood cells (WBC)', re: /\b(?:wbc|white blood cells?)\b[^\d\n]{0,20}(\d+(?:\.\d+)?)/i, unit: '×10⁹/L', low: 4, high: 11, lowNote: 'low - immune system may be weakened (radiation / stress)', highNote: 'high - possible infection or inflammation' },
  { analyte: 'Hemoglobin', re: /\b(?:hgb|hb|ha?emoglobin)\b[^\d\n]{0,20}(\d+(?:\.\d+)?)/i, unit: 'g/dL', low: 12, high: 17.5, lowNote: 'low - "space anemia" is common in flight', highNote: 'high - check hydration' },
  { analyte: 'Platelets', re: /\bplatelets?\b[^\d\n]{0,20}(\d+(?:\.\d+)?)/i, unit: '×10⁹/L', low: 150, high: 450, lowNote: 'low - bleeding risk', highNote: 'high' },
  { analyte: 'Lymphocytes', re: /\blymphocytes?\b[^\d\n]{0,20}(\d+(?:\.\d+)?)/i, unit: '×10⁹/L', low: 1, high: 4.8, lowNote: 'low - radiation-sensitive immune cells', highNote: 'high' },
]

function extractLabs(text: string): LabFinding[] {
  const out: LabFinding[] = []
  for (const r of LAB_RULES) {
    const m = r.re.exec(text)
    if (!m) continue
    const value = num(m[1])
    const outBy = value < r.low ? (r.low - value) / r.low : value > r.high ? (value - r.high) / r.high : 0
    const status: StatusLevel = outBy === 0 ? 'nominal' : outBy > 0.3 ? 'critical' : 'caution'
    out.push({ analyte: r.analyte, value, unit: r.unit, status, note: value < r.low ? r.lowNote : value > r.high ? r.highNote : 'normal' })
  }
  return out
}

const SYMPTOM_RULES: { re: RegExp; label: string; status: StatusLevel; indicator?: IndicatorId }[] = [
  { re: /chest pain|chest tight/i, label: 'chest pain', status: 'critical', indicator: 'heart_rate' },
  { re: /short(ness)? of breath|can'?t breathe|breathless/i, label: 'shortness of breath', status: 'critical', indicator: 'spo2' },
  { re: /faint(ed)?\b|passed out|black(ed)? out/i, label: 'fainting', status: 'critical', indicator: 'blood_pressure' },
  { re: /suicid|harm myself|end it all/i, label: 'thoughts of self-harm', status: 'critical', indicator: 'mood' },
  { re: /blurr(y|ed) vision|vision (change|problem)/i, label: 'vision changes (possible SANS)', status: 'caution', indicator: 'blood_pressure' },
  { re: /headache/i, label: 'headache', status: 'caution' },
  { re: /nause|vomit/i, label: 'nausea', status: 'caution' },
  { re: /dizz/i, label: 'dizziness', status: 'caution', indicator: 'blood_pressure' },
  { re: /sneez|watery eyes|sore throat/i, label: 'dust irritation ("lunar hay fever")', status: 'caution' },
  { re: /cough/i, label: 'cough', status: 'caution' },
  { re: /fever|chills/i, label: 'fever / chills', status: 'caution', indicator: 'body_temp' },
  { re: /can'?t sleep|insomnia|woke up (twice|several|many)/i, label: 'poor sleep', status: 'caution', indicator: 'sleep_hours' },
  { re: /anxious|anxiety|panic/i, label: 'anxiety', status: 'caution', indicator: 'mood' },
  { re: /\bsad\b|depress|lonely|missing home|homesick/i, label: 'low mood / homesickness', status: 'caution', indicator: 'mood' },
  { re: /\brash\b|itch/i, label: 'skin rash', status: 'caution' },
]

function extractSymptoms(text: string): SymptomFinding[] {
  return SYMPTOM_RULES.filter((s) => s.re.test(text)).map(({ label, status, indicator }) => ({ label, status, ...(indicator ? { indicator } : {}) }))
}

function hasValues(v: VitalsInput): boolean {
  return Object.entries(v).some(([k, x]) => k !== 'fasting' && k !== 'symptoms' && x !== undefined)
}

// ── Gatekeeper ─────────────────────────────────────────────────────────────

function offlineExtraction(input: IngestionInput, text: string): Extraction {
  const modality = detectModality(input, text)
  const reject = (reason: string, confidence = 0.9): Extraction => ({
    verdict: { accepted: false, detectedModality: modality, confidence, rejectionReason: reason },
    values: {},
    labs: [],
    symptoms: [],
    engine: 'offline_mock',
  })

  if (input.manualValues) {
    const values = { ...input.manualValues }
    const bad = implausible(values)
    if (bad.length) return reject(`Some values are not physically possible - please re-check: ${bad.join('; ')}.`, 1)
    if (!hasValues(values) && !values.symptoms?.length) return reject('No values entered yet - move at least one slider or type a symptom.', 1)
    const symptoms = extractSymptoms((values.symptoms ?? []).join('. '))
    return { verdict: { accepted: true, detectedModality: 'manual_slider', confidence: 1 }, values, labs: [], symptoms, engine: 'offline_mock' }
  }

  const name = input.fileName ?? ''
  const haystack = `${name.replace(/[_\-.]+/g, ' ')} ${text}`
  if (!haystack.trim()) return reject('Nothing to analyse - the file is empty or unreadable.', 1)

  const values = extractVitals(text || name.replace(/_/g, ' '))
  const labs = extractLabs(text)
  const symptoms = extractSymptoms(text)
  const med = termHits(haystack, MEDICAL_TERMS)
  const non = termHits(haystack, NON_MEDICAL_TERMS)
  const evidence = med.length + (hasValues(values) ? 2 : 0) + labs.length + symptoms.length
  const bad = implausible(values)

  if (bad.length && evidence <= 2) return reject(`The numbers found are not physically possible for a health reading (${bad.join('; ')}).`)
  for (const k of Object.keys(PLAUSIBLE) as (keyof typeof PLAUSIBLE)[]) {
    const x = values[k]
    const [lo, hi] = PLAUSIBLE[k]
    if (x !== undefined && (x < lo || x > hi)) delete values[k]
  }

  const what =
    modality === 'ultrasound_image'
      ? 'a regular photo, not a medical image'
      : modality === 'voice_log'
        ? 'audio that is not a health log'
        : 'a document with no health measurements'
  const help =
    modality === 'ultrasound_image'
      ? 'Upload an ultrasound scan, dosimeter display, skin/rash photo or eye image.'
      : modality === 'voice_log'
        ? 'Record a short note about how you feel, your sleep or symptoms.'
        : 'Upload a blood panel, lab report (CSV/PDF) or measurement log.'

  if (non.length > 0 && evidence < 2) return reject(`Rejected: non-biomedical data. This looks like ${what} (“${non.join(', ')}”). ${help}`)

  if (modality === 'voice_log' && !text) {
    // Audio we can't transcribe offline: accept as a health log but say so.
    if (non.length) return reject(`Rejected: non-biomedical data. This looks like ${what}. ${help}`)
    return {
      verdict: { accepted: true, detectedModality: 'voice_log', confidence: 0.55 },
      values: {},
      labs: [],
      symptoms: [],
      note: 'Voice log saved. Offline mode cannot transcribe audio - add a one-line typed summary so it can be graded.',
      engine: 'offline_mock',
    }
  }

  const needed = modality === 'ultrasound_image' ? 1 : 2
  if (evidence < needed) return reject(`Rejected: non-biomedical data. No health terms or measurements were found - this looks like ${what}. ${help}`, 0.7)

  const confidence = Math.min(0.98, 0.55 + evidence * 0.08)
  let note: string | undefined
  if (modality === 'ultrasound_image' && values.boneDensityChangePct === undefined)
    note = /dosimeter|msv/i.test(haystack)
      ? 'Dosimeter photo received - no dose number found; type the 24 h and mission values.'
      : 'Medical image received. No measurement found offline - read the % change from the scan software and enter it.'
  return { verdict: { accepted: true, detectedModality: modality, confidence: Math.round(confidence * 100) / 100 }, values, labs, symptoms, ...(note ? { note } : {}), engine: 'offline_mock' }
}

interface AiReply {
  accepted?: boolean
  detectedModality?: string
  confidence?: number
  rejectionReason?: string
  summary?: string
  severity?: string
  values?: Partial<Record<keyof VitalsInput, number | boolean>>
  labs?: { analyte?: string; value?: number; unit?: string; status?: string; note?: string }[]
  symptoms?: string[]
}

const MODALITIES: DataModality[] = ['manual_slider', 'lab_document', 'ultrasound_image', 'voice_log']
const STATUSES: StatusLevel[] = ['nominal', 'caution', 'critical']

const AI_PROMPT = `You are the biomedical gatekeeper for an astronaut self-care app (decision support, not diagnosis).
1) Decide if the input is biomedical (ultrasound/medical image, dosimeter, rash/eye photo, blood panel or lab report, vitals log, or a spoken/typed health log). Reject anything else with a short, friendly reason that says what to upload instead.
2) If accepted, extract ONCE everything useful so the raw file never needs to be read again.
Reply with JSON only:
{"accepted":bool,"detectedModality":"lab_document|ultrasound_image|voice_log|manual_slider","confidence":0..1,"rejectionReason":string?,
 "summary":"1-3 plain-English sentences for a non-doctor","severity":"nominal|caution|critical",
 "values":{"bloodSugarMgDl"?:n,"fasting"?:bool,"heartRateBpm"?:n,"systolicMmHg"?:n,"diastolicMmHg"?:n,"bodyTempC"?:n,"spo2Pct"?:n,"sleepHours"?:n,"mood"?:n(1-5, convert /10 answers),"radiationDailyMSv"?:n,"radiationMissionMSv"?:n,"boneDensityChangePct"?:n},
 "labs":[{"analyte":s,"value":n,"unit":s,"status":"nominal|caution|critical","note":s}],
 "symptoms":[s]}
Only include values that are actually present. Units: mg/dL, bpm, mmHg, °C, %, hours, mSv.`

async function aiExtraction(input: IngestionInput, text: string, ai?: AIConfig): Promise<Extraction | null> {
  if (!resolveApiKey(ai)) return null
  const parts: Parameters<typeof callGeminiJson>[0] = [{ text: AI_PROMPT }]
  parts.push({ text: `File name: ${input.fileName ?? '(none)'}; MIME: ${input.mimeType ?? input.file?.type ?? 'unknown'}; UI hint: ${input.modality ?? 'none'}` })
  if (text) parts.push({ text: `Text content:\n${text.slice(0, 30_000)}` })
  const mime = input.mimeType ?? input.file?.type ?? ''
  if (input.file && !text && (mime.startsWith('image/') || mime.startsWith('audio/') || mime === 'application/pdf')) {
    const data = await blobToBase64(input.file)
    if (data) parts.push({ inline_data: { mime_type: mime, data } })
  }
  const reply = await callGeminiJson<AiReply>(parts, ai)
  if (!reply || typeof reply.accepted !== 'boolean') return null

  const detected = MODALITIES.includes(reply.detectedModality as DataModality) ? (reply.detectedModality as DataModality) : detectModality(input, text)
  if (!reply.accepted)
    return {
      verdict: { accepted: false, detectedModality: detected, confidence: clamp01(reply.confidence ?? 0.8), rejectionReason: reply.rejectionReason || 'Rejected: non-biomedical data.' },
      values: {},
      labs: [],
      symptoms: [],
      engine: 'gemini',
    }
  const values: VitalsInput = {}
  for (const k of Object.keys(PLAUSIBLE) as (keyof typeof PLAUSIBLE)[]) {
    const x = reply.values?.[k]
    if (typeof x === 'number' && Number.isFinite(x) && x >= PLAUSIBLE[k][0] && x <= PLAUSIBLE[k][1]) values[k] = x
  }
  if (reply.values?.fasting === true) values.fasting = true
  const labs: LabFinding[] = (reply.labs ?? [])
    .filter((l) => l.analyte && typeof l.value === 'number')
    .map((l) => ({ analyte: l.analyte!, value: l.value!, unit: l.unit ?? '', status: STATUSES.includes(l.status as StatusLevel) ? (l.status as StatusLevel) : 'nominal', note: l.note ?? '' }))
  // Re-run the deterministic symptom rules on the AI's symptom list + text so critical words are never missed.
  const symptoms = extractSymptoms([...(reply.symptoms ?? []), text].join('. '))
  return {
    verdict: { accepted: true, detectedModality: detected, confidence: clamp01(reply.confidence ?? 0.8) },
    values,
    labs,
    symptoms,
    ...(reply.summary ? { note: reply.summary } : {}),
    ...(STATUSES.includes(reply.severity as StatusLevel) ? { aiSeverity: reply.severity as StatusLevel } : {}),
    engine: 'gemini',
  }
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** One extraction per input object - validate() and normalize() share it, so media is read/sent once. */
const cache = new WeakMap<IngestionInput, Promise<Extraction>>()

function extract(input: IngestionInput, ai?: AIConfig): Promise<Extraction> {
  let p = cache.get(input)
  if (!p) {
    p = (async () => {
      const text = await readText(input)
      if (!input.manualValues) {
        const viaAi = await aiExtraction(input, text, ai)
        if (viaAi) return viaAi
      }
      return offlineExtraction(input, text)
    })()
    cache.set(input, p)
  }
  return p
}

/** Gatekeeper: is this input biomedical? Never throws for bad input - returns accepted:false. */
export async function validateBiomedicalRelevance(input: IngestionInput, ai?: AIConfig): Promise<GatekeeperVerdict> {
  return (await extract(input, ai)).verdict
}

// ── Normalizer ─────────────────────────────────────────────────────────────

let seq = 0
const newId = () => `art-${Date.now().toString(36)}-${(seq++).toString(36)}`

function indicatorsFromValues(v: VitalsInput): IndicatorId[] {
  const ids: IndicatorId[] = []
  if (v.bloodSugarMgDl !== undefined) ids.push('blood_sugar')
  if (v.heartRateBpm !== undefined) ids.push('heart_rate')
  if (v.systolicMmHg !== undefined && v.diastolicMmHg !== undefined) ids.push('blood_pressure')
  if (v.bodyTempC !== undefined) ids.push('body_temp')
  if (v.spo2Pct !== undefined) ids.push('spo2')
  if (v.sleepHours !== undefined) ids.push('sleep_hours')
  if (v.mood !== undefined) ids.push('mood')
  if (v.radiationDailyMSv !== undefined || v.radiationMissionMSv !== undefined) ids.push('radiation_dose')
  if (v.boneDensityChangePct !== undefined) ids.push('bone_density')
  return ids
}

function updatesFromValues(v: VitalsInput, source: DataModality, timestamp: string, day: number, astronautId?: string): IndicatorUpdate[] {
  const out: IndicatorUpdate[] = []
  const u = (id: IndicatorId, value: number | string, unit: string) =>
    out.push({ ...(astronautId ? { astronautId } : {}), id, value, unit, source, timestamp, day })
  if (v.bloodSugarMgDl !== undefined) u('blood_sugar', v.bloodSugarMgDl, 'mg/dL')
  if (v.heartRateBpm !== undefined) u('heart_rate', v.heartRateBpm, 'bpm')
  if (v.systolicMmHg !== undefined && v.diastolicMmHg !== undefined) u('blood_pressure', `${Math.round(v.systolicMmHg)}/${Math.round(v.diastolicMmHg)}`, 'mmHg')
  if (v.bodyTempC !== undefined) u('body_temp', v.bodyTempC, '°C')
  if (v.spo2Pct !== undefined) u('spo2', v.spo2Pct, '%')
  if (v.sleepHours !== undefined) u('sleep_hours', v.sleepHours, 'hrs')
  if (v.mood !== undefined) u('mood', Math.round(v.mood), '/5')
  // History is cumulative mission dose, so only a mission total becomes a data point.
  if (v.radiationMissionMSv !== undefined) u('radiation_dose', v.radiationMissionMSv, 'mSv')
  if (v.boneDensityChangePct !== undefined) u('bone_density', v.boneDensityChangePct, '%')
  return out
}

function describeValues(v: VitalsInput): string[] {
  const out: string[] = []
  if (v.bloodSugarMgDl !== undefined) out.push(`blood sugar ${v.bloodSugarMgDl} mg/dL${v.fasting ? ' (fasting)' : ''}`)
  if (v.systolicMmHg !== undefined && v.diastolicMmHg !== undefined) out.push(`blood pressure ${v.systolicMmHg}/${v.diastolicMmHg} mmHg`)
  if (v.heartRateBpm !== undefined) out.push(`heart rate ${v.heartRateBpm} bpm`)
  if (v.bodyTempC !== undefined) out.push(`temperature ${v.bodyTempC} °C`)
  if (v.spo2Pct !== undefined) out.push(`SpO2 ${v.spo2Pct}%`)
  if (v.sleepHours !== undefined) out.push(`sleep ${v.sleepHours} h`)
  if (v.mood !== undefined) out.push(`mood ${v.mood}/5`)
  if (v.radiationDailyMSv !== undefined) out.push(`radiation ${v.radiationDailyMSv} mSv in 24 h`)
  if (v.radiationMissionMSv !== undefined) out.push(`mission dose ${v.radiationMissionMSv} mSv`)
  if (v.boneDensityChangePct !== undefined) out.push(`bone density ${v.boneDensityChangePct > 0 ? '+' : ''}${v.boneDensityChangePct}% vs pre-flight`)
  return out
}

function defaultEnvironment(input: IngestionInput): EnvironmentType {
  if (input.environment) return input.environment
  const p = input.astronautId ? CREW_PROFILES.find((c) => c.id === input.astronautId) : undefined
  return p?.environment ?? 'EARTH_ORBIT'
}

/** Grade what was extracted with the same rules as the dashboard (AI can raise, never lower). */
function grade(input: IngestionInput, x: Extraction): { severity: StatusLevel; worst: string[] } {
  const env = defaultEnvironment(input)
  const profile = input.astronautId ? CREW_PROFILES.find((c) => c.id === input.astronautId) : undefined
  const report = evaluateVitals(x.values, env, {
    ...(profile ? { missionState: getMissionState(profile.mission, input.day ?? profile.missionDay), baseline: profile.baseline, priorCareerDoseMSv: profile.priorCareerDoseMSv } : {}),
  })
  const statuses: StatusLevel[] = [
    ...report.indicators.map((i) => i.status),
    ...x.labs.map((l) => l.status),
    ...x.symptoms.map((s) => s.status),
    ...(x.aiSeverity ? [x.aiSeverity] : []),
  ]
  const worst = report.indicators.filter((i) => i.status !== 'nominal').map((i) => i.message)
  return { severity: worstStatus(statuses), worst }
}

/** Normalizer: turn an accepted input into a lightweight structured artifact (runs once). */
export async function normalizeArtifact(input: IngestionInput, verdict: GatekeeperVerdict, ai?: AIConfig): Promise<IngestedArtifact> {
  const x = await extract(input, ai)
  const day = input.day ?? 0
  const timestamp = input.timestamp ?? `Day ${Math.floor(day)}`
  const base = {
    id: newId(),
    timestamp,
    ...(input.fileName ? { fileName: input.fileName } : {}),
    modality: verdict.detectedModality,
  }
  if (!verdict.accepted)
    return { ...base, accepted: false, rejectionReason: verdict.rejectionReason ?? 'Rejected: non-biomedical data.', extractedSummary: '', mappedIndicators: [], severity: 'nominal' }

  const { severity, worst } = grade(input, x)
  const parts: string[] = []
  const vals = describeValues(x.values)
  const label = MODALITY_LABELS[verdict.detectedModality]
  if (x.note) parts.push(x.note)
  if (vals.length) parts.push(`${label}: ${vals.join(', ')}.`)
  const abnormalLabs = x.labs.filter((l) => l.status !== 'nominal')
  if (x.labs.length)
    parts.push(
      abnormalLabs.length
        ? `Lab flags: ${abnormalLabs.map((l) => `${l.analyte} ${l.value} ${l.unit} (${l.note})`).join('; ')}.`
        : `Other labs normal (${x.labs.map((l) => l.analyte).join(', ')}).`,
    )
  if (x.symptoms.length) parts.push(`Reported: ${x.symptoms.map((s) => s.label).join(', ')}.`)
  if (worst.length) parts.push(worst.slice(0, 3).join(' '))
  if (!parts.length) parts.push(`${label} saved. No measurements were found to grade.`)

  const mapped = new Set<IndicatorId>(indicatorsFromValues(x.values))
  for (const s of x.symptoms) if (s.indicator) mapped.add(s.indicator)
  if (verdict.detectedModality === 'ultrasound_image' && /bone|bmd|calcaneus|heel|ultrasound/i.test(`${input.fileName ?? ''} ${input.text ?? ''}`)) mapped.add('bone_density')

  return { ...base, accepted: true, extractedSummary: parts.join(' '), mappedIndicators: [...mapped], severity }
}

/**
 * Main entry point for the UI: validate → normalize → derive IndicatorUpdates.
 * Rejected inputs still resolve (artifact.accepted === false, updates === []). Never throws.
 */
export async function ingest(input: IngestionInput, ai?: AIConfig): Promise<IngestionResult> {
  try {
    const x = await extract(input, ai)
    const artifact = await normalizeArtifact(input, x.verdict, ai)
    const day = input.day ?? 0
    const updates = x.verdict.accepted
      ? updatesFromValues(x.values, x.verdict.detectedModality, artifact.timestamp, day, input.astronautId)
      : []
    return { verdict: x.verdict, artifact, updates, engine: x.engine }
  } catch (err) {
    const verdict: GatekeeperVerdict = {
      accepted: false,
      detectedModality: input.modality ?? 'lab_document',
      confidence: 0,
      rejectionReason: `Could not read this input (${err instanceof Error ? err.message : 'unknown error'}). Try again or enter the values manually.`,
    }
    return {
      verdict,
      artifact: {
        id: newId(),
        timestamp: input.timestamp ?? `Day ${Math.floor(input.day ?? 0)}`,
        ...(input.fileName ? { fileName: input.fileName } : {}),
        modality: verdict.detectedModality,
        accepted: false,
        rejectionReason: verdict.rejectionReason,
        extractedSummary: '',
        mappedIndicators: [],
        severity: 'nominal',
      },
      updates: [],
      engine: 'offline_mock',
    }
  }
}

// ── Demo fixtures ──────────────────────────────────────────────────────────

/** 1×1 PNG so the demo "image" is a real file the dropzone/preview can handle. */
const PNG_1PX = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
)

/**
 * Ready-made inputs for the "Test Valid Ultrasound vs. Invalid File" demo buttons.
 * Image fixtures carry `text` = the scan software's on-screen readout (what OCR / Gemini would read).
 */
export function createDemoInput(kind: DemoIngestionCase): IngestionInput {
  switch (kind) {
    case 'valid_ultrasound':
      return {
        modality: 'ultrasound_image',
        fileName: 'calcaneus_bone_ultrasound_day45.png',
        mimeType: 'image/png',
        file: new Blob([PNG_1PX], { type: 'image/png' }),
        text: 'Calcaneus quantitative ultrasound (heel). BMD change -3.2% vs pre-flight baseline. Probe placement OK.',
      }
    case 'valid_blood_panel': {
      const csv = [
        'analyte,value,unit,reference',
        'Glucose (fasting),128,mg/dL,70-99',
        'WBC,3.6,10^9/L,4.0-11.0',
        'Hemoglobin,14.1,g/dL,13.5-17.5',
        'Platelets,210,10^9/L,150-450',
        'Lymphocytes,0.9,10^9/L,1.0-4.8',
        'Sodium,139,mmol/L,135-145',
      ].join('\n')
      return { modality: 'lab_document', fileName: 'blood_panel_cbc_metabolic.csv', mimeType: 'text/csv', file: new Blob([csv], { type: 'text/csv' }) }
    }
    case 'valid_voice_log':
      return {
        modality: 'voice_log',
        fileName: 'voice_log_evening.webm',
        mimeType: 'audio/webm',
        file: new Blob([new Uint8Array(32)], { type: 'audio/webm' }),
        text: 'Evening log. Slept about 5 hours last night, woke up twice. Mild headache since this morning and a bit dizzy when I turned quickly. Mood maybe 2 out of 5, missing home.',
      }
    case 'invalid_file':
      return {
        fileName: 'crew_movie_night_poster.jpg',
        mimeType: 'image/jpeg',
        file: new Blob([PNG_1PX], { type: 'image/jpeg' }),
      }
  }
}
