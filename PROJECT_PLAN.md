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

Shared Data Schema v2.2 (src/types/astronaut.ts — SOURCE OF TRUTH)
Status thresholds: health_rules.md (reconciled; the code implements exactly that file). Pages/UX: astronaut_health_monitor_pages.md.
v2.1 = the v2.0 schema + astronaut_health_monitor_plan.md (team reference doc). Read the file itself for every field; key points:

TypeScript
export type StatusLevel = 'nominal' | 'caution' | 'critical';        // UI labels: Normal / Watch / Alert
export type DisplayStatus = StatusLevel | 'no_data';                  // grey — missing data is NEVER green
export type TrendDirection = 'stable' | 'improving' | 'drifting_caution' | 'rapid_decline';
export type BodySystem = 'cardiovascular' | 'musculoskeletal' | 'radiation_immune' | 'metabolic' | 'behavioral';
export type DataModality = 'wearable_auto' | 'manual_slider' | 'lab_document' | 'ultrasound_image' | 'voice_log' | 'environment_feed';
export type IndicatorId = 'blood_sugar' | 'radiation_dose' | 'heart_rate' | 'blood_pressure' | 'bone_density'
                        | 'sleep_hours' | 'mood' | 'body_temp' | 'spo2';   // spo2 NEW (cardiovascular zone)
export type ActionLevel = 'self_care' | 'crew_alert' | 'flight_surgeon';
// v2.2: mood is a 1–5 scale (unit '/5'). Sleep and mood Alerts need 3 in a row (health_rules.md).
export type EscalationMode = 'contact_ground' | 'act_then_report';   // by Earth delay (ISS/Moon vs transit/Mars)

// Environment = WHERE THE CREW IS ON A GIVEN MISSION DAY (replaces ISS_ORBIT/LUNAR_BASE/MARS_TRANSIT/SURFACE_ROVER)
export type EnvironmentType = 'EARTH' | 'EARTH_ORBIT' | 'DEEP_SPACE' | 'MARS_ORBIT' | 'MARS_SURFACE' | 'MOON_SURFACE';
export type HabitatType = 'ground' | 'spacecraft' | 'station' | 'rover' | 'moon_base' | 'mars_base';
export type MissionDestination = 'EARTH_TRAINING' | 'ISS' | 'MOON' | 'MARS';

export interface HistoryPoint { timestamp: string; value: number; baseline: number; source: DataModality; day: number; }

export interface HealthIndicator {
  id: IndicatorId; system: BodySystem; name: string;
  value: number | string | null;               // null = missing
  unit: string; status: StatusLevel;
  dataState: 'fresh' | 'stale' | 'missing';     // NEW — paint grey unless 'fresh'
  lastMeasuredDay?: number;
  trend: TrendDirection; projectedDaysToThreshold?: number;
  hazardLink: string; howToMeasure: string; whyNeeded: string; spaceShiftNote?: string;
  actionPlan: { level: ActionLevel; steps: string[]; escalationMode?: EscalationMode };
  history: HistoryPoint[];
  simulated: boolean;                           // NEW — show "Simulated" tag (real daily vitals not public)
}

export interface IngestedArtifact { id; timestamp; fileName?; modality; accepted; rejectionReason?; extractedSummary; mappedIndicators: IndicatorId[]; severity: StatusLevel; }

export interface MissionHealthBriefing {
  lastUpdated; overallStatus; headline; plainEnglishSummary;
  emergingRisks: { indicatorId; severity; explanation; preventiveAction }[];
  recommendedToolChecks: string[];
  escalationMode: EscalationMode;               // NEW
  environmentAlerts: string[];                  // NEW — shelter / CO2 / phase-transition alerts
}

export interface RoutineTask { id; title; xp; completed; frequency: 'daily' | 'weekly'; linkedSystem: BodySystem; refreshesIndicator?: IndicatorId; }

