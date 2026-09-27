import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The GutenbergKG worker (`make up` in gutenberg_kg), proxied under /worker so the
// page can read books without the worker sending CORS headers. The dev and preview
// servers only; a static build has no proxy. WORKER_URL points elsewhere.
const workerProxy = {
  "/worker": {
    target: process.env.WORKER_URL ?? "http://localhost:8000",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/worker/, ""),
  },
};

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { proxy: workerProxy },
  preview: { proxy: workerProxy },
});
