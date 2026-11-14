/**
 * Shared data schema for the Space Medic HUD — the CONTRACT between the
 * backend logic (src/types, src/data, src/services — Claude Code) and the UI
 * (src/components, src/App.tsx, src/index.css — Codex).
 *
 * Version 2.1 = PROJECT_PLAN.md v2.0 schema + astronaut_health_monitor_plan.md
 * (mission timeline, personal baselines, SpO2, cabin/radiation feeds,
 * delay-based escalation, admin/crew accounts, grey "missing data").
 *
 *   §1 Core health schema       (indicators, artifacts, briefing, tasks)
 *   §2 Environment & mission    (phases, exposure "bank account", escalation)
 *   §3 Accounts & baselines     (admin / astronaut, personal baseline)
 *   §4 Reference tables         (ranges, cabin limits, hazard→risk map)
 *   §5 Evaluator helper types   (vitals input, reports, trajectory)
 *   §6 Service contracts        (wearable, environment feed, ingestion, briefing)
 *
 * Rule: fields may be ADDED here, but existing fields must not be renamed or
 * removed without telling the other agent.
 */

// ════════════════════════════════════════════════════════════════════════════
// §1 Core health schema
// ════════════════════════════════════════════════════════════════════════════

/** Internal status. UI labels (reference doc wording): Normal / Watch / Alert. */
export type StatusLevel = 'nominal' | 'caution' | 'critical'

/** What the UI should paint. 'no_data' = grey — missing data is NEVER green. */
export type DisplayStatus = StatusLevel | 'no_data'

export type TrendDirection = 'stable' | 'improving' | 'drifting_caution' | 'rapid_decline'

/** The 5 clickable body-map zones. SpO2 lives under cardiovascular (cardiopulmonary). */
export type BodySystem =
  | 'cardiovascular'
  | 'musculoskeletal'
  | 'radiation_immune'
  | 'metabolic'
  | 'behavioral'

/** How a reading entered the app (reference doc: manual / wearable / env). */
export type DataModality =
  | 'wearable_auto'
  | 'manual_slider'
  | 'lab_document'
  | 'ultrasound_image'
  | 'voice_log'
  | 'environment_feed'

export type IndicatorId =
  | 'blood_sugar'
  | 'radiation_dose'
  | 'heart_rate'
  | 'blood_pressure'
  | 'bone_density'
  | 'sleep_hours'
  | 'mood'
  | 'body_temp'
  | 'spo2'

export type IndicatorUnit = 'mg/dL' | 'mSv' | 'bpm' | 'mmHg' | 'hrs' | '°C' | '/10' | '%'

export type ActionLevel = 'self_care' | 'crew_alert' | 'flight_surgeon'

/**
 * How to reach the ground, decided by one-way Earth delay.
 *  contact_ground  — short delay (ISS, Moon): call the flight surgeon.
 *  act_then_report — long delay (transit, Mars): act now on onboard guidance, then report.
 */
export type EscalationMode = 'contact_ground' | 'act_then_report'

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
  /** Set when level !== 'self_care'. */
  escalationMode?: EscalationMode
}

/** fresh = recent reading; stale = overdue for re-measure; missing = never measured. */
export type DataFreshness = 'fresh' | 'stale' | 'missing'

export interface HistoryPoint {
  /** Display label, e.g. "Day 12" or "Day 12 08:15". Use as chart X label. */
  timestamp: string
  value: number
  /** Personal baseline (or phase-adjusted expected value) at this point. */
  baseline: number
  source: DataModality
  /** Numeric mission day (fractional for intra-day ticks). Use for slope math / numeric X axis. */
  day: number
}

