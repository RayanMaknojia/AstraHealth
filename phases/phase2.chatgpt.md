# Phase 2 (ChatGPT): Final UI Scope and Backend Integration

**Owner:** ChatGPT / Codex (frontend and UI integration)
**Branch:** `codex/space-medic-home-redesign`
**Build:** 2
**Commit:** `4216a4d`
**Backend merge:** `901311d` merged `origin/main` at `911f771` before the UI changes.
**Status:** Completed and pushed.

This phase implemented `final_ui_scope_revision.md`. Home became a compact dashboard without a body figure or charts. The standing anatomical scan moved into Body Map, countermeasures were consolidated there, and all graphs moved to Trends. Claude's completed backend was integrated without editing service logic.

## Folder ownership

| Agent | Can create/edit |
|---|---|
| Claude Code | `src/types`, `src/data`, `src/services` |
| ChatGPT / Codex | `src/components`, `src/App.tsx`, `src/index.css`, frontend dependencies and UI documentation |

Backend services, data and health thresholds are consumed by the UI. They are not reimplemented in the frontend.

## What changed

| Surface | Result |
|---|---|
| Navigation | Five destinations: Home, Check-in, Body Map, Trends and More. Removed standalone Countermeasures, Photo Check and Mission Timeline routes. |
| Home | Compact journey and check-in reminder, larger typography, six vital tiles, lower-profile exposure row and a short briefing with a full drawer. Alerts are inside the briefing. No body or charts. |
| Body Map | Standing scan, five keyboard-selectable regions, explicit statuses, threshold references, action plans and countermeasure checklist. Pause/resume and reduced-motion support. No graphs. |
| Check-in | Actual persisted backend schedules and submissions. Wearable review with manual fallback, daily basics, weekly checks replacing morning on weekly days, and extended exams. |
| Weekly checks | Fasting glucose, body mass, food/hydration questionnaire and a true timed 60-second reaction test. |
| Extended checks | Crewmate-guided health exam, sleep/team questionnaire and ultrasound guidance with local image previews. |
| Journal | Device-only save/history/delete through the wellbeing service, separate from clinical ingestion and sync. |
| Images | Inline symptom/exam previews only. Object URLs are released; images are not stored or uploaded and disappear after refresh. |
| Trends | 1D, 7D, 30D and mission views with units and wearable/manual/synthetic source distinctions. System-specific navigation from Body Map. |
| More | Expanded cabin readings, cabin summaries, air-versus-symptoms helper, five NASA hazards, working triage, procedures, medication information and references. |
| Alerts | Backend-confirmed critical overrides, SOS and communication banners instead of temporary frontend confirmation state. |

## Backend integration

- `checkinService`: real due tasks, submissions and saved records; saved clinical readings are restored into the profile after refresh.
- `wellbeingService`: private journal and reaction-trial scoring.
- `alertService`: override evaluation, persistent confirmation and SOS.
- `environmentFeed`: cabin history, summaries and symptom context.
- `guidanceService`: triage decisions, procedures and medication list.

Breathing remains Unknown when the backend has no reading. The UI does not fabricate sensor values.

## Checks

| Check | Result at completion |
|---|---|
| TypeScript app check | Pass |
| ESLint | Pass |
| Production build | Pass |
| Home and Body Map without charts | Pass |
| Persisted clinical values after refresh | Pass |
| Journal excluded from sync; image previews not retained | Pass |
| Weekly replacement and timed reaction test | Pass |
| Extended exam and local scan preview | Pass |
| Cabin, five hazards and triage | Pass |
| Five pages at 1440, 834, 390 and 320 px | Pass; no horizontal overflow |
| Browser JavaScript errors | None observed |

Browser testing used Playwright because the Browser plugin was unavailable. External font requests failed under the cloud network; a bundled font remained available. These checks cover the offline demo, not real medical devices or real ground communication.

## Open this version

```bash
git fetch origin
git checkout 4216a4d
npm install
npm run dev
```

Stop the app and commit or stash local changes before switching. Return with `git switch codex/space-medic-home-redesign`.
