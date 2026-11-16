// What the flows share: the world they run over, and how a page is opened,
// logged in to and written from, as a person does it.

import { expect } from "@playwright/test";

export const world = JSON.parse(process.env.E2E_WORLD);
export const who = Object.fromEntries(world.accounts.map((a) => [a.handle.split(".")[0], a]));
export const url = (path) => world.base + path;

/// What the pages called of grain-serve that it failed to answer, as
/// `<status> <nsid>`, across every page the flows opened.
export const failed = new Set();

/// What the browsers said that a page did not show: errors, and requests
/// that failed, newest last.
export const said = [];

/// A browser of its own, logged in to no one, its page ready to open. It
/// reaches the pages, the PDS and the PLC directory and nothing else: what
/// the pages ask of plc.directory, as they do to find a PDS, the harness's
/// directory answers, and anything else off the world is refused, so no
/// flow reads or writes past it.
export const browse = async (browser) => {
  const context = await browser.newContext();
  const plc = new URL(world.plc);
  const local = new Set(["127.0.0.1", "localhost", world.host]);
  await context.route(
    (u) => !local.has(u.hostname),
    async (route) => {
      const asked = new URL(route.request().url());
      if (asked.hostname !== "plc.directory") return route.abort("blockedbyclient");
      const res = await fetch(new URL(asked.pathname + asked.search, plc));
      await route.fulfill({
        status: res.status,
        contentType: res.headers.get("content-type") ?? "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: Buffer.from(await res.arrayBuffer()),
      });
    },
  );
  const page = await context.newPage();
  // What the browser said, for a flow that fails to show.
  page.on("console", (m) => m.type() === "error" && said.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => said.push(`page error: ${e.message}`));
  page.on("requestfailed", (r) => said.push(`failed: ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", (res) => {
    const at = new URL(res.url());
    if (at.origin === world.base && at.pathname.startsWith("/xrpc/") && res.status() >= 500) {
      failed.add(`${res.status()} ${at.pathname.slice("/xrpc/".length)}`);
    }
  });
  return page;
};

/// The records of `collection` in `name`'s public repo, read from their PDS.
export const records = async (name, collection) => {
  const asked = `${world.pds}/xrpc/com.atproto.repo.listRecords?repo=${who[name].did}&collection=${collection}&limit=100`;
  return (await fetch(asked).then((r) => r.json())).records ?? [];
};

/// The record `rkey` of `collection` in `name`'s public repo: null for none.
export const record = async (name, collection, rkey) => {
  const asked = `${world.pds}/xrpc/com.atproto.repo.getRecord?repo=${who[name].did}&collection=${collection}&rkey=${rkey}`;
  const res = await fetch(asked);
  return res.ok ? res.json() : null;
};

/// Until the page's script has taken it over, as the root says once
/// mounted: a click before that reaches no handler.
export const ready = (page) => page.locator("html[data-ready]").waitFor({ state: "attached" });

/// `page` at `path` of the pages, ready.
export const go = async (page, path) => {
  await page.goto(path.startsWith("http") ? path : url(path));
  await ready(page);
};

/// Until `check` passes on `page` read anew: what one account wrote reaches
/// another's page through the index, and a page drawn from a cached answer
/// is read again rather than waited on. `check` is handed an `expect` that
/// gives up soon.
export const anew = (page, check, timeout = 30_000) =>
  expect(async () => {
    await page.reload();
    await ready(page);
    await check(expect.configure({ timeout: 3_000 }));
  }).toPass({ timeout });

/// Until `check` passes on what `read` answers, read anew each time.
export const eventually = (read, check, timeout = 15_000) =>
  expect(async () => check(await read())).toPass({ timeout });

/// Signs in as `name` on the PDS's own page `at` has come to, and approves
/// what was asked of it.
export const approve = async (at, name) => {
  await at.waitForURL((u) => u.origin === new URL(world.pds).origin);
  await at.getByRole("textbox", { name: "Password" }).fill(who[name].password);
  await at.getByRole("button", { name: "Sign in" }).click();
  await at.getByRole("button", { name: /^(accept|authorize|allow)$/i }).click();
};

/// Logs in as `name` from the sidebar's button: the handle in the dialog it
/// opens, then the PDS's own page to sign in and approve on, which sends
/// the browser back to the page it started from.
export const logIn = async (page, name) => {
  const back = page.url();
  await page.locator(".sidebar-top").getByRole("button", { name: "Sign in" }).click();
  const dialog = page.locator("dialog[open]");
  await dialog.getByPlaceholder("e.g. user.bsky.social").fill(who[name].handle);
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await approve(page, name);
  await page.waitForURL(back);
  await ready(page);
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
};

/// The sidebar's link to `label`.
export const nav = (page, label) =>
  page.locator("nav.sidebar-left").getByRole("link", { name: label, exact: true });

/// A photo, as a camera would hand one over: a JPEG drawn by the page's own
/// canvas, `width` by `height`, for a file input to take.
export const photo = async (page, name, [width, height] = [1200, 800]) => {
  const data = await page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext("2d");
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#f4b183");
      sky.addColorStop(1, "#2e5c8a");
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#1d2b36";
      g.fillRect(0, h * 0.7, w, h * 0.3);
      return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
    },
    [width, height],
  );
  return { name, mimeType: "image/jpeg", buffer: Buffer.from(data, "base64") };
};
