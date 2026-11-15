/**
 * Gemini client shared by every AI feature (briefing, image diagnosis, file extraction,
 * emergency second opinion).
 *
 * - The browser never holds the key: calls go to the local Python server
 *   (server/app.py → POST /api/ai/json), which adds GEMINI_API_KEY and talks to Google.
 * - Never throws: resolves null when offline, the server is not running, the key is
 *   missing, Gemini is busy, or the reply is malformed. Every caller has a
 *   deterministic offline fallback, so the app keeps working with no Earth link.
 */

import type { AIConfig } from '@/types/astronaut'

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'

function env(name: string): string | undefined {
  try {
    return (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name]
  } catch {
    return undefined
  }
}

/** Base URL of the Python server ('' = same origin, proxied by Vite). */
export function apiBase(): string {
  return (env('VITE_API_BASE') ?? '').replace(/\/$/, '')
}

/** AI is attempted unless forceOffline is set. (Kept under its old name for callers.) */
export function resolveApiKey(ai?: AIConfig): string | undefined {
  return ai?.forceOffline ? undefined : 'server'
}

export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } }

export interface AiCallInfo {
  ok: boolean
  model?: string
  error?: string
}

let lastCall: AiCallInfo = { ok: false, error: 'not_called' }
/** Result of the most recent AI call (for "Written by Gemini / offline rules" labels). */
export function lastAiCall(): AiCallInfo {
  return lastCall
}

/** POST JSON to the Python server. Resolves null on any failure. */
export async function postServer<T>(path: string, body: unknown, timeoutMs = 30_000): Promise<T | null> {
  if (typeof fetch === 'undefined') return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Never show the model or vendor name to the crew: the assistant is "AstraHealth". */
const NAME_RE = /\b(google\s+)?gemini(\s+(flash|pro|lite|ai|model))*\b|\bgoogle(\s+ai)?\b/gi
export function scrubModelNames<T>(v: T): T {
  if (typeof v === 'string') return v.replace(NAME_RE, 'AstraHealth AI') as T
  if (Array.isArray(v)) return v.map(scrubModelNames) as T
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrubModelNames(x)])) as T
  return v
}

/** Shared instruction added to every prompt. */
export const STYLE_RULES =
  'Never mention Gemini, Google or any AI model or company; you are "AstraHealth". ' +
  'Every care step must be precise and measurable: say how much, how long, how often and with what, e.g. ' +
  '"Rinse with 100-200 mL sterile saline from a 20 mL syringe for 30 seconds", "Press firmly with a 10 x 10 cm gauze pad for 10 full minutes", ' +
  '"Apply a pea-sized amount (about 0.5 g) of antibiotic ointment once a day", "Ibuprofen 400 mg by mouth every 6-8 h with food, max 1,200 mg in 24 h, if no allergy", ' +
  '"Re-check temperature every 4 h". Use items from a spacecraft medical kit (sterile saline, gauze 10 x 10 cm, wound-closure strips, transparent film dressing, ' +
  'antibiotic ointment, hydrocortisone 1% cream, cold pack, ibuprofen 200 mg tablets, paracetamol 500 mg tablets, cetirizine 10 mg, epinephrine 0.3 mg auto-injector, oxygen mask). ' +
  'Add "check allergies first" before any medicine.'

/** Like callGeminiJson, but also says which model answered or why it failed (safe with parallel calls). */
export async function callGeminiJsonInfo<T = unknown>(parts: GeminiPart[], ai?: AIConfig, system?: string): Promise<{ json: T | null; info: AiCallInfo }> {
  let info: AiCallInfo
  let json: T | null = null
  if (!resolveApiKey(ai)) info = { ok: false, error: 'offline_mode' }
  else {
    const reply = await postServer<{ ok: boolean; model?: string; json?: T; error?: string }>(
      '/api/ai/json',
      { parts, system, temperature: 0.2 },
      ai?.timeoutMs ?? 45_000,
    )
    if (!reply) info = { ok: false, error: 'server_unreachable' }
    else {
      info = { ok: reply.ok, model: reply.model, error: reply.error }
      json = reply.ok && reply.json !== undefined && reply.json !== null ? scrubModelNames(reply.json) : null
    }
  }
  lastCall = info
  return { json, info }
}

/** Call Gemini (via the server) and get parsed JSON back. Null when offline / on any failure. */
export async function callGeminiJson<T = unknown>(parts: GeminiPart[], ai?: AIConfig, system?: string): Promise<T | null> {
  return (await callGeminiJsonInfo<T>(parts, ai, system)).json
}

/** Base64-encode a Blob for inline_data (≤ maxBytes; larger files are not sent). */
export async function blobToBase64(blob: Blob, maxBytes = 4 * 1024 * 1024): Promise<string | null> {
  if (blob.size > maxBytes) return null
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(bin)
}
