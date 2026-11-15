# Phase 2 (Claude Code): Backend Services Live

**Owner:** Claude Code (backend, data and systems)
**Branch:** `claude/clever-bardeen-mn9gw6` (commit `d22dd4e`)
**Status:** Done. Every service in `src/services` is implemented, and no "not implemented" stubs remain, so Codex doesn't need try/catch fallbacks.

Phase 1 locked the shared schema and left placeholder services. Phase 2 replaces every placeholder with working logic so the UI can be wired to real data. Everything runs fully offline; Gemini is optional.

**Merge this branch into `main` before Codex starts the frontend**, so it builds against the real services.

## Folder ownership

| Agent | Can create/edit |
|---|---|
| Claude Code | `src/types`, `src/data`, `src/services` |
| Codex | `src/components`, `src/App.tsx`, `src/index.css`, and `package.json` / `package-lock.json` (only Codex runs `npm install` / `npx shadcn`) |

Phase 2 changed `src/services` and `src/data`, plus `docs/PROJECT_PLAN.md` checkboxes and this file. It also made a few **additive** changes to `src/types/astronaut.ts`, with nothing renamed or removed:
- a new `SpaceAdjustments` type
- an optional `environment` field on `IngestionInput`
- optional `missionMinutesPerTick` and `startingMissionDoseMSv` on `EnvironmentFeedConfig`

Nothing in `src/components`, `src/App.tsx`, `src/index.css` or `package.json` was touched.

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `npx tsc -p tsconfig.app.json --noEmit` (whole app, incl. UI) | pass, 0 errors |
| `npx eslint src/services src/types src/data` | pass |
| `npm run build` (`tsc -b && vite build`) | pass |
| End-to-end runtime script (login → live ticks → anomalies → uploads → briefing) | pass |

Dependencies were installed in a throwaway copy outside the repo, so `package-lock.json` was not touched.

## What each service does

### `healthEvaluator.ts`
- **Space adjustments** (`getSpaceAdjustments`):
  - Body temperature ranges shift **+1 °C after 60 continuous days in 0 g**. The fever (Alert) bound moves only half as far, so real fevers are still caught.
  - **In-flight blood pressure** high limits drop by 9 / 5 mmHg (24 h BP runs 8-10 mmHg lower), scaled by (1 − g) in partial gravity.
  - **Sleep target 8.5 h, Alert below 6 h**, Watch below 7 h.
  - Tighter SpO2 limits in 8.2 psia Moon/Mars habitats.
  - A plain-English `spaceShiftNote` per indicator.
- **Trajectory** (`computeTrajectory`): linear fit over the last 7 days (one point per day), producing `trend` (`stable` / `improving` / `drifting_caution` / `rapid_decline`) and `projectedDaysToThreshold`. Radiation and bone loss are judged against the expected rate for the current environment.
- **Personal baseline:** heart rate, SpO2 and blood sugar that are normal on paper but ≥ 3.5 SD from the astronaut's own baseline become Watch ("unusual for you").
- **Missing / stale data:** readings older than a per-indicator limit become `stale`, both stale and missing show grey, and the report lists them.
- **`applyIndicatorUpdates(profile, updates)`** merges any new readings (wearable, environment, manual, upload) and re-evaluates. Returns a new profile.

### `missionTimeline.ts`
- Phase for any mission day, including **pre-launch Earth mode** and **back on Earth**.
- Earth delay that grows during Mars transit and peaks at solar conjunction. Mars legs always use **act now, then report**; ISS and Moon use **contact the flight surgeon**.
- Exposure "bank account": days at 0 g / partial g, mission radiation, estimated bone loss `(1.25/30)·(1 − g)` %/day.
- Transition alerts: entering 0 g, day-60 temperature shift, gravity re-adaptation after landing (and on return to Earth), Mars conjunction comms blackout.
- `formatTripBarLabel` → "Day 45 · Flying to Mars · 138 days to arrival".

### `environmentFeed.ts`
- Cabin CO2 / temperature / humidity / pressure / inspired O2 replay, graded against NASA-STD-3001 limits (`evaluateCabin`).
- Radiation dose-rate feed that continues the astronaut's cumulative dose.
- `triggerSolarEvent()` → solar particle event sized for the location, with a **"Go to shelter"** flag. Live NASA DONKI events only if a NASA API key is given; offline otherwise.

