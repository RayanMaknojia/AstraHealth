# Phase 4 (ChatGPT): Revised UI Scope from final.md.pdf

**Owner:** ChatGPT / Codex (frontend; backend changes coordinated with Claude Code)
**Branch:** `codex/space-medic-home-redesign`
**Source:** User-uploaded `final.md.pdf`, titled "UI Change Instructions".
**Starting checkpoint:** Build 3, `7b21f9d`.
**Status:** Scope recorded. Implementation and acceptance checks are not completed. This document is not a claim that Build 4 exists.

The user named this next work Phase 4 ChatGPT. The attachment requests a new layout and several changes that reverse earlier UI decisions. Its instructions are recorded below as proposed work, separately from the completed history in Phases 1, 2 and 3. The current request also asks for phase explanations matching Claude's documentation; that documentation is the change delivered with these notes.

## Folder ownership

| Agent | Can create/edit |
|---|---|
| Claude Code | `src/types`, `src/data`, `src/services` |
| ChatGPT / Codex | `src/components`, `src/App.tsx`, `src/index.css`, frontend dependencies and UI documentation |

Backend services, data and health thresholds are consumed by the UI. They are not reimplemented in the frontend.

## Requested changes

| Surface | Requested Phase 4 behavior |
|---|---|
| Global punctuation | Replace em/en dashes with ordinary punctuation throughout UI, notifications, comments, data and documentation; verify with a repo-wide search. |
| Health colors | Status colors on values themselves: Optimal green, Borderline yellow, Alert red, missing grey. Include a word or icon for non-color identification. Remove redundant status badges beside values. |
| Non-health colors | Blue countermeasures, teal information, purple reminders, grey/white neutral labels. |
| Pop-ups | Content-sized, centered boxes, approximately 480 px maximum width and 20-24 px padding, left-aligned text and buttons. Preserve current text size. |
| Procedures | Number every step, with one step per line. |
| Top bar | Move the compact trip bar into the header. Show mission day once above it; group Earth delay, demo toggle and SOS alongside it. Replace cartoon icons with professional spacecraft/planet imagery. |
| Clocks | Earth UTC plus ISS GMT, Moon UTC, Mars local solar time with sol, or transit elapsed time, as appropriate. |
| Home reminders | Daily, weekly and monthly countdowns; purple normally, red when overdue; completed daily check-in shows Done. |
| Home vitals and briefing | Six vitals in two rows of three, status-colored values and a smaller briefing that continues to update after events. |
| Home body scan | Restore a neutral-grey body on the right. Start scan triggers a 4-6 second bottom-to-top sweep. Regions acquire the latest worst-reading status as the line reaches them. Show completion time. Afterwards regions link to their matching Body Map sections and show explanatory hover tooltips. |
| Body Map | Remove the standing figure. Replace the selector with five vertical rows: brain, heart, metabolism, immune/radiation DNA, then bones/muscle. Use realistic moving 3D assets, not the Build 3 SVG drawings. Clicks retain the existing detail content. |
| Model licensing | Use reusable licensed models or realistic looping renders, and document each asset's source and license in the README. |
| Five hazards | Remove Body Map/countermeasure links from hazard cards; preserve their other content. |
| Check-in | Remove eye/vision and optional evening sections. Daily fields: sleep quality, mood, energy/fatigue, stress, core temperature, symptoms, pain/location, medications with dose/time and optional journal. Keep read-only wearable review. |
| Skin symptom | Add photo opens Photo Check. This reintroduces a flow excluded by the previous scope. |
| Reaction test | Shorten to 30 seconds. Show a status-colored explanation against the astronaut's baseline: within 10% optimal, 10-20% slower borderline, over 20% slower alert. With no baseline, use 250-350 ms and show Baseline being set. |
| Journal layout | Reaction test and Journal in equal-height side-by-side columns, stacked on phones. Save entries; link history to a new More tab next to Cabin readings. Preserve device-only privacy. |
| Forms | Compact grid cards with label and input/status together; apply the same layout to monthly checks. |
| Trends | Range begins at day 0 for young missions, otherwise last N days. Aggregate today's readings into a daily average with a distinct dot/tooltip, or omit today if aggregation cannot be cleanly supported. |
| Cabin | Consistent professional icons beside CO2, O2, pressure, temperature, humidity, noise, light and radiation; status-colored values. |

## Scan region mapping requested by the PDF

| Region | Readings |
|---|---|
| Legs/feet | Bone-loss estimate, exercise minutes, body mass |
| Abdomen | Glucose and body-mass change |
| Chest | Resting heart rate and blood pressure |
| Neck/throat | SpO2 and breathing rate |
| Arms/skin | Core temperature, radiation dose and skin symptoms |
| Head | Mood, sleep, stress and reaction time |

## Implementation decisions and coordination still needed

- The PDF first asks for image-only rows without visible text, then asks for a little label on each row. Preserve accessible names and tooltips; resolve the visible-label preference before finalizing the selector.
- The global punctuation sweep includes Claude-owned services/data/types. Coordinate those edits rather than violating folder ownership or claiming a zero-result sweep after editing only UI files.
- Some requested scan inputs are not currently health indicators. Do not invent measurements or status thresholds; identify the backend-supported values and ask Claude for any missing contract.
- Reaction-test baseline classification must be reconciled with the backend scoring/evaluation contract. Changing the duration alone does not implement the new clinical comparison rule.
- Earlier scope prohibited persistent image uploads; the new PDF requests Photo Check. Confirm the intended local-preview versus saved/reviewable-image behavior before wiring image persistence or transmission.
- Earth clocks, mission time and simulated demo time need explicit consistent behavior so the displayed mission day and times do not disagree.
- Do not change unrelated features or push to main. Deliver on the frontend branch as a new commit so Builds 1-3 remain accessible.

## Acceptance checks (not yet run for Phase 4)

- [ ] Implement the requested layout, color and text changes within agreed ownership.
- [ ] Verify top-bar clocks, single mission-day label and professional imagery.
- [ ] Verify the Home scan before, during and after completion, region status timing and navigation.
- [ ] Verify the five realistic licensed organ assets, row selection and accessible controls.
- [ ] Verify daily/monthly form grids, 30-second test classification and private journal history navigation.
- [ ] Verify chart ranges and current-day aggregation.
- [ ] Verify cabin icons, popup sizing and numbered procedure steps.
- [ ] Complete the agreed repo-wide punctuation check, TypeScript, ESLint and production build.
- [ ] Browser-test desktop/mobile and reduced-motion behavior; inspect console errors.
- [ ] Capture Home before/after scan, Body Map, Check-in and one pop-up, as requested in the PDF.

## Earlier builds

| ChatGPT phase / build | Commit | Description |
|---|---|---|
| 1 | `8722c3f` | Generated body on Home plus separate Body Map |
| 2 | `4216a4d` | Body removed from Home, moved into Body Map |
| 3 | `7b21f9d` | Rotating SVG organ cards added on Body Map |
| 4 | Pending | Revised scope in this file; not implemented |

Phase numbers here identify ChatGPT's UI history. Claude's phase numbers describe its backend history independently.
