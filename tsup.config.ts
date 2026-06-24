import { defineConfig } from "tsup";

export default defineConfig([
  // Electron main process
  {
    entry: { main: "electron/main.ts" },
    outDir: "electron-dist",
    format: ["cjs"],
    outExtension: () => ({ js: ".cjs" }),
    platform: "node",
    external: ["electron", "better-sqlite3"],
    bundle: true,
    shims: true,
    minify: false,
  },
  // Express server
  {
    entry: { index: "server/index.ts" },
    outDir: "server-dist",
    format: ["cjs"],
    outExtension: () => ({ js: ".cjs" }),
    platform: "node",
    external: ["better-sqlite3"],
    bundle: true,
    shims: true,
    minify: false,
  },
]);
