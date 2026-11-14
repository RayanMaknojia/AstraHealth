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
 * Uses Gemini Flash when AIConfig has a key; otherwise deterministic offline
 * mock parsers so the hackathon demo always works.
 *
 * STATUS: Step-1 contract stub — signatures are final, bodies come in Step 2.
 */

import type {
  AIConfig,
  DemoIngestionCase,
  GatekeeperVerdict,
  IngestedArtifact,
  IngestionInput,
  IngestionResult,
} from '@/types/astronaut'
import { notImplemented } from './_notImplemented'

/** File types the dropzone should accept (pass to the <input accept> attr). */
export const ACCEPTED_FILE_TYPES = 'image/*,application/pdf,text/csv,text/plain,audio/*'

/** Gatekeeper: is this input biomedical? Never throws for bad input — returns accepted:false. */
export async function validateBiomedicalRelevance(
  _input: IngestionInput,
  _ai?: AIConfig,
): Promise<GatekeeperVerdict> {
  return notImplemented('validateBiomedicalRelevance')
}

/** Normalizer: turn an accepted input into a lightweight structured artifact (runs once). */
export async function normalizeArtifact(
  _input: IngestionInput,
  _verdict: GatekeeperVerdict,
  _ai?: AIConfig,
): Promise<IngestedArtifact> {
  return notImplemented('normalizeArtifact')
}

/**
 * Main entry point for the UI: validate → normalize → derive IndicatorUpdates.
 * Rejected inputs still resolve (artifact.accepted === false, updates === []).
 */
export async function ingest(_input: IngestionInput, _ai?: AIConfig): Promise<IngestionResult> {
  return notImplemented('ingest')
}

/** Ready-made inputs for the "Test Valid Ultrasound vs. Invalid File" demo buttons. */
export function createDemoInput(_kind: DemoIngestionCase): IngestionInput {
  return notImplemented('createDemoInput')
}
