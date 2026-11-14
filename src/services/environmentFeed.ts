/**
 * Environment Feed — cabin air and radiation, replayed by mission time.
 *
 *  - Cabin CO2 / temperature / humidity / pressure (OSDR Environmental Data
 *    App shape), evaluated against NASA-STD-3001 cabin limits.
 *  - Radiation dose-rate samples (RadLab shape) for the radiation_dose indicator.
 *  - Solar particle events (NASA DONKI SEP) → "Go to shelter" alert. Uses the
 *    live DONKI API only when a key is configured; otherwise simulated events,
 *    so the app runs with no Earth link.
 *
 * Values are SIMULATED replays shaped like the public datasets.
 */

import { CABIN_STANDARD_LIMITS as L, ENVIRONMENTS, mulberry32 } from '@/data/nasaSpaceflightData'
import type {
  CabinEvaluation,
  CabinParam,
  CabinReading,
  EnvironmentFeedConfig,
  EnvironmentFeedController,
  EnvironmentProfile,
  EnvironmentTick,
  EnvironmentTickListener,
  EnvironmentType,
  RadiationEvent,
  RadiationSample,
  StatusLevel,
} from '@/types/astronaut'

export const DONKI_SEP_URL = 'https://api.nasa.gov/DONKI/SEP'
export const DEFAULT_INTERVAL_MS = 15_000
export const DEFAULT_MISSION_MINUTES_PER_TICK = 15
const STREAM_START_MINUTE_OF_DAY = 8 * 60
/** Simulated solar particle events last this many mission hours. */
export const SOLAR_EVENT_DURATION_HOURS = 6

/**
 * Extra dose-rate during a strong SEP, mSv/h, by location. The ISS is partly
 * shielded by Earth's magnetic field; the Moon and deep space are not; Mars'
 * thin atmosphere roughly halves it. Order-of-magnitude demo values.
 */
const SEP_DOSE_RATE_MSV_PER_HOUR: Record<EnvironmentType, number> = {
  EARTH: 0,
  EARTH_ORBIT: 0.15,
  DEEP_SPACE: 3,
  MARS_ORBIT: 3,
  MARS_SURFACE: 1.2,
  MOON_SURFACE: 2.5,
}

/** Typical cabin conditions per environment (Moon/Mars habitats at 8.2 psia / 34% O2). */
function cabinBaseline(env: EnvironmentProfile) {
  return {
    module: env.id === 'EARTH_ORBIT' ? 'US Lab' : env.id === 'MOON_SURFACE' || env.id === 'MARS_SURFACE' ? 'Habitat' : 'Crew cabin',
    co2MmHg: env.id === 'EARTH' ? 0.3 : 2.1,
    tempC: 22.5,
    humidityPct: 45,
    cabinPsia: env.cabinPsia,
    o2Pct: env.cabinO2Pct,
  }
}

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp
const pad2 = (n: number) => String(n).padStart(2, '0')
const rank: Record<StatusLevel, number> = { nominal: 0, caution: 1, critical: 2 }

/** Inspired O2 partial pressure (mmHg) = (P_cabin − 47 mmHg water vapour) × FiO2. */
export function inspiredO2MmHg(cabinPsia: number, o2Pct: number): number {
  return round((cabinPsia * 51.715 - 47) * (o2Pct / 100), 1)
}

