# Space Medic Engineer — NASA Space Apps 2026 Master Spec

## Mission Objective
Build an interactive Astronaut Health Monitoring & Self-Assessment HUD addressing NASA's 5 Spaceflight Hazards (Space Radiation, Isolation & Confinement, Distance from Earth, Gravity Fields, Hostile Closed Environments) and Canadian Space Agency (CSA) radiation monitoring principles.

## Tech Stack
- Vite + React + TypeScript + Tailwind CSS + shadcn/ui + Recharts

## Shared Data Schema (`src/types/astronaut.ts`)
- `EnvironmentType`: `'ISS_ORBIT' | 'LUNAR_BASE' | 'MARS_TRANSIT' | 'SURFACE_ROVER'`
- `StatusLevel`: `'nominal' | 'caution' | 'critical'`
- `BodySystem`: `'cardiovascular' | 'musculoskeletal' | 'radiation_immune' | 'metabolic' | 'behavioral'`
- `HealthIndicator`:
  - `id`: string (`'blood_sugar'`, `'radiation_dose'`, `'heart_rate'`, `'blood_pressure'`, `'bone_density'`, `'sleep_hours'`, `'mood'`, `'body_temp'`)
  - `system`: BodySystem
  - `name`: string
  - `value`: number | string
  - `unit`: string (`'mg/dL'`, `'mSv'`, `'bpm'`, `'mmHg'`, `'hrs'`, `'°C'`, `'/10'`)
  - `status`: StatusLevel
  - `hazardLink`: string (which of NASA's 5 hazards drives this risk)
  - `howToMeasure`: string (simple step-by-step instruction for non-doctor astronauts)
  - `whyNeeded`: string (plain-English explanation of spaceflight impact)
  - `actionPlan`: { level: `'self_care' | 'crew_alert' | 'flight_surgeon'`, steps: string[] }
  - `history`: `{ day: number; value: number; baseline: number }[]`
- `RoutineTask`: `{ id: string; title: string; xp: number; completed: boolean; frequency: 'daily' | 'weekly' }`

## Task Board

### Claude Code Tasks (Data, NASA/CSA Thresholds & Logic)
- [x] Create `src/types/astronaut.ts` matching the exact schema above
- [x] Create `src/data/nasaSpaceflightData.ts` with realistic astronaut profiles, NASA HRP hazard mappings, CSA radiation thresholds, and multi-day baseline trend arrays
- [x] Create `src/services/healthEvaluator.ts` with real medical threshold rules (evaluating user-entered blood sugar mg/dL, BP, temp, sleep, radiation mSv, and mood into `nominal`/`caution`/`critical` + generating escalation actions)

### Codex Tasks (HUD UI, Interactive Body Map & Gamification)
- [ ] Replace template business dashboard with Dark-Mode Spacecraft Medical HUD layout, Environment Switcher (`ISS`, `Lunar Base`, `Mars Transit`, `Rover`), and Crew Profile selector
- [ ] Build Interactive Clickable SVG Human Body Map highlighting the 5 body systems in Emerald Green (`nominal`), Amber (`caution`), and Crimson (`critical`)
- [ ] Build "Log Vitals" interactive input panel (sliders/inputs for blood sugar, BP, temp, sleep, mood) wired to `healthEvaluator.ts`
- [ ] Build Recharts dynamic trend graphs + Plain-English "How to Measure / Why Needed / Action Protocol" drawer
- [ ] Build Gamified Daily Routine Checklist with Readiness Score gauge and streak tracker
