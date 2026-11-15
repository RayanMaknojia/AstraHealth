/**
 * Photo Check (pages doc §4).
 *
 * Tab 1 - Skin photo, AI FIRST LOOK ONLY (not a diagnosis):
 *   classes cut/laceration, burn, bruise, abrasion, bite/sting, scab, scar, possible
 *   infection, rash, normal skin, plus "unsure".
 *   Confidence < 70% → "Unsure. Sent to the flight surgeon for review." - never guess.
 *   1. The photo is turned into processed data in the browser (brightness, sharpness,
 *      % red / dark / yellow pixels).
 *   2. The AI (Gemini via the Python server) reads the image + that data + the astronaut's
 *      vitals, symptoms and earlier photos; offline, a stand-in uses the notes, file
 *      name and pixel colours.
 *   3. Severity is decided by rules here (never greener than the AI says), e.g. a
 *      possible infection with a fever ≥ 38.5 °C is an Alert and recommends SOS.
 * Tab 2 - Ultrasound, guided capture with NO AI diagnosis: step-by-step guide,
 *   pixel-based quality check (too dark / too bright / blurry), auto-tagging.
 * Every photo and scan is queued for flight-surgeon review via syncService;
 * reviews coming back in the inbox mark the record "reviewed".
 */

import { SKIN_CONFIDENCE_MIN, SKIN_GUIDANCE, SKIN_KEYWORDS, SKIN_LABELS, IMAGE_QUALITY as Q, ULTRASOUND_GUIDES } from '@/data/phase3Data'
import { CREW_PROFILES, phaseForDay } from '@/data/nasaSpaceflightData'
import { blobToBase64, callGeminiJson, resolveApiKey, STYLE_RULES } from '@/services/_gemini'
import { createStore, missionTimestamp, newId } from '@/services/_store'
import { enqueue, listInbox } from '@/services/syncService'
import type {
  AIConfig,
  ImageStats,
  PhotoComparison,
  PhotoRecord,
  ScanQuality,
  SkinLabel,
  PhotoContext,
  SkinPhotoInput,
  StatusLevel,
  UltrasoundCaptureInput,
} from '@/types/astronaut'

export const FIRST_LOOK_DISCLAIMER = 'First look only. Not a diagnosis.'
export const SKIN_LABEL_TEXT = SKIN_LABELS
export const ULTRASOUND_SCAN_GUIDES = ULTRASOUND_GUIDES

const store = createStore<PhotoRecord[]>('photos:v1', () => [])
const MAX_THUMB_CHARS = 140_000 // ~100 KB of base64

// ── Browser helper: real image quality stats ───────────────────────────────

/**
 * Compute brightness and sharpness from canvas pixels, e.g.
 *   const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, w, h)
 *   computeImageStats(ctx.getImageData(0, 0, w, h))
 * Downscale to ~256 px wide first for speed. Pure function, no DOM access.
 */
export function computeImageStats(image: { data: Uint8ClampedArray | number[]; width: number; height: number }): ImageStats {
  const { data, width, height } = image
  const lum = new Float32Array(width * height)
  let sum = 0
  let red = 0
  let dark = 0
  let yellow = 0
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const y = 0.299 * r + 0.587 * g + 0.114 * b
    lum[i] = y
    sum += y
    if (r > 110 && r > g * 1.45 && r > b * 1.35) red++
    if (y < 45) dark++
    if (r > 120 && g > 110 && b < g * 0.65 && Math.abs(r - g) < 60) yellow++
  }
  const px = Math.max(1, width * height)
  const pct = (n: number) => Math.round((n / px) * 1000) / 10
  const meanBrightness = width * height ? sum / (width * height) : 0
  let lapSum = 0
  let lapSq = 0
  let n = 0
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const v = lum[i - width] + lum[i + width] + lum[i - 1] + lum[i + 1] - 4 * lum[i]
      lapSum += v
      lapSq += v * v
      n++
    }
  const mean = n ? lapSum / n : 0
  const sharpness = n ? lapSq / n - mean * mean : 0
  return { width, height, meanBrightness: Math.round(meanBrightness), sharpness: Math.round(sharpness), rednessPct: pct(red), darkPct: pct(dark), yellowPct: pct(yellow) }
}

