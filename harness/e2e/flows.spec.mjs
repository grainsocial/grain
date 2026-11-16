// What people do on the pages, in order, as alice and bob: each write shown
// at once, kept in the writer's repo on their PDS, and shown again once the
// page is read anew, from grain-serve's index, to the writer and to the
// other account.

import { expect, test } from "@playwright/test";
import { BLUESKY_PROFILE } from "./setup.mjs";
import {
  anew,
  browse,
  eventually,
  failed,
  go,
  logIn,
  nav,
  photo,
  record,
  said,
  records,
  who,
} from "./pages.mjs";

test.describe.configure({ mode: "serial" });

/// alice's browser and bob's.
let alice;
let bob;

test.beforeAll(async ({ browser }) => {
  alice = await browse(browser);
  bob = await browse(browser);
});

test.afterAll(async () => {
  await alice.context().close();
  await bob.context().close();
});

/// What the browsers said, shown for a flow that failed.
test.afterEach(() => {
  const info = test.info();
  if (info.status !== info.expectedStatus && said.length) console.log(said.slice(-40).join("\n"));
  said.length = 0;
});

const TITLE = "Low tide at Ocean Beach";
const RETITLED = "Low tide at Ocean Beach, late October";
/// The gallery alice makes, by its record key.
let rkey;
const galleryPage = () => `/profile/alice.test/gallery/${rkey}`;
/// The gallery page's own title.
const heading = (page, title) => page.getByRole("heading", { level: 1, name: title });
const galleryLink = (page) => page.locator(`a[href$="/gallery/${rkey}"]`).first();

test("logging in through the PDS seeds a profile from Bluesky", async () => {
  await go(alice, "/");
  await logIn(alice, "alice");
  // In the background, after the login: from her Bluesky profile.
  await eventually(
    () => record("alice", "social.grain.actor.profile", "self"),
    (r) => expect(r?.value).toMatchObject(BLUESKY_PROFILE),
  );
  await go(alice, "/profile/alice.test");
  await anew(alice, (expect) =>
    expect(alice.locator(".profile-name")).toHaveText(BLUESKY_PROFILE.displayName),
  );
});

test("logging in with no Bluesky profile seeds a bare one", async () => {
  await go(bob, "/");
  await logIn(bob, "bob");
  await eventually(
    () => record("bob", "social.grain.actor.profile", "self"),
    (r) => {
      expect(r?.value?.createdAt).toBeTruthy();
      expect(r?.value?.displayName).toBeUndefined();
    },
  );
  // A PDS with no spaces: no Groups.
  await expect(nav(bob, "Profile")).toBeVisible();
  await expect(nav(bob, "Groups")).toHaveCount(0);
});

test("the home feed and the story tray load", async () => {
  await go(alice, "/");
  await expect(alice.locator(".story-strip").getByText("Your story")).toBeVisible();
  await expect(alice.getByText("No galleries found.")).toBeVisible();
  // What the two are drawn from, as the browser asks for them.
  const asked = await alice.evaluate(async () => {
    const said = (r) => r.json().then((body) => ({ status: r.status, body }));
    const stories = await fetch("/xrpc/social.grain.story.getAuthors").then(said);
    const feeds = await fetch("/xrpc/social.grain.feed.describeFeeds").then(said);
    const recent = feeds.body?.feeds?.find((f) => f.name === "recent");
    const q = new URLSearchParams({ feed: recent?.uri ?? "" });
    const feed = await fetch(`/xrpc/social.grain.feed.getFeed?${q}`).then(said);
    return { stories, feeds, feed };
  });
  expect(asked.stories.status).toBe(200);
  expect(asked.feeds.status).toBe(200);
  expect(asked.feed.status, JSON.stringify(asked.feed.body)).toBe(200);
  expect(asked.feed.body.items).toEqual([]);
});

test("creating a gallery with a photo", async () => {
  await go(alice, "/create");
  await alice.locator('input[type="file"]').setInputFiles(await photo(alice, "tide.jpg"));
  await alice.getByPlaceholder("Add a title...").fill(TITLE);
  await alice.getByPlaceholder(/^Add a description/).fill("The pools the sea leaves behind.");
  await alice.getByRole("button", { name: "Next" }).click();
  await alice
    .getByPlaceholder("Describe this image (optional)...")
    .fill("Rock pools under an orange sky");
  await alice.getByRole("button", { name: "Post", exact: true }).click();
  await alice.waitForURL((u) => u.pathname === "/");
  // In her repo: the gallery, its photo with its blob, and the item joining them.
  const [gallery] = (await records("alice", "social.grain.gallery")).filter(
    (r) => r.value.title === TITLE,
  );
  expect(gallery?.value.description).toBe("The pools the sea leaves behind.");
  rkey = gallery.uri.split("/").pop();
  const items = (await records("alice", "social.grain.gallery.item")).filter(
    (r) => r.value.gallery === gallery.uri,
  );
  expect(items).toHaveLength(1);
  const [shot] = (await records("alice", "social.grain.photo")).filter(
    (r) => r.uri === items[0].value.item,
  );
  expect(shot?.value.alt).toBe("Rock pools under an orange sky");
  expect(shot?.value.photo?.ref?.$link).toBeTruthy();
  // In the feed, and on her profile.
  await anew(alice, (expect) => expect(galleryLink(alice)).toBeVisible());
  await go(alice, "/profile/alice.test");
  await anew(alice, (expect) => expect(galleryLink(alice)).toBeVisible());
  await go(alice, galleryPage());
  await expect(heading(alice, TITLE)).toBeVisible();
});

