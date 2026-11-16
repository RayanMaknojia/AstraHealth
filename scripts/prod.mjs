// `npm run start:prod`: run AstraHealth the way the hosted site runs it (Render / Docker):
// one Python server serving the built website (dist/) and the /api endpoints together.
// Run `npm run build` first. Port: PORT env or 8080.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
if (!existsSync(path.join(dist, "index.html"))) {
  console.error("[astrahealth] No build found. Run:  npm run build");
  process.exit(1);
}
const env = {
  ...process.env,
  HOST: process.env.HOST || "127.0.0.1",
  PORT: process.env.PORT || "8080",
  STATIC_DIR: dist,
};

function start(candidates) {
  const [cmd, ...rest] = candidates;
  if (!cmd) {
    console.error("[astrahealth] Python 3 was not found. Install it, then run this again.");
    process.exit(1);
  }
  const child = spawn(cmd, [path.join("server", "app.py")], { cwd: root, env, stdio: "inherit" });
  child.on("error", () => start(rest)); // command not found: try the next one
  child.on("exit", (code) => process.exit(code ?? 0));
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill());
}
start(process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"]);
