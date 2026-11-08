import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (pkg: string, file = "index.tsx") => fileURLToPath(new URL(`./packages/${pkg}/src/${file}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@mahrus-rohisyam\/core-ui$/, replacement: src("core-ui") },
      { find: /^@mahrus-rohisyam\/core-api$/, replacement: src("core-api", "index.ts") },
      { find: /^@mahrus-rohisyam\/core-auth$/, replacement: src("core-auth") },
      { find: /^@mahrus-rohisyam\/core-shell$/, replacement: src("core-shell") },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["packages/*/src/**/*.test.{ts,tsx}"],
  },
});
