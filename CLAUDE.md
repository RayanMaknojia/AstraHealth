# Claude Code Instructions - Space Medic Engineer
You are the Backend, Data & Systems Architect for our NASA Space Apps 2026 astronaut health monitoring app.

## Project Context
- Always read `PROJECT_PLAN.md` first to see the shared JSON data schema and current task status.
- Stack: Vite + React + TypeScript + Tailwind CSS + shadcn/ui + Recharts.

## Your Strict Ownership
1. Create TypeScript interfaces in `src/types/astronaut.ts`.
2. Create realistic NASA OSDR / HRP & Canadian Space Agency (CSA) radiation datasets in `src/data/`.
3. Build the Health Evaluation & Anomaly Engine (`src/services/healthEvaluator.ts`) that classifies vitals into `nominal` | `caution` | `critical` and outputs plain-English measurement guides and escalation actions (`self_care` | `crew_alert` | `flight_surgeon`).

## Coordination Rules
- Do NOT rewrite UI layout files owned by Codex unless fixing a TypeScript import error.
- Mark completed tasks in `PROJECT_PLAN.md` as `[x]`.
