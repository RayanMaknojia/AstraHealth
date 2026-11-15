import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type ProxyOptions } from "vite"

/**
 * /api goes to the Python server. When it isn't running, answer with a quiet
 * {ok:false} JSON instead of a 502, so the browser console stays clean and the
 * app falls back to its onboard rules exactly as before.
 */
const apiProxy: ProxyOptions = {
  target: process.env.API_TARGET || "http://127.0.0.1:8787",
  changeOrigin: true,
  configure: (proxy) => {
    proxy.on("error", (_err, _req, res) => {
      if (!("writeHead" in res) || res.headersSent) return
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ ok: false, error: "server_unreachable" }))
    })
  },
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
  server: { proxy: { "/api": apiProxy } },
  preview: { proxy: { "/api": apiProxy } },
  define: {
    'import.meta.env.VITE_BASENAME': JSON.stringify(process.env.VITE_BASENAME || ''),
  }
})