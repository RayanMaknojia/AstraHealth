/**
 * Stateful Incremental AI Briefing.
 *
 * Takes (currentBriefing + one new BriefingEvent + updated indicators) and
 * rewrites the MissionHealthBriefing in plain English: color-coded overall
 * status, early trajectory warnings (EmergingRisk[]), preventive actions and
 * the next onboard tool checks. Only the prior briefing and the normalized
 * event are sent to the LLM — never raw media or full history.
 *
 * Uses Gemini Flash when AIConfig has a key; otherwise deterministic offline
 * templates driven by healthEvaluator output.
 *
 * STATUS: Step-1 contract stub — signatures are final, bodies come in Step 2.
 */

import type {
  AIConfig,
  BriefingContext,
  BriefingEvent,
  BriefingUpdateResult,
  MissionHealthBriefing,
} from '@/types/astronaut'
import { notImplemented } from './_notImplemented'

/** Build the first briefing for a crew member from their evaluated indicators (sync, offline). */
export function createInitialBriefing(_ctx: BriefingContext): MissionHealthBriefing {
  return notImplemented('createInitialBriefing')
}

/** Incrementally update the briefing after a single new event. */
export async function updateBriefing(
  _current: MissionHealthBriefing,
  _event: BriefingEvent,
  _ctx: BriefingContext,
  _ai?: AIConfig,
): Promise<BriefingUpdateResult> {
  return notImplemented('updateBriefing')
}
