/**
 * Home "Start scan": generate a fresh set of simulated KPI readings.
 *
 * 1. Ask the Python server (server/scan.py via POST /api/scan).
 * 2. If it is not running, use the browser fallback below (same algorithm), so the
 *    demo never breaks.
 * Readings continue the astronaut's own 7-day trend; ~12% of scans put one reading in
 * a Watch/Alert range (never life-threatening).
 */

import { postServer } from '@/services/_gemini'
import { newId } from '@/services/_store'
import type { AstronautProfile, IndicatorUpdate, ScanKpi, ScanResult } from '@/types/astronaut'

const KPIS: Record<ScanKpi, { noise: number; dp: number; lo: number; hi: number; def: number }> = {
  heart_rate: { noise: 3, dp: 0, lo: 35, hi: 190, def: 68 },
  body_temp: { noise: 0.12, dp: 1, lo: 34, hi: 41.5, def: 36.9 },
  spo2: { noise: 0.7, dp: 0, lo: 80, hi: 100, def: 97 },
  systolic: { noise: 4, dp: 0, lo: 70, hi: 200, def: 115 },
  diastolic: { noise: 3, dp: 0, lo: 40, hi: 120, def: 74 },
  blood_sugar: { noise: 6, dp: 0, lo: 50, hi: 260, def: 95 },
}

const ANOMALIES: Partial<Record<ScanKpi, { caution: [number, number]; critical: [number, number]; note: string }>> = {
  heart_rate: { caution: [104, 116], critical: [122, 130], note: 'Resting heart rate is high for this scan.' },
  body_temp: { caution: [38.0, 38.3], critical: [38.6, 38.9], note: 'Body temperature is raised (possible fever).' },
  spo2: { caution: [93, 94], critical: [88, 89], note: 'Blood oxygen is lower than usual.' },
  systolic: { caution: [134, 152], critical: [162, 170], note: 'Blood pressure is high for this scan.' },
  blood_sugar: { caution: [145, 172], critical: [186, 205], note: 'Blood sugar is high (not fasting).' },
}

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp

function slope(v: number[]): number {
  const n = v.length
  if (n < 3) return 0
  const mx = (n - 1) / 2
  const my = v.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  v.forEach((y, x) => {
    num += (x - mx) * (y - my)
    den += (x - mx) ** 2
  })
  return den ? num / den : 0
}

/** Daily means of the last 7 days per scan KPI (oldest → newest) + personal baselines. */
export function scanInputs(profile: AstronautProfile): { recent: Partial<Record<ScanKpi, number[]>>; baseline: Partial<Record<ScanKpi, number>> } {
  const recent: Partial<Record<ScanKpi, number[]>> = {}
  const daily = (id: string, pick: (h: { value: number; diastolic?: number }) => number | undefined) => {
    const ind = profile.indicators.find((i) => i.id === id)
    if (!ind) return []
    const today = Math.floor(profile.missionDay)
    const byDay = new Map<number, number[]>()
    for (const h of ind.history) {
      const d = Math.floor(h.day)
      const v = pick(h)
      if (d > today - 7 && d <= today && v !== undefined) byDay.set(d, [...(byDay.get(d) ?? []), v])
    }
    return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([, xs]) => xs.reduce((a, b) => a + b, 0) / xs.length)
  }
  recent.heart_rate = daily('heart_rate', (h) => h.value)
  recent.body_temp = daily('body_temp', (h) => h.value)
  recent.spo2 = daily('spo2', (h) => h.value)
  recent.systolic = daily('blood_pressure', (h) => h.value)
  recent.diastolic = daily('blood_pressure', (h) => h.diastolic)
  recent.blood_sugar = daily('blood_sugar', (h) => h.value)
  const b = profile.baseline.values
  const baseline: Partial<Record<ScanKpi, number>> = {
    heart_rate: b.heart_rate?.mean,
    body_temp: b.body_temp?.mean,
    spo2: b.spo2?.mean,
    systolic: b.blood_pressure?.mean,
    blood_sugar: b.blood_sugar?.mean,
  }
  return { recent, baseline }
}