export interface HealthIndicator {
  id: IndicatorId
  system: BodySystem
  name: string
  /** number for most vitals; string for blood pressure ("118/76"); null when missing. */
  value: number | string | null
  unit: IndicatorUnit | string
  status: StatusLevel
  /** UI must paint grey when dataState !== 'fresh' (see DisplayStatus). */
  dataState: DataFreshness
  /** Mission-day of the last reading, if any. */
  lastMeasuredDay?: number
  trend: TrendDirection
  /** Populated when drifting toward caution/critical. */
  projectedDaysToThreshold?: number
  /** Which of NASA's 5 hazards drives this risk. */
  hazardLink: HazardName | string
  /** Step-by-step tool guide for non-doctor scientists. */
  howToMeasure: string
  /** Plain-English explanation of spaceflight physiological impact. */
  whyNeeded: string
  /** Plain-English "how today's environment changes this indicator" (e.g. temp +1 °C after day 60 in 0 g). */
  spaceShiftNote?: string
  actionPlan: ActionPlan
  history: HistoryPoint[]
  /** True for synthetic crew data — UI shows a "Simulated" tag (real daily vitals are not public). */
  simulated: boolean
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
  /** How to escalate right now given Earth delay. */
  escalationMode: EscalationMode
  /** Active environment alerts (shelter, CO2, phase transition) folded into the briefing. */
  environmentAlerts: string[]
}

export interface RoutineTask {
  id: string
  title: string
  xp: number
  completed: boolean
  frequency: 'daily' | 'weekly'
  linkedSystem: BodySystem
  /** Measurement reminder: indicator this task refreshes, if any. */
  refreshesIndicator?: IndicatorId
}

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

// ════════════════════════════════════════════════════════════════════════════
// §2 Environment & mission timeline
//    "Don't ask where are you going — ask what day of the mission it is."
// ════════════════════════════════════════════════════════════════════════════

/** Environment the crew is in on a given mission day (reference doc §7 env_id). */
export type EnvironmentType =
  | 'EARTH'
  | 'EARTH_ORBIT'
  | 'DEEP_SPACE'
  | 'MARS_ORBIT'
  | 'MARS_SURFACE'
  | 'MOON_SURFACE'

/** Vehicle / habitat the crew lives in (challenge: spacecraft, station, rover, Moon base, Mars base). */
export type HabitatType = 'ground' | 'spacecraft' | 'station' | 'rover' | 'moon_base' | 'mars_base'

/** What admin picks when creating an astronaut. */
export type MissionDestination = 'EARTH_TRAINING' | 'ISS' | 'MOON' | 'MARS'

export type DustRisk = 'none' | 'moderate' | 'high'

export interface EnvironmentProfile {
  id: EnvironmentType
  label: string
  description: string
  /** Fraction of Earth gravity (1 = 1 g). Passes straight into the cabin. */
  gravityG: number
  /** Natural day length in hours (null = no natural day, e.g. deep space). */
  dayLengthHours: number | null
  /** Typical in-cabin dose-equivalent rate, mSv per day. */
  typicalDoseRateMSvPerDay: number
  /** One-way signal delay to Earth, human-readable. */
  commDelay: string
  commDelaySecondsMin: number
  /** Max one-way delay in seconds (drives EscalationMode). */
  commDelaySecondsMax: number
  dustRisk: DustRisk
  /** Cabin atmosphere set by life support (NASA-STD-3001). */
  cabinPsia: number
  cabinO2Pct: number
  notes: string[]
  sources: SourceRef[]
}

export interface MissionPhase {
  order: number
  name: string
  /** Inclusive start day, exclusive end day. */
  startDay: number
  endDay: number
  environment: EnvironmentType
  habitat: HabitatType
}

export interface MissionPlan {
  id: string
  name: string
  destination: MissionDestination
  /** ISO date. Mission day is derived from this and "today" (no manual updates). */
  launchDate: string
  /** Admin-editable (delays). */
  totalDays: number
  phases: MissionPhase[]
}

/** The body's "bank account": running totals carried across phases. */
export interface CumulativeExposure {
  missionDay: number
  days0g: number
  daysPartialG: number
  totalRadiationMSv: number
  /** Negative %, from bone_loss_per_day = (1.25 / 30) × (1 − gravity_g). Labeled as an estimate. */
  estBoneLossPct: number
}

