// Reader-side discovery: a gallery shared with you is findable without anyone
// sending you a link.
//
// This is the one thing grain keeps that the protocol does not. A space's
// member list lives with its authority and being added leaves no trace on the
// member's own PDS, so a reader has nothing to enumerate. grain records who a
// gallery was shared with, then confirms each row by reading the gallery
// through a credential the authority issues.
//
// Needs the dev stack and its two accounts:
//   docker compose up -d && ./seeds/pdsjs-accounts.sh
//   npx playwright test

import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const author = JSON.parse(readFileSync("data/pdsjs/credentials-spacehost.json", "utf8"));
const reader = JSON.parse(readFileSync("data/pdsjs/credentials-spacemember.json", "utf8"));

async function login(page: any, account: { did: string }) {
  await page.goto(`/oauth/login?handle=${encodeURIComponent(account.did)}`);
  await page.getByRole("textbox").first().fill("dev-password");
  await page.getByRole("button", { name: "Authorize", exact: true }).click();
  await page.waitForURL((url: URL) => url.port === "3000", { timeout: 60_000 });
}

test("a reader sees a gallery shared with them", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 900, height: 900 });

  const title = `Shared ${Date.now().toString(36)}`;

  await login(page, author);
  await page.goto("/private/create", { waitUntil: "networkidle" });
  await expect
    .poll(
      async () => {
        await page.getByTestId("private-photos").setInputFiles("seeds/images/skyline.jpg");
        return page.locator(".thumb img").count();
      },
      { timeout: 60_000, intervals: [500, 1000, 2000] },
    )
    .toBeGreaterThan(0);
  await page.getByPlaceholder("Sunday at the coast").fill(title);
  await page.getByPlaceholder(/did:plc/).fill(reader.did);
  await page.getByRole("button", { name: /create private gallery/i }).click();
  await page.waitForURL(/\/private\/did(:|%3A)/i, { timeout: 60_000 });

  // Now as the reader, who has never seen a URL for it.
  await login(page, reader);
  await page.goto("/settings/account", { waitUntil: "networkidle" });
  const link = page.getByRole("link", { name: new RegExp(title) });
  await expect(link).toBeVisible({ timeout: 30_000 });

  // And it opens: the photo comes through the space with a credential the
  // author's PDS issued for this reader.
  await link.click();
  await page.waitForURL(/\/private\/did(:|%3A)/i, { timeout: 30_000 });
  await expect(page.locator('img[src*="getPrivateBlob"]').first()).toBeVisible({ timeout: 30_000 });
});
