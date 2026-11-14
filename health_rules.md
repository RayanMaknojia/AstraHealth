# Health Rules (reconciled)

NASA Space Apps Challenge 2026 · **Single source of truth for status colours.**

This file reconciles the three team documents:
- `astronaut_health_monitor_plan.md` (reference doc §5–§7)
- `astronaut_health_monitor_pages.md` (pages and KPIs)
- what was built in Phase 2 (`src/services/healthEvaluator.ts`)

Where they disagreed, the rule below was chosen for being **safer, less noisy, or closer to real spaceflight practice**. The reason is written next to each choice. The code in `src/data/nasaSpaceflightData.ts` (`THRESHOLDS`, `SPACE_ADJUSTMENT_RULES`) and `src/services/healthEvaluator.ts` implements exactly this table.

> Decision support, not diagnosis. Have a clinician review these before any real use.

## How a status is decided

1. **Range check**: compare the reading with the table below, using the ranges for *today's* mission phase.
2. **Personal check**: compare it with the astronaut's own baseline (Earth-mode readings or the first 7 days).
3. **Pattern check**: some Alerts need a *pattern*, not one bad reading (see sleep and mood).
4. **The stricter colour wins.**
5. **No fresh reading → grey.** Missing data is never green.

Crew-facing labels: 🟢 **Normal** · 🟡 **Watch** · 🔴 **Alert** · ⚪ **No data**.

## Vital signs

| KPI | 🟢 Normal | 🟡 Watch | 🔴 Alert | Space adjustment | Why this choice |
|---|---|---|---|---|---|
| **Resting heart rate** (bpm) | 50–100 | 40–49 or 101–120, **or ≥ 15% away from your baseline** | < 40 or > 120 | None (unchanged on long ISS stays) | Pages doc's 15% personal rule is simpler to explain than standard deviations. |
| **Blood pressure, systolic** (mmHg) | 90–129 | 130–159, or 80–89 | ≥ 160 or < 80 | **In flight: 82–89 counts as Normal** (BP runs 8–10 mmHg lower). **Back to Earth limits for 14 days after landing.** | The drop in flight is *expected*, so it shouldn't raise alarms. Phase 2 lowered the *high* limits instead, which flagged healthy crews; that's fixed. After landing, low BP means fainting risk, so the relaxed limit is switched off. |
| **Blood pressure, diastolic** (mmHg) | 60–84 | 85–99, or < 60 (< 55 in flight) | ≥ 100 | Same as systolic | Pages doc (AHA-based, 85 not 80) is less noisy. |
| **Body temperature** (°C) | 36.1–37.5 | 35.0–36.0 or 37.6–38.4 | ≥ 38.5 or < 35.0 | **After 60 days in 0 g: Normal goes up to 37.9.** Alert stays at 38.5. | Pages doc is more conservative than Phase 2's full +1 °C shift: real fevers are never hidden. |
| **SpO2** (%) | ≥ 95 (≥ 96 in an 8.2 psi Moon/Mars habitat) | 90–94 (90–95 in habitat) | < 90 | Tighter *Watch* in the low-pressure habitat | Both docs agree on Alert < 90. Only the early warning is tightened, so habitat crews aren't told they're in danger every day. |
| **Sleep** (h) | ≥ 7 (target 8.5) | 6–6.9, **or a single night < 6** | **< 6 h for 3 nights in a row**, or **any night < 4 h** | Target 8.5 h (NASA schedule). Mars sol is 24 h 39 min. | One short night is normal in space (ISS average ~6 h), so it's only Watch. A *pattern* of short nights is the real risk. The < 4 h rule is our addition: fitness for EVA or piloting. |
| **Mood** (**1–5**) | 4–5 | 3, or a single day at 1–2 | **1–2 for 3 days in a row**, or **any mention of self-harm** | None | **Switched from 1–10 to 1–5** to match the pages doc and every other check-in scale (sleep quality, fatigue, nausea, pain are all 1–5). This is easier to tap while floating. One bad day is human; three is a pattern. Self-harm is always an immediate Alert. |
| **Blood glucose, fasting** (mg/dL) | 70–99 | 54–69 or 100–180 | < 54 or > 180 | None | Pages doc. |
| **Blood glucose, not fasting** (mg/dL) | 70–140 | 54–69 or 141–180 | < 54 or > 180 | None | Keeps the normal after-meal rise from being flagged. |