/** Plain-language description of the processed pixel data. */
export function describeImageStats(st?: ImageStats): string[] {
  if (!st) return []
  const out: string[] = []
  if (st.rednessPct !== undefined) out.push(st.rednessPct >= 30 ? `Large red area (${st.rednessPct}% of the photo)` : st.rednessPct >= 10 ? `Some redness (${st.rednessPct}% of the photo)` : `Little redness (${st.rednessPct}%)`)
  if ((st.darkPct ?? 0) >= 15) out.push(`Dark patches (${st.darkPct}%): scab, bruise or shadow`)
  if ((st.yellowPct ?? 0) >= 8) out.push(`Yellow tones (${st.yellowPct}%): possible pus or an older bruise`)
  out.push(st.sharpness < Q.minSharpness ? 'Image is blurry' : 'Image is sharp enough to review')
  return out
}

function qualityFrom(stats: ImageStats | undefined, file?: Blob): { quality: ScanQuality; message: string } {
  if (stats) {
    if (stats.meanBrightness < Q.minBrightness) return { quality: 'too_dark', message: 'Too dark - add light or increase gain, then try again.' }
    if (stats.meanBrightness > Q.maxBrightness) return { quality: 'too_bright', message: 'Too bright / washed out - lower the gain, then try again.' }
    if (stats.sharpness < Q.minSharpness) return { quality: 'blurry', message: 'Blurry - hold the probe/camera still and try again.' }
    return { quality: 'ok', message: 'Image saved.' }
  }
  if (file && file.size < Q.minBytes) return { quality: 'unreadable', message: 'The image file looks empty or too small - capture again.' }
  return { quality: 'ok', message: 'Image saved (quality not measured - pass imageStats for a real check).' }
}

const clampThumb = (s?: string) => (s && s.length <= MAX_THUMB_CHARS ? s : undefined)

function phaseNameFor(astronautId: string, day: number): string {
  const p = CREW_PROFILES.find((c) => c.id === astronautId)
  return p ? phaseForDay(p.mission, day).name : `Day ${Math.floor(day)}`
}

// ── Skin first look ────────────────────────────────────────────────────────

interface SkinGuess {
  label: SkinLabel
  confidence: number
  alternatives: { label: SkinLabel; confidence: number }[]
  engine: PhotoRecord['engine']
  findings?: string[]
  summary?: string
  severity?: StatusLevel
  interimSteps?: string[]
  sos?: boolean
  reason?: string
}

function offlineSkinGuess(input: SkinPhotoInput): SkinGuess {
  const text = `${input.fileName ?? ''} ${input.notes ?? ''}`.toLowerCase().replace(/[_\-.]+/g, ' ')
  const scores = (Object.keys(SKIN_KEYWORDS) as Exclude<SkinLabel, 'unsure'>[])
    .map((label) => ({ label, hits: SKIN_KEYWORDS[label].filter((k) => text.includes(k)).length }))
    .sort((a, b) => b.hits - a.hits)
  const st = input.imageStats
  // Pixel colours nudge the guess when the words agree (never on their own above 70%).
  if (st?.rednessPct !== undefined && st.rednessPct >= 25) for (const sc of scores) if (sc.label === 'infection' || sc.label === 'rash' || sc.label === 'burn') sc.hits += sc.hits ? 0.5 : 0
  if ((st?.yellowPct ?? 0) >= 8) for (const sc of scores) if (sc.label === 'infection' && sc.hits) sc.hits += 0.5
  scores.sort((a, b) => b.hits - a.hits)
  const top = scores[0]
  if (!top || top.hits === 0) {
    const hint: SkinLabel[] = (st?.rednessPct ?? 0) >= 25 ? ['rash', 'infection'] : (st?.darkPct ?? 0) >= 15 ? ['scab', 'bruise'] : [scores[0]?.label ?? 'normal', scores[1]?.label ?? 'bruise']
    return { label: 'unsure', confidence: 0.45, alternatives: hint.map((label) => ({ label, confidence: 0.2 })), engine: 'offline_mock' }
  }
  const second = scores[1]?.hits ?? 0
  const confidence = Math.min(0.92, 0.72 + 0.06 * (top.hits - second))
  const rest = 1 - confidence
  const alternatives = scores
    .slice(1, 3)
    .map((s, i) => ({ label: s.label as SkinLabel, confidence: Math.round(rest * (i === 0 ? 0.65 : 0.25) * 100) / 100 }))
  return { label: top.label, confidence: Math.round(confidence * 100) / 100, alternatives, engine: 'offline_mock' }
}

