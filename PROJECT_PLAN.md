Space Medic Engineer — NASA Space Apps 2026 Master Spec (v2.0)
Mission Objective
Build an autonomous, movie-grade Astronaut Health Monitoring & Self-Assessment HUD addressing NASA's 5 Spaceflight Hazards (Space Radiation, Isolation & Confinement, Distance from Earth, Gravity Fields, Hostile Closed Environments) and Canadian Space Agency (CSA) radiation monitoring & biodosimetry principles (organ-specific exposure limits, neutron/ionizing dose tracking).

Designed for non-physician scientists/astronauts on long-duration missions:

Continuous Autonomous Telemetry: Ingests automated wearable vitals every 15 mission minutes (heart rate, body temp, sleep, stress/HRV).

Universal Multimodal Diagnostic Dropzone: Accepts any manual clinical input (blood panels, ultrasound images, voice logs, lab PDFs/CSVs, manual sliders), intelligently validates biomedical relevance (rejecting non-health noise), and normalizes raw media once into lightweight structured clinical summaries so downstream AI never re-reads heavy images or audio.

Predictive Trajectory & Incremental AI Briefing: Tracks both active thresholds and multi-day drift ("on the path to abnormal"), maintaining a stateful, color-coded plain-English medical briefing that explains what is happening, what might happen next, how to prevent it, and how to operate onboard diagnostic tools.

Tech Stack
Frontend: Vite + React + TypeScript + Tailwind CSS + shadcn/ui + Recharts (Responsive PC & Tablet PWA)

AI / Multimodal Pipeline: Gemini Flash (Gatekeeper + One-Time Media Extractor + Incremental Briefing Updater) with deterministic fallback rules in healthEvaluator.ts

Shared Data Schema (src/types/astronaut.ts)
TypeScript
export type EnvironmentType = 'ISS_ORBIT' | 'LUNAR_BASE' | 'MARS_TRANSIT' | 'SURFACE_ROVER';

export type StatusLevel = 'nominal' | 'caution' | 'critical';

export type TrendDirection = 'stable' | 'improving' | 'drifting_caution' | 'rapid_decline';

export type BodySystem =
  | 'cardiovascular'
  | 'musculoskeletal'
  | 'radiation_immune'
  | 'metabolic'
  | 'behavioral';

export type DataModality =
  | 'wearable_auto'
  | 'manual_slider'
  | 'lab_document'
  | 'ultrasound_image'
  | 'voice_log';

export interface HistoryPoint {
  timestamp: string; // e.g., "Sol 14 08:00" or "Day 12"
  value: number;
  baseline: number;
  source: DataModality;
}

export interface HealthIndicator {
  id:
    | 'blood_sugar'
    | 'radiation_dose'
    | 'heart_rate'
    | 'blood_pressure'
    | 'bone_density'
    | 'sleep_hours'
    | 'mood'
    | 'body_temp';
  system: BodySystem;
  name: string;
  value: number | string;
  unit: string; // 'mg/dL', 'mSv', 'bpm', 'mmHg', '%', 'hrs', '°C', '/10'
  status: StatusLevel;
  trend: TrendDirection;
  projectedDaysToThreshold?: number; // Populated when drifting toward caution/critical
  hazardLink: string; // Maps directly to one of NASA's 5 Spaceflight Hazards
  howToMeasure: string; // Step-by-step tool guide for non-doctor scientists
  whyNeeded: string; // Plain-English explanation of spaceflight physiological impact
  actionPlan: {
    level: 'self_care' | 'crew_alert' | 'flight_surgeon';
    steps: string[];
  };
  history: HistoryPoint[];
}

export interface IngestedArtifact {
  id: string;
  timestamp: string;
  fileName?: string;
  modality: DataModality;
  accepted: boolean;
  rejectionReason?: string; // Shown if non-health file/input is blocked
  extractedSummary: string; // Normalized once; raw binary/audio never re-sent to LLM
  mappedIndicators: HealthIndicator['id'][];
  severity: StatusLevel;
}

export interface MissionHealthBriefing {
  lastUpdated: string;
  overallStatus: StatusLevel;
  headline: string;
  plainEnglishSummary: string; // Jargon-free explanation for non-medical crew
  emergingRisks: {
    indicatorId: HealthIndicator['id'];
    severity: StatusLevel;
    explanation: string; // Why current trajectory indicates an upcoming issue
    preventiveAction: string;
  }[];
  recommendedToolChecks: string[]; // Next diagnostic measurements to perform
}

export interface RoutineTask {
  id: string;
  title: string;
  xp: number;
  completed: boolean;
  frequency: 'daily' | 'weekly';
  linkedSystem: BodySystem;
}
System Pipeline Architecture
Automated 15-Minute Wearable Loop (wearableStream.ts):

