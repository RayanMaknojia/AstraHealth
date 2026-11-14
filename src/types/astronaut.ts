/**
 * Shared data schema for the Space Medic HUD — the CONTRACT between the
 * backend logic (src/services, src/data — Claude Code) and the UI
 * (src/components, src/App.tsx — Codex).
 *
 * Section 1 mirrors the "Shared Data Schema (v2.0)" in PROJECT_PLAN.md.
 * Section 2 holds additive helper types used by the data layer.
 * Section 3 holds the input/output contracts of each service module.
 *
 * Rule: fields may be ADDED here, but existing fields must not be renamed or
 * removed without telling the other agent.
 */

// ════════════════════════════════════════════════════════════════════════════
// 1. Core schema (PROJECT_PLAN.md v2.0)
// ════════════════════════════════════════════════════════════════════════════

export type EnvironmentType = 'ISS_ORBIT' | 'LUNAR_BASE' | 'MARS_TRANSIT' | 'SURFACE_ROVER'

export type StatusLevel = 'nominal' | 'caution' | 'critical'

export type TrendDirection = 'stable' | 'improving' | 'drifting_caution' | 'rapid_decline'

export type BodySystem =
  | 'cardiovascular'
  | 'musculoskeletal'
  | 'radiation_immune'
  | 'metabolic'
  | 'behavioral'

export type DataModality =
  | 'wearable_auto'
  | 'manual_slider'
  | 'lab_document'
  | 'ultrasound_image'
  | 'voice_log'

export type IndicatorId =
  | 'blood_sugar'
  | 'radiation_dose'
  | 'heart_rate'
  | 'blood_pressure'
  | 'bone_density'
  | 'sleep_hours'
  | 'mood'
  | 'body_temp'

export type IndicatorUnit = 'mg/dL' | 'mSv' | 'bpm' | 'mmHg' | 'hrs' | '°C' | '/10' | '%'

export type ActionLevel = 'self_care' | 'crew_alert' | 'flight_surgeon'

/** NASA Human Research Program's 5 Hazards of Human Spaceflight. */
export type HazardName =
  | 'Space Radiation'
  | 'Isolation and Confinement'
  | 'Distance from Earth'
  | 'Gravity Fields'
  | 'Hostile Closed Environments'

export interface ActionPlan {
  level: ActionLevel
  steps: string[]
}

export interface HistoryPoint {
  /** Display label, e.g. "Day 12" or "Day 12 08:15". Use as chart X label. */
  timestamp: string
  value: number
  baseline: number
  source: DataModality
  /** Additive: numeric mission day (fractional for intra-day ticks). Use for slope math / numeric X axis. */
  day: number
}

export interface HealthIndicator {
  id: IndicatorId
  system: BodySystem
  name: string
  /** number for most vitals; string for blood pressure, e.g. "118/76". */
  value: number | string
  unit: IndicatorUnit | string
  status: StatusLevel
  trend: TrendDirection
  /** Populated when drifting toward caution/critical. */
  projectedDaysToThreshold?: number
  /** Which of NASA's 5 hazards drives this risk. */
  hazardLink: HazardName | string
  /** Step-by-step tool guide for non-doctor scientists. */
  howToMeasure: string
  /** Plain-English explanation of spaceflight physiological impact. */
  whyNeeded: string
  actionPlan: ActionPlan
  history: HistoryPoint[]
}

export interface IngestedArtifact {
  id: string
  timestamp: string
  fileName?: string
  modality: DataModality
  accepted: boolean
  /** Shown if a non-health file/input is blocked. */
  rejectionReason?: string
  /** Normalized once; raw binary/audio is never re-sent to the LLM. */
  extractedSummary: string
  mappedIndicators: IndicatorId[]
  severity: StatusLevel
}

export interface EmergingRisk {
  indicatorId: IndicatorId
  severity: StatusLevel
  /** Why the current trajectory indicates an upcoming issue. */
  explanation: string
  preventiveAction: string
}

export interface MissionHealthBriefing {
  lastUpdated: string
  overallStatus: StatusLevel
  headline: string
  /** Jargon-free explanation for non-medical crew. */
  plainEnglishSummary: string
  emergingRisks: EmergingRisk[]
  /** Next diagnostic measurements to perform. */
  recommendedToolChecks: string[]
}