interface AiSkinReply {
  label?: string
  confidence?: number
  alternatives?: { label?: string; confidence?: number }[]
  findings?: string[]
  summary?: string
  severity?: string
  interimSteps?: string[]
  sosRecommended?: boolean
  reason?: string
}

const LABELS: SkinLabel[] = ['laceration', 'burn', 'bruise', 'abrasion', 'bite', 'scab', 'scar', 'infection', 'rash', 'normal', 'unsure']
const strList = (x: unknown, max = 6): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, max) : [])

function contextText(c?: PhotoContext): string {
  if (!c) return 'No other data.'
  return [
    `Mission day ${c.missionDay}, ${c.location}. ${c.escalationMode === 'act_then_report' ? 'Earth is too far for real-time help: act onboard first.' : 'Flight surgeon reachable with short delay.'}`,
    `Latest vitals: temperature ${c.tempC ?? 'unknown'} °C, heart rate ${c.heartRate ?? 'unknown'} bpm, SpO2 ${c.spo2 ?? 'unknown'} %, BP ${c.bloodPressure ?? 'unknown'}.`,
    `Recent symptoms: ${c.symptoms.join(', ') || 'none reported'}.`,
    `Medical notes: ${c.medicalNotes.join(' ') || 'none'}.`,
    `Earlier photos: ${c.priorPhotos.join('; ') || 'none'}.`,
  ].join('\n')
}

const SKIN_SYSTEM =
  'You are an onboard medical decision-support assistant for astronauts. You give a FIRST LOOK, never a diagnosis. ' +
  'Be conservative: if unsure, say "unsure". Write short, plain-English steps a non-doctor can follow with a basic spacecraft medical kit. ' +
  STYLE_RULES +
  ' Reply with JSON only.'

async function aiSkinGuess(input: SkinPhotoInput, ai?: AIConfig): Promise<SkinGuess | null> {
  if (!resolveApiKey(ai) || !input.file) return null
  const data = await blobToBase64(input.file)
  if (!data) return null
  const st = input.imageStats
  const reply = await callGeminiJson<AiSkinReply>(
    [
      {
        text: [
          'Look at this skin photo from an astronaut and classify it as ONE of: laceration, burn, bruise, abrasion, bite, scab, scar, infection, rash, normal, unsure.',
          `Body location: ${input.bodyLocation}. Pain: ${input.painLevel ?? 'not given'}/5. Astronaut's notes: ${input.notes || 'none'}.`,
          st ? `Processed image data: brightness ${st.meanBrightness}/255, sharpness ${st.sharpness}, red pixels ${st.rednessPct ?? '?'}%, dark pixels ${st.darkPct ?? '?'}%, yellow pixels ${st.yellowPct ?? '?'}%.` : '',
          contextText(input.context),
          'Consider the vitals and history: e.g. a red, swollen wound plus fever suggests a spreading infection; a bite plus breathing trouble suggests anaphylaxis.',
          'Reply JSON: {"label":string,"confidence":0..1,"alternatives":[{"label":string,"confidence":number}],"findings":[short observations of the image],"summary":one sentence,"severity":"nominal"|"caution"|"critical","interimSteps":[up to 6 precise steps to do now, each with amounts, durations and frequency],"sosRecommended":boolean,"reason":why that severity}.',
          'Use "unsure" if the image is unclear or not skin. sosRecommended only for a possibly life- or limb-threatening situation.',
        ].filter(Boolean).join('\n'),
      },
      { inline_data: { mime_type: input.mimeType ?? input.file.type ?? 'image/jpeg', data } },
    ],
    ai,
    SKIN_SYSTEM,
  )
  if (!reply || !LABELS.includes(reply.label as SkinLabel) || typeof reply.confidence !== 'number') return null
  const sev = reply.severity === 'critical' || reply.severity === 'caution' || reply.severity === 'nominal' ? reply.severity : undefined
  return {
    label: reply.label as SkinLabel,
    confidence: Math.max(0, Math.min(1, reply.confidence)),
    alternatives: (reply.alternatives ?? []).filter((a) => LABELS.includes(a.label as SkinLabel) && typeof a.confidence === 'number').slice(0, 3).map((a) => ({ label: a.label as SkinLabel, confidence: a.confidence! })),
    engine: 'gemini',
    findings: strList(reply.findings),
    summary: typeof reply.summary === 'string' ? reply.summary.slice(0, 300) : undefined,
    severity: sev,
    interimSteps: strList(reply.interimSteps, 5),
    sos: reply.sosRecommended === true,
    reason: typeof reply.reason === 'string' ? reply.reason.slice(0, 300) : undefined,
  }
}