// NEW — mission timeline ("what day of the mission is it?")
MissionPhase { order, name, startDay, endDay, environment, habitat }
MissionPlan { id, name, destination, launchDate, totalDays, phases[] }
CumulativeExposure { missionDay, days0g, daysPartialG, totalRadiationMSv, estBoneLossPct }   // the body's "bank account"
TransitionAlert { kind, severity, title, guidance[], activeFromDay, activeToDay }
MissionState { plan, missionDay, phase, environment, earthDelaySeconds, escalationMode, exposure,
               daysToNextPhase, nextPhase, progress (0–1 for trip bar), activeAlerts[] }

// NEW — accounts & baselines
CrewAccount / AuthSession (admin | astronaut, login + PIN; demo-grade only)
PersonalBaseline { astronautId, source: 'earth_mode' | 'first_7_days' | 'population_default', values: { mean, sd, n } per indicator }
AstronautProfile gains: crewRole, login, mission: MissionPlan, habitat, notes[], baseline

// NEW — reference tables & environment feed
ReferenceRange, CabinLimit, HazardRiskEntry, CabinReading, CabinEvaluation, RadiationEvent (DONKI SEP → shelter), EnvironmentTick

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

Mission Timeline (missionTimeline.ts):

Maps mission day → phase → environment rules (gravity, dose rate, Earth delay, cabin atmosphere). Keeps the cumulative exposure "bank account" (days at 0 g / partial g, radiation, bone loss = (1.25/30)·(1 − g) %/day) and transition alerts (entering 0 g, day-60 temp shift, landing after transit, solar storm). Drives the trip bar + demo slider.

Environment Feed (environmentFeed.ts):

Replays cabin CO2/temp/humidity (OSDR shape) and radiation dose-rate (RadLab shape) by mission time; evaluates cabin vs NASA-STD-3001 limits; DONKI SEP events (live with key, simulated offline) raise a "Go to shelter" alert.

Accounts (accountService.ts):

Admin (mission control) creates astronauts (name, role, PIN, destination, launch date, notes) and edits dates for delays; astronauts log in with name + PIN. Demo logins: admin, mars_crew, iss_crew, moon_crew. localStorage, offline-first, demo-grade auth.

Task Board
[x] STEP 1 — CONTRACT LOCKED v2.1 (Claude Code): src/types/astronaut.ts now covers PROJECT_PLAN v2.0 + astronaut_health_monitor_plan.md. Stubs with final signatures (bodies throw "not implemented" until Step 2): src/services/wearableStream.ts, ingestionEngine.ts, briefingEngine.ts, missionTimeline.ts, environmentFeed.ts, accountService.ts. Ready now (real, not stubs): src/data (ENVIRONMENTS ×6, MISSION_TEMPLATES, CREW_PROFILES iss_crew / mars_crew / moon_crew, INDICATOR_GUIDES incl. SpO2) and healthEvaluator (evaluateProfile, evaluateVitals, displayStatus, STATUS_COLORS / STATUS_LABELS / ESCALATION_MODE_LABELS, escalationModeFor). Parallel execution may start.


