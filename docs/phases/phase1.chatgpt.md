# Phase 1 (ChatGPT): Initial Frontend and Home Redesign

**Owner:** ChatGPT / Codex (frontend and UI integration)
**Branch:** `codex/space-medic-home-redesign`
**Build:** 1
**Commits:** `c7d56f3` (initial frontend), `8722c3f` (Build 1 checkpoint)
**Status:** Completed and pushed. Historical version; later phases change this layout.

This phase built the first working Space Medic frontend against Claude's implemented services, then redesigned Home. This is the version the user identifies as having two body views: the generated standing figure on Home and the separate interactive Body Map.

## Folder ownership

| Agent | Can create/edit |
|---|---|
| Claude Code | `src/types`, `src/data`, `src/services` |
| ChatGPT / Codex | `src/components`, `src/App.tsx`, `src/index.css`, frontend dependencies and UI documentation |

Backend services, data and health thresholds are consumed by the UI. They are not reimplemented in the frontend.

## What was built

| Surface | Behavior at this checkpoint |
|---|---|
| Login and admin | Name/PIN login, demo accounts, astronaut account creation and mission-date editing through account services. |
| Mission shell | Dark spacecraft dashboard, desktop sidebar/mobile navigation, Earth-delay display and mission-control demo tools. |
| Home | Larger mission day, Earth/destination icons, a rocket marker with a filled progress line, check-in reminder, vital tiles, briefing and exposure information. |
| Human scan | Generated standing-body asset on Home with a repeating five-second bottom-to-top glow, pause/resume and reduced-motion support. |
| Body Map | Separate selectable body-system explorer with readings, graphs and countermeasures. This duplication was revised in Phase 2. |
| Check-in | Manual inputs from backend metadata, symptom collection and clinical ingestion feedback. |
| Trends | History, baseline and projection charts, plus measurement and action guidance. |
| Live updates | Wearable and cabin subscriptions feed the health evaluator and incremental briefing. Demo tools exercise anomalies and accepted/rejected ingestion. |

The initial frontend foundation is `c7d56f3`. The user's Build 1 checkpoint is the later `8722c3f`, not the foundation commit.

## Important files

- `src/components/medic/accounts.tsx`, `workspace.tsx`, `use-mission.ts`
- `src/components/medic/home.tsx`, `human-scan.tsx`, `assets/human-model.webp`
- `src/components/medic/body-map.tsx`, `checkin.tsx`, `charts.tsx`
- `src/App.tsx`, `src/index.css`

## Checks and limits

The frontend was built and exercised against the available backend. Later phases have their own verification records; their check-in persistence, private journal and cadence improvements should not be assumed to exist at this checkpoint. The early reminder used frontend scheduling logic, replaced with persisted backend scheduling in Phase 2. Figma exploration was unavailable in the environment, so this was not a Figma-derived implementation.

## Open this version

Stop the running app with Ctrl+C. Commit or stash local changes before switching.

```bash
git fetch origin
git checkout 8722c3f
npm install
npm run dev
```

This checkout is detached for inspection. To make changes based on it, create a new branch. To return to the current frontend branch, use `git switch codex/space-medic-home-redesign`.