const ANAPHYLAXIS = /breath|wheez|throat|tongue|lip swell|face swell|swollen (face|lips|tongue)|dizz|faint|hives all over/i
const ORDER: Record<StatusLevel, number> = { nominal: 0, caution: 1, critical: 2 }
const raise = (a: StatusLevel, b: StatusLevel): StatusLevel => (ORDER[b] > ORDER[a] ? b : a)

/**
 * Context-aware severity (deterministic; health_rules.md "Photo check severity").
 * The result is never greener than the label's default or than Gemini's view.
 */
export function judgeSkinSeverity(
  label: SkinLabel,
  input: Pick<SkinPhotoInput, 'notes' | 'painLevel' | 'imageStats' | 'context' | 'bodyLocation'>,
  aiSeverity?: StatusLevel,
  aiSos = false,
): { status: StatusLevel; sos: boolean; reasons: string[] } {
  const notes = `${input.notes ?? ''} ${(input.context?.symptoms ?? []).join(' ')}`
  const c = input.context
  const reasons: string[] = []
  let status: StatusLevel = SKIN_GUIDANCE[label].status
  let sos = false
  const fever = (c?.tempC ?? 0) >= 38.5
  const warm = (c?.tempC ?? 0) >= 37.6
  const fastHr = (c?.heartRate ?? 0) > 110
  const lowO2 = (c?.spo2 ?? 100) < 92

  if ((input.painLevel ?? 0) >= 4) {
    status = raise(status, 'caution')
    reasons.push(`Pain ${input.painLevel}/5.`)
  }
  if (label === 'infection' || ((label === 'bite' || label === 'laceration' || label === 'abrasion' || label === 'scab') && /pus|red streak|spreading|swollen|hot to touch|warm/i.test(notes))) {
    if (fever || fastHr) {
      status = 'critical'
      sos = true
      reasons.push(`Possible spreading infection with ${fever ? `fever (${c?.tempC} °C)` : ''}${fever && fastHr ? ' and ' : ''}${fastHr ? `fast heart rate (${c?.heartRate} bpm)` : ''}: risk of sepsis.`)
    } else if (warm) {
      status = 'critical'
      reasons.push(`Possible infection with a raised temperature (${c?.tempC} °C).`)
    } else if (label === 'infection') reasons.push('Signs of infection, no fever yet.')
  }
  if ((label === 'bite' || label === 'rash') && (ANAPHYLAXIS.test(notes) || lowO2)) {
    status = 'critical'
    sos = true
    reasons.push(lowO2 ? `Skin reaction with low blood oxygen (${c?.spo2} %): possible allergic reaction affecting breathing.` : 'Skin reaction with breathing, throat or face-swelling symptoms: possible anaphylaxis.')
  }
  if (label === 'laceration' && /spurt|pulsing|won.?t stop|wont stop|over 10 min|deep|gaping|bone|tendon/i.test(notes)) {
    status = 'critical'
    if (/spurt|pulsing|won.?t stop|wont stop/i.test(notes)) {
      sos = true
      reasons.push('Bleeding that will not stop.')
    } else reasons.push('Deep or gaping cut.')
  }
  if (label === 'burn' && /blister|large|face|hand|white|leather|chest|airway|smoke|singed/i.test(notes)) {
    status = 'critical'
    reasons.push('Burn that is large, blistered, deep or on the face/hands.')
    if (/airway|smoke|singed|face/i.test(notes)) {
      sos = true
      reasons.push('Burn near the face or airway.')
    }
  }
  const prior = (c?.priorPhotos ?? []).filter((p) => p.toLowerCase().includes(input.bodyLocation.toLowerCase()))
  if (prior.length && label !== 'normal' && label !== 'scar' && label !== 'scab' && status !== 'critical' && /alert|watch/i.test(prior[0])) {
    status = raise(status, 'caution')
    reasons.push(`Same spot was already flagged earlier (${prior[0]}).`)
  }
  if (aiSeverity && ORDER[aiSeverity] > ORDER[status]) {
    status = aiSeverity
    reasons.push('The AI review judged this more serious than the rules.')
  }
  if (aiSos && status === 'critical') sos = true
  if (!reasons.length) reasons.push(`${SKIN_LABELS[label]}: ${status === 'nominal' ? 'routine care.' : 'needs onboard care and monitoring.'}`)
  return { status, sos, reasons }
}