[x] STEP 2 — SERVICES LIVE (Claude Code): every function in src/services is implemented — no "not implemented" throws remain, so no try/catch fallbacks are needed. `npx tsc --noEmit`, `tsc -p tsconfig.app.json --noEmit`, eslint on src/services|types|data, and `npm run build` all pass. All services work fully offline; Gemini is used only if VITE_GEMINI_API_KEY (or AIConfig.apiKey) is set. Wiring cheat-sheet for Codex:
- Login: accountService.authenticate(login, pin) → getProfileForSession(session). Demo logins in DEMO_LOGINS (admin 0000, mars_crew 1111, iss_crew 2222, moon_crew 3333). Admin: listAccounts, createAstronaut, updateMissionDates.
- Hydrate: healthEvaluator.evaluateProfile(profile) → { indicators, report, missionState }. Demo slider: evaluateProfile(profile, { missionState: getMissionState(profile.mission, day), ignoreStaleness: true }).
- Trip bar: missionTimeline.getMissionState(plan, day?) + formatTripBarLabel(state); plan.phases for segments.
- Live data: wearableStream.createWearableStream({ profile }) and environmentFeed.createEnvironmentFeed({ missionState }) → subscribe(tick) → healthEvaluator.applyIndicatorUpdates(profile, tick.updates) → briefingEngine.updateBriefing(briefing, { kind: 'wearable_tick' | 'environment_tick', tick }, { profile, missionState, indicators }).
- Demo bar: wearable.tickOnce() (+15m), environmentFeed.triggerSolarEvent() + wearable.injectAnomaly('solar_flare'), ingestionEngine.ingest(createDemoInput('valid_ultrasound' | 'invalid_file' | ...)).
- Dropzone / sliders: ingestionEngine.ingest({ file, fileName, mimeType, astronautId, day } or { manualValues, astronautId, day }) → artifact (accepted / rejectionReason) + updates → applyIndicatorUpdates → updateBriefing({ kind: 'artifact', artifact }).
- First briefing: briefingEngine.createInitialBriefing({ profile, missionState, indicators }).
- Colors/labels: displayStatus(ind), STATUS_COLORS, STATUS_LABELS, ESCALATION_MODE_LABELS. Cabin panel: tick.cabinEvaluation; shelter banner: tick.activeEvent?.shelterAdvised.


[x] STEP 2b — RULES RECONCILED (Claude Code): health_rules.md merges the plan doc, the pages doc and Phase 2. Mood is now 1–5. Sleep/mood Alerts need 3 in a row. Temperature, BP (low limits relax in flight, not after landing), glucose, bone, SpO2 and the heart-rate 15% baseline rule follow that file. New for the UI: CHECKIN_INPUTS (slider min/max/step/unit/normal text) and CHECKIN_SYMPTOMS in src/data.

UI implications of v2.1 (for Codex — your call how to render):
- EnvironmentType values changed (see schema). The "Environment Switcher" becomes a mission/crew selector + trip bar ("Day 45 · Flying to Mars · 138 days to arrival"); in demo mode the trip bar is a slider that calls missionTimeline.getMissionState(plan, day).
- Use displayStatus(indicator) for colors: 'no_data' = grey. Never show missing data as green.
- 9 indicators now (spo2 added, cardiovascular zone). Show a "Simulated" tag when indicator.simulated.
- Show escalation as ESCALATION_MODE_LABELS[report.escalationMode] (contact ground vs act-then-report).
- Login screen (name + PIN) and an admin setup screen; demo logins in accountService.DEMO_LOGINS.
- Cabin panel (CO2, temp, humidity) + "Go to shelter" banner from environmentFeed.

Folder ownership: Claude Code → src/types, src/data, src/services only. Codex → src/components, src/App.tsx, src/index.css, and package.json / package-lock.json (only Codex runs npm install / npx shadcn).

Claude Code Tasks (Data, Multimodal Gatekeeper, Trajectory Logic & Incremental AI)
[x] Create src/types/astronaut.ts matching the v2.1 schema above

[x] Create src/data/nasaSpaceflightData.ts with realistic astronaut profiles, NASA HRP hazard mappings, CSA radiation thresholds, and baseline history arrays

[x] Create src/services/healthEvaluator.ts with real medical threshold rules (incl. SpO2, missing-data, delay-based escalation)

[x] Add slope-based trajectory detection (trend & projectedDaysToThreshold), personal-baseline scoring, and phase-adjusted ranges (temp +1 °C after day 60 in 0 g, BP −8–10 mmHg in flight, sleep target 8.5 h / alert < 6 h, tighter SpO2 in 8.2 psia habitats) to healthEvaluator.ts

[x] Create src/services/ingestionEngine.ts implementing the AI Biomedical Relevance Gatekeeper (accept/reject with reason) + One-Time Multimodal Normalizer (with offline mock parsers for demo reliability)

