# AstraHealth

Offline-first health monitoring and self-assessment for astronauts on ISS, Moon and Mars missions. NASA Space Apps Challenge 2026, challenge: *Create Health Monitoring Software for Astronauts on Space Missions*.

> **SI disclosure:** built with Super Intelligence (AI) assistance. SI-generated images carry a visible "SI-generated" watermark in the app; AI-written text is labelled. Details: [SI_DISCLOSURE.md](SI_DISCLOSURE.md) and [si-metadata.json](si-metadata.json).

## Run locally

```bash
npm install
npm run dev
```

`npm run dev` starts both parts: the **Python server** (body-scan generator + AI proxy, standard library only) on port 8787 and the **web app**. Open the address Vite prints. If Python is not installed, the app still runs with offline fallbacks; you can also start the server yourself with `python server/app.py` (or `npm run server`) and only the web app with `npm run dev:web`.

The app always opens on the login page; a login lasts for the browser tab.

**Gemini key:** copy `server/.env.example` to `server/.env` and set `GEMINI_API_KEY=...`. The key stays in the Python server and never reaches the browser; `server/.env` is git-ignored. Without the key, or without the Python server, everything still works: the scan uses a built-in browser generator and the briefing, photo check and SOS checks use offline rules (the UI says which one was used).

**Health database:** readings, scans, briefings, photo assessments, uploads and SOS events are stored in the browser's IndexedDB (`space-medic`). The first login of each astronaut writes 21 days of simulated history; every new reading is appended. Clear site data to reset. Demo logins: `iss_crew` / `2222`, `moon_crew` / `3333`, `mars_crew` / `1111`, and admin `admin` / `0000`.

The frontend branch is `codex/space-medic-home-redesign`. Build history and implementation notes are in `phases/phase1.chatgpt.md` through `phases/phase9.chatgpt.md`.

## Anatomical 3D assets

These original meshes were created for this project using Blender. They are local GLB models rendered with Three.js, not externally hosted images or flattened icon rotations. They are anatomical illustrations for navigation, not clinically validated anatomical reference models.

| Asset | Source | License |
|---|---|---|
| Brain: paired hemispheres, gyri and brainstem | `src/components/medic/assets/organs/generate.py` | CC0-1.0 |
| Heart: ventricles, atria, major vessels and coronary branches | Same original Blender generator | CC0-1.0 |
| Liver and gallbladder | Same original Blender generator | CC0-1.0 |
| DNA double helix | Same original Blender generator | CC0-1.0 |
| Femur (earlier build) | Same original Blender generator | CC0-1.0 |
| Skeletal and musculature torso, pelvis and proximal limbs (Build 5 selector) | Same original Blender generator | CC0-1.0 |

The original generated meshes and their generator are dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). No third-party anatomical mesh was copied. External model catalogues were inaccessible in the build environment. To regenerate, install Blender and run from the repository root:

```bash
blender --background --python src/components/medic/assets/organs/generate.py
```

Three.js is MIT licensed. Lucide icons are ISC licensed. The bundled DM Sans font license is in `src/components/medic/assets/FONT-LICENSE.txt`. The standing-body illustration is the generated asset introduced in Build 1.

## Reference-inspired artwork (Phase 9)

The current Body Map uses `reference-brain.glb`, `reference-heart.glb`, `reference-liver.glb`, `reference-dna.glb` and `reference-leg.glb`. These original CC0 meshes follow the user’s brain, heart, liver, DNA and knee-to-foot bone/muscle references. They are genuine meshes with depth and full horizontal rotation, not photographs flipped on a flat plane. The unshown surfaces are illustrative approximations; these are not exact photo-to-3D reconstructions or clinically validated models. Earlier models remain available in the repository.

Regenerate the current models with:

```bash
blender --background --python src/components/medic/assets/organs/generate-reference-organs.py
```

The trip bar uses newly generated transparent Earth, Moon, Mars, ISS and shuttle artwork in `src/components/medic/assets/journey/mission-artwork.png`, inspired by the supplied visual references. `JourneyArt` selects each image through CSS background positioning, without altering the source image. These are generated illustrations, not NASA photographs or downloaded third-party model textures. Destination selection and spacecraft position continue to follow mission state.

## Data and privacy

Readings, cabin telemetry, clinical assessments and ground communication (including SOS to the AstraHealth ground lab and the ISS) are demo simulations; no real emergency message is sent. When Gemini is enabled, briefing data and skin photos are sent to Google's Gemini API through the local Python server. Accounts use demo-grade local storage. The journal stays on this device and is never included in clinical ingestion or sync. Photo Check stores the photo (JPEG, up to 1280 px) and its assessment in the device's health database; files attached in "Something wrong?" are kept too (up to 10 MB). Everything is listed in More → My records, with a "Download my data" export. A review summary (not the photo) is queued for the flight surgeon. Removing browser storage deletes locally saved data.

The Mars clock is an approximate mission-sol clock. An actual landing longitude and solar-time calibration are not configured. ISS and Moon use UTC/GMT. Transit elapsed time follows the app's mission day and onboard simulation time.

## Checks

```bash
npm run lint
npm run build
```

```bash
python -m unittest discover -s server
```