test("favoriting a gallery", async () => {
  await go(bob, galleryPage());
  await bob.getByRole("button", { name: "Favorite", exact: true }).first().click();
  await expect(bob.getByRole("button", { name: "Unfavorite" }).first()).toBeVisible();
  const uri = `at://${who.alice.did}/social.grain.gallery/${rkey}`;
  await eventually(
    () => records("bob", "social.grain.favorite"),
    (favs) => expect(favs.map((r) => r.value.subject)).toContain(uri),
  );
  await anew(bob, (expect) =>
    expect(bob.getByRole("button", { name: "Unfavorite" }).first()).toBeVisible(),
  );
});

const SAID = "The light on the left pool is something else.";

test("commenting on a gallery", async () => {
  await go(bob, galleryPage());
  const box = bob.getByPlaceholder("Add a comment...").first();
  await box.fill(SAID);
  await box.press("Enter");
  await expect(bob.getByText(SAID)).toBeVisible();
  await expect(box).toHaveValue("");
  const comments = await records("bob", "social.grain.comment");
  expect(comments.map((r) => r.value.text)).toContain(SAID);
  await anew(bob, (expect) => expect(bob.getByText(SAID)).toBeVisible());
  // And to alice.
  await go(alice, galleryPage());
  await anew(alice, (expect) => expect(alice.getByText(SAID)).toBeVisible());
});

test("following", async () => {
  await go(bob, "/profile/alice.test");
  await bob.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(bob.getByRole("button", { name: "Following", exact: true })).toBeVisible();
  await eventually(
    () => records("bob", "social.grain.graph.follow"),
    (follows) => expect(follows.map((r) => r.value.subject)).toContain(who.alice.did),
  );
  await anew(bob, (expect) =>
    expect(bob.getByRole("button", { name: "Following", exact: true })).toBeVisible(),
  );
});

test("notifications show alice what bob did", async () => {
  await go(alice, "/notifications");
  const from = (what) => alice.locator(".notif", { hasText: what });
  await anew(alice, async (expect) => {
    await expect(from("followed you")).toContainText("bob.test");
    await expect(from("favorited your gallery")).toContainText("bob.test");
    await expect(from("commented on your gallery")).toContainText(SAID);
  });
});

// The gallery menu offers editing to one account alone, so the editor is
// reached by its address.
test("editing a gallery", async () => {
  await go(alice, `${galleryPage()}/edit`);
  const title = alice.getByPlaceholder("Add a title...");
  await expect(title).toHaveValue(TITLE);
  await title.fill(RETITLED);
  await alice.getByRole("button", { name: "Save", exact: true }).click();
  await alice.waitForURL((u) => u.pathname === galleryPage());
  // In her repo, then in the index, then on the page she is sent back to.
  const kept = await record("alice", "social.grain.gallery", rkey);
  expect(kept?.value.title).toBe(RETITLED);
  const indexed = await alice.evaluate(
    (uri) =>
      fetch(`/xrpc/social.grain.gallery.getGallery?gallery=${encodeURIComponent(uri)}`).then((r) =>
        r.json(),
      ),
    kept.uri,
  );
  expect(indexed.gallery?.title).toBe(RETITLED);
  await expect(heading(alice, RETITLED)).toBeVisible();
  await go(bob, galleryPage());
  await anew(bob, (expect) => expect(heading(bob, RETITLED)).toBeVisible());
});

test("editing a profile", async () => {
  await go(alice, "/settings/profile");
  const name = alice.getByPlaceholder("Your name");
  await expect(name).toHaveValue(BLUESKY_PROFILE.displayName);
  await name.fill("Alice in Tidepools");
  await alice.getByPlaceholder("Tell us about yourself").fill("Low tides and long exposures.");
  await alice.getByRole("button", { name: "Save", exact: true }).click();
  await expect(alice.getByText("Profile saved")).toBeVisible();
  const kept = await record("alice", "social.grain.actor.profile", "self");
  expect(kept?.value).toMatchObject({
    displayName: "Alice in Tidepools",
    description: "Low tides and long exposures.",
  });
  await go(bob, "/profile/alice.test");
  await anew(bob, (expect) =>
    expect(bob.locator(".profile-name")).toHaveText("Alice in Tidepools"),
  );
});

test("deleting a gallery", async () => {
  await go(alice, galleryPage());
  await alice.locator(".meta-top").getByRole("button", { name: "More options" }).click();
  alice.once("dialog", (d) => d.accept());
  await alice.getByRole("button", { name: "Delete gallery" }).click();
  await alice.waitForURL(
    (u) => u.pathname.startsWith("/profile/alice.test") && !u.pathname.includes("/gallery/"),
  );
  expect(await record("alice", "social.grain.gallery", rkey)).toBeNull();
  const items = await records("alice", "social.grain.gallery.item");
  expect(items.filter((r) => r.value.gallery.endsWith(`/${rkey}`))).toEqual([]);
  await anew(alice, (expect) => expect(galleryLink(alice)).toHaveCount(0));
  await go(bob, "/");
  await anew(bob, (expect) => expect(galleryLink(bob)).toHaveCount(0));
});

// Last: what every page above asked of grain-serve was answered, rather
// than failed or refused as a method it does not serve.
test("every call the pages made was answered", async () => {
  expect([...failed].sort()).toEqual([]);
});
