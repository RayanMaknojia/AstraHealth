# Phase 7 (Claude Code): AstraHealth Rename, Rounder Organs, SI Disclosure, Submission

**Starting point:** `main` at `d7044d9` (PR #11)

## Changes

| Request | Change |
|---|---|
| Organs look squashed from the side | Inflation depth raised (brain 1.40, heart 1.35, liver 1.05, leg 1.35; a sphere now stays a sphere), so side views are about as round as the front. The DNA is now a **true 3D double helix** (about 2.4 turns, beaded strands, 15 base-pair rungs, colours taken from the warm pixels of the reference picture), so it looks right from every angle. |
| Rename to AstraHealth | Brand (sidebar, login), page titles, footer, "Tell AstraHealth" panel, AI persona, server banner, `index.html` meta (template meta removed), `package.json` name, README. Storage keys are unchanged, so existing data is kept. |
| App opened straight into a crew workspace | The login now lasts for the browser tab (sessionStorage). A new tab or window always starts at the login page; a reload in the same tab keeps you signed in. Old sessions saved in localStorage are cleared. |
| `ECONNREFUSED 127.0.0.1:8787` in the terminal | `npm run dev` now starts the Python server **and** Vite (`scripts/dev.mjs`; tries `python`, `py`, `python3`). If Python is missing or stops, the app keeps running offline. When the server is down, the Vite proxy answers 503 quietly and prints one hint instead of stack traces. New scripts: `npm run dev:web` (web only) and `npm run server` (Python only). |
| AI reliability | Lite model first (fast), Flash as backup; 10 s per attempt (25 s when a photo is attached), 40 s overall; the server window prints why an AI call failed (e.g. 429 = rate limit / quota). |
| SI disclosure (Space Apps rules) | Visible **SI-generated** watermarks on the body-scan figure, journey artwork and every Body Map 3D card; AI text labelled "(SI-generated)"; SI metadata written into the image files (PNG text, EXIF) and GLBs (`asset.extras.siGenerated`); `README.md`, `docs/si-metadata.json`, `package.json` (`siDisclosure`), `index.html` meta, README, login and footer notes. |
| Submission form | `docs/SUBMISSION.md`: (a) 185-word summary, (b) project details, (c) SI use statement. |
