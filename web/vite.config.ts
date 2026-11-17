import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

/** Writes dist/version.json, which an open page checks for a newer build (src/game/updateCheck.ts). */
function versionFile(): Plugin {
  return {
    name: "version-file",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: `${JSON.stringify({ version })}\n` });
    },
  };
}

export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), tailwindcss(), versionFile()],
  build: {
    // three.js alone is ~790 kB minified and the forest's own code ~630 kB;
    // the 500 kB default warns on both every build. 1000 kB still flags real
    // growth.
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        // Libraries in their own chunks, so a release that changes only the
        // forest's code leaves them cached for a returning visitor. three.js
        // changes least often, so it gets its own.
        codeSplitting: {
          groups: [
            { name: "three", test: /node_modules[\\/]three[\\/]/, priority: 2 },
            { name: "vendor", test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
});