### `accountService.ts`
- Demo logins: `admin` / 0000, `mars_crew` / 1111, `iss_crew` / 2222, `moon_crew` / 3333.
- Admin can create astronauts (they start with all-grey "no data" indicators in Earth mode) and edit launch date or mission length; the mission day updates automatically.
- Saved in `localStorage` (memory fallback), works offline. **Demo-grade login only, not real security.**

### `wearableStream.ts`
- Every 15 mission minutes (default 15 s real time): heart rate, core and skin temperature, SpO2, steps, HRV, and last night's sleep on wake-up. Includes a daily circadian rhythm.
- Daily 2 h exercise block (resting HR/temperature aren't graded during it).
- Demo anomalies that last a few ticks: tachycardia, fever (ramps up), sleep deprivation, low SpO2, solar-flare stress response.

### `ingestionEngine.ts`
- **Gatekeeper:** accepts medical images, dosimeter photos, lab reports (CSV / text / simple PDF), voice logs and manual sliders. Rejects non-health files with a clear reason and a suggestion of what to upload. Physically impossible slider values (e.g. HR 400) are rejected.
- **Extract once:** a single pass (one Gemini call when a key is set, otherwise offline parsers) pulls out vitals, lab flags (WBC, hemoglobin, platelets, lymphocytes) and symptoms (chest pain, shortness of breath, dizziness, headache, dust irritation, low mood...). The raw file is never needed again.
- **Severity is always re-graded locally** with the same rules as the dashboard. The AI can add findings but can't downgrade them.
- Demo fixtures: `valid_ultrasound` (bone −3.2%, Watch), `valid_blood_panel` (high fasting glucose, low WBC), `valid_voice_log` (5 h sleep, headache, low mood, Alert), `invalid_file` (movie poster, rejected).

### `briefingEngine.ts`
- `createInitialBriefing` and `updateBriefing` build a plain-English briefing: headline, what's abnormal and why, early trajectory warnings with prevention steps, next measurements (with how-to), escalation sentence based on Earth delay, and environment alerts.
- **Stateful:** remembers shelter / cabin alerts and the latest uploaded log between updates. Returns a `changes[]` list for toasts.
- Deterministic code owns every status and alert. Gemini (if a key is set) only rewrites wording, and only when something meaningful changed, not on every 15-minute tick.

## Wiring for Codex
Full cheat-sheet: **STEP 2** section of `docs/PROJECT_PLAN.md`. Short version:

| UI piece | Call |
|---|---|
| Login | `accountService.authenticate(login, pin)` → `getProfileForSession(session)` |
| Hydrate dashboard | `healthEvaluator.evaluateProfile(profile)` → `{ indicators, report, missionState }` |
| Trip bar / demo slider | `missionTimeline.getMissionState(plan, day)` + `formatTripBarLabel(state)`; evaluate with `{ missionState, ignoreStaleness: true }` |
| Live data | `createWearableStream({ profile })`, `createEnvironmentFeed({ missionState })` → `subscribe(tick)` |
| Any new reading | `applyIndicatorUpdates(profile, updates)` → `updateBriefing(briefing, event, { profile, missionState, indicators })` |
| Demo bar | `wearable.tickOnce()`, `feed.triggerSolarEvent()` + `wearable.injectAnomaly('solar_flare')`, `ingest(createDemoInput('valid_ultrasound' \| 'invalid_file'))` |
| Dropzone / sliders | `ingestionEngine.ingest({ file, fileName, mimeType, astronautId, day })` or `ingest({ manualValues, ... })` |
| Colours / labels | `displayStatus(ind)`, `STATUS_COLORS`, `STATUS_LABELS`, `ESCALATION_MODE_LABELS` |

## Things to know
- **Mood stays on the 1-10 scale.**
- **Gemini is optional.** Set `VITE_GEMINI_API_KEY` to enable it; a key in a Vite env var ships to the browser, which is fine for a demo but not for production.
- **Staleness and the demo slider:** sliding the mission day far past the last reading makes indicators grey (correct behaviour). For the judges' slider, pass `ignoreStaleness: true` to `evaluateProfile`.
- Some values are estimates by design (partial-gravity BP and bone loss, Earth delay curve, solar-event dose rates) and are labeled that way in the code and notes.

## Next (Phase 2, Codex)
Merge this branch, then Codex builds the HUD in `src/components`, `src/App.tsx` and `src/index.css`: login switcher, Mission Control demo bar, mission-day slider, body map, ingestion panel, briefing card, trend graphs with the guide drawer, and the countermeasure checklist.
