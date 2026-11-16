"""
AstraHealth local server (Python standard library only, no pip installs).

    python server/app.py            # listens on http://127.0.0.1:8787

Production (one service runs the whole app, e.g. Render via the Dockerfile):
    HOST=0.0.0.0 PORT=<host's port> STATIC_DIR=dist TRUST_PROXY=1 python server/app.py
    - serves the built website (npm run build -> dist/) next to the API
    - limits AI calls per visitor and per hour so a public site can't drain the quota

Endpoints (all JSON):
    GET  /api/health    -> {"ok": true, "ai": bool, "models": [...]}
    POST /api/scan      -> new simulated KPI readings for the Home "Start scan" button
    POST /api/ai/json   -> forwards a prompt (+ optional images) to Gemini and returns parsed JSON

The Gemini key is read from GEMINI_API_KEY (environment or server/.env) and never
leaves this process. If the key is missing or Gemini fails, /api/ai/json answers
{"ok": false} and the app uses its offline rules instead.
"""

from __future__ import annotations

import json
import mimetypes
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scan import generate_scan  # noqa: E402
import garden  # noqa: E402

HERE = Path(__file__).resolve().parent
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
MAX_BODY = 12 * 1024 * 1024  # images are base64 inside the JSON body


def load_env_file(path: Path) -> None:
    """Minimal .env reader: KEY=value lines, # comments. Real env vars win."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(HERE / ".env")
PORT = int(os.environ.get("PORT", "8787"))
HOST = os.environ.get("HOST", "127.0.0.1")
# Built website to serve next to the API (production). Unset = API only (local dev).
STATIC_DIR = Path(os.environ["STATIC_DIR"]).resolve() if os.environ.get("STATIC_DIR") else None
# Behind a hosting proxy (Render, etc.) the visitor's IP is the first X-Forwarded-For entry.
TRUST_PROXY = os.environ.get("TRUST_PROXY", "") in ("1", "true", "yes")
# CORS: the site and API share one origin in production; allow others only if set.
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")
# AI rate limits (0 = off). Defaults suit a public demo on a free Gemini key.
AI_PER_IP = int(os.environ.get("AI_LIMIT_PER_IP", "30"))  # calls per visitor ...
AI_PER_IP_WINDOW = float(os.environ.get("AI_LIMIT_PER_IP_SECONDS", "600"))  # ... per 10 minutes
AI_GLOBAL_PER_HOUR = int(os.environ.get("AI_LIMIT_PER_HOUR", "400"))  # all visitors together
MODELS = [m.strip() for m in os.environ.get("GEMINI_MODELS", "gemini-flash-lite-latest,gemini-flash-latest").split(",") if m.strip()]
TIMEOUT = float(os.environ.get("GEMINI_TIMEOUT_SECONDS", "10"))  # per attempt (text)
IMAGE_TIMEOUT = float(os.environ.get("GEMINI_IMAGE_TIMEOUT_SECONDS", "25"))  # per attempt (with an image)
DEADLINE = float(os.environ.get("GEMINI_DEADLINE_SECONDS", "40"))  # whole request (browser waits 45 s)
SKIP_FAILED_SECONDS = 300  # a model that timed out / errored is skipped for 5 minutes
_bad_until: dict[str, float] = {}


def api_key() -> str | None:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    return key or None


def to_openai_content(parts: list[dict]) -> list[dict]:
    """Gemini-style parts ({text} / {inline_data}) -> OpenAI-style content blocks."""
    content: list[dict] = []
    for p in parts:
        if isinstance(p.get("text"), str):
            content.append({"type": "text", "text": p["text"]})
        elif isinstance(p.get("inline_data"), dict):
            d = p["inline_data"]
            mime, data = d.get("mime_type", "image/jpeg"), d.get("data", "")
            if mime.startswith("image/") and data:
                content.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{data}"}})
            elif data:
                content.append({"type": "text", "text": f"[Attached {mime} file omitted: only images are sent to the model]"})
    return content


def parse_json_text(text: str):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return json.loads(text)


def call_gemini(parts: list[dict], system: str | None, temperature: float) -> dict:
    key = api_key()
    if not key:
        return {"ok": False, "error": "no_api_key"}
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": to_openai_content(parts)})
    last_error = "unknown"
    per_attempt = IMAGE_TIMEOUT if any(isinstance(p.get("inline_data"), dict) for p in parts) else TIMEOUT
    start = time.monotonic()
    now = time.time()
    healthy = [m for m in MODELS if _bad_until.get(m, 0) <= now]
    order = healthy + [m for m in MODELS if m not in healthy]  # busy models last, not never
    for model in order:
        for attempt in range(2):
            remaining = DEADLINE - (time.monotonic() - start)
            if remaining < 3:
                return {"ok": False, "error": f"deadline ({last_error})"}
            body = json.dumps({
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "response_format": {"type": "json_object"},
            }).encode()
            req = urllib.request.Request(GEMINI_URL, data=body, method="POST", headers={
                "content-type": "application/json",
                "authorization": f"Bearer {key}",
            })
            try:
                with urllib.request.urlopen(req, timeout=min(per_attempt, remaining)) as res:
                    data = json.loads(res.read().decode())
                text = data["choices"][0]["message"]["content"] or ""
                _bad_until.pop(model, None)
                return {"ok": True, "model": model, "json": parse_json_text(text)}
            except urllib.error.HTTPError as e:
                last_error = f"{model}: HTTP {e.code}"
                if e.code in (429, 503) and attempt == 0 and time.monotonic() - start < 5:
                    time.sleep(1.2)  # quick "busy" answer: one short retry
                    continue
                if e.code >= 500 or e.code == 429:
                    _bad_until[model] = time.time() + SKIP_FAILED_SECONDS
                break  # 4xx (bad model / key) or still busy: try the next model
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                last_error = f"{model}: {e.__class__.__name__}"
                _bad_until[model] = time.time() + SKIP_FAILED_SECONDS
                break
            except (KeyError, IndexError, ValueError) as e:
                last_error = f"{model}: unreadable reply ({e.__class__.__name__})"
                break
    return {"ok": False, "error": last_error}


class RateLimiter:
    """Sliding-window counters: per visitor and for the whole server."""

    def __init__(self, per_key: int, key_window: float, global_per_hour: int):
        self.per_key, self.key_window, self.global_per_hour = per_key, key_window, global_per_hour
        self._keys: dict[str, deque] = {}
        self._all: deque = deque()
        self._lock = threading.Lock()

    def allow(self, key: str, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        with self._lock:
            while self._all and now - self._all[0] > 3600:
                self._all.popleft()
            q = self._keys.setdefault(key, deque())
            while q and now - q[0] > self.key_window:
                q.popleft()
            if self.global_per_hour and len(self._all) >= self.global_per_hour:
                return False
            if self.per_key and len(q) >= self.per_key:
                return False
            q.append(now)
            self._all.append(now)
            if len(self._keys) > 5000:  # forget idle visitors
                self._keys = {k: v for k, v in self._keys.items() if v}
            return True


ai_limiter = RateLimiter(AI_PER_IP, AI_PER_IP_WINDOW, AI_GLOBAL_PER_HOUR)
# Station Garden: at most 60 plantings per visitor per 10 minutes.
garden_limiter = RateLimiter(60, 600, 0)

# Types the browser needs for the built site (3D models, fonts, images).
for _ext, _mime in {".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".glb": "model/gltf-binary",
                    ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json",
                    ".csv": "text/csv", ".wasm": "application/wasm"}.items():
    mimetypes.add_type(_mime, _ext)


class Handler(BaseHTTPRequestHandler):
    server_version = "AstraHealth/1.0"

    def log_message(self, fmt, *args):  # quieter console: one line per request
        sys.stderr.write("[server] " + (fmt % args) + "\n")

    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.send_header("access-control-allow-origin", ALLOWED_ORIGIN)
        self.send_header("access-control-allow-headers", "content-type")
        self.send_header("access-control-allow-methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict | None:
        length = int(self.headers.get("content-length") or 0)
        if length <= 0 or length > MAX_BODY:
            return None
        try:
            data = json.loads(self.rfile.read(length).decode())
            return data if isinstance(data, dict) else None
        except (ValueError, UnicodeDecodeError):
            return None

    def _client(self) -> str:
        if TRUST_PROXY:
            fwd = (self.headers.get("x-forwarded-for") or "").split(",")[0].strip()
            if fwd:
                return fwd
        return self.client_address[0]

    def _static(self, head: bool = False) -> None:
        """Serve the built website; unknown app paths get index.html (single-page app)."""
        assert STATIC_DIR is not None
        rel = urllib.parse.unquote(self.path.split("?", 1)[0].split("#", 1)[0]).lstrip("/")
        target = (STATIC_DIR / rel).resolve() if rel else STATIC_DIR / "index.html"
        if not (target == STATIC_DIR or STATIC_DIR in target.parents):  # no ../ escapes
            self._send(404, {"ok": False, "error": "not_found"})
            return
        if not target.is_file():
            if "." in Path(rel).name:  # a missing file (asset), not an app route
                self._send(404, {"ok": False, "error": "not_found"})
                return
            target = STATIC_DIR / "index.html"
        data = target.read_bytes()
        mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if mime.startswith("text/") or mime in ("application/json", "image/svg+xml"):
            mime += "; charset=utf-8"
        self.send_response(200)
        self.send_header("content-type", mime)
        self.send_header("content-length", str(len(data)))
        # Hashed build files never change; index.html must always be re-checked.
        hashed = rel.startswith("assets/")
        self.send_header("cache-control", "public, max-age=31536000, immutable" if hashed else "no-cache")
        self.send_header("x-content-type-options", "nosniff")
        self.send_header("referrer-policy", "strict-origin-when-cross-origin")
        self.send_header("x-frame-options", "SAMEORIGIN")
        self.end_headers()
        if not head:
            self.wfile.write(data)

    def do_OPTIONS(self):  # CORS preflight
        self._send(204, {})

    def do_HEAD(self):
        if STATIC_DIR and not self.path.startswith("/api/"):
            self._static(head=True)
        else:
            self.send_response(200 if self.path.rstrip("/") == "/api/health" else 404)
            self.end_headers()

    def do_GET(self):
        route, _, query = self.path.partition("?")
        if self.path.rstrip("/") == "/api/health":
            self._send(200, {"ok": True, "ai": api_key() is not None, "models": MODELS})
        elif route.rstrip("/") == "/api/garden":
            params = dict(p.split("=", 1) for p in query.split("&") if "=" in p)
            crew = garden.clean_crew(params.get("crew"))
            if crew is None:
                self._send(400, {"ok": False, "error": "bad_crew"})
            else:
                self._send(200, {"ok": True, "crew": crew, "plants": garden.get_garden(crew)})
        elif STATIC_DIR and not self.path.startswith("/api/"):
            self._static()
        else:
            self._send(404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        path = self.path.rstrip("/")
        body = self._body()
        if body is None:
            self._send(400, {"ok": False, "error": "invalid_json_or_too_large"})
            return
        if path == "/api/scan":
            try:
                self._send(200, {"ok": True, **generate_scan(body)})
            except (TypeError, ValueError, KeyError) as e:
                self._send(400, {"ok": False, "error": f"bad_scan_input: {e}"})
        elif path == "/api/garden/plant":
            crew = garden.clean_crew(body.get("crew"))
            plant = garden.clean_plant(body.get("plant"))
            if crew is None or plant is None:
                self._send(400, {"ok": False, "error": "bad_plant"})
            elif not garden_limiter.allow(self._client()):
                self._send(429, {"ok": False, "error": "rate_limited"})
            else:
                status, payload = garden.add_plant(crew, plant)
                self._send(status, payload)
        elif path == "/api/ai/json":
            parts = body.get("parts")
            if not isinstance(parts, list) or not parts:
                self._send(400, {"ok": False, "error": "parts_required"})
                return
            if not ai_limiter.allow(self._client()):
                sys.stderr.write("[server] AI rate limit reached; the app used offline rules.\n")
                self._send(200, {"ok": False, "error": "rate_limited"})
                return
            temperature = body.get("temperature", 0.2)
            started = time.monotonic()
            result = call_gemini(parts, body.get("system"), float(temperature) if isinstance(temperature, (int, float)) else 0.2)
            took = time.monotonic() - started
            if result.get("ok"):
                sys.stderr.write(f"[server] AI ok: {result.get('model')} in {took:.1f}s\n")
            else:
                hint = " (rate limit / quota: wait a minute or check your key's quota)" if "429" in str(result.get("error")) else ""
                sys.stderr.write(f"[server] AI unavailable after {took:.1f}s: {result.get('error')}{hint}. The app used offline rules.\n")
            self._send(200, result)
        else:
            self._send(404, {"ok": False, "error": "not_found"})


def main() -> None:
    if STATIC_DIR and not (STATIC_DIR / "index.html").is_file():
        print(f"STATIC_DIR {STATIC_DIR} has no index.html: run `npm run build` first. Serving the API only.", flush=True)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    site = f", website from {STATIC_DIR}" if STATIC_DIR else ""
    print(f"AstraHealth server on http://{HOST}:{PORT}  (Gemini: {'on' if api_key() else 'off - offline rules only'}{site})", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
