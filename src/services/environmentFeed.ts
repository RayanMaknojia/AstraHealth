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
 * STATUS: Step-1 contract stub — signatures are final, bodies come in Step 2.
 */

import type {
  CabinEvaluation,
  CabinReading,
  EnvironmentFeedConfig,
  EnvironmentFeedController,
  RadiationEvent,
} from '@/types/astronaut'
import { notImplemented } from './_notImplemented'

export const DONKI_SEP_URL = 'https://api.nasa.gov/DONKI/SEP'

/** Create a replay feed for the current mission state. Call start() to begin ticking. */
export function createEnvironmentFeed(_config: EnvironmentFeedConfig): EnvironmentFeedController {
  return notImplemented('createEnvironmentFeed')
}

/** Check one cabin reading against CABIN_LIMITS (CO2 ≤ 3 mmHg 1-h avg, temp/humidity band, pressure). */
export function evaluateCabin(_reading: CabinReading): CabinEvaluation {
  return notImplemented('evaluateCabin')
}

/** Fetch recent SEP events from DONKI. Resolves [] (never throws) when offline or no key. */
export async function fetchDonkiSepEvents(
  _opts: { apiKey?: string; startDate?: string; endDate?: string; signal?: AbortSignal } = {},
): Promise<RadiationEvent[]> {
  return notImplemented('fetchDonkiSepEvents')
}
