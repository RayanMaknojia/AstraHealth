# Phase 4 (ChatGPT): Revised UI Scope from final.md.pdf

**Owner:** ChatGPT / Codex (frontend; backend changes coordinated with Claude Code)
**Branch:** `codex/space-medic-home-redesign`
**Source:** User-uploaded `final.md.pdf`, titled "UI Change Instructions".
**Starting checkpoint:** Build 3, `7b21f9d`.
**Build:** 4
**Status:** Implemented on the frontend branch, with verification and limits recorded below.

The user named this work Phase 4 ChatGPT and then instructed ChatGPT to implement the attached scope. This build restores the human scan to Home, replaces the Body Map figure with real 3D organ models, revises the check-in workflow and updates the shared header, charts and status presentation. Builds 1-3 remain available at their original commits.

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

## What was implemented

- The header now owns the compact mission trip bar, professional Lucide icons, Earth/local clocks, Earth delay, demo switch and SOS. Home no longer duplicates the journey bar.
- Home shows three persisted schedule reminders, two rows of three desktop vitals, status-colored readings, a compact live briefing and the click-to-start scan on the right.
- The scan takes five seconds, reveals regions in sequence, exposes accessible status/reason tooltips and navigates to the selected Body Map system after completion. Reduced-motion users get an immediate result without a sweep.
- Body Map has five vertical GLB model rows and the existing detail/countermeasure panel. Models rotate about their vertical axes; motion can be paused. Keyboard selection works. The standing figure is no longer on this page.
- Real GLB assets were authored in Blender: brain, heart, liver, DNA and femur. Their generator, source attribution and CC0-1.0 license are included and documented in README.md. These are anatomical illustrations rather than medically validated reference scans.
- Daily, weekly and monthly tabs remain; eye/vision and optional evening sections are removed. Daily/manual fields and medications use compact cards, including dose/time fields when a medication is selected. Monthly adds a six-step crewmate exam with recorded results.
- Reaction tests run for 30 seconds and display a status-colored, one-line explanation using the backend's personal baseline and 10%/20% boundaries. A 250-350 ms reference is shown while establishing a baseline. Results are saved on check-in submission.
- Reaction test and Journal are equal-height desktop columns, stacked on phones. Past journal entries live in More, next to Cabin readings, with device-only history/delete.
- Skin symptoms offer Add photo, opening Photo Check. Explicitly saving uses the existing service's first-look assessment and review queue. The raw photo is a temporary preview, not retained or transmitted by this UI.
- Multi-day chart points are daily averages, including a hollow current-day point and Today so far tooltip. Mixed sources are identified explicitly. Intraday views retain individual readings. Windows start at day 0 or the last N days, as appropriate.
- Cabin readings have professional icons and status-colored values. Guided actions are numbered, hazard cards no longer contain Body Map links, and emergency pop-ups fit their content within a 480 px maximum width.
- The global punctuation pass includes docs, data, types and services as explicitly requested. Backend changes are verified to be strictly punctuation-only; no clinical threshold or service logic changed.
- The bundled font is used without external Google Fonts requests. Three.js loads with Body Map; renderer resources and WebGL contexts are released when leaving it.

## Decisions and limits

- The PDF gives both image-only rows and a final request for little labels. This build follows the final wording: small labels, hover titles and accessible names, without large headings in the rows.
- External model catalogues were inaccessible. Original local 3D meshes were created instead of claiming third-party assets or licenses that could not be verified.
- The Mars display is an approximate mission-sol clock; no landing longitude/solar-time calibration is configured. ISS/Moon use UTC/GMT; transit elapsed time follows the onboard simulation. Earth UTC continues to reflect the real clock.
- Breathing/stress and other inputs without a graded backend sensor value are not fabricated. Scan tooltips distinguish unavailable/ungraded inputs from the available evaluated readings. The scan visualizes existing data; it is not a new diagnostic measurement.
- Photo Check preserves temporary-image handling. It stores the structured assessment and queues its summary without a thumbnail or raw image. The offline first-look engine is explicitly labeled as a demo, not image diagnosis.
- Three.js adds a lazy Body Map chunk above Vite's default 500 kB warning threshold. Production build succeeds; the models stay local and load only with Body Map. Real-device GPU performance and clinical validity are not established by the demo browser tests.

## Checks

| Check | Result |
|---|---|
| Repo-wide em/en dash search | Zero matches |
| Backend ownership audit | All service/data/type edits exactly match punctuation normalization |
| TypeScript, ESLint and production build | Pass; Vite reports the documented 3D chunk size warning |
| Header, clocks, three reminders and single top-area day label | Pass |
| Scan neutral state, timed reveal, completion, navigation and reduced motion | Pass |
| Five local GLB canvases, order, selection and pause/resume | Pass |
| Daily submission, completion and core temperature restored on refresh | Pass |
| Monthly six-step exam and saved completion | Pass |
| Actual 30-second reaction test and 10%/20% boundary checks | Pass |
| Photo Check assessment through service; no saved image or object URL | Pass |
| Journal save/history navigation and exclusion from sync | Pass |
| Day-zero/rolling windows, daily averaging, mixed sources and future-day exclusion | Pass |
| Briefing updates after fever progresses across thresholds | Pass |
| Cabin icons and removal of hazard navigation links | Pass |
| All five pages at 1440, 834, 390 and 320 px | Pass; no horizontal overflow |
| Emergency pop-up size and reduced-motion scan | Pass |
| Browser JavaScript errors and console warnings/errors | None in the final comprehensive run |

Browser plugin was unavailable, so verification used Chromium through Playwright at localhost:5173. Screenshots captured Home before/after scan, Body Map, Check-in, Photo Check and SOS. Browser scripts/screenshots were kept outside the repository. Checks use the offline demo, not real medical devices, real ground communications or clinical validation.

## Earlier builds

| ChatGPT phase / build | Commit | Description |
|---|---|---|
| 1 | `8722c3f` | Generated body on Home plus separate Body Map |
| 2 | `4216a4d` | Body removed from Home, moved into Body Map |
| 3 | `7b21f9d` | Rotating SVG organ cards added on Body Map |
| 4 | Current frontend branch | Phase 4 UI implementation documented here |

Phase numbers here identify ChatGPT's UI history. Claude's phase numbers describe its backend history independently.
