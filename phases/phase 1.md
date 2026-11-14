# Phase 1: Contract Lock (v2.1)

**Owner:** Claude Code (backend, data and systems)
**Branch:** `claude/clever-bardeen-mn9gw6`
**Status:** Done. Parallel execution with Codex can start.

Phase 1 locks the shared schema in `src/types/astronaut.ts`. That file is the agreement between the backend logic (Claude Code) and the UI (Codex). It now covers `PROJECT_PLAN.md` v2.0 plus the team reference doc `astronaut_health_monitor_plan.md`.

**Codex should start from this branch** (or after it is merged into `main`). Older copies of the schema are out of date.

## Folder ownership

| Agent | Can create/edit |
|---|---|
| Claude Code | `src/types`, `src/data`, `src/services` |
| Codex | `src/components`, `src/App.tsx`, `src/index.css`, and `package.json` / `package-lock.json` (only Codex runs `npm install` / `npx shadcn`) |

Rule: fields may be **added** to `astronaut.ts`, but existing fields must not be renamed or removed without telling the other agent.

## What changed because of the reference doc

### 1. Environments follow the mission day
The doc's main idea is "what day of the mission is it?", because a Mars trip passes through several environments.

- The old four environments (`ISS_ORBIT`, `LUNAR_BASE`, `MARS_TRANSIT`, `SURFACE_ROVER`) are replaced by the doc's six: `EARTH`, `EARTH_ORBIT`, `DEEP_SPACE`, `MARS_ORBIT`, `MARS_SURFACE`, `MOON_SURFACE`.
- Each one carries the doc's gravity, radiation per day, Earth delay, day length, dust risk and cabin air pressure/oxygen.
- Rover, station and base are a separate habitat field (`HabitatType`), since the challenge lists spacecraft, station, rover, Moon base and Mars base.
- Mission schedules exist for Earth training, the ISS, the Moon and the doc's 866-day Mars trip. The mission day is worked out from the launch date.
- New types cover the running totals (days at zero gravity, total radiation, estimated bone loss), transition alerts (entering zero gravity, day-60 temperature shift, landing on Mars, solar storm), and a `MissionState` object for the trip bar and demo slider.

### 2. Health readings
- **Blood oxygen (SpO2)** is a new indicator, with stricter limits in the low-pressure Moon and Mars habitats.
- **Missing data shows grey, never green.** Indicators record whether a reading is fresh, stale or missing, and `displayStatus()` returns `no_data` when it isn't fresh.
- **A `simulated` flag** on every indicator, because real daily vitals aren't public.
- **Personal baseline** per astronaut, taken from their first 7 readings.
- **Crew-facing labels** are Normal / Watch / Alert. Internal values (`nominal` / `caution` / `critical`) are unchanged.

### 3. Escalation depends on Earth delay
On the ISS or Moon the plan says "contact the flight surgeon". In deep space or at Mars it says "act now with onboard guidance, then report".

### 4. Cabin air and radiation feed
Types for cabin CO2, temperature and humidity, cabin limits from NASA's crew health standard (NASA-STD-3001), and solar storm events from NASA's space-weather service (DONKI) that trigger a "Go to shelter" alert.

### 5. Accounts
Mission control (admin) creates astronaut accounts; astronauts log in with name + PIN. Demo logins: `admin`, `mars_crew`, `iss_crew`, `moon_crew` (`moon_crew` was added on top of the doc's three). Demo-level login only, not real security.

## Files

### Placeholder services (signatures final, bodies throw "not implemented" until Phase 2)
- `src/services/wearableStream.ts`
- `src/services/ingestionEngine.ts`
- `src/services/briefingEngine.ts`
- `src/services/missionTimeline.ts`
- `src/services/environmentFeed.ts`
- `src/services/accountService.ts`

### Already working
- `src/data/nasaSpaceflightData.ts`: six environments, mission schedules, three demo crew members, indicator guides including SpO2.
- `src/services/healthEvaluator.ts`: `evaluateProfile`, `evaluateVitals`, `displayStatus`, `STATUS_COLORS`, `STATUS_LABELS`, `ESCALATION_MODE_LABELS`, `escalationModeFor`, the SpO2 check and missing-data handling.

### Demo crew

| Login | Where | Status | Escalation |
|---|---|---|---|
| `iss_crew` | ISS, day 92 | Watch | Contact ground |
| `mars_crew` | Flying to Mars, day 45 | Watch | Act now, then report |
| `moon_crew` | Moon base, day 21 | Alert | Contact ground |

### `PROJECT_PLAN.md`
- Schema section describes v2.1.
- New Phase 2 tasks listed for Claude Code.
- "UI implications" note for Codex: environment switcher becomes a trip bar/slider, grey for missing data, SpO2 tile, login screen, shelter banner. Codex's task list was left as written.

## Things to know
- **Health evaluator checkbox was corrected.** Trend detection and the doc's space adjustments (temperature +1 °C after day 60, lower blood pressure in flight, sleep target 8.5 h with alert under 6 h) aren't built yet. That part is unticked and listed as a Phase 2 task.
- **Mood stays on a 1–10 scale.** The doc says 1–5; switching would affect the evaluator and UI sliders.
- **Branch history has a merge commit.** The branch was rebased onto the new `main`, a force-push was blocked, so the pushed version was merged back in and pushed normally. Nothing was lost.

## Next (Phase 2, Claude Code)
Implement the six placeholder services, plus trend detection, personal-baseline scoring and phase-adjusted ranges in `healthEvaluator.ts`, and the reference tables (`REFERENCE_RANGES`, `CABIN_LIMITS`, `HAZARD_RISK_MAP`) in `src/data`.