export type TransitionAlertKind =
  | 'entering_0g'
  | 'temp_baseline_shift'
  | 'landing_after_transit'
  | 'solar_storm'
  | 'comm_blackout'

export interface TransitionAlert {
  kind: TransitionAlertKind
  severity: StatusLevel
  title: string
  /** What to watch / do, plain English. */
  guidance: string[]
  /** Days this alert stays active from its trigger day. */
  activeFromDay: number
  activeToDay: number
}

/** Everything the HUD needs for "today" — produced by missionTimeline.getMissionState(). */
export interface MissionState {
  plan: MissionPlan
  missionDay: number
  phase: MissionPhase
  environment: EnvironmentProfile
  /** Current one-way delay (grows during deep-space transit). */
  earthDelaySeconds: number
  escalationMode: EscalationMode
  exposure: CumulativeExposure
  daysToNextPhase: number | null
  nextPhase: MissionPhase | null
  /** 0–1 progress for the trip bar. */
  progress: number
  activeAlerts: TransitionAlert[]
}

// ════════════════════════════════════════════════════════════════════════════
// §3 Accounts & personal baselines
// ════════════════════════════════════════════════════════════════════════════

export type UserRole = 'admin' | 'astronaut'

export type CrewRole = 'commander' | 'pilot' | 'specialist' | 'flight_engineer' | 'medical_officer'

/** Created only by admin (mission control). Demo-grade auth — not real security. */
export interface CrewAccount {
  id: string
  login: string
  displayName: string
  userRole: UserRole
  crewRole?: CrewRole
  /** Demo-only hash; never store plain PINs. */
  pinHash: string
  /** null for admin. */
  astronautId: string | null
}

export interface AuthSession {
  account: Omit<CrewAccount, 'pinHash'>
  startedAt: string
}

export interface BaselineStat {
  mean: number
  sd: number
  n: number
}

/** Scoring compares each reading to the astronaut's OWN baseline, not just population ranges. */
export interface PersonalBaseline {
  astronautId: string
  source: 'earth_mode' | 'first_7_days' | 'population_default'
  values: Partial<Record<IndicatorId, BaselineStat>>
}

export interface AstronautProfile {
  id: string
  name: string
  /** Free-text display role, e.g. "Commander". */
  role: string
  crewRole: CrewRole
  agency: 'NASA' | 'CSA' | 'ESA' | 'JAXA'
  age: number
  sex: 'female' | 'male'
  /** Login of the linked demo account (e.g. 'mars_crew'). */
  login: string
  mission: MissionPlan
  /** Derived snapshot for convenience; source of truth is missionTimeline.getMissionState(). */
  environment: EnvironmentType
  habitat: HabitatType
  missionDay: number
  missionLengthDays: number
  /** Cumulative career effective dose before this mission, mSv. */
  priorCareerDoseMSv: number
  /** Admin notes, e.g. "naturally low BP", allergies. */
  notes: string[]
  baseline: PersonalBaseline
  indicators: HealthIndicator[]
  routine: RoutineTask[]
}

// ════════════════════════════════════════════════════════════════════════════
// §4 Reference tables (reference doc §5, §6, §9)
// ════════════════════════════════════════════════════════════════════════════

export interface ReferenceRange {
  indicator: IndicatorId
  unit: string
  earthLow: number | null
  earthHigh: number | null
  /** Plain-English space shift, e.g. "24 h BP drops 8–10 mmHg". */
  spaceShift: string
  /** App rule from the reference doc, e.g. "Target 8.5 h, alert below 6 h". */
  appRule: string
  sources: SourceRef[]
}

export type CabinParam = 'co2_mmhg' | 'temp_c' | 'humidity_pct' | 'cabin_psia' | 'ppo2_mmhg'

