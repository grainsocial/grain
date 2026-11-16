// The pages used as people use them: logged in through the PDS's own
// approval page, writing from the pages, and reading back what they wrote,
// on the page and in the PDS, through grain-serve and the web's build
// together, as next.grain.social runs them.
//
//   just e2e    the flows, over the stock PDS and then the spaces alpha
//
// Each run seeds a world of its own (setup.mjs) on free ports. The flows go
// in order in one worker, as each writes to the world the next reads.

import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { root } from "./setup.mjs";

const spaces = !!process.env.GRAIN_DEV_ENV;

export default defineConfig({
  testDir: ".",
  // The flows over the stock PDS, as most accounts' are; the spaces ones
  // over the spaces alpha (GRAIN_DEV_ENV), as only it serves spaces.
  testMatch: spaces ? "spaces.spec.mjs" : "flows.spec.mjs",
  globalSetup: "./setup.mjs",
  outputDir: join(root, "target/e2e", spaces ? "spaces" : "results"),
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    browserName: "chromium",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    // The pages are reached as a PDS reaches grain-serve: over https, at
    // the harness's client hostname, with the harness's own certificate.
    ignoreHTTPSErrors: true,
    launchOptions: { args: ["--host-resolver-rules=MAP client.grain.internal 127.0.0.1"] },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
