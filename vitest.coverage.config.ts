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
      //
      // These dropped on 2026-09-16, when groups landed. Nothing got worse —
      // the server code that can be tested from here went *up*, to 87.67% of
      // statements. What changed is the denominator: groups brought 438
      // statements of space-credential code, and reading a permissioned space
      // needs a delegation token minted on the viewer's PDS and a credential
      // presented to the authority. Neither exists in a test harness, and the
      // original plan already put spaces out of scope for that reason.
      //
      // Counted anyway rather than excluded, because an exclusion makes
      // untested code invisible and this code is the access boundary of the
      // whole feature. Better a number that says so. Raising it means a fake
      // space authority to test against; until then this floor stops the rest
      // from sliding.
      thresholds: {
        autoUpdate: true,
        statements: 75.1,
        branches: 66.12,
        functions: 68.29,
        lines: 76.22,
      },
    },
  },
});