[x] Create src/services/briefingEngine.ts implementing Stateful Incremental AI Summary updates (reads prior briefing + new normalized event only; outputs color-coded plain-English diagnosis, early drift warnings, and tool instructions)

[x] Create src/services/wearableStream.ts simulating automatic 15-minute wearable telemetry ticks (HR, SpO2, skin/core temp, steps, HRV, sleep) + demo anomaly injection triggers

[x] Create src/services/missionTimeline.ts (phase lookup, Earth delay, escalation mode, cumulative exposure bank account, transition alerts, trip-bar label)

[x] Create src/services/environmentFeed.ts (cabin CO2/temp/humidity replay + NASA-STD-3001 cabin limits, RadLab-style dose feed, DONKI SEP shelter alerts with offline fallback)

[x] Create src/services/accountService.ts (admin-created accounts, name + PIN login, launch-date edits, offline localStorage) + src/data reference tables (REFERENCE_RANGES, CABIN_LIMITS, HAZARD_RISK_MAP)

[x] Reconcile thresholds with astronaut_health_monitor_pages.md → health_rules.md (mood 1–5, 3-in-a-row sleep/mood Alerts, CHECKIN_INPUTS)

[ ] PHASE 3 backend: check-in schedule (morning / evening / weekly / monthly / eye exams) + streaks + badges + crew leaderboard (consistency only)

[ ] PHASE 3 backend: body mass + exercise minutes indicators, workout log, bone-loss projection (no-exercise vs actual), reaction test

[ ] PHASE 3 backend: confirmable override alerts (O1 Critical Health, O2 Cabin Emergency, O3 Radiation Storm, O4 SOS) + comms-blackout banner + "Is it me or the air?" helper

[ ] PHASE 3 backend: Photo Check (skin first-look with "unsure" < 70% → flight-surgeon queue; guided ultrasound capture + quality check), sync outbox/inbox, triage trees, medication list, device-only journal

Codex Tasks (Movie-Grade Spacecraft HUD, Interactive Body Map & Demo Controls)
[x] Build Dark-Mode Spacecraft Medical HUD with animated deep-space canvas/nebula backdrop, glowing glassmorphic telemetry panels, mission timeline and demo crew selector (ISS / Moon / Mars)

[x] Build Interactive Clickable SVG Human Body Map highlighting all 5 BodySystem zones with dynamic Emerald (nominal), Amber (caution / drifting_caution), and pulsing Crimson (critical) glow filters

[x] Build Universal Data Ingestion & Manual Vitals Panel combining manual sliders (blood_sugar, blood_pressure, body_temp, sleep_hours, mood) with a drag-and-drop Multimodal Diagnostic Dropzone (shows Gatekeeper "Accepted & Normalized" vs. "Rejected: Non-Biomedical Data" toast feedback)

[x] Build Live AI Medical Briefing Card displaying color-coded overall status, plain-English health explanation, "Emerging Trajectory Warnings" callouts, and preventive steps

[x] Build Recharts Dynamic Trend Graphs (showing baseline vs. actual + projected drift) paired with the "How to Measure / Why Needed / Action Protocol" slide-over drawer

[x] Build Gamified Daily Countermeasure Checklist with Mission Readiness Score gauge, XP bar, and session checklist progress (real streaks / badges remain Phase 3)

[x] Add Mission Control Demo Bar in header (+15m Wearable Sync, Trigger Solar Flare Spike, Test Valid Ultrasound vs. Invalid File) for live hackathon judging


UI MVP integration (Codex): login and admin account creation / mission-date editing; shared mission state; Home, Check-in, Body Map, Trends, Streaks checklist, More, briefing, timeline; live wearable and cabin subscriptions; demo anomalies and normalized-file ingestion; confirmable critical-health / solar-shelter overlays. Phase 3 pages remain explicit Coming soon views. Services, types, data, and health thresholds were not edited.
