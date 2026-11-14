/**
 * Photo Check (pages doc §4).
 *
 * Tab 1 — Skin photo, AI FIRST LOOK ONLY (not a diagnosis):
 *   classes cut/laceration, burn, bruise, abrasion, normal skin, plus "unsure".
 *   Confidence < 70% → "Unsure. Sent to the flight surgeon for review." — never guess.
 *   Gemini (image) when a key is set; otherwise an offline stand-in that reads the
 *   file name and the astronaut's notes. A real onboard image model (TensorFlow.js /
 *   ONNX) would replace the offline stand-in.
 * Tab 2 — Ultrasound, guided capture with NO AI diagnosis: step-by-step guide,
 *   pixel-based quality check (too dark / too bright / blurry), auto-tagging.
 * Every photo and scan is queued for flight-surgeon review via syncService;
 * reviews coming back in the inbox mark the record "reviewed".
 */

import { SKIN_CONFIDENCE_MIN, SKIN_GUIDANCE, SKIN_KEYWORDS, SKIN_LABELS, IMAGE_QUALITY as Q, ULTRASOUND_GUIDES } from '@/data/phase3Data'
import { CREW_PROFILES, phaseForDay } from '@/data/nasaSpaceflightData'
import { blobToBase64, callGeminiJson, resolveApiKey } from '@/services/_gemini'
import { createStore, missionTimestamp, newId } from '@/services/_store'
import { enqueue, listInbox } from '@/services/syncService'
import type {
  AIConfig,
  ImageStats,
  PhotoComparison,
  PhotoRecord,
  ScanQuality,
  SkinLabel,
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
  for (let i = 0; i < width * height; i++) {
    const y = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
    lum[i] = y
    sum += y
  }
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
  return { width, height, meanBrightness: Math.round(meanBrightness), sharpness: Math.round(sharpness) }
}

function qualityFrom(stats: ImageStats | undefined, file?: Blob): { quality: ScanQuality; message: string } {
  if (stats) {
    if (stats.meanBrightness < Q.minBrightness) return { quality: 'too_dark', message: 'Too dark — add light or increase gain, then try again.' }
    if (stats.meanBrightness > Q.maxBrightness) return { quality: 'too_bright', message: 'Too bright / washed out — lower the gain, then try again.' }
    if (stats.sharpness < Q.minSharpness) return { quality: 'blurry', message: 'Blurry — hold the probe/camera still and try again.' }
    return { quality: 'ok', message: 'Image saved.' }
  }
  if (file && file.size < Q.minBytes) return { quality: 'unreadable', message: 'The image file looks empty or too small — capture again.' }
  return { quality: 'ok', message: 'Image saved (quality not measured — pass imageStats for a real check).' }
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
}

function offlineSkinGuess(input: SkinPhotoInput): SkinGuess {
  const text = `${input.fileName ?? ''} ${input.notes ?? ''}`.toLowerCase().replace(/[_\-.]+/g, ' ')
  const scores = (Object.keys(SKIN_KEYWORDS) as Exclude<SkinLabel, 'unsure'>[])
    .map((label) => ({ label, hits: SKIN_KEYWORDS[label].filter((k) => text.includes(k)).length }))
    .sort((a, b) => b.hits - a.hits)
  const top = scores[0]
  if (!top || top.hits === 0)
    return { label: 'unsure', confidence: 0.45, alternatives: scores.slice(0, 2).map((s) => ({ label: s.label, confidence: 0.15 })), engine: 'offline_mock' }
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
}

const LABELS: SkinLabel[] = ['laceration', 'burn', 'bruise', 'abrasion', 'normal', 'unsure']

async function aiSkinGuess(input: SkinPhotoInput, ai?: AIConfig): Promise<SkinGuess | null> {
  if (!resolveApiKey(ai) || !input.file) return null
  const data = await blobToBase64(input.file)
  if (!data) return null
  const reply = await callGeminiJson<AiSkinReply>(
    [
      { text: `First-look skin injury triage for an astronaut (NOT a diagnosis). Classify the photo as one of: laceration, burn, bruise, abrasion, normal, unsure. Body location: ${input.bodyLocation}. Notes: ${input.notes ?? 'none'}. Reply JSON only: {"label":s,"confidence":0..1,"alternatives":[{"label":s,"confidence":n}]}. Use "unsure" if the image is unclear or not skin.` },
      { inline_data: { mime_type: input.mimeType ?? input.file.type ?? 'image/jpeg', data } },
    ],
    ai,
  )
  if (!reply || !LABELS.includes(reply.label as SkinLabel) || typeof reply.confidence !== 'number') return null
  return {
    label: reply.label as SkinLabel,
    confidence: Math.max(0, Math.min(1, reply.confidence)),
    alternatives: (reply.alternatives ?? []).filter((a) => LABELS.includes(a.label as SkinLabel) && typeof a.confidence === 'number').slice(0, 3).map((a) => ({ label: a.label as SkinLabel, confidence: a.confidence! })),
    engine: 'gemini',
  }
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
  let status: StatusLevel = g.status
  if ((input.painLevel ?? 0) >= 4 && status === 'nominal') status = 'caution'
  if (guess.label === 'burn' && /blister|large|face|hand|white|leather/i.test(input.notes ?? '')) status = 'critical'

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
  }
  store.update((xs) => [...xs, record])
  enqueue({
    astronautId: input.astronautId,
    type: 'photo',
    title: `Skin photo — ${input.bodyLocation}`,
    summary: guess.label === 'unsure' ? 'Unsure — needs flight-surgeon review' : `${SKIN_LABELS[guess.label]} (${Math.round(guess.confidence * 100)}%)`,
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
    otherPossibilities: (r.alternatives ?? []).map((a) => `${SKIN_LABELS[a.label]} ${Math.round(a.confidence * 100)}%`).join(', ') || '—',
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

const SEVERITY: Record<SkinLabel, number> = { normal: 0, bruise: 1, abrasion: 2, laceration: 3, burn: 3, unsure: -1 }

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
        ? `Looks worse after ${daysApart} days — tell the crew medical officer.`
        : trend === 'unchanged'
          ? `No clear change after ${daysApart} days. Keep it clean and re-check.`
          : 'Can’t compare automatically — the flight surgeon will review both.'
  return { sameLocation, daysApart, before, after, trend, note }
}

export function resetPhotos(): void {
  store.reset()
}