export interface RoutineTask {
  id: string
  title: string
  xp: number
  completed: boolean
  frequency: 'daily' | 'weekly'
  linkedSystem: BodySystem
}

// ════════════════════════════════════════════════════════════════════════════
// 2. Additive helper types (data layer + health evaluator)
// ════════════════════════════════════════════════════════════════════════════

export interface SourceRef {
  label: string
  url: string
}

export interface SpaceflightHazard {
  name: HazardName
  summary: string
  keyFacts: string[]
  affectedSystems: BodySystem[]
  countermeasures: string[]
  sources: SourceRef[]
}

export interface EnvironmentProfile {
  id: EnvironmentType
  label: string
  description: string
  /** Fraction of Earth gravity (1 = 1 g). */
  gravityG: number
  /** Typical absorbed dose-equivalent rate, mSv per day. */
  typicalDoseRateMSvPerDay: number
  /** One-way signal delay to Earth, human-readable. */
  commDelay: string
  /** Max one-way delay in seconds (drives autonomy guidance). */
  commDelaySecondsMax: number
  notes: string[]
}

export interface AstronautProfile {
  id: string
  name: string
  role: string
  agency: 'NASA' | 'CSA' | 'ESA' | 'JAXA'
  age: number
  sex: 'female' | 'male'
  environment: EnvironmentType
  missionDay: number
  missionLengthDays: number
  /** Cumulative career effective dose before this mission, mSv. */
  priorCareerDoseMSv: number
  indicators: HealthIndicator[]
  routine: RoutineTask[]
}

/** Raw values an astronaut types/slides into the "Log Vitals" panel. */
export interface VitalsInput {
  bloodSugarMgDl?: number
  /** True if no food in the last 8 hours (tightens glucose ranges). */
  fasting?: boolean
  heartRateBpm?: number
  systolicMmHg?: number
  diastolicMmHg?: number
  bodyTempC?: number
  sleepHours?: number
  /** Self-rated 1–10 (10 = best). */
  mood?: number
  /** Dose recorded by personal dosimeter over the last 24 h, mSv. */
  radiationDailyMSv?: number
  /** Cumulative mission dose so far, mSv. */
  radiationMissionMSv?: number
  /** Bone mineral density change vs pre-flight, % (negative = loss). */
  boneDensityChangePct?: number
}

export interface IndicatorEvaluation {
  id: IndicatorId
  system: BodySystem
  status: StatusLevel
  /** Display value, e.g. 112 or "118/76". */
  value: number | string
  unit: string
  /** One-line plain-English verdict. */
  message: string
  /** The rule that fired, for transparency (e.g. "≥ 200 mg/dL"). */
  thresholdNote: string
  actionPlan: ActionPlan
}

export interface SystemStatus {
  system: BodySystem
  status: StatusLevel
  drivers: IndicatorId[]
}

export interface HealthReport {
  environment: EnvironmentType
  overallStatus: StatusLevel
  escalation: ActionLevel
  /** 0–100, used by the Readiness Score gauge. */
  readinessScore: number
  indicators: IndicatorEvaluation[]
  systems: SystemStatus[]
  /** Extra guidance tied to the environment (comm delay, gravity...). */
  environmentAdvisories: string[]
}

/** Output of the slope-based trajectory check in healthEvaluator.ts. */
export interface TrajectoryResult {
  trend: TrendDirection
  /** Linear-regression slope over recent history, units per mission day. */
  slopePerDay: number
  projectedDaysToThreshold?: number
  /** Which boundary the metric is heading toward, if any. */
  projectedStatus?: Exclude<StatusLevel, 'nominal'>
}

// ════════════════════════════════════════════════════════════════════════════
// 3. Service contracts
// ════════════════════════════════════════════════════════════════════════════

// ── Shared: a single new reading for one indicator ────────────────────────

export interface IndicatorUpdate {
  id: IndicatorId
  value: number | string
  source: DataModality
  timestamp: string
  day: number
}

// ── wearableStream.ts ─────────────────────────────────────────────────────

/** Demo anomalies the Mission Control bar can inject. */
export type AnomalyKind = 'solar_flare' | 'tachycardia' | 'fever' | 'sleep_deprivation'