export interface CabinLimit {
  param: CabinParam
  label: string
  unit: string
  nominalLow?: number
  nominalHigh?: number
  /** Watch (caution) boundary. */
  watch?: number
  /** Alert (critical) boundary. */
  alert?: number
  note: string
}

export interface HazardRiskEntry {
  hazard: HazardName
  /** NASA HRP risk name, e.g. "Risk of Bone Fracture". */
  risk: string
  indicators: IndicatorId[]
  why: string
  action: string
  escalateToGround: boolean
}

// ════════════════════════════════════════════════════════════════════════════
// §5 Evaluator helper types
// ════════════════════════════════════════════════════════════════════════════

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
  spo2Pct?: number
  /** Dose recorded by personal dosimeter over the last 24 h, mSv. */
  radiationDailyMSv?: number
  /** Cumulative mission dose so far, mSv. */
  radiationMissionMSv?: number
  /** Bone mineral density change vs pre-flight, % (negative = loss). */
  boneDensityChangePct?: number
  /** Free-text symptoms from the manual check-in (headache, dizziness, ...). */
  symptoms?: string[]
}

/** Optional context that tightens/shifts ranges (phase, baseline, cabin). */
export interface EvaluationContext {
  missionState?: MissionState
  baseline?: PersonalBaseline
  priorCareerDoseMSv?: number
}

