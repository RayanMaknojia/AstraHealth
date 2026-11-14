/**
 * Minimal Gemini Flash client shared by ingestionEngine and briefingEngine.
 *
 * - Runs only when an API key is available (AIConfig.apiKey or VITE_GEMINI_API_KEY)
 *   and forceOffline is not set. Every caller has a deterministic offline fallback,
 *   so the app keeps working with no Earth link.
 * - Never throws: resolves null on any error, timeout or malformed reply.
 *
 * Note: a key in a Vite env var ships to the browser. Fine for a hackathon demo;
 * use a server-side proxy for anything real.
 */

import type { AIConfig } from '@/types/astronaut'

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

function envKey(): string | undefined {
  try {
    return (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_GEMINI_API_KEY
  } catch {
    return undefined
  }
}

export function resolveApiKey(ai?: AIConfig): string | undefined {
  if (ai?.forceOffline) return undefined
  const key = ai?.apiKey ?? envKey()
  return key && key.trim() ? key.trim() : undefined
}

export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } }

/** Call Gemini and parse a JSON reply. Returns null when offline / on any failure. */
export async function callGeminiJson<T = unknown>(parts: GeminiPart[], ai?: AIConfig): Promise<T | null> {
  const key = resolveApiKey(ai)
  if (!key || typeof fetch === 'undefined') return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ai?.timeoutMs ?? 12_000)
  try {
    const res = await fetch(`${ENDPOINT}/${ai?.model ?? DEFAULT_GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (!text) return null
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
    return JSON.parse(cleaned) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
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
