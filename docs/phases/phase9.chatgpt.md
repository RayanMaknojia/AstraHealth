# Phase 9 (ChatGPT): Journey Artwork and Rotating Anatomy

**Owner:** ChatGPT / Codex (frontend)
**Branch:** `codex/space-medic-home-redesign`
**Date:** November 15, 2026 (America/Vancouver)
**Starting checkpoint:** `7085952`, Claude’s merged PR #9.
**Status:** Implemented and verified.

## Integration checkpoint

Before making the visual changes, fetched origin and verified Claude’s final backend PR #9 was merged into main. Fast-forwarded this frontend branch to `7085952`, including Claude’s Phase 5 and round-two changes and the earlier Phase 8 acknowledgment fix. Claude’s server, health database, scan/briefing integration, records and emergency behavior remain intact. This phase makes no edits to services, data or types.

## Changes

- The shared mission header now uses much larger Earth, Moon, Mars and ISS illustrations and a separate shuttle progress marker. Desktop endpoints are 60 px and the shuttle is 64 px, with compact mobile sizing. Real mission state still selects the destination and marker position; the filled journey line remains in place.
- Created a transparent artwork sheet inspired by the supplied space references. The illustrations were generated anew; they are not copies of NASA photo assets. A CSS sprite selects each object from the unchanged source image.
- Built five original Blender models inspired by the supplied organ/body-part references: folded brain with cerebellum and brainstem, heart with major vessels and coronary branches, asymmetric liver, tissue-colored DNA double helix, and knee-to-foot bone/muscle leg. These replace the previous five Body Map assets while retaining the existing system-to-health-data mapping.
- These are actual volumetric meshes with full horizontal rotation around the vertical axis. Updated camera fitting for the different proportions and lighting for readable tissue detail. Pause/resume, offscreen suspension, reduced motion, selection and resource disposal remain supported.
- The Trends indicator dropdown and all four timeframe buttons now have a matching 48 px height and baseline. Removed the timeframe row’s inherited bottom offset in this context.

## Asset sources and limits

`generate-reference-organs.py` and the five `reference-*.glb` files are original CC0-1.0 illustrations; the generator and license are committed. Prior assets remain available. The visible single-view references guide appearance; unseen surfaces were inferred. This is an illustrative 3D approximation, not photogrammetry, exact image reconstruction or a clinically validated anatomy model. The journey artwork is a newly generated illustration sheet used locally; no external image requests are needed.

## Verification

| Check | Result |
|---|---|
| ESLint | Pass |
| TypeScript and production build | Pass; existing lazy Three.js chunk-size warning remains |
| Enlarged header artwork and shared trip bar | Pass |
| Trends indicator and 1D/7D/30D/Mission control geometry | Matching top position and height |
| Five local GLBs load and select their associated systems | Pass |
| Rotation changes the rendered view; pause holds it still | Pass |
| Reduced motion holds models still | Pass |
| Five pages at 1440, 1100, 834, 390 and 320 px | No horizontal overflow in 25 combinations |
| Browser JavaScript errors, console warnings/errors, failed HTTP responses | None observed |

Browser plugin was unavailable, so Chromium through Playwright tested localhost:5173 in an isolated demo context. The local Python server ran with Gemini disabled for these checks. Existing user records were not cleared and no real emergency messages were sent.
