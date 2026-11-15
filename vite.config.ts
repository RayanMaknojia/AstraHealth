import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // Python server (server/app.py): scan generator + Gemini proxy. The key stays in the server.
  server: { proxy: { "/api": { target: process.env.API_TARGET || "http://127.0.0.1:8787", changeOrigin: true } } },
  preview: { proxy: { "/api": { target: process.env.API_TARGET || "http://127.0.0.1:8787", changeOrigin: true } } },
  define: {
    'import.meta.env.VITE_BASENAME': JSON.stringify(process.env.VITE_BASENAME || ''),
  }
})