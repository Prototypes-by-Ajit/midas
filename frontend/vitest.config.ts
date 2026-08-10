import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
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