/**
 * Analyze a skin photo. Never throws for bad input: a non-image or unclear photo comes back
 * as "unsure" and is still queued for the flight surgeon.
 */
export async function analyzeSkinPhoto(input: SkinPhotoInput, ai?: AIConfig): Promise<PhotoRecord> {
  const mime = input.mimeType ?? input.file?.type ?? ''
  const isImage = !input.file || mime.startsWith('image/') || /\.(png|jpe?g|webp|heic|gif|bmp)$/i.test(input.fileName ?? '')
  let guess: SkinGuess = isImage ? ((await aiSkinGuess(input, ai).catch(() => null)) ?? offlineSkinGuess(input)) : { label: 'unsure', confidence: 0, alternatives: [], engine: 'offline_mock' }
  const quality = qualityFrom(input.imageStats, input.file)
  if (quality.quality !== 'ok' && guess.label !== 'unsure') guess = { ...guess, confidence: Math.min(guess.confidence, 0.6) }
  if (guess.confidence < SKIN_CONFIDENCE_MIN) guess = { ...guess, label: 'unsure' }

  const g = SKIN_GUIDANCE[guess.label]
  const judged = judgeSkinSeverity(guess.label, input, guess.engine === 'gemini' ? guess.severity : undefined, guess.sos)
  const status: StatusLevel = judged.status
  if (guess.reason && guess.engine === 'gemini') judged.reasons.push(`AI review: ${guess.reason}`)
  const findings = [...(guess.findings ?? []), ...describeImageStats(input.imageStats)].slice(0, 8)
  const interim = (guess.interimSteps?.length ? guess.interimSteps : g.firstAid).slice(0, 6)

  const day = Math.floor(input.day)
  const record: PhotoRecord = {
    id: newId('pho'),
    astronautId: input.astronautId,
    mode: 'skin',
    missionDay: day,
    timestamp: missionTimestamp(input.day),
    phaseName: phaseNameFor(input.astronautId, day),
    bodyLocation: input.bodyLocation,
    ...(input.fileName ? { fileName: input.fileName } : {}),
    ...(clampThumb(input.thumbnailDataUrl) ? { thumbnailDataUrl: clampThumb(input.thumbnailDataUrl) } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.painLevel ? { painLevel: input.painLevel } : {}),
    aiLabel: guess.label,
    aiConfidence: guess.confidence,
    alternatives: guess.alternatives,
    status,
    firstAid: g.firstAid,
    escalateWhen: g.escalateWhen,
    ...(quality.quality !== 'ok' ? { quality: quality.quality, qualityMessage: quality.message } : {}),
    reviewStatus: 'pending',
    engine: guess.engine,
    findings,
    severityReasons: judged.reasons,
    aiSummary: guess.summary ?? `${SKIN_LABELS[guess.label]}${guess.label === 'unsure' ? '' : ` (${Math.round(guess.confidence * 100)}% sure)`} on the ${input.bodyLocation}.`,
    interimSteps: interim,
    sosRecommended: judged.sos,
    ...(input.imageStats ? { imageStats: input.imageStats } : {}),
  }
  store.update((xs) => [...xs, record])
  enqueue({
    astronautId: input.astronautId,
    type: 'photo',
    title: `Skin photo - ${input.bodyLocation}`,
    summary: guess.label === 'unsure' ? 'Unsure - needs flight-surgeon review' : `${SKIN_LABELS[guess.label]} (${Math.round(guess.confidence * 100)}%)`,
    missionDay: day,
    priority: guess.label === 'unsure' || status === 'critical' ? 'high' : 'normal',
    refId: record.id,
  })
  return record
}

/** Result-card text for a skin record (pages doc §4 result card). */
export function skinResultCard(r: PhotoRecord): { likelyType: string; confidenceText: string; otherPossibilities: string; groundReview: string; disclaimer: string } {
  const unsure = r.aiLabel === 'unsure'
  return {
    likelyType: unsure ? 'Unsure' : SKIN_LABELS[r.aiLabel ?? 'unsure'],
    confidenceText: unsure ? 'Unsure. Sent to the flight surgeon for review.' : `${Math.round((r.aiConfidence ?? 0) * 100)}%`,
    otherPossibilities: (r.alternatives ?? []).map((a) => `${SKIN_LABELS[a.label]} ${Math.round(a.confidence * 100)}%`).join(', ') || '-',
    groundReview: r.reviewStatus === 'reviewed' ? `Reviewed: ${r.reviewNotes ?? 'see inbox'}` : 'Added to sync queue. Flight surgeon review pending.',
    disclaimer: FIRST_LOOK_DISCLAIMER,
  }
}

