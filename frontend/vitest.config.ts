import { fileURLToPath } from "node:url"

import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  // Mirrors the `@/*` path in tsconfig. The first two suites imported their
  // subjects relatively and never needed it; T077 tests a module that imports
  // `@/lib/reports/contract`, and without this the suite fails to resolve rather
  // than fails to pass — which reads like a broken test instead of missing
  // config. Anything under src/ is now testable without rewriting its imports.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Phase 1 installs the runner before any suite exists, and the phase
    // checkpoint expects it to "execute and collect zero tests". Without this,
    // an empty run exits 1. T015/T016 add the first real suites.
    passWithNoTests: true,
    // src/features/auth/auth.test.ts is a standalone `node:assert` script run as
    // `node --experimental-strip-types`, not a vitest suite. Vitest fails any
    // collected file containing zero tests, so it is excluded here rather than
    // rewritten -- it belongs to unrelated work the scope guard says to preserve.
    // Spread the defaults: setting `exclude` replaces them rather than adding.
    exclude: [...configDefaults.exclude, "src/features/auth/auth.test.ts"],
  },
})
