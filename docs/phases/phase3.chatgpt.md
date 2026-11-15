# Phase 3 (ChatGPT): Rotating Organ Cards

**Owner:** ChatGPT / Codex (frontend)
**Branch:** `codex/space-medic-home-redesign`
**Build:** 3
**Commit:** `7b21f9d`
**Status:** Completed and pushed.

This phase added five selectable organ cards to Body Map. The icons rotate horizontally around their vertical axis. Home retained the Phase 2 layout with no body figure.

## Folder ownership

| Agent | Can create/edit |
|---|---|
| Claude Code | `src/types`, `src/data`, `src/services` |
| ChatGPT / Codex | `src/components`, `src/App.tsx`, `src/index.css`, frontend dependencies and UI documentation |

Backend services, data and health thresholds are consumed by the UI. They are not reimplemented in the frontend.

## What changed

| Item | Behavior |
|---|---|
| Five cards | Brain and wellbeing, Heart and circulation, Metabolism, Bones and muscles, Immune and radiation. |
| Organ artwork | Inline SVG brain, anatomical heart, liver, bone and immune-cell symbols. These are stylized drawings, not realistic 3D anatomical models. |
| Motion | A slow 12-second CSS `rotateY` loop gives each icon a horizontal turn. |
| Controls | Shared Pause rotation / Resume rotation control. Reduced-motion preferences disable automatic rotation. |
| Selection | Clicking or keyboard-activating a card updates the same existing detail panel and body-region selection. |
| Layout | Five cards in one desktop row; two columns on narrow screens. |
| Existing figure | The standing Body Map figure and scan remained. The duplicate text-only system-button list was removed. |

## Files changed

- Added `src/components/medic/organ-systems.tsx`.
- Updated `body-map.tsx` and `human-scan.tsx` to share system selection with the cards.
- Added responsive card and motion styling in `src/index.css`.
- Marked the completed task in `docs/PROJECT_PLAN.md`.

## Checks

| Check | Result at completion |
|---|---|
| ESLint and production build, including TypeScript | Pass |
| Five cards side by side at desktop size | Pass |
| Horizontal rotation changes over time | Pass |
| Pause/resume | Pass |
| All five systems selectable with the keyboard | Pass |
| Home has no organ cards | Pass |
| 1440, 834, 390 and 320 px layouts | Pass; no horizontal overflow |
| Reduced-motion preference | Pass; animation disabled |
| Browser JavaScript errors | None observed |

Browser checks used Playwright because the Browser plugin was unavailable.

## Scope limits

`checkin_fields (1).md` was reviewed but not applied in this phase. Build 3 changes organ cards only. It does not implement the later `final.md.pdf`: no realistic GLB models, no return of the figure to Home, and no 30-second reaction test yet.

## Open this version

```bash
git fetch origin
git checkout 7b21f9d
npm install
npm run dev
```

Stop the app and commit or stash local changes before switching. Return with `git switch codex/space-medic-home-redesign`.