export interface WearableReadings {
  heartRateBpm: number
  bodyTempC: number
  /** Rolling sleep total for the last sleep period; present on wake ticks. */
  sleepHours?: number
  /** Heart-rate variability (RMSSD, ms) — stress proxy. */
  hrvMs: number
  /** Radiation dose added during this tick, mSv (spikes on solar_flare). */
  radiationDeltaMSv: number
}

export interface WearableTick {
  /** Monotonic tick counter starting at 1. */
  tick: number
  /** Total mission minutes elapsed since stream start (tick × 15 by default). */
  missionMinute: number
  /** Display label, e.g. "Day 92 08:15". */
  timestamp: string
  day: number
  readings: WearableReadings
  /** Indicator updates derived from readings, ready for healthEvaluator. */
  updates: IndicatorUpdate[]
  injectedAnomaly?: AnomalyKind
}

export interface WearableStreamConfig {
  profile: AstronautProfile
  /** Real-time milliseconds between ticks. Default 15000. */
  intervalMs?: number
  /** Mission minutes per tick. Default 15. */
  missionMinutesPerTick?: number
  /** Seed for deterministic noise. */
  seed?: number
}

export type WearableTickListener = (tick: WearableTick) => void

export interface WearableStreamController {
  start(): void
  stop(): void
  isRunning(): boolean
  /** Advance one tick immediately (the "+15m Wearable Sync" button). */
  tickOnce(): WearableTick
  /** Queue an anomaly; it is applied on the next tick. */
  injectAnomaly(kind: AnomalyKind): void
  /** Returns an unsubscribe function. */
  subscribe(listener: WearableTickListener): () => void
}

// ── ingestionEngine.ts ────────────────────────────────────────────────────

/** Anything dropped into the Multimodal Diagnostic Dropzone or slider panel. */
export interface IngestionInput {
  /** Hint from the UI; the gatekeeper may correct it. */
  modality?: DataModality
  fileName?: string
  mimeType?: string
  /** Raw media (image / pdf / audio). Read once, never persisted. */
  file?: Blob
  /** Raw text: pasted notes, CSV content, or a voice transcript. */
  text?: string
  /** Values from the manual sliders panel. */
  manualValues?: VitalsInput
  timestamp?: string
}

export interface GatekeeperVerdict {
  accepted: boolean
  detectedModality: DataModality
  /** 0–1 confidence the input is biomedical. */
  confidence: number
  /** Required when accepted === false. */
  rejectionReason?: string
}

export interface IngestionResult {
  verdict: GatekeeperVerdict
  artifact: IngestedArtifact
  /** New readings to merge into indicator history (empty if rejected). */
  updates: IndicatorUpdate[]
  /** 'gemini' when the LLM ran, 'offline_mock' for deterministic fallback. */
  engine: 'gemini' | 'offline_mock'
}

/** Built-in demo fixtures for the "Test Valid Ultrasound vs Invalid File" buttons. */
export type DemoIngestionCase =
  | 'valid_ultrasound'
  | 'valid_blood_panel'
  | 'valid_voice_log'
  | 'invalid_file'

// ── briefingEngine.ts ─────────────────────────────────────────────────────

/** The single new event the incremental briefing reacts to. */
export type BriefingEvent =
  | { kind: 'wearable_tick'; tick: WearableTick }
  | { kind: 'artifact'; artifact: IngestedArtifact }
  | { kind: 'manual_vitals'; updates: IndicatorUpdate[] }
  | { kind: 'environment_change'; environment: EnvironmentType }

export interface BriefingContext {
  profile: Pick<AstronautProfile, 'id' | 'name' | 'environment' | 'missionDay'>
  /** Indicators AFTER the event has been applied and re-evaluated. */
  indicators: HealthIndicator[]
}

export interface BriefingUpdateResult {
  briefing: MissionHealthBriefing
  /** Human-readable list of what changed vs. the previous briefing (for toasts). */
  changes: string[]
  engine: 'gemini' | 'offline_mock'
}

/** Optional LLM settings; when absent, services use offline deterministic logic. */
export interface AIConfig {
  /** Read from import.meta.env.VITE_GEMINI_API_KEY by default. */
  apiKey?: string
  /** Default 'gemini-flash-latest'. */
  model?: string
  /** Force offline mock even if a key exists (for demo reliability). */
  forceOffline?: boolean
  timeoutMs?: number
}
