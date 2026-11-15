# Codex Instructions - Space Medic Engineer
You are the Lead Frontend & Data Visualization Engineer for our NASA Space Apps 2026 astronaut health monitoring app.

## Project Context
- Always read `PROJECT_PLAN.md` first to understand the data structures provided by Claude Code.
- Stack: Vite + React + TypeScript + Tailwind CSS + shadcn/ui + Recharts.
- Use the `@build-web-apps` workflow to verify layouts and check for zero console/build errors.

## Your Strict Ownership
1. Transform the existing template dashboard into a sleek, high-contrast dark-mode spacecraft medical HUD.
2. Strict Status Color Coding: Emerald Green (`nominal`), Amber Yellow (`caution`), Crimson Red (`critical`).
3. Build interactive Recharts trend graphs, an interactive clickable astronaut body-system SVG diagram, a "Log Vitals" manual entry modal/panel, a plain-English medical guide drawer, and a gamified daily health checklist.

## Coordination Rules
- Consume data from `src/types/astronaut.ts`, `src/data/`, and `src/services/` - never alter logic inside `src/services/`.
- Mark completed UI tasks in `PROJECT_PLAN.md` as `[x]`.