/** Browser fallback, mirrors server/scan.py. */
export function generateScanLocally(
  recent: Partial<Record<ScanKpi, number[]>>,
  baseline: Partial<Record<ScanKpi, number>>,
  rand: () => number = Math.random,
  anomalyRate = 0.12,
): Pick<ScanResult, 'readings' | 'extras' | 'anomaly'> {
  const readings = {} as Record<ScanKpi, number>
  for (const [k, spec] of Object.entries(KPIS) as [ScanKpi, (typeof KPIS)[ScanKpi]][]) {
    const series = (recent[k] ?? []).filter(Number.isFinite).slice(-7)
    const base = baseline[k] ?? series[0] ?? spec.def
    const last3 = series.slice(-3)
    let v = series.length ? last3.reduce((a, b) => a + b, 0) / last3.length + 0.8 * 2 * slope(series) : base
    v += (rand() * 2 - 1) * spec.noise
    readings[k] = round(Math.min(spec.hi, Math.max(spec.lo, v)), spec.dp)
  }
  readings.diastolic = Math.min(readings.diastolic, readings.systolic - 25)
  let anomaly: ScanResult['anomaly'] = null
  if (rand() < anomalyRate) {
    const keys = Object.keys(ANOMALIES) as ScanKpi[]
    const kpi = keys[Math.floor(rand() * keys.length) % keys.length]
    const level = rand() < 0.25 ? 'critical' : 'caution'
    const [lo, hi] = ANOMALIES[kpi]![level]
    readings[kpi] = round(lo + rand() * (hi - lo), KPIS[kpi].dp)
    if (kpi === 'systolic') readings.diastolic = Math.round(Math.min(readings.systolic - 40, 84 + (readings.systolic - 134) * 0.4))
    anomaly = { kpi, level, note: ANOMALIES[kpi]!.note }
  }
  const hr = readings.heart_rate
  const extras = {
    respiratory_rate: Math.round(Math.min(24, Math.max(10, 12 + (hr - 60) * 0.08 + (rand() * 3 - 1.5)))),
    hrv_ms: Math.round(Math.min(110, Math.max(18, 75 - (hr - 60) * 0.9 + (rand() * 16 - 8)))),
  }
  return { readings, extras, anomaly }
}

function isValid(r: unknown): r is Pick<ScanResult, 'readings' | 'extras' | 'anomaly'> {
  const x = r as ScanResult | null
  return !!x && !!x.readings && (Object.keys(KPIS) as ScanKpi[]).every((k) => Number.isFinite(x.readings[k])) && !!x.extras
}

/** Run a body scan for the current mission day / onboard minute. Never throws. */
export async function runScan(profile: AstronautProfile, onboardMinute: number): Promise<ScanResult> {
  const { recent, baseline } = scanInputs(profile)
  const day = Math.floor(profile.missionDay)
  const reply = await postServer<{ ok: boolean } & Pick<ScanResult, 'readings' | 'extras' | 'anomaly'>>('/api/scan', { astronautId: profile.id, missionDay: day, recent, baseline }, 6000)
  const python = reply?.ok && isValid(reply)
  const gen = python ? reply! : generateScanLocally(recent, baseline)
  const minute = Math.max(0, Math.min(1439, Math.round(onboardMinute)))
  const hh = String(Math.floor(minute / 60)).padStart(2, '0')
  const mm = String(minute % 60).padStart(2, '0')
  const timestamp = `Day ${day} ${hh}:${mm} · body scan`
  const at = day + minute / 1440
  const r = gen.readings
  const up = (id: IndicatorUpdate['id'], value: number | string, unit: string): IndicatorUpdate => ({ astronautId: profile.id, id, value, unit, source: 'body_scan', timestamp, day: at })
  const updates: IndicatorUpdate[] = [
    up('heart_rate', r.heart_rate, 'bpm'),
    up('body_temp', r.body_temp, '°C'),
    up('spo2', r.spo2, '%'),
    up('blood_pressure', `${Math.round(r.systolic)}/${Math.round(r.diastolic)}`, 'mmHg'),
    up('blood_sugar', r.blood_sugar, 'mg/dL'),
  ]
  return {
    id: newId('scan'),
    astronautId: profile.id,
    day: at,
    timestamp,
    readings: r,
    extras: gen.extras,
    anomaly: gen.anomaly ?? null,
    generator: python ? 'python' : 'browser_fallback',
    updates,
  }
}
