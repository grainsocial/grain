// Over the spaces alpha: what an account on a PDS that serves permissioned
// spaces finds that one on the stock PDS does not. getSpaceSupport says the
// PDS serves them, so the Groups tab shows, and the groups page opens to
// the groups grain knows rather than to the notice that spaces are
// needed. The world has no group host, so no group is started here.

import { expect, test } from "@playwright/test";
import { browse, failed, go, logIn, nav, said, url, world } from "./pages.mjs";

test.describe.configure({ mode: "serial" });

let alice;

test.beforeAll(async ({ browser }) => {
  if (!world.spaces)
    throw new Error("the spaces flows run over the spaces alpha: set GRAIN_DEV_ENV");
  alice = await browse(browser);
});

test.afterAll(async () => {
  await alice?.context().close();
});

/// What the browsers said, shown for a flow that failed.
test.afterEach(() => {
  const info = test.info();
  if (info.status !== info.expectedStatus && said.length) console.log(said.slice(-40).join("\n"));
  said.length = 0;
});

test("logging in on a PDS with spaces shows Groups", async () => {
  await go(alice, "/");
  await logIn(alice, "alice");
  const asked = await alice.evaluate(() =>
    fetch("/xrpc/social.grain.server.getSpaceSupport").then((r) => r.json()),
  );
  expect(asked.supported).toBe(true);
  await expect(nav(alice, "Groups")).toBeVisible();
});

test("the groups page opens", async () => {
  await nav(alice, "Groups").click();
  await alice.waitForURL(url("/groups"));
  await expect(alice.getByText("No groups yet.")).toBeVisible();
  // No group host, so nothing to start one on.
  await expect(alice.getByRole("link", { name: "Start a group" })).toHaveCount(0);
});

test("every call the pages made was answered", async () => {
  expect([...failed].sort()).toEqual([]);
});
