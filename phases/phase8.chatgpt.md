# Phase 8 (ChatGPT): Fix the Repeating Emergency Pop-up

**Owner:** ChatGPT / Codex (frontend)
**Branch:** `codex/space-medic-home-redesign`
**Starting checkpoint:** Phase 7 documentation, `872a6d9` (Home implementation remains `b1b96b2`).
**Status:** Fixed and verified.

## Reported problem and reproduction

The user could not reach the dashboard after pressing Confirm on an emergency warning. Retake reading and Notify crew did not dismiss it either.

The issue was reproduced with the Mars demo's critical sleep alert aged past the existing ten-minute escalation window. The backend raised an SOS above the original critical alert. The UI displayed and confirmed only the SOS. Its immediate reevaluation still found the original critical alert unconfirmed and raised another SOS, producing a loop.

The failing test confirmed that after one click the original critical alert remained open, the first SOS was confirmed, and a new unconfirmed SOS had been created.

## What changed

Only the emergency-dialog UI in `src/components/medic/workspace.tsx` changed:

- Display all current pending alerts in the same dialog, with the highest-priority alert first and the other alerts' headlines, details and action steps below it.
- Explain the number of pending alerts and the acknowledgment action.
- Show Confirm all for multiple displayed alerts; retain Confirm for a single alert.
- Acknowledge exactly the alerts displayed in the dialog before reevaluating the current state. This closes both the escalated SOS and the original critical alert together, breaking the loop.
- Retake reading and Notify crew retain their existing roles. They do not acknowledge an alert or dismiss the dialog.

This does not suppress clinical warnings or erase abnormal readings. Confirmed records, acknowledgment names/times and the existing backend cooldown remain intact. New alerts still display normally. No service, data, type, dependency or Home-layout changes were made.

## Checks

| Check | Result |
|---|---|
| Reproduce the original aged-critical/SOS loop before the fix | Reproduced |
| Both original critical alert and escalated SOS are shown | Pass |
| Confirm all acknowledges both and restores dashboard access | Pass |
| Automatic reevaluation after 30 seconds | No repeated SOS loop |
| Reload after confirmation | Dashboard remains accessible |
| Abnormal sleep reading retained | Pass |
| New SOS still opens | Pass |
| Retake / Notify preserve the open dialog | Pass; confirmation remains required |
| Single-alert Confirm | Pass |
| Confirmation at a mobile viewport | Pass |
| Browser JavaScript errors | None observed |
| ESLint and production build | Pass; existing lazy Three.js chunk-size warning remains |

Browser plugin was unavailable; Chromium through Playwright tested an isolated offline-demo browser context at localhost:5173. The reproduction aged only the test context's alert record. User records were not cleared or modified during testing, and no actual ground or emergency message was sent.
