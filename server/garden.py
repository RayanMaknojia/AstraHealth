"""
Station Garden: the crew's shared garden (one per crew code), stored as a JSON file.

    GET  /api/garden?crew=station          -> {"ok": true, "crew", "plants": [...]}
    POST /api/garden/plant {crew, plant}   -> {"ok": true, "plants": [...]} (409 if the plot is taken)

A plant is {id, astronautId, name, kind, col, row, missionDay, plantedAt}. The server only
keeps the garden: seeds are earned on each device from that astronaut's own healthy
habits, and no health data is ever sent here.

Storage: GARDEN_FILE (default server/data/garden.json). On a free host the disk can be
wiped on a redeploy; the app keeps a local copy and re-sends its own plants.
"""

from __future__ import annotations

import json
import os
import re
import threading
from pathlib import Path

HERE = Path(__file__).resolve().parent
GARDEN_FILE = Path(os.environ.get("GARDEN_FILE", str(HERE / "data" / "garden.json")))

COLS, ROWS = 12, 5
KINDS = {"grass", "flower", "fern", "tree", "mushroom", "reed", "lily", "pine", "crystal"}
CREW_RE = re.compile(r"^[a-z0-9-]{1,32}$")
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

_lock = threading.Lock()


def _load() -> dict:
    try:
        data = json.loads(GARDEN_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _save(data: dict) -> None:
    GARDEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = GARDEN_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    tmp.replace(GARDEN_FILE)


def clean_crew(value) -> str | None:
    crew = str(value or "station").strip().lower()
    return crew if CREW_RE.match(crew) else None


def clean_plant(p) -> dict | None:
    """Validate a plant sent by the app; None if anything is off."""
    if not isinstance(p, dict):
        return None
    try:
        col, row, day = int(p.get("col")), int(p.get("row")), int(p.get("missionDay"))
    except (TypeError, ValueError):
        return None
    pid, aid = str(p.get("id", "")), str(p.get("astronautId", ""))
    name = str(p.get("name", "")).strip()[:40]
    kind = str(p.get("kind", ""))
    planted = str(p.get("plantedAt", ""))[:40]
    if not (ID_RE.match(pid) and ID_RE.match(aid) and name and kind in KINDS):
        return None
    if not (0 <= col < COLS and 0 <= row < ROWS and 0 <= day <= 100_000):
        return None
    return {"id": pid, "astronautId": aid, "name": name, "kind": kind, "col": col, "row": row, "missionDay": day, "plantedAt": planted}


def get_garden(crew: str) -> list[dict]:
    with _lock:
        return list(_load().get(crew, []))


def add_plant(crew: str, plant: dict) -> tuple[int, dict]:
    """Returns (http status, payload)."""
    with _lock:
        data = _load()
        plants = list(data.get(crew, []))
        if any(p.get("id") == plant["id"] for p in plants):
            return 200, {"ok": True, "plants": plants}  # already there (a re-send)
        if any(p.get("col") == plant["col"] and p.get("row") == plant["row"] for p in plants):
            return 409, {"ok": False, "error": "plot_taken", "plants": plants}
        if len(plants) >= COLS * ROWS:
            return 409, {"ok": False, "error": "garden_full", "plants": plants}
        plants.append(plant)
        data[crew] = plants
        try:
            _save(data)
        except OSError:
            return 503, {"ok": False, "error": "storage_unavailable", "plants": plants[:-1]}
        return 200, {"ok": True, "plants": plants}