Runs on a configurable interval (e.g., 15s real-time = 15m mission time) pushing heart_rate, body_temp, and sleep_hours into healthEvaluator.ts.

Multimodal Gatekeeper & Extract-Once Normalizer (ingestionEngine.ts):

Step 1 (Validate): Inspects uploaded image (ultrasound/rash/dosimeter), document (blood panel), audio note, or raw text. Rejects non-health inputs immediately with a clear reason.

Step 2 (Normalize Once): Converts accepted multimodal inputs into a single IngestedArtifact JSON record (extractedSummary, mappedIndicators, severity) and discards raw media from future AI context windows.

Threshold + Slope Trajectory Evaluator (healthEvaluator.ts):

Evaluates static NASA/CSA clinical thresholds (nominal / caution / critical) and computes linear drift over recent history points to flag drifting_caution or rapid_decline before a metric crosses a hard limit.

Stateful Incremental AI Briefing (briefingEngine.ts):

Takes (currentBriefing + newNormalizedEvent + updatedIndicators) and incrementally rewrites MissionHealthBriefing in plain English—highlighting color-coded abnormalities, early trajectory warnings, and actionable prevention steps.

Task Board
[x] STEP 1 — CONTRACT LOCKED (Claude Code): src/types/astronaut.ts upgraded to v2.0 + service contracts; stubs created for src/services/ingestionEngine.ts, briefingEngine.ts, wearableStream.ts (final signatures; bodies throw "not implemented" until Step 2). Additive vs. the schema above: HistoryPoint.day (numeric day), IndicatorId alias, EmergingRisk, IndicatorUpdate, WearableTick / WearableStreamController, IngestionInput / GatekeeperVerdict / IngestionResult, BriefingEvent / BriefingContext / BriefingUpdateResult, AIConfig, TrajectoryResult. Parallel execution may start.

Folder ownership: Claude Code → src/types, src/data, src/services only. Codex → src/components, src/App.tsx, src/index.css, and package.json / package-lock.json (only Codex runs npm install / npx shadcn).

Claude Code Tasks (Data, Multimodal Gatekeeper, Trajectory Logic & Incremental AI)
[x] Create src/types/astronaut.ts matching the v2.0 schema above

[x] Create src/data/nasaSpaceflightData.ts with realistic astronaut profiles, NASA HRP hazard mappings, CSA radiation thresholds, and baseline history arrays

[x] Create src/services/healthEvaluator.ts with real medical threshold rules + slope-based trajectory detection (trend & projectedDaysToThreshold)

[ ] Create src/services/ingestionEngine.ts implementing the AI Biomedical Relevance Gatekeeper (accept/reject with reason) + One-Time Multimodal Normalizer (with offline mock parsers for demo reliability)

[ ] Create src/services/briefingEngine.ts implementing Stateful Incremental AI Summary updates (reads prior briefing + new normalized event only; outputs color-coded plain-English diagnosis, early drift warnings, and tool instructions)

[ ] Create src/services/wearableStream.ts simulating automatic 15-minute wearable telemetry ticks + demo anomaly injection triggers

Codex Tasks (Movie-Grade Spacecraft HUD, Interactive Body Map & Demo Controls)
[ ] Build Dark-Mode Spacecraft Medical HUD with animated deep-space canvas/nebula backdrop, glowing glassmorphic telemetry panels, Environment Switcher (ISS, Lunar Base, Mars Transit, Rover), and Crew Profile selector

[ ] Build Interactive Clickable SVG Human Body Map highlighting all 5 BodySystem zones with dynamic Emerald (nominal), Amber (caution / drifting_caution), and pulsing Crimson (critical) glow filters

[ ] Build Universal Data Ingestion & Manual Vitals Panel combining manual sliders (blood_sugar, blood_pressure, body_temp, sleep_hours, mood) with a drag-and-drop Multimodal Diagnostic Dropzone (shows Gatekeeper "Accepted & Normalized" vs. "Rejected: Non-Biomedical Data" toast feedback)

[ ] Build Live AI Medical Briefing Card displaying color-coded overall status, plain-English health explanation, "Emerging Trajectory Warnings" callouts, and preventive steps

[ ] Build Recharts Dynamic Trend Graphs (showing baseline vs. actual + projected drift) paired with the "How to Measure / Why Needed / Action Protocol" slide-over drawer

[ ] Build Gamified Daily Countermeasure Checklist with Mission Readiness Score gauge, XP bar, and streak tracker

[ ] Add Mission Control Demo Bar in header (+15m Wearable Sync, Trigger Solar Flare Spike, Test Valid Ultrasound vs. Invalid File) for live hackathon judging
