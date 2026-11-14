# Phase 3 (Claude Code): Health Rules Reconciled

**Owner:** Claude Code (backend, data and systems)
**Branch:** `claude/clever-bardeen-mn9gw6` · PR [RayanMaknojia/Uranus-monitoring#3](https://github.com/RayanMaknojia/Uranus-monitoring/pull/3)
**Status:** Done. Merge before Codex builds the Check-in sliders (mood is now 1–5).

A new team doc, `astronaut_health_monitor_pages.md`, gave different thresholds from the plan doc and from what was built in Phase 2. This step merges all three into **one rules file, `health_rules.md`**, choosing for each reading the rule that is safer, less noisy, or closer to real spaceflight practice, with the reason written next to it. The code now implements exactly that file.

## Folder ownership

| Agent | Can create/edit |
|---|---|
| Claude Code | `src/types`, `src/data`, `src/services` |
| Codex | `src/components`, `src/App.tsx`, `src/index.css`, and `package.json` / `package-lock.json` (only Codex runs `npm install` / `npx shadcn`) |

This step changed `src/data`, `src/services`, small **additive** fields in `src/types/astronaut.ts`, `PROJECT_PLAN.md`, the new `health_rules.md`, and this file. No UI files or `package.json`.

## What changed

| Reading | Before (Phase 2) | Now (`health_rules.md`) | Why |
|---|---|---|---|
| **Mood** | 1–10 scale | **1–5 scale** | Matches the pages doc and every other check-in scale (sleep quality, fatigue, nausea, pain); easier to tap while floating |
| **Mood Alert** | single day ≤ 3/10 | **1–2 for 3 days in a row**; self-harm mention is still an immediate Alert | One bad day is human; three is a pattern |
| **Sleep Alert** | single night < 6 h | **< 6 h for 3 nights in a row**, or **any night < 4 h** | ISS crews average ~6 h, so one short night is only Watch; < 4 h makes someone unfit for EVA/piloting (our addition) |
| **Blood pressure in flight** | *high* limits lowered by 9/5 mmHg | **low limits relax by 8/5 mmHg**; high limits stay at Earth values; relaxation **off for 14 days after landing** | Lower BP in flight is expected and shouldn't alarm; after landing, low BP means a fainting risk |
| **Diastolic Watch** | from 80 | **from 85** | Pages doc, less noisy |
| **Body temperature** | Watch 37.3 / Alert 38.3; +1 °C after day 60 | **Normal 36.1–37.5 (37.9 after day 60 in 0 g); Alert ≥ 38.5 never shifted** | More conservative: a real fever is never hidden |
| **Glucose** | Alert ≥ 200; fasting Watch ≥ 126 | **Alert > 180; fasting Watch from 100** (not fasting: 141–180) | Pages doc; after-meal rise isn't flagged |
| **Bone density** | Watch −3% / Alert −6% | **Watch −5% / Alert −10%** | A normal 6-month ISS stay loses ~6–9%; the old limits flagged every healthy crew |
| **SpO2 in 8.2 psi habitat** | Watch < 96 / Alert < 92 | **Watch < 96 / Alert < 90** (same Alert everywhere) | Both docs agree on Alert < 90; only the early warning is tighter |
| **Heart rate, personal** | ≥ 3.5 SD from baseline | **≥ 15% from your baseline average** | Pages doc; easier to explain to a non-doctor |

Unchanged: heart-rate ranges, radiation (% of the 600 mSv career limit and daily spikes), solar storm shelter alert, cabin CO2/O2/pressure limits, Earth-delay escalation, grey for missing data, 7-day trend warnings.

## New for the UI

- **`CHECKIN_INPUTS`** (`src/data`): one entry per check-in slider with `min`, `max`, `step`, `unit` and `normalText`, so the UI never hard-codes ranges.
- **`CHECKIN_SYMPTOMS`** (`src/data`): the morning symptom checklist from the pages doc ("skin problem" should offer "Add photo").
- **Types (additive):** `VitalsInput.sleepRecentNights` / `moodRecentDays` (filled automatically from history for the 3-in-a-row rules); `IndicatorUnit` uses `'/5'` for mood.
- Uploads and voice logs that say "x out of 10" for mood are converted to 1–5 automatically.

## Checks

| Check | Result |
|---|---|
| 39 rule-by-rule tests against `health_rules.md` | all pass |
| `npx tsc --noEmit` | pass |
| `npx tsc -p tsconfig.app.json --noEmit` (whole app, incl. UI) | pass, 0 errors |
| `npx eslint src/services src/types src/data` | pass |
| `npm run build` | pass |
| End-to-end script (login → live ticks → fever → solar storm → 4 demo uploads → briefing) | pass |

Dependencies were installed in a throwaway copy outside the repo; `package-lock.json` was not touched.

## Instructions for Codex (frontend, now)

Send this after the PR is merged:

```text
Pull the latest main first (git checkout main && git pull). Read, in this order: PROJECT_PLAN.md (v2.2, incl. the "STEP 2 — SERVICES LIVE" wiring cheat-sheet), astronaut_health_monitor_pages.md (pages + layout), health_rules.md (status rules — the backend already implements them; never re-implement thresholds in the UI), then src/types/astronaut.ts, src/data/ and src/services/ (read-only).

RULES
- Only create/edit files inside src/components/, src/App.tsx and src/index.css. Do NOT edit src/types/, src/data/ or src/services/. If you need something from the backend, leave a TODO and tell the user.
- You own package.json / package-lock.json: you are the only agent that runs npm install or npx shadcn@latest add.
- Mood is a 1–5 scale. Get every slider's min/max/step/unit/normal-range text from CHECKIN_INPUTS and the symptom list from CHECKIN_SYMPTOMS (src/data).
- Colours ONLY via displayStatus(indicator) + STATUS_COLORS / STATUS_LABELS: Emerald = Normal, Amber = Watch (also trend drifting_caution), pulsing Crimson = Alert, Slate Grey = No data (never green). Show a "Simulated" tag when indicator.simulated is true.
- All services are implemented and work offline. Do not add "not implemented" fallbacks; just handle errors gracefully (toast + keep the last good state).

BUILD (dark-mode, movie-grade Spacecraft Medical HUD, PC + tablet), MVP pages from astronaut_health_monitor_pages.md:
1. Login — name/login + PIN via accountService.authenticate(login, pin); astronauts → Home via getProfileForSession(session), admin → Admin. List the demo logins under the form from DEMO_LOGINS (admin, iss_crew, mars_crew, moon_crew). Logout via accountService.logout().
2. Global shell on every page — top bar with compact trip bar (missionTimeline.getMissionState(profile.mission, profile.missionDay) + formatTripBarLabel), Earth delay (formatDelay(state.earthDelaySeconds)), overall status dot, SOS button (opens a placeholder modal for now); side/bottom nav: Home, Check-in, Body Map, Trends, Streaks, More. Animated deep-space backdrop.
3. Mission Control Demo Bar (header, demo mode only): "+15m Wearable Sync" (wearable.tickOnce()), "Trigger Solar Storm Shelter Alert" (environmentFeed.triggerSolarEvent() then feed.tickOnce(), plus wearable.injectAnomaly('solar_flare')), "Inject fever / tachycardia / low SpO2 / sleep deprivation" (wearable.injectAnomaly from ANOMALY_LABELS), "Test Valid Ultrasound" and "Test Invalid File" (ingestionEngine.ingest(createDemoInput('valid_ultrasound' | 'invalid_file'))), and a Mission Day slider: on change build state = getMissionState(profile.mission, day) and evaluate with evaluateProfile(profile, { missionState: state, ignoreStaleness: true }); every page must update live.
4. Home — trip bar (EARTH ●━━○── MARS style using plan.phases and state.progress), overall status card (briefing headline), vital tiles (heart rate, BP, temp, SpO2, sleep, mood: value, colour, trend arrow from indicator.trend, last reading time; tap → Trends), mission exposure tiles (state.exposure: radiation total + % of 600 mSv, est. bone loss, current gravity + next phase), cabin strip (latest environment tick: tick.cabinEvaluation.params), active alerts list (briefing.environmentAlerts + emergingRisks), today's tasks from profile.routine.
5. Daily Check-in — sliders from CHECKIN_INPUTS + symptom checklist from CHECKIN_SYMPTOMS (show unit + normalText next to each field). Submit → ingestionEngine.ingest({ manualValues, astronautId: profile.id, day: state.missionDay }) → if accepted: applyIndicatorUpdates(profile, result.updates) → updateBriefing(briefing, { kind: 'artifact', artifact: result.artifact }, ctx); if rejected show result.verdict.rejectionReason. Show a coloured summary after submit. Also add the Multimodal Diagnostic Dropzone here (accept = ACCEPTED_FILE_TYPES): ingest({ file, fileName, mimeType, astronautId, day }) with "Accepted & Normalized" / "Rejected: Non-Biomedical Data" feedback showing artifact.extractedSummary or rejectionReason.
6. Body Map — clickable SVG human figure, 5 BodySystem zones coloured by report.systems (+ grey when all that zone's indicators are no_data); tap a zone → detail panel with its indicators, status reason (actionPlan / message), mini 14-day chart, "What you can do" (actionPlan.steps), escalation rule (ESCALATION_MODE_LABELS[report.escalationMode]).
7. Trends — Recharts: indicator.history value vs baseline, shaded status bands, mission-phase markers (plan.phases), projectedDaysToThreshold callout; cumulative radiation toward 600 mSv with 50%/80% lines. Slide-over drawer per KPI: How to Measure (howToMeasure), Why Needed (whyNeeded), Space note (spaceShiftNote), Action Protocol (actionPlan.steps + level).
8. Live AI Medical Briefing card (Home + its own panel) — createInitialBriefing({ profile, missionState, indicators }) on login; after EVERY event call updateBriefing(...) and show headline, plainEnglishSummary, emergingRisks (Trajectory Warnings with preventiveAction), recommendedToolChecks, environmentAlerts; show result.changes as toasts.
9. Crew Streaks / Countermeasure Checklist — for now: profile.routine as a gamified checklist (XP bar, completed state kept in React state) + Mission Readiness gauge from report.readinessScore. The full streak/badge backend arrives in Phase 3 — build the layout so it can switch to it later.
10. Admin — accountService.listAccounts(), createAstronaut(...) form (destination, launch date, PIN, notes; show AccountError messages), updateMissionDates(id, { launchDate, totalDays }), crew overview using listProfiles() + evaluateProfile(p).report.overallStatus.
11. Critical Health Alert override (O1) — full-screen when any fresh indicator becomes critical or briefing.overallStatus === 'critical' (and a solar-storm variant when the env tick has activeEvent?.shelterAdvised): reading, value, "Do this now" (actionPlan.steps), Retake / Notify crew / Confirm buttons. Keep confirm state in React for now (the confirmable-alert backend arrives in Phase 3).

LIVE LOOP (on login, per astronaut): wearable = createWearableStream({ profile }); feed = createEnvironmentFeed({ missionState, startingMissionDoseMSv: <current radiation_dose value> }); subscribe to both; on every tick: { profile, report, missionState } = applyIndicatorUpdates(profile, tick.updates) → updateBriefing(briefing, { kind: 'wearable_tick' | 'environment_tick', tick }, { profile, missionState, indicators: profile.indicators }). start() both in normal mode; stop() on logout/unmount.

NOT YET (Phase 3 backend is in progress) — show tidy "Coming soon" cards: Photo Check (skin AI + guided ultrasound), Habitat page, Exercise & Bone, Sleep/Mood/Journal, Guidance & Triage, Mission Control Sync, Cabin Emergency / SOS override flows, real streaks/badges/leaderboard.

FINISH: mark completed UI tasks [x] in PROJECT_PLAN.md, and make sure npx tsc -p tsconfig.app.json --noEmit and npm run build both pass with zero console errors.
```

## Next (Claude Code, Phase 3 backend)

Backend for the "Coming soon" pages, already listed as tasks in `PROJECT_PLAN.md`:

1. **Check-ins:** morning / evening / weekly / monthly schedule and eye exams (day 30, day 90, then every 90 days), streaks (a reported symptom counts as done; admin can excuse), badges, crew leaderboard (consistency only, never health values).
2. **Body mass and exercise** as indicators (body mass: Watch 3–5% loss, Alert > 5%; exercise: Watch 60–119 min, Alert < 60 min for 3 days), workout log, bone-loss projection (no exercise vs actual), reaction test.
3. **Confirmable override alerts:** O1 Critical Health, O2 Cabin Emergency (CO2 > 3 mmHg for 1 h), O3 Radiation Storm, O4 SOS; comms-blackout banner; "Is it me or the air?" helper.
4. **Photo Check** (skin first look; "unsure" below 70% → flight-surgeon queue; guided ultrasound capture + quality check), sync outbox/inbox, triage decision trees, medication list, device-only private journal.

When Phase 3 lands, a follow-up Codex prompt will switch the "Coming soon" cards to the real backend.
