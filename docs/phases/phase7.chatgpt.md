# Phase 7 (ChatGPT): Fixed Required Marks and Approved Home Layout

**Owner:** ChatGPT / Codex (frontend)
**Branch:** `codex/space-medic-home-redesign`
**Starting checkpoint:** Phase 6, `7f130ae`
**Implementation commits:** `533874c`, `b1b96b2`
**Status:** Completed, tested and pushed. This file records the recent changes after Phase 6.

## What changed

### Required marks and vital-card spacing (`533874c`)

- Required asterisks are red and appear immediately after their heading, followed by a space.
- Label text and its asterisk are grouped together so changing a slider's output no longer moves the asterisk independently.
- The same heading/mark treatment covers daily ratings, measurement labels, monthly exam labels, weekly confirmations and selected-medication dose/time fields.
- The weekly reaction-test heading uses the same adjacent required-mark placement.
- Home vital cards stopped stretching to the height of the taller restored body scan. Their existing inner padding was retained, and measurement values stayed bold.
- Required-field validation, exam guidance navigation, draft preservation and reset-after-success behavior from Phase 6 were unchanged.

### Prototype review

The user first requested image-only layout prototypes. Those previews did not change application code. The approved arrangement used the earlier `3c8dbbc` card proportions and spacing as its starting point, bold measurements, the restored detailed anatomical scan, and a narrower Medical briefing directly below the vitals. The user then explicitly requested implementation of that arrangement.

### Approved Home implementation (`b1b96b2`)

| Area | Implemented behavior |
|---|---|
| Left column | Six compact vital cards in three desktop columns and two rows, with bold measurements and small, consistent gutters. |
| Medical briefing | Sits directly below the vitals and shares their combined width. It fills the previous empty area to the left of the scan. |
| Right column | The restored body scan stretches to the combined height of the vitals and briefing. Both columns align at the top and bottom. |
| Vertical spacing | The vitals-to-briefing gap is 12 px. The gap from the aligned briefing/scan bottom edge to the mission-exposure row is also 12 px, following the user's final clarification. |
| Briefing preview | Compact headline and summary, followed by a Full briefing action with a divider. Detailed alerts and escalation guidance remain available in the full briefing drawer. |
| Mission exposure | The existing full-width radiation, estimated bone loss and gravity row remains below the health grid, using the actual existing values. Prototype sample values were not hard-coded into the app. |
| Smaller screens | The left column and scan stack cleanly without horizontal overflow. |

## Scope and ownership

The required-mark patch changed only `checkin.tsx`, `reaction-test.tsx` and `src/index.css`. The approved Home layout changed only `home.tsx` and Home-scoped rules in `src/index.css`.

No backend, domain, data, shared types or dependencies were changed. Other pages retain their existing behavior. The scan's data evaluation and timing, clinical rules, journal privacy and saved records are unchanged. These were presentation updates, not a new clinical feature.

## Verification recorded at implementation

| Check | Result |
|---|---|
| ESLint and production build | Pass; existing lazy Three.js chunk-size warning remains |
| Red asterisks immediately after headings | Pass |
| Asterisk position through monthly slider changes | Pass; checked document coordinates to account for normal browser focus scrolling |
| Compact vital cards and bold measurements | Pass |
| 320 px Check-in layout | Pass; no horizontal overflow |
| Briefing width/left edge equals the vitals grid | Pass |
| Vitals-to-briefing gap | 12 px |
| Scan and left-column top/bottom alignment | Pass |
| Gap above exposure row | 12 px, matching the gap above the briefing |
| Home at 1920, 1440, 1100, 834, 390 and 320 px | Pass |
| Scan completion, vital-to-Trends navigation and Full briefing drawer | Pass |
| Detailed alerts visible in full briefing | Pass |
| Browser JavaScript errors and console warnings/errors | None in the final Home verification run |

Browser plugin was unavailable; verification used Chromium through Playwright at localhost:5173. Prototype images, verification scripts and screenshots were kept outside the repository. This documentation update does not change application code and does not claim a new runtime test run.

## Commit reference

| Checkpoint | Commit |
|---|---|
| Phase 6 implementation | `7f130ae` |
| Fixed required-mark positioning and compact vital cards | `533874c` |
| Approved Home layout with matched 12 px spacing | `b1b96b2` |

To inspect the approved Home implementation, stop the app, commit or stash local changes, then run:

```bash
git fetch origin
git checkout b1b96b2
npm ci
npm run dev
```

To return to the working branch, use `git switch codex/space-medic-home-redesign`.
