# Phase 6 (ChatGPT): Briefing Cleanup, Required Check-ins and Returnable Guidance

**Owner:** ChatGPT / Codex (frontend)
**Branch:** `codex/space-medic-home-redesign`
**Build:** 6
**Starting checkpoint:** Build 5, `3c8dbbc`
**Source:** The user's screenshot-based fixes for alerts, Home scan, vital emphasis, required measurements and physical-exam guidance.
**Status:** Implemented and verified.

## What changed

| Request | Result |
|---|---|
| Duplicate Alert labels | Removed the small status label beside the briefing headline. The uppercase ALERT prefix itself is red with a cross. Duplicate overall-status and parenthesized Alert wording is removed from a critical briefing paragraph without dropping readings or advice. Critical vital cards use their red value and cross instead of another Alert label. |
| Previous Home scan | Restored `home-scan.tsx` byte for byte from Build 4, `551e958`, and restored its image, overlay positioning, scan height and footer presentation. Build 5's clipped silhouette replacement is no longer used. |
| Emphasized measurements | Primary vital values use a bold 750 weight; units stay subordinate. |
| Five required daily measurements | Core temperature, mood, sleep quality, energy/fatigue and stress are required. They start unset. Sliders show Choose a rating until the user chooses one; custom validation prevents default slider positions from counting as answers. Resting heart rate remains optional. |
| Required-field asterisks | Added visible asterisks to the daily fields and all other existing required controls: weekly measurements, fasting confirmation, reaction test, monthly exam results/completion, conditional pain location and selected-medication dose/time. |
| Exam guidance links | The third result option opens More, selects Guidance & triage, opens the matching examination and focuses its summary. A selected follow-up also exposes an Open guidance button for revisiting the same instructions. |
| Complete exam guidance | Added circulation, breathing, skin, movement, sleep, crew wellbeing and Eye Exam guidance. Existing blood-pressure, eye-ultrasound, wound-care and standing-BP procedures remain available. Related approved procedures are included with the relevant examination. |
| Return without refilling | Every new examination guide and each existing procedure has Back to Check-in. The Check-in component stays mounted but hidden while viewing other pages, so its draft and cadence selection survive the round trip. No extra draft data is written to storage. |
| Reset after submission | Successful Check-in saves clear measurement inputs, ratings, symptoms, pain/location, medication selections/dose/time, weekly answers, exam selections/completion, photo-preview state and journal draft. The reaction-test component is reset as well. Validation errors and unsuccessful saves retain the draft. Saved clinical records and private journal entries remain saved. |

## Structure and ownership

- `exam-guidance.ts` contains the seven UI guidance entries and stable IDs shared by the form and More.
- `exam-guidance-view.tsx` renders numbered guidance, relevant existing procedures and return controls.
- `workspace.tsx` keeps an opened Check-in mounted across route changes. It is destroyed when the crew workspace changes, preserving separation between crew drafts.
- `checkin.tsx` owns required-field validation, asterisks, guidance navigation and reset-after-success behavior.
- `home.tsx`, restored `home-scan.tsx` and `src/index.css` implement the requested Home corrections.
- `reaction-test.tsx` adds the weekly required indicator; its timing and scoring are unchanged.

No service, data, type, domain or dependency files were changed. Guidance is a UI checklist and records crew observations, not a new diagnostic or SANS evaluation engine. The journal is still private and excluded from clinical ingestion/sync. Unsaved drafts survive navigation within the current workspace, not a browser reload.

## Checks

| Check | Result |
|---|---|
| TypeScript / production build | Pass; existing lazy Three.js chunk-size warning remains |
| ESLint | Pass |
| Restored scan source compared with Build 4 | Exact byte match |
| Red cross plus uppercase ALERT, no small headline label or duplicate paragraph labels | Pass |
| Bold vital values | Pass |
| Empty core-temperature field blocks submission | Pass |
| Missing daily rating blocks submission | Pass |
| First five inputs required, resting heart rate optional | Pass |
| All seven exam option -> matching More guidance -> Check-in round trips | Pass; temperature, ratings, journal and exam selections retained |
| Successful monthly submission resets draft and completed exam controls | Pass |
| Every currently required native input/select has an asterisk | Pass, including conditional pain location and weekly controls |
| Completed 30-second reaction test cleared after successful submission | Pass |
| Private journal draft excluded from sync | Pass |
| Five pages at 1440, 834, 390 and 320 px | Pass; no horizontal overflow |
| Browser errors and console warnings/errors | None in the comprehensive run |

Browser plugin was unavailable, so Chromium through Playwright tested the offline demo at localhost:5173. Screenshots and temporary verification scripts were kept outside the repository.

## Build checkpoints

| Build | Commit |
|---|---|
| 1 | `8722c3f` |
| 2 | `4216a4d` |
| 3 | `7b21f9d` |
| 4 | `551e958` |
| 5 | `3c8dbbc` |
| 6 | Current phase implementation commit |
