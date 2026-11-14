/**
 * Shared data schema for the Space Medic HUD.
 * Mirrors the "Shared Data Schema" section of PROJECT_PLAN.md exactly;
 * the extra types below it are additive helpers used by the data layer
 * and the health evaluator.
 */

// ── Core schema (PROJECT_PLAN.md) ──────────────────────────────────────────

export type EnvironmentType = 'ISS_ORBIT' | 'LUNAR_BASE' | 'MARS_TRANSIT' | 'SURFACE_ROVER'

export type StatusLevel = 'nominal' | 'caution' | 'critical'

export type BodySystem =
  | 'cardiovascular'
  | 'musculoskeletal'
  | 'radiation_immune'
  | 'metabolic'
  | 'behavioral'

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
  day: number
  value: number
  baseline: number
}

export interface HealthIndicator {
  id: IndicatorId
  system: BodySystem
  name: string
  /** number for most vitals; string for blood pressure, e.g. "118/76". */
  value: number | string
  unit: IndicatorUnit | string
  status: StatusLevel
  /** Which of NASA's 5 hazards drives this risk. */
  hazardLink: HazardName | string
  /** Simple step-by-step instruction for non-doctor astronauts. */
  howToMeasure: string
  /** Plain-English explanation of spaceflight impact. */
  whyNeeded: string
  actionPlan: ActionPlan
  history: HistoryPoint[]
}

export interface RoutineTask {
  id: string
  title: string
  xp: number
  completed: boolean
  frequency: 'daily' | 'weekly'
}

// ── Additive helper types ──────────────────────────────────────────────────

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
