# Phase 3 Backend (Claude Code): Every Remaining Page Has a Backend

**Owner:** Claude Code (backend, data and systems)
**Branch:** `claude/clever-bardeen-mn9gw6`
**Status:** Done. Every page in `astronaut_health_monitor_pages.md` now has working backend logic, including the ones the frontend showed as "Coming soon".

This phase does **not** depend on any frontend. It only adds plain TypeScript in `src/types`, `src/data` and `src/services`; any UI can call it.

## Folder ownership

| Agent | Can create/edit |
|---|---|
| Claude Code | `src/types`, `src/data`, `src/services` |
| Frontend (Codex or whoever builds the UI) | `src/components`, `src/App.tsx`, `src/index.css`, and `package.json` / `package-lock.json` |

Changed: new services and `src/data/phase3Data.ts`; **additive** types in `src/types/astronaut.ts` (§7, nothing renamed or removed; `EnvironmentFeedController` gained `cabinHistory()`, `CabinReading` gained optional `noiseDb` / `lightPhase`); `health_rules.md`; `PROJECT_PLAN.md`; this file. No UI files or `package.json`.

## Suggested workflow for the frontend

1. Keep the Codex frontend on its own branch (`git checkout -b codex/frontend` and commit there; don't push to `main`).
2. After this phase is merged, run `git merge main` on that branch to get the new backend.
3. Experiment locally (`npm run dev`). When you're happy, push the branch and open a PR. If not, delete it — `main` is unaffected.

## What was built

| Page (pages doc) | Service | What it does |
|---|---|---|
| **3. Daily Check-in** (schedule) and **7. Crew Streaks** | `checkinService.ts` | Morning (required), evening (optional), weekly, monthly, eye exam (day 30, 90, then every 90). `submitCheckin` grades vitals, logs exercise / body mass / reaction extras, queues a sync item. **A symptom-only check-in still counts.** Streaks, 7 badges (incl. team "Steady Orbit" at ≥ 90%), team goal, **consistency-only leaderboard**, admin excuse, admin crew overview. Demo crew start with 32 / 21 / 9-day streaks. |
| **4. Photo Check** | `photoCheckService.ts` | **Skin first look:** cut, burn, bruise, abrasion, normal, unsure. Below 70% confidence → "Unsure. Sent to the flight surgeon for review." — never guesses. First-aid steps and "when to escalate" per type. **Ultrasound:** step-by-step guides (eye, neck vein, heart, bladder, other), **real pixel quality check** (too dark / too bright / blurry via `computeImageStats`), auto-tagging with body part, day and phase, no AI diagnosis. History, compare two photos (healing / worse), reviews arrive via Sync. Gemini for images when a key is set; offline stand-in otherwise. |
| **8. Habitat** | `environmentFeed.ts` (added) | 24 h cabin history, 1 h / 6 h / 24 h CO2 averages, noise + hearing-protection reminder, light phase, **"Is it me or the air?"** (symptoms vs last 6 h CO2). |
| **9. Exercise and Bone** | `exerciseService.ts` | Workout log, daily status (Watch < 120 min, Alert < 60 min for 3 days), weekly goal days (6), exercise streak, body mass vs preflight (Watch 3–5% loss, Alert > 5%), **bone projection: no exercise vs your actual compliance** (estimate). |
| **10. Sleep, Mood and Journal** | `wellbeingService.ts` | **Private journal stored on the device only** (never synced, no export). 60-second reaction test scoring (ignores false starts / lapses) + status vs baseline. 7-day sleep and mood averages, 14-day mood calendar, circadian note (Mars sol 24 h 39 min), tips, "Request private talk with ground" (queued without content). |
| **11. Guidance and Triage** | `guidanceService.ts` | Yes/no decision trees for headache, chest pain, dizziness, nausea, burn, cut, eye change, fever → steps + colour, adjusted for Earth delay. Guided procedures (BP, eye ultrasound, wound care, standing BP test). Medication list: red expired, yellow expiring ≤ 30 days or ≤ 5 left. |
| **12. Mission Control Sync** | `syncService.ts` | Outbox (high priority first), inbox, link status: always on near Earth, 2 h windows every 8 h on Mars legs, **blackout at solar conjunction**. `runSync` sends and generates ground replies (photo reviews, alert acknowledgements). |
| **O1–O4 overrides + banner** | `alertService.ts` | Full-screen alerts that stay until **Confirm** (logged who/when), each queued as a high-priority outbox item. O1 any fresh Alert vital · O2 CO2 > 3 mmHg for ≥ 1 h, pressure out of limits, inspired O2 < 127 · O3 solar storm with shelter · O4 SOS button, or O1 unconfirmed for 10 min. Deduplicated, 60-min cool-down after confirm. Thin banner for comms blackout / waiting for link. |

Rules for all of these are in `health_rules.md` ("Phase 3 rules" table).

## Checks

| Check | Result |
|---|---|
| 39 rule-by-rule tests (`health_rules.md`) | all pass |
| Phase 2 end-to-end (login → live ticks → fever → solar storm → uploads → briefing) | pass |
| **Phase 3 end-to-end** (every service above, incl. dedupe, cool-down, SOS escalation, two-step Mars sync, reviews flowing back to photos, journal never in outbox) | pass |
| `npx tsc --noEmit` | pass |
| `npx tsc -p tsconfig.app.json --noEmit` (whole app) | pass, 0 errors |
| `npx eslint src/services src/types src/data` | pass |
| `npm run build` | pass |

Dependencies were installed in a throwaway copy outside the repo; `package-lock.json` was not touched.

## Things to know

- **`mars_crew` opens with an Alert:** its demo history has 3 nights under 6 h in a row, so O1 (sleep) is raised on login. That's the rules working; confirm it to continue.
- **Bone projection over 866 days is large** (≈ −31% at the demo crew's exercise level) because the reference-doc formula is applied for the whole mission. It is labeled as an estimate.
- **Skin "AI" offline** reads the file name and notes; a real onboard image model (TensorFlow.js / ONNX) would replace it. With a Gemini key the photo itself is classified.
- **Demo-grade storage:** everything is in `localStorage` on the device. Each service has a `reset…()` function for a clean judging run.

## Prompt for the frontend (when you add these pages)

```text
Pull the latest main (or `git merge main` into your frontend branch). Read PROJECT_PLAN.md (the "PHASE 3 — BACKEND FOR ALL REMAINING PAGES" list), phases/phase3BackendClaude.md, astronaut_health_monitor_pages.md and health_rules.md. Only edit src/components/, src/App.tsx and src/index.css — never src/types/, src/data/ or src/services/. Colours only via displayStatus / STATUS_COLORS / STATUS_LABELS (grey for no_data).

Replace every "Coming soon" card with the real page:
1. Daily Check-in schedule: getDueCheckins(profile) for Today's tasks (Home) and the Check-in tabs (morning / evening / weekly / monthly / eye exam, fields from each task's `fields`). Submit with submitCheckin({ profile, slot, day, values, extras, symptoms }); apply result.ingestion?.updates with applyIndicatorUpdates, then updateBriefing; toast result.message. "Skin problem" symptom → button to Photo Check with the location prefilled.
2. Crew Streaks: getStreak (badge on Home + 28-day calendar), getBadges(profile, getTeamGoal(profiles)), getTeamGoal bar, getLeaderboard(profiles) table (never show health values). Profiles from accountService.listProfiles().
3. Photo Check (tabs): Skin — camera/upload, body-location picker, notes, pain 1–5; draw the image to a canvas, pass imageStats = computeImageStats(ctx.getImageData(...)) and a small thumbnailDataUrl; analyzeSkinPhoto(...) → show skinResultCard(record) + record.firstAid / record.escalateWhen + FIRST_LOOK_DISCLAIMER. Ultrasound — pick scan type, show ULTRASOUND_SCAN_GUIDES[type].steps and goodImage, captureUltrasound(...) → if quality !== 'ok' show qualityMessage and "try again". History panel: listPhotos(id) with review status; compare two with comparePhotos.
4. Habitat: feed.cabinHistory() charts (CO2 with the 3.0 line, temp, humidity), summarizeCabin(history), "Is it me or the air?" card from isItMeOrTheAir(todaySymptoms, history).
5. Exercise & Bone: logWorkout form, getExerciseSummary (today ring, week days, streak, by type), getBodyMassSummary, projectBoneLoss(plan, id, day) chart (two lines + note).
6. Sleep, Mood & Journal: getSleepMoodSummary(profile, missionState), mood calendar, 60-second reaction test (collect trial times → scoreReactionTrials → recordReaction), private journal (addJournalEntry / listJournal / deleteJournalEntry — label "Stored on this device only"), "Request private talk" → requestPrivateTalk.
7. Guidance & Triage: listTriageSymptoms → startTriage / answerTriage → triageOutcomeForMission(outcome, missionState) (colour from .status); listProcedures; getMedicationList (colour from .status).
8. Mission Control Sync: getLinkStatus(missionState, id) in the top bar, listOutbox / listInbox / unreadCount / markRead, "Sync now" → runSync(missionState, id) (also call it every few minutes).
9. Overrides: after every evaluation / tick call syncOverrides({ profile, report, missionState, environmentTick, cabinHistory: feed.cabinHistory() }); render the first active override full-screen (OVERRIDE_TITLES, headline, details, steps) with Confirm → confirmOverride(id, name). SOS button → raiseSos({ astronautId, name, location, missionDay }). Thin top banner from getBanner(missionState, id).
10. Admin: getCrewOverview(profiles) table, excuseCheckin form, getOverrideLog().

FINISH: npx tsc -p tsconfig.app.json --noEmit and npm run build pass with zero console errors; mark UI tasks [x] in PROJECT_PLAN.md.
```