// ── Ultrasound guided capture ──────────────────────────────────────────────

/** Save a guided ultrasound capture: quality check + auto-tag + review queue. No AI diagnosis. */
export function captureUltrasound(input: UltrasoundCaptureInput): PhotoRecord {
  const guide = ULTRASOUND_GUIDES[input.scanType]
  const quality = qualityFrom(input.imageStats, input.file)
  const day = Math.floor(input.day)
  const record: PhotoRecord = {
    id: newId('scn'),
    astronautId: input.astronautId,
    mode: 'ultrasound',
    missionDay: day,
    timestamp: missionTimestamp(input.day),
    phaseName: phaseNameFor(input.astronautId, day),
    bodyLocation: input.bodyLocation ?? guide.bodyLocation,
    ...(input.fileName ? { fileName: input.fileName } : {}),
    ...(clampThumb(input.thumbnailDataUrl) ? { thumbnailDataUrl: clampThumb(input.thumbnailDataUrl) } : {}),
    scanType: input.scanType,
    quality: quality.quality,
    qualityMessage: quality.message,
    reviewStatus: 'pending',
    engine: 'offline_mock',
  }
  // Only good images are kept and sent; a bad one comes back so the UI can say "try again".
  if (quality.quality !== 'ok') return record
  store.update((xs) => [...xs, record])
  enqueue({ astronautId: input.astronautId, type: 'scan', title: `${guide.label} scan`, summary: `${guide.label}, day ${day}`, missionDay: day, refId: record.id })
  return record
}

// ── History & compare ──────────────────────────────────────────────────────

/** Past photos and scans, newest first; reviews from the inbox are applied automatically. */
export function listPhotos(astronautId: string, mode?: PhotoRecord['mode']): PhotoRecord[] {
  const reviews = new Map(listInbox(astronautId).filter((m) => m.type === 'photo_review' && m.refId).map((m) => [m.refId!, m.body]))
  return store
    .get()
    .filter((r) => r.astronautId === astronautId && (!mode || r.mode === mode))
    .map((r) => (reviews.has(r.id) ? { ...r, reviewStatus: 'reviewed' as const, reviewNotes: reviews.get(r.id) } : r))
    .sort((a, b) => b.missionDay - a.missionDay || b.id.localeCompare(a.id))
}

const SEVERITY: Record<SkinLabel, number> = { normal: 0, scar: 0, scab: 1, bruise: 1, rash: 2, bite: 2, abrasion: 2, laceration: 3, burn: 3, infection: 4, unsure: -1 }

/** Compare two photos of the same spot to see if a wound is healing. */
export function comparePhotos(idA: string, idB: string): PhotoComparison | null {
  const all = store.get()
  const a = all.find((r) => r.id === idA)
  const b = all.find((r) => r.id === idB)
  if (!a || !b) return null
  const [before, after] = a.missionDay <= b.missionDay ? [a, b] : [b, a]
  const sameLocation = before.bodyLocation.toLowerCase() === after.bodyLocation.toLowerCase()
  const sb = SEVERITY[before.aiLabel ?? 'unsure']
  const sa = SEVERITY[after.aiLabel ?? 'unsure']
  const trend: PhotoComparison['trend'] = sb < 0 || sa < 0 ? 'unknown' : sa < sb ? 'healing' : sa > sb ? 'worse' : 'unchanged'
  const daysApart = after.missionDay - before.missionDay
  const note = !sameLocation
    ? 'These photos are of different body locations.'
    : trend === 'healing'
      ? `Looks better after ${daysApart} days (${SKIN_LABELS[before.aiLabel!]} → ${SKIN_LABELS[after.aiLabel!]}).`
      : trend === 'worse'
        ? `Looks worse after ${daysApart} days - tell the crew medical officer.`
        : trend === 'unchanged'
          ? `No clear change after ${daysApart} days. Keep it clean and re-check.`
          : 'Can’t compare automatically - the flight surgeon will review both.'
  return { sameLocation, daysApart, before, after, trend, note }
}

export function resetPhotos(): void {
  store.reset()
}
