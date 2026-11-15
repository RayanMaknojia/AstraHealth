// `npm run dev`: start the AstraHealth Python server (scan generator + AI proxy) and the
// Vite web app together. If Python is missing, the web app still runs with its offline
// fallbacks (browser scan generator, rules-based briefing).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The Python server gets its own port. A PORT set by the terminal, editor or host is
// meant for the web app; passing it on would put both on the same port.
const API_PORT = process.env.API_PORT || "8787";
const children = [];

async function serverRunning() {
  try {
    const res = await fetch(`http://127.0.0.1:${API_PORT}/api/health`, {
      signal: AbortSignal.timeout(800),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function startPython(candidates) {
  const [cmd, ...rest] = candidates;
  if (!cmd) {
    console.warn(
      "\n[astrahealth] Python was not found, so the AI server is not running.\n" +
        "              The app still works offline. To enable AI, install Python 3 and run:  python server/app.py\n",
    );
    return;
  }
  const child = spawn(cmd, [path.join("server", "app.py")], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PORT: API_PORT },
  });
  child.on("error", () => startPython(rest)); // command not found: try the next one
  child.on("exit", (code) => {
    if (code && code !== 0)
      console.warn(`[astrahealth] Python server stopped (exit ${code}). The app keeps running with offline fallbacks.`);
  });
  children.push(child);
}

if (await serverRunning()) console.log(`[astrahealth] Python server already running on port ${API_PORT}.`);
else
  startPython(
    process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"],
  );

const vite = path.join(root, "node_modules", "vite", "bin", "vite.js");
if (!existsSync(vite)) {
  console.error("[astrahealth] Vite is not installed. Run:  npm install");
  process.exit(1);
}
const web = spawn(process.execPath, [vite, ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
});
children.push(web);

const stop = () => {
  for (const c of children) if (!c.killed) c.kill();
};
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});
web.on("exit", (code) => {
  stop();
  process.exit(code ?? 0);
});