/** Check one cabin reading against cabin limits (CO2 ≤ 3 mmHg 1-h avg, temp/humidity band, pressure, ppO2). */
export function evaluateCabin(reading: CabinReading): CabinEvaluation {
  const params: CabinEvaluation['params'] = []
  const advisories: string[] = []
  const add = (param: CabinParam, value: number, status: StatusLevel, message: string) => params.push({ param, value, status, message })

  // CO2
  const co2 = reading.co2MmHg
  if (co2 > L.co2SymptomMmHg) {
    add('co2_mmhg', co2, 'critical', `CO2 ${co2} mmHg — above ${L.co2SymptomMmHg}: expect fatigue, poor sleep, nausea.`)
    advisories.push('Cabin: CO2 very high — check the CO2 scrubber, increase air flow, and stay out of dead-air corners.')
  } else if (co2 > L.co2AlertMmHg) {
    add('co2_mmhg', co2, 'critical', `CO2 ${co2} mmHg — over the ${L.co2AlertMmHg} mmHg 1-hour limit; headaches likely (2.8–4.5 mmHg).`)
    advisories.push('Cabin: CO2 over limit — headaches likely. Report to the crew and check scrubber status.')
  } else if (co2 >= L.co2WatchMmHg) {
    add('co2_mmhg', co2, 'caution', `CO2 ${co2} mmHg — above the ${L.co2WatchMmHg} mmHg long-term target (headache risk rises).`)
    advisories.push('Cabin: CO2 slightly high — keep fans clear; note any headache.')
  } else add('co2_mmhg', co2, 'nominal', `CO2 ${co2} mmHg — normal.`)

  // Temperature
  const t = reading.tempC
  if (t < L.tempLowC - 2 || t > L.tempHighC + 2) add('temp_c', t, 'critical', `Cabin ${t} °C — far outside ${L.tempLowC}–${L.tempHighC} °C.`)
  else if (t < L.tempLowC || t > L.tempHighC) add('temp_c', t, 'caution', `Cabin ${t} °C — outside the ${L.tempLowC}–${L.tempHighC} °C comfort band.`)
  else add('temp_c', t, 'nominal', `Cabin ${t} °C — comfortable.`)

  // Humidity
  const h = reading.humidityPct
  if (h < L.humidityLowPct - 10 || h > L.humidityHighPct + 10) add('humidity_pct', h, 'critical', `Humidity ${h}% — far outside ${L.humidityLowPct}–${L.humidityHighPct}%.`)
  else if (h < L.humidityLowPct || h > L.humidityHighPct) add('humidity_pct', h, 'caution', `Humidity ${h}% — outside ${L.humidityLowPct}–${L.humidityHighPct}%.`)
  else add('humidity_pct', h, 'nominal', `Humidity ${h}% — normal.`)

  // Pressure
  const p = reading.cabinPsia
  if (p < L.pressureLowPsia || p > L.pressureHighPsia) {
    add('cabin_psia', p, 'critical', `Cabin pressure ${p} psia — outside the allowed ${L.pressureLowPsia}–${L.pressureHighPsia} psia.`)
    advisories.push('Cabin: pressure out of limits — follow the leak / depress emergency procedure.')
  } else add('cabin_psia', p, 'nominal', `Cabin pressure ${p} psia — within limits.`)

  // Inspired oxygen
  const o2 = inspiredO2MmHg(reading.cabinPsia, reading.o2Pct)
  if (o2 < L.minInspiredO2MmHg) {
    add('ppo2_mmhg', o2, 'critical', `Inspired O2 ${o2} mmHg — below the ${L.minInspiredO2MmHg} mmHg minimum.`)
    advisories.push('Cabin: oxygen below minimum — put on emergency O2 masks and check life support.')
  } else if (o2 < L.o2WatchMmHg)
    add('ppo2_mmhg', o2, 'caution', `Inspired O2 ${o2} mmHg — close to the ${L.minInspiredO2MmHg} mmHg floor (normal for an 8.2 psia habitat; watch SpO2).`)
  else add('ppo2_mmhg', o2, 'nominal', `Inspired O2 ${o2} mmHg — normal.`)

  const status = params.reduce<StatusLevel>((w, x) => (rank[x.status] > rank[w] ? x.status : w), 'nominal')
  return { status, params, advisories }
}

function solarEvent(day: number, envId: EnvironmentType, minuteOfDay: number, source: RadiationEvent['source'] = 'simulated'): RadiationEvent {
  const rate = SEP_DOSE_RATE_MSV_PER_HOUR[envId]
  const total = round(rate * SOLAR_EVENT_DURATION_HOURS, 1)
  return {
    id: `sep-${source}-${day.toFixed(3)}`,
    type: 'SEP',
    startTime: `Day ${Math.floor(day)} ${pad2(Math.floor(minuteOfDay / 60))}:${pad2(Math.round(minuteOfDay % 60))}`,
    day,
    source,
    doseRateMSvPerHour: rate,
    shelterAdvised: rate > 0,
    summary:
      rate > 0
        ? `Solar particle event: about +${rate} mSv/h here for ~${SOLAR_EVENT_DURATION_HOURS} h (≈${total} mSv unsheltered; storm limit ${L.perStormLimitMSv} mSv). Go to the storm shelter now.`
        : 'Solar particle event detected; no extra exposure expected on Earth.',
  }
}

