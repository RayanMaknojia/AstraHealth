import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import type { ProxyOptions } from "vite"

// Python server not running → answer {ok:false} quietly (the app uses its offline
// fallbacks) and print one hint instead of a stack trace for every request.
// Status 200, not 503: any 5xx is logged as a red error in the browser console.
let warnedNoServer = false
function apiProxy(): ProxyOptions {
  return {
    target: process.env.API_TARGET || `http://127.0.0.1:${process.env.API_PORT || "8787"}`,
    changeOrigin: true,
    configure: (proxy) => {
      // Vite adds its own (noisy) error logger after this; keep only ours.
      const on = proxy.on.bind(proxy) as (event: string, listener: (...args: unknown[]) => void) => unknown
      ;(proxy as unknown as { on: (event: string, listener: (...args: unknown[]) => void) => unknown }).on = (event, listener) =>
        event === "error" ? proxy : on(event, listener)
      on("error", (_err: unknown, _req: unknown, res: unknown) => {
        if (!warnedNoServer) {
          warnedNoServer = true
          console.warn("[astrahealth] AI server not reachable on port 8787: using offline fallbacks. Start it with:  python server/app.py")
        }
        const out = res as unknown as { headersSent?: boolean; writeHead?: (s: number, h: Record<string, string>) => void; end?: (b: string) => void }
        if (out.writeHead && !out.headersSent) out.writeHead(200, { "content-type": "application/json" })
        out.end?.(JSON.stringify({ ok: false, error: "server_unreachable" }))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // Python server (server/app.py): scan generator + Gemini proxy. The key stays in the server.
  server: { proxy: { "/api": apiProxy() } },
  preview: { proxy: { "/api": apiProxy() } },
  define: {
    'import.meta.env.VITE_BASENAME': JSON.stringify(process.env.VITE_BASENAME || ''),
  }
})