### Personal baseline (stricter colour wins)
- **Heart rate:** Watch if ≥ 15% above or below your baseline average.
- **SpO2 and blood glucose:** Watch if ≥ 3.5 standard deviations from your baseline (catches a sudden personal change that is still inside the population range).

## Mission exposure

| KPI | 🟢 Normal | 🟡 Watch | 🔴 Alert | Why this choice |
|---|---|---|---|---|
| **Radiation, mission + career total** | < 50% of 600 mSv | 50–80% | > 80% | Both docs agree. |
| **Radiation, today** | Normal for this location | ≥ 2 mSv/day or > 2× the location's normal rate | ≥ 10 mSv/day | Catches a dose spike before the total moves. |
| **Solar storm** | None | Watch issued | Event active → **Go to shelter** | Pages doc. |
| **Bone density change** (measured or estimated) | > −5% | −5% to −10% | ≤ −10% | **Changed from Phase 2's −3% / −6%.** A normal 6-month ISS stay loses ~6–9% at the hip, so −3% flagged every healthy crew. The pages doc's values flag *unusual* loss. |

## Cabin (NASA-STD-3001)

| KPI | 🟢 Normal | 🟡 Watch | 🔴 Alert |
|---|---|---|---|
| CO2, 1 h average (mmHg) | < 2.5 | 2.5–3.0 | > 3.0 (symptoms above 4.5) |
| Inspired O2 (mmHg) | ≥ 135 | 127–134 (normal in an 8.2 psi habitat) | < 127 |
| Cabin pressure (psia) | 5–15 | — | outside 5–15 |
| Temperature (°C) | 18–27 | outside by ≤ 2 | outside by > 2 |
| Humidity (%) | 25–75 | outside by ≤ 10 | outside by > 10 |

## Trends (early warning)

A reading can be 🟢 and still be **drifting**. The app fits a line through the last 7 days (one point per day) and warns:
- **Drifting** when the change is meaningful and heading toward a limit, with "reaches Watch / Alert in about N days".
- **Rapid decline** when it is already at Alert and getting worse, will cross a limit within 3 days, or is changing 3× faster than normal.

## Escalation (by Earth delay)

| Where | Rule |
|---|---|
| ISS, Moon (short delay) | **Contact the flight surgeon** |
| Mars transit, Mars orbit, Mars surface (long delay) | **Act now with onboard guidance, then report** |

## Coming in Phase 3 (backend), with these rules

| KPI | 🟢 Normal | 🟡 Watch | 🔴 Alert | Source |
|---|---|---|---|---|
| Body mass (% from preflight) | within 3% | 3–5% loss | > 5% loss | Pages doc, weekly |
| Exercise (min/day) | ≥ 120 | 60–119 | < 60 for 3 days in a row | Pages doc, ISS 2 h/day |
| Reaction test (ms) | within 10% of baseline | 10–20% slower | > 20% slower | Our choice (pages doc gives no limits) |
| Cabin CO2 override | — | — | > 3.0 mmHg for 1 hour → Cabin Emergency | Pages doc O2 |

## What changed from Phase 2

1. **Mood 1–10 → 1–5.**
2. **Sleep:** one night < 6 h is now Watch; Alert needs 3 nights in a row (or one night < 4 h).
3. **Mood:** Alert needs 3 low days in a row (self-harm is still immediate).
4. **Blood pressure in flight:** the low limits relax instead of the high limits tightening; relaxation switches off for 14 days after landing.
5. **Temperature:** Normal tops out at 37.5 (37.9 after day 60 in 0 g); Alert at 38.5.
6. **Glucose:** Alert above 180 (was 200); fasting Watch from 100.
7. **Diastolic Watch from 85** (was 80).
8. **Bone:** Watch −5%, Alert −10% (was −3% / −6%).
9. **Heart rate:** personal baseline rule is now "15% away from your average".
10. **SpO2 in habitat:** Alert < 90 (was < 92); the tighter limit is the Watch at 96.
