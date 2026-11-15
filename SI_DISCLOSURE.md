# Use of Super Intelligence (SI) in AstraHealth

NASA Space Apps Challenge 2026 permits SI tools (chatbots, large language models, foundation models, image generators) if their use is clearly identified. This file lists where and how SI was used in AstraHealth. A machine-readable copy is in [`si-metadata.json`](si-metadata.json).

AstraHealth does not use, contain or modify NASA logos, flags, mission patches or mission identifiers. NASA is referenced only in text, as the source of public health and spaceflight data and as the challenge organiser.

## Summary

| Area | SI involvement | How it is identified |
|---|---|---|
| Source code (frontend, backend, Python server, scripts) | Written with SI coding assistants, directed, reviewed and tested by the team | This file, `si-metadata.json`, `package.json` (`siDisclosure`), `index.html` meta tags, README, app footer and login page |
| Images (human body figure, journey artwork, five organ reference images) | SI-generated | Visible **"SI-generated"** watermark in the app wherever they appear; EXIF / PNG text metadata in the files |
| 3D organ models (`image-*.glb`) | Built by SI-written code from the SI-generated organ images | Visible **"SI-generated 3D"** watermark on each Body Map card; `asset.generator` and `asset.extras.siGenerated` in each GLB |
| Simulated health data (21-day history, body scans, cabin feed) | Generated at run time by SI-written code (no real astronaut data) | Labelled "Simulated" in the UI; this file |
| Runtime AI features (medical briefing, photo first look, file/text extraction) | Produced live by an AI model (Google Gemini API) through the local server; offline rules are used when it is unavailable | Labelled **"AI briefing (SI-generated)"** and **"AI first look (SI-generated text)"** in the UI; the UI says when offline rules wrote it instead |
| Audio | None | n/a |

## Tools

| Tool | Used for |
|---|---|
| Claude Code (Anthropic) | Data schema, health rules engine, services, health database, Python server, AI briefing / photo diagnosis / SOS logic, 3D organ generator, parts of the UI, documentation |
| OpenAI Codex / ChatGPT | Frontend UI (React components, layout, styling), earlier Blender organ generators, journey artwork and human body figure |
| Image generator (SI) | The five organ reference images supplied by the team (brain, heart, liver, DNA, leg), the human body figure and the journey artwork |
| Google Gemini API (runtime) | Writing the medical briefing, first look at skin photos, extracting values from uploaded text/files |

## Human contribution

The team defined the problem, the features and the clinical thresholds (reconciled in `health_rules.md` from NASA / CSA public sources), reviewed every change, tested the app, made the design decisions and wrote the prompts. Every status colour (Normal / Watch / Alert) comes from deterministic, human-reviewed rules; AI output can only make a status more serious, never less.

## Files

- SI-generated images: `src/components/medic/assets/human-model.webp`, `src/components/medic/assets/journey/mission-artwork.png`, `src/components/medic/assets/organs/source/*.jpg`
- Models built from them: `src/components/medic/assets/organs/image-*.glb` (generator: `image-to-3d.py`)
- Earlier SI-written Blender generators (models kept but unused): `generate.py`, `generate-reference-organs.py`
- Project history per phase, including which assistant did what: `phases/`
