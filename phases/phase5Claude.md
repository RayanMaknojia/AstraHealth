# Phase 5 (Claude Code): Gemini, Health Database, Body Scan and Auto-SOS

**Owner:** Claude Code (backend + the UI for these features, approved by the user for this phase)
**Status:** Implemented and tested.

## What the user asked for

1. **Gemini image diagnosis.** The astronaut uploads a photo of a scab, bite, scar, infection or injury. It is turned into processed data, the injury type is identified and a solution is given. If it is too severe (for any input, not only images), interim steps are shown and the SOS is pressed, alerting the AstraHealth station on Earth and the nearest ISS. The decision uses the astronaut's past data and the new data (check-in, file/text, wearable).
2. **Gemini medical briefing.** Pressing **Start scan** on Home runs a Python script that generates new KPI readings. Gemini assesses them together with relevant past data. **Full briefing** shows everything: the last check-in, the last 24 hours and the past 7 days. Every AI feature needs a fallback.
3. **A proper database** instead of hard-coded values. Wearable, scan and manual inputs append to it. Each user starts with 21 days of fake data, coloured red/yellow/green by `health_rules.md`.

## Decisions (asked and answered before building)

| Question | Answer |
|---|---|
| Database | IndexedDB in the browser (offline, no server needed for data) |
| 21 days | Keep each crew member's mission day; seed the 21 days before today |
| Seed mix | Realistic: mostly green, some Watch/Alert days, existing demo stories kept |
| Auto-SOS | 30 s countdown with "I'm OK, cancel" and "Send SOS now"; sends by itself if nobody answers |
| Scan generator | Python server, browser fallback when it's not running |
| Gemini key | In the Python server (`server/.env`), never in the browser |
| Briefing data | Last 24 h + 7-day trends + last check-in |
| UI | Built by Claude Code this time (user approved) |

## How it fits together

```
Browser (React)                                   Python server (server/app.py, stdlib only)
  Start scan ──► scanService ──POST /api/scan──►  scan.py: trend-following readings
                 │ (fallback: same generator in TS)
                 ▼
  healthDb (IndexedDB) ◄── every reading appended (seed, wearable, check-in, file, scan)
                 │
                 ▼
  emergencyService.assessEmergency ──► SOS countdown ──► sendSos (AstraHealth Earth + ISS)
                 │
  aiBriefing ──POST /api/ai/json──►  Gemini (key from server/.env, model fallback chain)
  photoCheck ──POST /api/ai/json──►  Gemini (image + processed data + vitals + history)
                 │ (fallback: offline rules; the UI says which engine wrote it)
```

## Files

| File | Purpose |
|---|---|
| `server/app.py` | Local server: `GET /api/health`, `POST /api/scan`, `POST /api/ai/json` (Gemini proxy). Models tried in order; a model that times out or errors is skipped for 5 minutes; 15 s per attempt, 35 s overall. |
| `server/scan.py` | Body-scan generator: continues the astronaut's own 7-day trend with small noise; about 12% of scans put one reading at Watch or Alert (never life-threatening). |
| `server/test_server.py` | 10 unit tests (trend, bounds, anomaly rate, endpoints, no-key fallback). |
| `server/.env.example` | Copy to `server/.env` and set `GEMINI_API_KEY`. `server/.env` is git-ignored. |
| `src/services/_gemini.ts` | Now calls the Python server instead of Google directly (the browser never holds the key). Never throws. |
| `src/services/healthDb.ts` | IndexedDB tables `readings`, `scans`, `briefings`, `photos`, `uploads`, `sos`, `meta`; 21-day seeding; colour per reading; profile rebuilt from the database at login (older days averaged per day). Memory fallback when IndexedDB is unavailable. |
| `src/services/scanService.ts` | Calls `/api/scan`; TypeScript copy of the generator as fallback. |
| `src/services/aiBriefing.ts` | Full briefing: last check-in, last 24 h, past 7 days (rule colours), concerns, next checks, interim steps, SOS recommendation. Gemini writes the words and can only make the status more serious. |
| `src/services/emergencyService.ts` | "Too severe for onboard care?" rules, SOS recipients with signal delay, `sendSos` (override + high-priority outbox items + database). |
| `src/services/photoCheckService.ts` | 11 skin classes (adds bite, scab, scar, infection, rash), red/dark/yellow pixel percentages, Gemini prompt with vitals/symptoms/earlier photos, context-aware severity (`judgeSkinSeverity`). |
| `src/data/nasaSpaceflightData.ts` | 21 seed days per crew (7 older days continue each trend backwards; the newest 14 days and baselines are unchanged) plus past Watch/Alert events. |
| `src/types/astronaut.ts` | §8: `DbReading`, `ScanResult`, `AiBriefing`, `BriefingLine`, `EmergencyAssessment`, `SosEvent`, `PhotoContext`; `body_scan` source; new skin labels; `HistoryPoint.diastolic`. |
| `src/App.tsx` | Loads (and on first run seeds) the profile from the database before opening the workspace. |
| `src/components/medic/use-mission.ts` | Appends every update to the database; new actions `scan`, `refreshBriefing`, `photoAssessed`, `report`, `sendSosNow`, `cancelSos`; emergency check after every input; briefing re-written on scan, check-in, photo, upload, status change (at most once a minute) and Refresh. |
| `home.tsx`, `home-scan.tsx` | Scan shows the new readings and which scanner made them; briefing card shows "Written by Gemini" / "Offline rules (reason)" and a Refresh button; the full briefing drawer shows every section. |
| `report-problem.tsx`, `checkin.tsx` | New "Something wrong? Tell Space Medic" panel: text, photo or file. |
| `photo-check.tsx` | Sends the astronaut's context; shows findings, why-this-colour, do-this-now and get-help-if. |
| `workspace.tsx` | SOS button sends immediately; 30 s auto-SOS countdown dialog; SOS alert lists recipients and arrival times. |
| `health_rules.md` | New section: when it is an SOS, skin-photo severity table, briefing colour rule. |

## Severity and SOS (short version)

- An ordinary Alert (for example 3 short nights) keeps the existing full-screen alert. It is **not** an SOS.
- **SOS countdown** when: red-flag words (chest pain, can't breathe, severe allergic reaction, fainting/seizure, stroke signs, bleeding that won't stop, self-harm); one life-threatening vital (SpO2 < 85, HR > 150 or < 35, temperature ≥ 40 or < 35, BP ≥ 180/120 or < 80 systolic, glucose < 54 or > 300); two vitals at Alert at once; a skin photo judged an emergency (e.g. infection + fever ≥ 38.5 °C); or Gemini says SOS while the rules already say Alert.
- Cancelled countdowns are not raised again for the same reasons for 60 minutes.
- Recipients: **AstraHealth Station (Earth medical lab)**, the **ISS** (or ISS crewmates when on the ISS) and your crewmates, each with the one-way signal time. Dispatch is simulated.

## Tests

| Check | Result |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build` | Pass (existing Three.js chunk-size warning) |
| `python -m unittest discover -s server` | 10/10 pass |
| Node backend script: seeding (189 readings per crew, with Watch/Alert days), hydrate keeps every crew's overall status, scan append, emergency rules, skin severity, offline briefing | All pass |
| Playwright with the real Gemini key through the Python server (see the run summary in the final report) | See below |

## Limits

- Simulated readings and simulated SOS dispatch; decision support, not diagnosis.
- The Gemini key in `server/.env` is fine for a demo; anything real needs proper hosting and authentication.
- When Gemini is enabled, briefing data and photos go to Google's API.
- The database lives in one browser; clearing site data resets it (the next login re-seeds).
