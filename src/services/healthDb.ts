/**
 * Health database (IndexedDB, in the browser; works fully offline, survives reloads).
 *
 * Tables
 *   readings   every vital reading from every source (seed, wearable, check-in, file, body scan)
 *   scans      body-scan results (incl. extras such as respiratory rate / HRV)
 *   briefings  AI (or offline-rules) medical briefings, newest last
 *   photos     skin / ultrasound assessments (copy of photoCheckService records)
 *   uploads    accepted / rejected file and text inputs
 *   sos        SOS events with recipients
 *   meta       seed flags
 *
 * The first time an astronaut opens the app, 21 days of simulated history are written
 * (SEED_HISTORY_DAYS), each reading tagged with its colour (docs/health_rules.md).
 * After that, every new reading is APPENDED; the profile on screen is rebuilt from here.
 * Falls back to an in-memory store when IndexedDB is unavailable (tests / private mode).
 */

import { SEED_HISTORY_DAYS } from '@/data/nasaSpaceflightData'
import {
  evaluateBloodPressure,
  evaluateBloodSugar,
  evaluateBodyTemp,
  evaluateBoneDensity,
  evaluateHeartRate,
  evaluateMood,
  evaluateRadiation,
  evaluateSleep,
  evaluateSpO2,
  getSpaceAdjustments,
  MAX_HISTORY_POINTS,
} from '@/services/healthEvaluator'
import { getMissionState } from '@/services/missionTimeline'
import { newId } from '@/services/_store'
import type {
  AiBriefing,
  AstronautProfile,
  DbReading,
  IndicatorId,
  IndicatorUpdate,
  IngestedArtifact,
  PhotoRecord,
  ScanResult,
  SosEvent,
  StatusLevel,
} from '@/types/astronaut'

const DB_NAME = 'space-medic'
const DB_VERSION = 1
/** Bump to re-seed (v2: blood sugar weekly only). Old seeded rows are replaced. */
const SEED_VERSION = 'v2'
export const TABLES = ['readings', 'scans', 'briefings', 'photos', 'uploads', 'sos', 'meta'] as const
export type Table = (typeof TABLES)[number]

type Row = { id: string; astronautId?: string } & Record<string, unknown>

// ── Low-level storage (IndexedDB or memory) ────────────────────────────────

const memory = new Map<Table, Map<string, Row>>(TABLES.map((t) => [t, new Map()]))
let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        for (const t of TABLES) {
          if (db.objectStoreNames.contains(t)) continue
          const store = db.createObjectStore(t, { keyPath: 'id' })
          if (t !== 'meta') store.createIndex('astronautId', 'astronautId', { unique: false })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function putRows(table: Table, rows: Row[]): Promise<void> {
  if (!rows.length) return
  const db = await openDb()
  if (!db) {
    const m = memory.get(table)!
    for (const r of rows) m.set(r.id, structuredClone(r))
    return
  }
  const tx = db.transaction(table, 'readwrite')
  const store = tx.objectStore(table)
  for (const r of rows) store.put(r)
  await done(tx)
}

export async function listRows<T = Row>(table: Table, astronautId?: string): Promise<T[]> {
  const db = await openDb()
  if (!db) {
    const all = [...memory.get(table)!.values()]
    return structuredClone(astronautId ? all.filter((r) => r.astronautId === astronautId) : all) as T[]
  }
  return new Promise((resolve) => {
    const tx = db.transaction(table, 'readonly')
    const store = tx.objectStore(table)
    const req = astronautId && table !== 'meta' ? store.index('astronautId').getAll(astronautId) : store.getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => resolve([])
  })
}

async function deleteRows(table: Table, ids: string[]): Promise<void> {
  if (!ids.length) return
  const db = await openDb()
  if (!db) {
    const m = memory.get(table)!
    for (const id of ids) m.delete(id)
    return
  }
  const tx = db.transaction(table, 'readwrite')
  const store = tx.objectStore(table)
  for (const id of ids) store.delete(id)
  await done(tx)
}

async function getRow<T = Row>(table: Table, id: string): Promise<T | null> {
  const db = await openDb()
  if (!db) return (structuredClone(memory.get(table)!.get(id)) as T) ?? null
  return new Promise((resolve) => {
    const req = db.transaction(table, 'readonly').objectStore(table).get(id)
    req.onsuccess = () => resolve((req.result as T) ?? null)
    req.onerror = () => resolve(null)
  })
}

/** Delete everything (Admin "reset demo"). The next login re-seeds. */
export async function resetDatabase(): Promise<void> {
  for (const m of memory.values()) m.clear()
  const db = await openDb()
  if (!db) return
  const tx = db.transaction([...TABLES], 'readwrite')
  for (const t of TABLES) tx.objectStore(t).clear()
  await done(tx)
}

/** Whether data persists across reloads (false = in-memory fallback). */
export async function isPersistent(): Promise<boolean> {
  return (await openDb()) !== null
}

// ── Colour of a single reading (docs/health_rules.md) ───────────────────────────

const numeric = (v: number | string): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const m = /^\s*(\d+(?:\.\d+)?)/.exec(v)
  return m ? Number(m[1]) : null
}

