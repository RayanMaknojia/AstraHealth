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
 *   §7 Phase 3 contracts        (check-ins & streaks, exercise & body mass, override
 *                                alerts, sync, Photo Check, wellbeing, guidance)
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

export type IndicatorUnit = 'mg/dL' | 'mSv' | 'bpm' | 'mmHg' | 'hrs' | '°C' | '/5' | '%'

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
  /** Self-rated 1–5 (5 = best). See health_rules.md. */
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
  /** Last nights' sleep, oldest → newest, INCLUDING tonight's value (for the 3-nights-in-a-row rule). */
  sleepRecentNights?: number[]
  /** Last days' mood, oldest → newest, INCLUDING today's value (for the 3-days-in-a-row rule). */
  moodRecentDays?: number[]
}

/** Optional context that tightens/shifts ranges (phase, baseline, cabin). */
export interface EvaluationContext {
  missionState?: MissionState
  baseline?: PersonalBaseline
  priorCareerDoseMSv?: number
}

/** Spaceflight physiology shifts applied to ranges for the current mission day. */
export interface SpaceAdjustments {
  /** Top of Normal rises 37.5 → 37.9 °C after day 60 in 0 g (health_rules.md). Alert stays at 38.5. */
  bodyTempShiftC: number
  /** In-flight BP runs 8–10 mmHg lower → the LOW limits relax by this much (negative). 0 for 14 days after landing. */
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
  /** Cabin noise, dB(A). */
  noiseDb?: number
  /** Lighting phase that matches the crew sleep schedule. */
  lightPhase?: 'day' | 'evening' | 'night'
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
  /** Last 24 h of cabin readings (oldest → newest) for charts and "Is it me or the air?". */
  cabinHistory(): CabinReading[]
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

// ════════════════════════════════════════════════════════════════════════════
// §7 Phase 3 contracts (astronaut_health_monitor_pages.md pages 3–13, O1–O4)
// ════════════════════════════════════════════════════════════════════════════

/** A 1–5 self-rating. Which end is "good" depends on the field — see each field's doc. */
export type Rating5 = 1 | 2 | 3 | 4 | 5

// ── checkinService.ts ─────────────────────────────────────────────────────

export type CheckinSlot = 'morning' | 'evening' | 'weekly' | 'monthly' | 'eye_exam'

/** Extra check-in answers that are not dashboard indicators. */
export interface CheckinExtras {
  /** 1 = terrible, 5 = great. */
  sleepQuality?: Rating5
  /** 1 = none, 5 = exhausted. */
  fatigue?: Rating5
  /** 1 = none / normal appetite, 5 = severe nausea / no appetite. */
  nauseaAppetite?: Rating5
  headache?: boolean
  exerciseMinutes?: number
  exerciseType?: WorkoutType
  bodyMassKg?: number
  reactionMs?: number
  notes?: string
}

export interface CheckinScheduleItem {
  slot: CheckinSlot
  title: string
  required: boolean
  estMinutes: number
  /** What the form should ask (labels for the UI). */
  fields: string[]
}

export interface CheckinTaskDue extends CheckinScheduleItem {
  due: boolean
  done: boolean
  excused: boolean
  /** e.g. "Due today", "Day 90 eye exam", "Weekly — due by day 49". */
  dueReason: string
}

export interface CheckinRecord {
  id: string
  astronautId: string
  missionDay: number
  slot: CheckinSlot
  /** ISO time it was saved. */
  completedAt: string
  values?: VitalsInput
  extras?: CheckinExtras
  symptoms: string[]
  /** Set when admin excused a missed check-in instead. */
  excused?: { by: string; reason: string }
}

export type StreakDayState = 'done' | 'excused' | 'missed' | 'today' | 'future'

export interface StreakInfo {
  current: number
  best: number
  /** Last 28 days for the streak calendar (oldest → newest). */
  calendar: { day: number; state: StreakDayState }[]
}

export type BadgeId =
  | 'streak_7'
  | 'streak_30'
  | 'streak_100'
  | 'weekly_all'
  | 'monthly_exam'
  | 'exercise_6'
  | 'team_steady_orbit'

export interface Badge {
  id: BadgeId
  label: string
  description: string
  team: boolean
  earned: boolean
  /** 0–1 progress toward the badge (1 when earned). */
  progress: number
  /** e.g. "3 more days". */
  progressText: string
}

/** Consistency only — never health values (pages doc §7). */
export interface LeaderboardRow {
  rank: number
  astronautId: string
  displayName: string
  role: string
  currentStreak: number
  /** % of required check-ins done in the last 7 days. */
  weekPct: number
  exerciseDays: number
  exerciseDaysGoal: number
  badgeCount: number
}

export interface TeamGoal {
  weekPct: number
  goalPct: number
  met: boolean
  badgeLabel: string
}

export interface CrewOverviewRow {
  astronautId: string
  displayName: string
  role: string
  status: DisplayStatus
  lastCheckinDay: number | null
  currentStreak: number
  openAlerts: number
}

// ── exerciseService.ts ────────────────────────────────────────────────────

export type WorkoutType = 'treadmill' | 'bike' | 'resistance' | 'other'

export interface WorkoutLog {
  id: string
  astronautId: string
  day: number
  type: WorkoutType
  minutes: number
  /** 1 = easy, 5 = max effort. */
  effort: Rating5
}

export interface ExerciseSummary {
  todayMinutes: number
  goalMinutes: number
  /** Status from completed days (health_rules.md: Watch 60–119, Alert < 60 for 3 days). */
  status: StatusLevel
  message: string
  /** Days in the last 7 that met the goal, out of exerciseDaysGoal. */
  weeklyDays: number
  exerciseDaysGoal: number
  /** Consecutive days meeting the goal. */
  streakDays: number
  /** Minutes per day, last 7 days (oldest → newest, today last). */
  last7: { day: number; minutes: number }[]
  byType: Record<WorkoutType, number>
}

export interface BodyMassReading {
  day: number
  kg: number
}

export interface BodyMassSummary {
  preflightKg: number | null
  latestKg: number | null
  changePct: number | null
  status: DisplayStatus
  message: string
  history: BodyMassReading[]
}

export interface BoneProjectionPoint {
  day: number
  /** Estimated % change with no countermeasures. */
  noExercisePct: number
  /** Estimated % change at the astronaut's actual exercise compliance. */
  actualPct: number
}

export interface BoneProjection {
  /** 0–1 share of days meeting the exercise goal over the last 30 days. */
  compliance: number
  points: BoneProjectionPoint[]
  /** Projected loss at mission end, actual compliance. */
  endOfMissionPct: number
  note: string
}

// ── alertService.ts (override layer) ──────────────────────────────────────

export type OverrideKind = 'critical_health' | 'cabin_emergency' | 'radiation_storm' | 'sos'

/** Full-screen alert that covers any page until someone taps Confirm. */
export interface OverrideAlert {
  id: string
  kind: OverrideKind
  astronautId: string
  /** Stable key so the same problem isn't raised twice (e.g. "critical_health:spo2"). */
  key: string
  title: string
  headline: string
  /** "Which reading, the value and the normal range" etc. */
  details: string[]
  /** "Do this now" steps. */
  steps: string[]
  indicatorId?: IndicatorId
  raisedAt: string
  missionDay: number
  missionTimestamp: string
  confirmedBy?: string
  confirmedAt?: string
  /** Outbox item created for the ground. */
  outboxItemId?: string
}

export interface BannerAlert {
  kind: 'comms_blackout' | 'link_waiting'
  message: string
  expectedBackInDays?: number
}

export interface OverrideInputs {
  profile: AstronautProfile
  report: HealthReport
  missionState: MissionState
  /** Latest environment tick, if any. */
  environmentTick?: EnvironmentTick
  /** Recent cabin readings (environmentFeed.cabinHistory()) for the 1-hour CO2 rule. */
  cabinHistory?: CabinReading[]
}

// ── syncService.ts ────────────────────────────────────────────────────────

export type SyncItemType = 'checkin' | 'photo' | 'scan' | 'alert' | 'sos' | 'private_request' | 'report'
export type SyncPriority = 'high' | 'normal' | 'low'
export type SyncStatus = 'queued' | 'sent' | 'received'

export interface SyncItem {
  id: string
  astronautId: string
  type: SyncItemType
  priority: SyncPriority
  title: string
  /** Short, non-private description (private requests never include content). */
  summary: string
  createdAt: string
  missionDay: number
  sizeKb: number
  status: SyncStatus
  /** Links back to a photo / alert / check-in record. */
  refId?: string
}

export interface InboxMessage {
  id: string
  astronautId: string
  from: 'flight_surgeon' | 'mission_control' | 'admin'
  type: 'reply' | 'photo_review' | 'mission_change' | 'note'
  title: string
  body: string
  at: string
  missionDay: number
  read: boolean
  refId?: string
}

export type LinkState = 'connected' | 'waiting' | 'blackout'

export interface LinkStatus {
  state: LinkState
  earthDelaySeconds: number
  /** Human text, e.g. "Last sync 2 h ago". */
  lastSyncText: string
  lastSyncAt: string | null
  nextWindowInHours: number | null
  blackoutEndsInDays?: number
}

export interface SyncRunResult {
  link: LinkStatus
  sent: number
  received: number
  newInbox: InboxMessage[]
}

// ── photoCheckService.ts ──────────────────────────────────────────────────

export type PhotoMode = 'skin' | 'ultrasound'
export type SkinLabel = 'laceration' | 'burn' | 'bruise' | 'abrasion' | 'normal' | 'unsure'
export type UltrasoundScanType = 'eye' | 'neck_vein' | 'heart' | 'bladder' | 'other'
export type ScanQuality = 'ok' | 'too_dark' | 'too_bright' | 'blurry' | 'unreadable'

/** Pixel statistics computed in the browser (photoCheckService.computeImageStats). */
export interface ImageStats {
  width: number
  height: number
  /** 0–255 average luminance. */
  meanBrightness: number
  /** Variance of the Laplacian — higher = sharper. */
  sharpness: number
}

export interface PhotoRecord {
  id: string
  astronautId: string
  mode: PhotoMode
  missionDay: number
  timestamp: string
  phaseName: string
  bodyLocation: string
  fileName?: string
  /** Small data-URL thumbnail supplied by the UI (≤ ~100 KB; larger ones are dropped). */
  thumbnailDataUrl?: string
  notes?: string
  painLevel?: Rating5
  // Skin first look
  aiLabel?: SkinLabel
  /** 0–1. */
  aiConfidence?: number
  alternatives?: { label: SkinLabel; confidence: number }[]
  status?: StatusLevel
  firstAid?: string[]
  escalateWhen?: string[]
  // Ultrasound
  scanType?: UltrasoundScanType
  quality?: ScanQuality
  qualityMessage?: string
  // Ground review
  reviewStatus: 'pending' | 'reviewed'
  reviewNotes?: string
  engine: 'gemini' | 'offline_mock'
}

export interface SkinPhotoInput {
  astronautId: string
  day: number
  file?: Blob
  fileName?: string
  mimeType?: string
  bodyLocation: string
  notes?: string
  painLevel?: Rating5
  imageStats?: ImageStats
  thumbnailDataUrl?: string
}

export interface UltrasoundCaptureInput {
  astronautId: string
  day: number
  scanType: UltrasoundScanType
  file?: Blob
  fileName?: string
  mimeType?: string
  imageStats?: ImageStats
  thumbnailDataUrl?: string
  bodyLocation?: string
}

export interface PhotoComparison {
  sameLocation: boolean
  daysApart: number
  before: PhotoRecord
  after: PhotoRecord
  trend: 'healing' | 'unchanged' | 'worse' | 'unknown'
  note: string
}

// ── wellbeingService.ts ───────────────────────────────────────────────────

/** Private journal entry — stored on this device only, never synced or shared. */
export interface JournalEntry {
  id: string
  astronautId: string
  at: string
  missionDay: number
  text: string
}

export interface ReactionResult {
  ms: number
  baselineMs: number | null
  slowerPct: number | null
  status: DisplayStatus
  message: string
}

export interface SleepMoodSummary {
  sleepLastNight: number | null
  sleep7DayAvg: number | null
  sleepTargetHours: number
  /** Local day length (24 h Earth/ISS, 24.65 h Mars sol). */
  dayLengthHours: number | null
  mood7DayAvg: number | null
  moodCalendar: { day: number; value: number | null; status: DisplayStatus }[]
  circadian: 'on_schedule' | 'shifted'
  circadianNote: string
  tips: string[]
}

// ── guidanceService.ts ────────────────────────────────────────────────────

export type TriageSymptom = 'headache' | 'chest_pain' | 'dizziness' | 'nausea' | 'burn' | 'cut' | 'eye_change' | 'fever'

export interface TriageQuestion {
  kind: 'question'
  id: string
  question: string
  yes: string
  no: string
}

export interface TriageOutcome {
  kind: 'outcome'
  id: string
  level: ActionLevel
  title: string
  steps: string[]
}

export type TriageNode = TriageQuestion | TriageOutcome

export interface TriageTree {
  symptom: TriageSymptom
  label: string
  start: string
  nodes: Record<string, TriageNode>
}

export interface GuidedProcedure {
  id: 'blood_pressure' | 'eye_ultrasound' | 'wound_care' | 'standing_bp'
  title: string
  steps: string[]
  tips: string[]
}

export interface Medication {
  id: string
  name: string
  use: string
  qtyLeft: number
  unit: string
  /** ISO date. */
  expiryDate: string
  spaceNote?: string
}

export interface MedicationStatus extends Medication {
  status: StatusLevel
  /** e.g. "Expires in 12 days", "Expired 3 days ago", "Low stock". */
  statusText: string
}