/** Create a replay feed for the current mission state. Call start() to begin ticking. */
export function createEnvironmentFeed(config: EnvironmentFeedConfig): EnvironmentFeedController {
  const intervalMs = config.intervalMs ?? DEFAULT_INTERVAL_MS
  const perTick = config.missionMinutesPerTick ?? DEFAULT_MISSION_MINUTES_PER_TICK
  const state0 = config.missionState
  const listeners = new Set<EnvironmentTickListener>()
  let tick = 0
  let totalDose = config.startingMissionDoseMSv ?? state0.exposure.totalRadiationMSv
  let activeEvent: RadiationEvent | undefined
  let eventTicksLeft = 0
  let timer: ReturnType<typeof setInterval> | null = null

  const env = state0.environment
  const base = cabinBaseline(env)

  const emit = (t: EnvironmentTick) => {
    for (const l of listeners) {
      try {
        l(t)
      } catch (err) {
        console.error('[environmentFeed] listener failed', err)
      }
    }
  }

  const tickOnce = (): EnvironmentTick => {
    tick += 1
    const rand = mulberry32((config.seed ?? 11) * 100_019 + tick)
    const noise = (amp: number) => (rand() * 2 - 1) * amp
    const absMinute = STREAM_START_MINUTE_OF_DAY + tick * perTick
    const minuteOfDay = absMinute % 1440
    const missionDay = state0.missionDay + Math.floor(absMinute / 1440)
    const day = round(state0.missionDay + absMinute / 1440, 4)
    const timestamp = `Day ${missionDay} ${pad2(Math.floor(minuteOfDay / 60))}:${pad2(minuteOfDay % 60)}`

    // CO2 builds up during waking hours with crew activity, falls overnight.
    const activity = Math.max(0, Math.sin(((minuteOfDay - 7 * 60) / 1440) * 2 * Math.PI))
    const cabin: CabinReading = {
      timestamp,
      day,
      module: base.module,
      co2MmHg: round(Math.max(0.2, base.co2MmHg + 0.5 * activity + noise(0.15)), 2),
      tempC: round(base.tempC + 0.8 * activity + noise(0.3), 1),
      humidityPct: Math.round(base.humidityPct + 6 * activity + noise(3)),
      cabinPsia: round(base.cabinPsia + noise(0.03), 2),
      o2Pct: round(base.o2Pct + noise(0.2), 1),
    }

    const backgroundPerDay = env.typicalDoseRateMSvPerDay * (1 + noise(0.1))
    const eventPerDay = activeEvent ? activeEvent.doseRateMSvPerHour * 24 : 0
    const radiation: RadiationSample = {
      timestamp,
      day,
      doseRateMSvPerDay: round(backgroundPerDay + eventPerDay, 3),
      source: 'simulated',
    }
    totalDose = round(totalDose + (radiation.doseRateMSvPerDay * perTick) / 1440, 3)

    const t: EnvironmentTick = {
      timestamp,
      day,
      cabin,
      cabinEvaluation: evaluateCabin(cabin),
      radiation,
      ...(activeEvent ? { activeEvent } : {}),
      updates: [
        {
          id: 'radiation_dose',
          value: round(totalDose, 2),
          unit: 'mSv',
          source: 'environment_feed',
          timestamp,
          day,
        },
      ],
    }
    if (activeEvent && --eventTicksLeft <= 0) activeEvent = undefined
    emit(t)
    return t
  }

  const controller: EnvironmentFeedController = {
    start() {
      if (timer) return
      timer = setInterval(tickOnce, intervalMs)
      // Live space weather only when a key is configured; never blocks or throws.
      if (config.nasaApiKey)
        void fetchDonkiSepEvents({ apiKey: config.nasaApiKey }).then((events) => {
          const recent = events.at(-1)
          if (recent && !activeEvent) {
            activeEvent = { ...recent, doseRateMSvPerHour: SEP_DOSE_RATE_MSV_PER_HOUR[env.id], shelterAdvised: SEP_DOSE_RATE_MSV_PER_HOUR[env.id] > 0 }
            eventTicksLeft = Math.ceil((SOLAR_EVENT_DURATION_HOURS * 60) / perTick)
          }
        })
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
    isRunning: () => timer !== null,
    tickOnce,
    triggerSolarEvent() {
      const absMinute = STREAM_START_MINUTE_OF_DAY + tick * perTick
      activeEvent = solarEvent(round(state0.missionDay + absMinute / 1440, 4), env.id, absMinute % 1440)
      eventTicksLeft = Math.ceil((SOLAR_EVENT_DURATION_HOURS * 60) / perTick)
      return activeEvent
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  return controller
}

interface DonkiSep {
  sepID?: string
  eventTime?: string
  instruments?: { displayName?: string }[]
}

/** Fetch recent SEP events from DONKI. Resolves [] (never throws) when offline or no key. */
export async function fetchDonkiSepEvents(
  opts: { apiKey?: string; startDate?: string; endDate?: string; signal?: AbortSignal } = {},
): Promise<RadiationEvent[]> {
  if (!opts.apiKey || typeof fetch === 'undefined') return []
  const end = opts.endDate ?? new Date().toISOString().slice(0, 10)
  const start = opts.startDate ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const url = `${DONKI_SEP_URL}?startDate=${start}&endDate=${end}&api_key=${encodeURIComponent(opts.apiKey)}`
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 8000)
  opts.signal?.addEventListener('abort', () => ctrl.abort())
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return []
    const data: unknown = await res.json()
    if (!Array.isArray(data)) return []
    return (data as DonkiSep[])
      .filter((e) => e.eventTime)
      .map((e) => ({
        id: e.sepID ?? `donki-${e.eventTime}`,
        type: 'SEP' as const,
        startTime: e.eventTime!,
        day: 0,
        source: 'donki' as const,
        doseRateMSvPerHour: 0,
        shelterAdvised: false,
        summary: `NASA DONKI reported a solar energetic particle event at ${e.eventTime}${e.instruments?.[0]?.displayName ? ` (${e.instruments[0].displayName})` : ''}.`,
      }))
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

/** Look up the environment profile for a feed (convenience for UI labels). */
export function environmentProfile(id: EnvironmentType): EnvironmentProfile {
  return ENVIRONMENTS[id]
}
