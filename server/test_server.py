"""Run: python -m unittest discover -s server  (no network needed)."""

import json
import sys
import threading
import unittest
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scan import KPIS, generate_scan  # noqa: E402
import app  # noqa: E402


class ScanTests(unittest.TestCase):
    def test_follows_trend_without_anomaly(self):
        recent = {"heart_rate": [70, 72, 74, 76, 78, 80, 82]}
        out = generate_scan({"recent": recent, "anomalyRate": 0, "seed": 1})
        self.assertIsNone(out["anomaly"])
        self.assertGreater(out["readings"]["heart_rate"], 80)  # keeps climbing
        self.assertLess(out["readings"]["heart_rate"], 90)

    def test_all_kpis_in_physiological_bounds(self):
        for seed in range(300):
            out = generate_scan({"recent": {}, "seed": seed})
            for kpi, (_, _, lo, hi, _) in KPIS.items():
                self.assertGreaterEqual(out["readings"][kpi], lo, kpi)
                self.assertLessEqual(out["readings"][kpi], hi, kpi)
            self.assertLess(out["readings"]["diastolic"], out["readings"]["systolic"])

    def test_anomaly_rate_roughly_twelve_percent(self):
        hits = sum(1 for s in range(2000) if generate_scan({"recent": {}, "seed": s})["anomaly"])
        self.assertTrue(150 < hits < 330, hits)

    def test_forced_anomaly_never_life_threatening(self):
        for s in range(200):
            r = generate_scan({"recent": {}, "seed": s, "anomalyRate": 1})["readings"]
            self.assertGreaterEqual(r["spo2"], 88)
            self.assertLessEqual(r["heart_rate"], 130)
            self.assertLess(r["body_temp"], 39.0)

    def test_bad_input(self):
        with self.assertRaises(ValueError):
            generate_scan({"recent": "nope"})


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = app.ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def post(self, path, payload):
        req = urllib.request.Request(self.base + path, data=json.dumps(payload).encode(), headers={"content-type": "application/json"}, method="POST")
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(req, timeout=5) as res:
            return json.loads(res.read())

    def test_scan_endpoint(self):
        out = self.post("/api/scan", {"recent": {"spo2": [97, 98, 97]}, "seed": 3})
        self.assertTrue(out["ok"])
        self.assertEqual(out["generator"], "python")

    def test_ai_requires_parts(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            self.post("/api/ai/json", {"parts": []})
        self.assertEqual(ctx.exception.code, 400)

    def test_ai_without_key_fails_soft(self):
        saved = app.os.environ.pop("GEMINI_API_KEY", None)
        try:
            out = self.post("/api/ai/json", {"parts": [{"text": "hi"}]})
            self.assertEqual(out, {"ok": False, "error": "no_api_key"})
        finally:
            if saved is not None:
                app.os.environ["GEMINI_API_KEY"] = saved

    def test_parts_conversion(self):
        c = app.to_openai_content([{"text": "a"}, {"inline_data": {"mime_type": "image/png", "data": "AAA"}}, {"inline_data": {"mime_type": "application/pdf", "data": "BBB"}}])
        self.assertEqual(c[1]["image_url"]["url"], "data:image/png;base64,AAA")
        self.assertIn("omitted", c[2]["text"])

    def test_parse_fenced_json(self):
        self.assertEqual(app.parse_json_text('```json\n{"a": 1}\n```'), {"a": 1})


class RateLimitTests(unittest.TestCase):
    def test_per_visitor_limit_and_window(self):
        rl = app.RateLimiter(per_key=3, key_window=60, global_per_hour=0)
        self.assertEqual([rl.allow("a", now=t) for t in (0, 1, 2, 3)], [True, True, True, False])
        self.assertTrue(rl.allow("b", now=3))  # other visitors unaffected
        self.assertTrue(rl.allow("a", now=61))  # window slid past the first call

    def test_global_hourly_limit(self):
        rl = app.RateLimiter(per_key=0, key_window=60, global_per_hour=2)
        self.assertEqual([rl.allow(k, now=0) for k in "xyz"], [True, True, False])
        self.assertTrue(rl.allow("z", now=3601))


class StaticSiteTests(unittest.TestCase):
    """Production mode: the same server serves the built website next to /api."""

    @classmethod
    def setUpClass(cls):
        import tempfile
        cls.tmp = tempfile.TemporaryDirectory()
        root = Path(cls.tmp.name)
        (root / "assets").mkdir()
        (root / "index.html").write_text("<!doctype html><title>AstraHealth</title>", encoding="utf-8")
        (root / "assets" / "app-abc123.js").write_text("console.log(1)", encoding="utf-8")
        (root / "assets" / "brain.glb").write_bytes(b"glTF")
        (Path(cls.tmp.name).parent / "secret.txt").write_text("nope", encoding="utf-8")
        cls.saved = app.STATIC_DIR
        app.STATIC_DIR = root.resolve()
        cls.httpd = app.ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        app.STATIC_DIR = cls.saved
        cls.tmp.cleanup()

    def get(self, path):
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        try:
            with opener.open(self.base + path, timeout=5) as res:
                return res.status, dict(res.headers), res.read()
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers), e.read()

    def test_index_and_app_routes(self):
        for path in ("/", "/home", "/trends?x=1"):
            status, headers, body = self.get(path)
            self.assertEqual(status, 200, path)
            self.assertIn(b"AstraHealth", body)
            self.assertEqual(headers["cache-control"], "no-cache")

    def test_hashed_assets_cached_with_types(self):
        status, headers, _ = self.get("/assets/app-abc123.js")
        self.assertEqual(status, 200)
        self.assertTrue(headers["content-type"].startswith("text/javascript"))
        self.assertIn("immutable", headers["cache-control"])
        self.assertEqual(self.get("/assets/brain.glb")[1]["content-type"], "model/gltf-binary")

    def test_missing_asset_is_404_not_index(self):
        self.assertEqual(self.get("/assets/missing.js")[0], 404)

    def test_no_path_traversal(self):
        for path in ("/../secret.txt", "/%2e%2e/secret.txt", "/assets/../../secret.txt"):
            status, _, body = self.get(path)
            self.assertNotIn(b"nope", body, path)

    def test_api_still_works(self):
        status, _, body = self.get("/api/health")
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(body)["ok"])


if __name__ == "__main__":
    unittest.main()
