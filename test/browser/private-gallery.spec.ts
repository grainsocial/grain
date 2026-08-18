// The private gallery flow, end to end, in a browser: OAuth into a PDS that
// serves permissioned spaces, publish a gallery into a space, then read it back
// and confirm the photo bytes arrive through grain rather than the CDN.
//
// Needs the dev stack and its accounts:
//   docker compose up -d && ./seeds/pdsjs-accounts.sh
//   npx playwright test
//
// Skipped when those accounts are absent, so a checkout without the stack still
// runs the suite.

import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const CREDS = "data/pdsjs/credentials-spacehost.json";
const PASSWORD = "dev-password";

test.skip(!existsSync(CREDS), "needs ./seeds/pdsjs-accounts.sh");

const author = JSON.parse(readFileSync(CREDS, "utf8")) as {
  did: string;
  handle: string;
  pdsUrl: string;
};

test("publish a private gallery and read it back", async ({ page }) => {
  test.setTimeout(120_000);

  // 1. Log in. The DID, not the handle: handle resolution runs through the dev
  //    relay, which has never heard of an account on a pds.js instance.
  await page.goto(`/oauth/login?handle=${encodeURIComponent(author.did)}`);

  // pds.js knows which account is being authorized from the request, so its
  // consent screen asks only for the password. "Authorize" exactly — there is
  // an "Authorize with a passkey" button beside it.
  await expect(page.getByRole("heading", { name: /sign in to authorize/i })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("textbox").first().fill(PASSWORD);
  await page.getByRole("button", { name: "Authorize", exact: true }).click();

  await page.waitForURL((url) => url.port === "3000", { timeout: 60_000 });

  // 2. Publish a gallery into a space.
  // networkidle, because the file below is handed to the input programmatically
  // and a change event dispatched before Svelte has hydrated is dropped with
  // nothing to observe.
  await page.goto("/private/create", { waitUntil: "networkidle" });
  // Retried rather than waited on: the file is handed to the input
  // programmatically, and a change event dispatched before Svelte has attached
  // its handler is dropped with nothing to observe. Polling stops at the first
  // thumbnail, so this adds one photo, not one per attempt.
  //
  // By test id, not by tag: the layout carries file inputs of its own.
  await expect
    .poll(
      async () => {
        await page.getByTestId("private-photos").setInputFiles("seeds/images/forest.jpg");
        return page.locator(".thumb img").count();
      },
      { timeout: 60_000, intervals: [500, 1000, 2000] },
    )
    .toBeGreaterThan(0);

  await page.getByPlaceholder("Sunday at the coast").fill("Browser test gallery");
  await page.getByRole("button", { name: /create private gallery/i }).click();

  // 3. Land on the gallery and read it back out of the space.
  await page.waitForURL(/\/private\/did(:|%3A)/i, { timeout: 60_000 });
  await expect(page.getByText("Private", { exact: false }).first()).toBeVisible();

  // 4. The photo. Served by grain from the space, never cached anywhere in
  //    between — so the response has to be a real image and say so.
  const image = page.locator(".grid img").first();
  await expect(image).toBeVisible({ timeout: 30_000 });

  const src = await image.getAttribute("src");
  expect(src).toContain("getPrivateBlob");

  const response = await page.request.get(src!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/^image\//);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect((await response.body()).byteLength).toBeGreaterThan(1000);

  // The browser decoded it, not just the request client.
  await expect
    .poll(async () => image.evaluate((el: HTMLImageElement) => el.naturalWidth), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
});