/** Spaceflight physiology shifts applied to ranges for the current mission day. */
export interface SpaceAdjustments {
  /** +1 °C after day 60 in 0 g (reference doc §6). */
  bodyTempShiftC: number
  /** In-flight 24 h BP runs 8–10 mmHg lower → high thresholds move down by this (negative). */
  bpShiftSystolic: number
  bpShiftDiastolic: number
  /** Scheduled sleep target (8.5 h); alert below 6 h. */
  sleepTargetHours: number
  /** 8.2 psia exploration habitat → tighter SpO2 limits. */
  lowPressureHabitat: boolean
  /** Plain-English note per affected indicator, copied to HealthIndicator.spaceShiftNote. */
  notes: Partial<Record<IndicatorId, string>>
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
  /** Deviation vs personal baseline in SDs, when a baseline exists. */
  baselineZ?: number
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
  escalationMode: EscalationMode
  /** 0–100, used by the Readiness Score gauge. */
  readinessScore: number
  indicators: IndicatorEvaluation[]
  systems: SystemStatus[]
  /** Indicators with no fresh reading — render grey, exclude from "all clear". */
  missingIndicators: IndicatorId[]
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
// §6 Service contracts
// ════════════════════════════════════════════════════════════════════════════

// ── Shared: one row of the unified `vitals_reading` table ─────────────────

export interface IndicatorUpdate {
  astronautId?: string
  id: IndicatorId
  value: number | string
  unit: string
  source: DataModality
  timestamp: string
  day: number
}

/** Alias matching the reference doc's table name. */
export type VitalsReading = IndicatorUpdate

// ── wearableStream.ts ─────────────────────────────────────────────────────

/** Demo anomalies the Mission Control bar can inject. */
export type AnomalyKind = 'solar_flare' | 'tachycardia' | 'fever' | 'sleep_deprivation' | 'hypoxia'

export interface WearableReadings {
  heartRateBpm: number
  /** Core-equivalent temperature used for the body_temp indicator. */
  bodyTempC: number
  skinTempC: number
  spo2Pct: number
  steps: number
  /** Rolling sleep total for the last sleep period; present on wake ticks. */
  sleepHours?: number
  /** Heart-rate variability (RMSSD, ms) — stress proxy. */
  hrvMs: number
}

export interface WearableTick {
  /** Monotonic tick counter starting at 1. */
  tick: number
  /** Total mission minutes elapsed since stream start (tick × 15 by default). */
  missionMinute: number
  /** Display label, e.g. "Day 45 08:15". */
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

// ── environmentFeed.ts (RadLab / OSDR cabin replay + DONKI solar events) ──

export interface CabinReading {
  timestamp: string
  day: number
  module: string
  co2MmHg: number
  tempC: number
  humidityPct: number
  cabinPsia: number
  o2Pct: number
}

export interface CabinEvaluation {
  status: StatusLevel
  /** Per-parameter verdicts. */
  params: { param: CabinParam; value: number; status: StatusLevel; message: string }[]
  /** e.g. "CO2 above 4.5 mmHg — expect fatigue, poor sleep, nausea." */
  advisories: string[]
}

export type RadiationEventType = 'SEP' | 'FLARE' | 'CME'

export interface RadiationEvent {
  id: string
  type: RadiationEventType
  startTime: string
  day: number
  /** 'donki' = live NASA DONKI API; 'radlab' = replayed OSDR data; 'simulated' = demo. */
  source: 'donki' | 'radlab' | 'simulated'
  /** Extra dose-rate during the event, mSv/h. */
  doseRateMSvPerHour: number
  /** True → show the "Go to shelter" alert. */
  shelterAdvised: boolean
  summary: string
}

export interface RadiationSample {
  timestamp: string
  day: number
  doseRateMSvPerDay: number
  source: 'radlab' | 'simulated'
}

export interface EnvironmentTick {
  timestamp: string
  day: number
  cabin: CabinReading
  cabinEvaluation: CabinEvaluation
  radiation: RadiationSample
  /** Present while a solar event is active. */
  activeEvent?: RadiationEvent
  /** radiation_dose update for the indicator history. */
  updates: IndicatorUpdate[]
}

export interface EnvironmentFeedConfig {
  missionState: MissionState
  intervalMs?: number
  /** Optional NASA API key for DONKI; offline simulated events when absent. */
  nasaApiKey?: string
  seed?: number
  /** Mission minutes per tick. Default 15 (matches the wearable loop). */
  missionMinutesPerTick?: number
  /** Cumulative mission dose to continue from (e.g. last radiation_dose value). Default: missionState.exposure.totalRadiationMSv. */
  startingMissionDoseMSv?: number
}

export type EnvironmentTickListener = (tick: EnvironmentTick) => void

export interface EnvironmentFeedController {
  start(): void
  stop(): void
  isRunning(): boolean
  tickOnce(): EnvironmentTick
  /** Demo: force a solar particle event ("Trigger Solar Flare Spike"). */
  triggerSolarEvent(): RadiationEvent
  subscribe(listener: EnvironmentTickListener): () => void
}

// ── ingestionEngine.ts ────────────────────────────────────────────────────

/** Anything dropped into the Multimodal Diagnostic Dropzone or slider panel. */
export interface IngestionInput {
  astronautId?: string
  /** Hint from the UI; the gatekeeper may correct it. */
  modality?: DataModality
  fileName?: string
  mimeType?: string
  /** Raw media (image / pdf / audio). Read once, never persisted. */
  file?: Blob
  /** Raw text: pasted notes, CSV content, or a voice transcript. */
  text?: string
  /** Values from the manual check-in panel. */
  manualValues?: VitalsInput
  timestamp?: string
  day?: number
  /** Current environment, used to grade severity of extracted values. Default EARTH_ORBIT. */
  environment?: EnvironmentType
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
  | { kind: 'environment_tick'; tick: EnvironmentTick }
  | { kind: 'artifact'; artifact: IngestedArtifact }
  | { kind: 'manual_vitals'; updates: IndicatorUpdate[] }
  | { kind: 'phase_change'; from: MissionPhase; to: MissionPhase }
  | { kind: 'mission_day_change'; missionDay: number }

export interface BriefingContext {
  profile: Pick<AstronautProfile, 'id' | 'name' | 'missionDay' | 'notes'>
  missionState: MissionState
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
  /** Force offline mock even if a key exists (the app must run with no Earth link). */
  forceOffline?: boolean
  timeoutMs?: number
}
