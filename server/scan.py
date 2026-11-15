"""
Body-scan reading generator (simulated wearable / onboard scanner).

Each scan continues the astronaut's own recent trend (linear fit over the last
<= 7 daily values) with small noise. About 12% of scans put ONE reading into a
Watch or Alert range (never life-threatening) so the briefing has something real
to react to. The TypeScript fallback in src/services/scanService.ts mirrors this.
"""

from __future__ import annotations

import random

# kpi: (noise, decimals, hard_min, hard_max, population_default)
KPIS = {
    "heart_rate": (3.0, 0, 35, 190, 68),
    "body_temp": (0.12, 1, 34.0, 41.5, 36.9),
    "spo2": (0.7, 0, 80, 100, 97),
    "systolic": (4.0, 0, 70, 200, 115),
    "diastolic": (3.0, 0, 40, 120, 74),
}
# Blood sugar is NOT scanned: it comes from the weekly fasting check-in (and lab reports).

# Watch / Alert ranges an anomaly may land in (health_rules.md); none are life-threatening.
ANOMALIES = {
    "heart_rate": {"caution": (104, 116), "critical": (122, 130), "note": "Resting heart rate is high for this scan."},
    "body_temp": {"caution": (38.0, 38.3), "critical": (38.6, 38.9), "note": "Body temperature is raised (possible fever)."},
    "spo2": {"caution": (93, 94), "critical": (88, 89), "note": "Blood oxygen is lower than usual."},
    "systolic": {"caution": (134, 152), "critical": (162, 170), "note": "Blood pressure is high for this scan."},
}


def _num_list(value) -> list[float]:
    if not isinstance(value, list):
        return []
    return [float(v) for v in value if isinstance(v, (int, float)) and not isinstance(v, bool)]


def _slope(values: list[float]) -> float:
    n = len(values)
    if n < 3:
        return 0.0
    xs = range(n)
    mx, my = (n - 1) / 2, sum(values) / n
    den = sum((x - mx) ** 2 for x in xs)
    return sum((x - mx) * (y - my) for x, y in zip(xs, values)) / den if den else 0.0


def _round(v: float, dp: int) -> float:
    return round(v, dp) if dp else float(round(v))


def generate_scan(body: dict) -> dict:
    recent = body.get("recent") or {}
    baseline = body.get("baseline") or {}
    if not isinstance(recent, dict) or not isinstance(baseline, dict):
        raise ValueError("recent and baseline must be objects")
    rng = random.Random(body.get("seed")) if body.get("seed") is not None else random.Random()
    rate = body.get("anomalyRate", 0.12)
    rate = min(1.0, max(0.0, float(rate))) if isinstance(rate, (int, float)) else 0.12

    readings: dict[str, float] = {}
    for kpi, (noise, dp, lo, hi, default) in KPIS.items():
        series = _num_list(recent.get(kpi))[-7:]
        base = baseline.get(kpi)
        base = float(base) if isinstance(base, (int, float)) else (series[0] if series else default)
        if series:
            level = sum(series[-3:]) / len(series[-3:])
            # mean of the last 3 sits 2 steps behind the new reading; damp the trend a little
            value = level + 0.8 * 2 * _slope(series)
        else:
            value = base
        value += rng.uniform(-noise, noise)
        readings[kpi] = _round(min(hi, max(lo, value)), dp)

    # Keep diastolic below systolic with a realistic gap.
    readings["diastolic"] = min(readings["diastolic"], readings["systolic"] - 25)

    anomaly = None
    if rng.random() < rate:
        kpi = rng.choice(list(ANOMALIES))
        level = "critical" if rng.random() < 0.25 else "caution"
        lo, hi = ANOMALIES[kpi][level]
        dp = KPIS[kpi][1]
        readings[kpi] = _round(rng.uniform(lo, hi), dp)
        if kpi == "systolic":
            readings["diastolic"] = _round(min(readings["systolic"] - 40, 84 + (readings["systolic"] - 134) * 0.4), 0)
        anomaly = {"kpi": kpi, "level": level, "note": ANOMALIES[kpi]["note"]}

    hr = readings["heart_rate"]
    extras = {
        "respiratory_rate": _round(min(24, max(10, 12 + (hr - 60) * 0.08 + rng.uniform(-1.5, 1.5))), 0),
        "hrv_ms": _round(min(110, max(18, 75 - (hr - 60) * 0.9 + rng.uniform(-8, 8))), 0),
    }
    return {"readings": readings, "extras": extras, "anomaly": anomaly, "generator": "python"}
