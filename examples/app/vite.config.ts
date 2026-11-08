import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const src = (pkg: string, file = "index.tsx") => fileURLToPath(new URL(`../../packages/${pkg}/src/${file}`, import.meta.url));

// Served by the Go app under /app/. In development, API calls go to the Go app on port 8080
// (start it with `make run` in core-backend).
export default defineConfig({
  base: "/app/",
  resolve: {
    // Use the packages' source, so changes show without rebuilding them.
    alias: [
      { find: /^@mahrus-rohisyam\/core-ui$/, replacement: src("core-ui") },
      { find: /^@mahrus-rohisyam\/core-api$/, replacement: src("core-api", "index.ts") },
      { find: /^@mahrus-rohisyam\/core-auth$/, replacement: src("core-auth") },
      { find: /^@mahrus-rohisyam\/core-shell$/, replacement: src("core-shell") },
    ],
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8080" },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      // React Query marks files "use client" for server components; a client-only build ignores it.
      onwarn(warning, warn) {
        if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning);
      },
    },
  },
});