function parseBp(v: number | string, diastolic?: number): [number, number] | null {
  if (typeof v === 'string') {
    const m = /(\d+)\s*\/\s*(\d+)/.exec(v)
    if (m) return [Number(m[1]), Number(m[2])]
  }
  const sys = numeric(v)
  return sys !== null && diastolic !== undefined ? [sys, diastolic] : null
}

/**
 * Status for one reading on a given mission day. `previous` = earlier daily values of the
 * same indicator (for the 3-in-a-row sleep / mood rules).
 */
export function classifyReading(profile: AstronautProfile, id: IndicatorId, value: number | string, day: number, previous: number[] = [], diastolic?: number): StatusLevel {
  const state = getMissionState(profile.mission, Math.max(0, Math.floor(day)))
  const adj = getSpaceAdjustments(state)
  const n = numeric(value)
  try {
    switch (id) {
      case 'heart_rate':
        return n === null ? 'nominal' : evaluateHeartRate(n).status
      case 'blood_pressure': {
        const bp = parseBp(value, diastolic)
        return bp ? evaluateBloodPressure(bp[0], bp[1], adj).status : 'nominal'
      }
      case 'blood_sugar':
        return n === null ? 'nominal' : evaluateBloodSugar(n, false).status
      case 'body_temp':
        return n === null ? 'nominal' : evaluateBodyTemp(n, adj).status
      case 'spo2':
        return n === null ? 'nominal' : evaluateSpO2(n, state.environment.cabinPsia).status
      case 'sleep_hours':
        return n === null ? 'nominal' : evaluateSleep(n, adj, [...previous.slice(-2), n]).status
      case 'mood':
        return n === null ? 'nominal' : evaluateMood(n, [...previous.slice(-2), n]).status
      case 'radiation_dose':
        return n === null ? 'nominal' : evaluateRadiation(undefined, n, { environment: state.phase.environment, priorCareerDoseMSv: profile.priorCareerDoseMSv }).status
      case 'bone_density':
        return n === null ? 'nominal' : evaluateBoneDensity(n).status
    }
  } catch {
    /* fall through */
  }
  return 'nominal'
}

// ── Readings ───────────────────────────────────────────────────────────────

function toReading(profile: AstronautProfile, u: IndicatorUpdate, status: StatusLevel, seeded = false, diastolic?: number): DbReading | null {
  const bp = u.id === 'blood_pressure' ? parseBp(u.value, diastolic) : null
  const n = bp ? bp[0] : numeric(u.value)
  if (n === null) return null
  return {
    id: newId('rd'),
    astronautId: profile.id,
    indicatorId: u.id,
    value: bp ? `${Math.round(bp[0])}/${Math.round(bp[1])}` : u.value,
    numeric: n,
    ...(bp ? { diastolic: bp[1] } : {}),
    unit: u.unit,
    source: u.source,
    day: u.day,
    timestamp: u.timestamp,
    status,
    ...(seeded ? { seeded: true } : {}),
  }
}

/**
 * Append new readings. Pass the profile AFTER applyIndicatorUpdates so each reading is
 * stored with the colour the app showed for it.
 */
