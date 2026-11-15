# Space Medic

Astronaut health monitoring demo for NASA Space Apps Challenge 2026.

## Run locally

```bash
npm install
npm run dev
```

Open the localhost address printed by Vite. Demo logins: `iss_crew` / `2222`, `moon_crew` / `3333`, `mars_crew` / `1111`, and admin `admin` / `0000`.

The frontend branch is `codex/space-medic-home-redesign`. Build history and implementation notes are in `phases/phase1.chatgpt.md` through `phases/phase4.chatgpt.md`.

## Anatomical 3D assets

These original meshes were created for this project using Blender. They are local GLB models rendered with Three.js, not externally hosted images or flattened icon rotations. They are anatomical illustrations for navigation, not clinically validated anatomical reference models.

| Asset | Source | License |
|---|---|---|
| Brain: paired hemispheres, gyri and brainstem | `src/components/medic/assets/organs/generate.py` | CC0-1.0 |
| Heart: ventricles, atria, major vessels and coronary branches | Same original Blender generator | CC0-1.0 |
| Liver and gallbladder | Same original Blender generator | CC0-1.0 |
| DNA double helix | Same original Blender generator | CC0-1.0 |
| Femur | Same original Blender generator | CC0-1.0 |

The original generated meshes and their generator are dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). No third-party anatomical mesh was copied. External model catalogues were inaccessible in the build environment. To regenerate, install Blender and run from the repository root:

```bash
blender --background --python src/components/medic/assets/organs/generate.py
```

Three.js is MIT licensed. Lucide icons are ISC licensed. The bundled DM Sans font license is in `src/components/medic/assets/FONT-LICENSE.txt`. The standing-body illustration is the generated asset introduced in Build 1.

## Data and privacy

Readings, cabin telemetry, clinical assessments and ground communication are demo simulations. Accounts use demo-grade local storage. The journal stays on this device and is never included in clinical ingestion or sync. Photo Check previews are temporary; saving an assessment stores its structured result and queues a review summary, without retaining the photo. Removing browser storage deletes locally saved data.

The Mars clock is an approximate mission-sol clock. An actual landing longitude and solar-time calibration are not configured. ISS and Moon use UTC/GMT. Transit elapsed time follows the app's mission day and onboard simulation time.

## Checks

```bash
npm run lint
npm run build
```
