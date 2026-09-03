// Coverage runs from its own config, not vite.config.ts, because vite-plus
// guards the coverage provider against the vitest version it was *built*
// against (4.1.11) rather than the one actually running. We override vitest to
// 5 — see "The vitest overrides" in AGENTS.md — so `vp test --coverage` refuses
// to start no matter which provider version is installed. Importing vitest's
// own `defineConfig` here skips the guard plugin; `vp test` is unaffected and
// stays the normal way to run the suite.
//
// Scope is server code only. `app/lib` is browser code with no DOM setup, and
// `.svelte` files cannot be instrumented without a component test harness, so
// including either would only report an unreachable denominator.
import { hatk } from "@hatk/hatk/vite-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [hatk()],
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/browser/**"],
    coverage: {
      provider: "v8",
      include: ["server/**/*.ts"],
      reporter: ["text", "json-summary"],
      // A ratchet: every run raises the floor to what the suite actually
      // reaches, so coverage can go up and never quietly back down.
      thresholds: {
        autoUpdate: true,
        statements: 33.34,
        branches: 32.31,
        functions: 39.73,
        lines: 33.69,
      },
    },
  },
});