export async function recordUpdates(profileAfter: AstronautProfile, updates: IndicatorUpdate[]): Promise<number> {
  const status = new Map(profileAfter.indicators.map((i) => [i.id, i.status]))
  const rows = updates
    .map((u) => toReading(profileAfter, u, status.get(u.id) ?? classifyReading(profileAfter, u.id, u.value, u.day)))
    .filter((r): r is DbReading => r !== null)
  await putRows('readings', rows as unknown as Row[])
  return rows.length
}

export async function getReadings(astronautId: string, fromDay = -Infinity, toDay = Infinity): Promise<DbReading[]> {
  const all = await listRows<DbReading>('readings', astronautId)
  return all.filter((r) => r.day >= fromDay && r.day <= toDay).sort((a, b) => a.day - b.day || a.id.localeCompare(b.id))
}

// ── Seeding (21 days of simulated history, first run only) ─────────────────

/** Population-typical healthy values for astronauts with no generated history. */
const GENERIC: Record<IndicatorId, { base: number; noise: number; dp: number; unit: string }> = {
  heart_rate: { base: 66, noise: 4, dp: 0, unit: 'bpm' },
  blood_pressure: { base: 114, noise: 5, dp: 0, unit: 'mmHg' },
  blood_sugar: { base: 94, noise: 6, dp: 0, unit: 'mg/dL' },
  body_temp: { base: 36.9, noise: 0.2, dp: 1, unit: '°C' },
  spo2: { base: 97, noise: 0.8, dp: 0, unit: '%' },
  sleep_hours: { base: 7.2, noise: 0.6, dp: 1, unit: 'h' },
  mood: { base: 4.2, noise: 0.5, dp: 0, unit: '/5' },
  radiation_dose: { base: 0, noise: 0, dp: 2, unit: 'mSv' },
  bone_density: { base: 0, noise: 0, dp: 2, unit: '%' },
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function genericHistory(profile: AstronautProfile, id: IndicatorId): { day: number; value: number | string; diastolic?: number }[] {
  const g = GENERIC[id]
  let x = hash(profile.id + id) || 1
  const rand = () => ((x = Math.imul(x ^ (x >>> 15), 2246822507) ^ Math.imul(x ^ (x >>> 13), 3266489909)), ((x >>> 0) % 10000) / 10000)
  const out: { day: number; value: number | string; diastolic?: number }[] = []
  const start = Math.max(1, profile.missionDay - SEED_HISTORY_DAYS + 1)
  const f = 10 ** g.dp
  for (let d = start; d <= Math.max(start, profile.missionDay); d++) {
    if (id === 'radiation_dose') {
      out.push({ day: d, value: Math.round(getMissionState(profile.mission, d).exposure.totalRadiationMSv * 100) / 100 })
      continue
    }
    if (id === 'bone_density') {
      out.push({ day: d, value: Math.round(-getMissionState(profile.mission, d).exposure.estBoneLossPct * 100) / 100 })
      continue
    }
    const v = Math.round((g.base + (rand() * 2 - 1) * g.noise) * f) / f
    if (id === 'blood_sugar' && (profile.missionDay - d) % 7 !== 0) continue // weekly fasting check-in
    if (id === 'blood_pressure') {
      const dia = Math.round(72 + (rand() * 2 - 1) * 4)
      out.push({ day: d, value: `${v}/${dia}`, diastolic: dia })
    } else out.push({ day: d, value: id === 'mood' ? Math.min(5, Math.max(1, v)) : v })
  }
  return out
}

/**
 * Write 21 days of history for this astronaut once per device (and once per seed version).
 * Uses the profile's own generated series (demo crew stories), or healthy population
 * values for admin-created crew. Returns the number of readings written (0 if already seeded).
 */
export async function ensureSeeded(profile: AstronautProfile): Promise<number> {
  const key = `seeded:${SEED_VERSION}:${profile.id}`
  if (await getRow('meta', key)) return 0
  // Upgrading from an older seed: drop its generated rows (and blood sugar that a body
  // scan used to produce); real check-ins, uploads and wearable readings stay.
  const old = await listRows<DbReading>('readings', profile.id)
  await deleteRows(
    'readings',
    old.filter((r) => r.seeded || (r.indicatorId === 'blood_sugar' && r.source === 'body_scan')).map((r) => r.id),
  )
  const rows: DbReading[] = []
  const firstDay = Math.max(1, profile.missionDay - SEED_HISTORY_DAYS + 1)
  for (const ind of profile.indicators) {
    const pts: { day: number; value: number | string; diastolic?: number; source: DbReading['source'] }[] = ind.history.length
      ? ind.history
          .filter((h) => h.day >= firstDay && h.day <= profile.missionDay)
          .map((h) => ({ day: h.day, value: ind.id === 'blood_pressure' && h.diastolic !== undefined ? `${Math.round(h.value)}/${h.diastolic}` : h.value, diastolic: h.diastolic, source: h.source }))
      : genericHistory(profile, ind.id).map((h) => ({ ...h, source: 'wearable_auto' as const }))
    const previous: number[] = []
    for (const pt of pts) {
      const status = classifyReading(profile, ind.id, pt.value, pt.day, previous, pt.diastolic)
      const r = toReading(profile, { id: ind.id, value: pt.value, unit: ind.unit, source: pt.source, day: pt.day, timestamp: `Day ${Math.floor(pt.day)}` }, status, true, pt.diastolic)
      if (r) rows.push(r)
      const n = numeric(pt.value)
      if (n !== null) previous.push(n)
    }
  }
  await putRows('readings', rows as unknown as Row[])
  await putRows('meta', [{ id: key, at: new Date().toISOString(), count: rows.length }])
  return rows.length
}

/**
 * Keep every reading from the last 2 days; older days become one daily average
 * (the database itself keeps every raw reading).
 */
export function compactReadings(rs: DbReading[], today: number): DbReading[] {
  const cutoff = Math.floor(today) - 2
  const recent = rs.filter((r) => Math.floor(r.day) > cutoff)
  const days = new Map<number, DbReading[]>()
  for (const r of rs) if (Math.floor(r.day) <= cutoff) days.set(Math.floor(r.day), [...(days.get(Math.floor(r.day)) ?? []), r])
  const daily = [...days.entries()].map(([d, xs]) => {
    if (xs.length === 1) return xs[0]
    const mean = (f: (r: DbReading) => number | undefined) => {
      const v = xs.map(f).filter((x): x is number => x !== undefined)
      return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : undefined
    }
    const last = xs[xs.length - 1]
    const num = mean((r) => r.numeric)!
    const dia = mean((r) => r.diastolic)
    const worst = xs.some((r) => r.status === 'critical') ? 'critical' : xs.some((r) => r.status === 'caution') ? 'caution' : 'nominal'
    return { ...last, day: d, timestamp: `Day ${d}`, numeric: num, value: dia !== undefined ? `${Math.round(num)}/${Math.round(dia)}` : num, ...(dia !== undefined ? { diastolic: dia } : {}), status: worst as StatusLevel }
  })
  return [...daily, ...recent].sort((a, b) => a.day - b.day)
}

/**
 * Rebuild the profile's indicators from the database (call once at login, after
 * ensureSeeded). Indicators with no stored readings keep what the profile had.
 */
export async function hydrateProfile(profile: AstronautProfile): Promise<AstronautProfile> {
  const readings = await getReadings(profile.id)
  if (!readings.length) return profile
  const byId = new Map<IndicatorId, DbReading[]>()
  for (const r of readings) byId.set(r.indicatorId, [...(byId.get(r.indicatorId) ?? []), r])
  const indicators = profile.indicators.map((ind) => {
    const rs = byId.get(ind.id)
    if (!rs?.length) return ind
    const kept = compactReadings(rs, profile.missionDay).slice(-MAX_HISTORY_POINTS)
    const baseline = profile.baseline.values[ind.id]?.mean
    const last = kept[kept.length - 1]
    return {
      ...ind,
      value: last.value,
      dataState: 'fresh' as const,
      lastMeasuredDay: last.day,
      history: kept.map((r) => ({
        timestamp: r.timestamp,
        value: r.numeric,
        baseline: baseline ?? ind.history.find((h) => Math.floor(h.day) === Math.floor(r.day))?.baseline ?? r.numeric,
        source: r.source,
        day: r.day,
        ...(r.diastolic !== undefined ? { diastolic: r.diastolic } : {}),
      })),
      simulated: ind.simulated || kept.some((r) => r.seeded || r.source === 'wearable_auto' || r.source === 'body_scan' || r.source === 'environment_feed'),
    }
  })
  const maxDay = Math.max(profile.missionDay, ...readings.map((r) => Math.floor(r.day)))
  return { ...profile, missionDay: maxDay, indicators }
}

/** Seed (if needed) then hydrate: the one call the app makes at login. */
export async function loadProfileFromDb(profile: AstronautProfile): Promise<AstronautProfile> {
  try {
    await ensureSeeded(profile)
    return await hydrateProfile(profile)
  } catch {
    return profile // never block login on storage problems
  }
}

// ── Other tables ───────────────────────────────────────────────────────────

const byTime = <T extends { createdAt?: string; day?: number }>(a: T, b: T) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || (a.day ?? 0) - (b.day ?? 0)

export async function saveScan(scan: ScanResult): Promise<void> {
  await putRows('scans', [scan as unknown as Row])
}
export async function listScans(astronautId: string): Promise<ScanResult[]> {
  return (await listRows<ScanResult>('scans', astronautId)).sort((a, b) => a.day - b.day)
}

export async function saveBriefing(b: AiBriefing): Promise<void> {
  await putRows('briefings', [b as unknown as Row])
}
export async function listBriefings(astronautId: string): Promise<AiBriefing[]> {
  return (await listRows<AiBriefing>('briefings', astronautId)).sort(byTime)
}
export async function latestBriefing(astronautId: string): Promise<AiBriefing | null> {
  return (await listBriefings(astronautId)).at(-1) ?? null
}

/** A photo assessment plus the photo itself (JPEG, longest side ≤ 1280 px). */
export type StoredPhoto = PhotoRecord & { image?: Blob; savedAt?: string }

export async function savePhoto(p: PhotoRecord, image?: Blob | null): Promise<void> {
  const row: StoredPhoto = { ...p, ...(image ? { image } : {}), savedAt: new Date().toISOString() }
  await putRows('photos', [row as unknown as Row])
}
export async function listPhotoRecords(astronautId: string): Promise<StoredPhoto[]> {
  return (await listRows<StoredPhoto>('photos', astronautId)).sort((a, b) => a.missionDay - b.missionDay || (a.savedAt ?? '').localeCompare(b.savedAt ?? ''))
}

export interface UploadRow {
  id: string
  astronautId: string
  createdAt: string
  day: number
  artifact: IngestedArtifact
  /** What the astronaut typed ("Something wrong?" box). */
  text?: string
  /** The attached file itself (≤ 10 MB), so it can be opened again later. */
  file?: Blob
  fileName?: string
  fileType?: string
}
export const MAX_STORED_FILE_BYTES = 10 * 1024 * 1024
export async function saveUpload(astronautId: string, day: number, artifact: IngestedArtifact, text?: string, file?: Blob | null, fileName?: string): Promise<void> {
  const keepFile = file && file.size <= MAX_STORED_FILE_BYTES
  const row: UploadRow = {
    id: artifact.id || newId('up'),
    astronautId,
    createdAt: new Date().toISOString(),
    day,
    artifact,
    ...(text ? { text: text.slice(0, 4000) } : {}),
    ...(keepFile ? { file, fileName: fileName ?? artifact.fileName, fileType: file.type || undefined } : file ? { fileName: fileName ?? artifact.fileName } : {}),
  }
  await putRows('uploads', [row as unknown as Row])
}
export async function listUploads(astronautId: string): Promise<UploadRow[]> {
  return (await listRows<UploadRow>('uploads', astronautId)).sort(byTime)
}

export async function saveSos(e: SosEvent): Promise<void> {
  await putRows('sos', [e as unknown as Row])
}
export async function listSos(astronautId?: string): Promise<SosEvent[]> {
  return (await listRows<SosEvent>('sos', astronautId)).sort(byTime)
}

/** Table sizes (Admin / debugging). */
export async function databaseStats(astronautId?: string): Promise<Record<Table, number>> {
  const out = {} as Record<Table, number>
  for (const t of TABLES) out[t] = (await listRows(t, t === 'meta' ? undefined : astronautId)).length
  return out
}
