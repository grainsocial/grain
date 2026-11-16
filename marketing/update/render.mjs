// The update notice: stories on grain.social's account before and on the
// day grain moves to grain-serve, and the one feed item the
// old apps get after. Renders notice.html for each into
// marketing/update/*.png. The copy, and the posts that go with them, are in
// README.md beside this.
//
// Usage: node marketing/update/render.mjs ["Monday, Nov 16"]

import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const date = process.argv[2] ?? "Monday, Nov 16";
const STORY = { width: 1080, height: 1920 };

const NOTICES = [
  {
    file: "story-1.png",
    size: STORY,
    eyebrow: "Heads up",
    title: "A new Grain is on the way",
    body: "We’ve made big changes under the hood. Update the app to keep your feed, stories and galleries working.",
    date: `Older versions of the app stop working on <b>${date}</b>.`,
  },
  {
    file: "story-2.png",
    size: STORY,
    eyebrow: "Update today",
    title: "Get the latest Grain",
    body: "Open the App Store or Google Play and update Grain. It takes a minute, and nothing you posted changes.",
    date: `Older versions of the app stop working on <b>${date}</b>.`,
  },
  {
    file: "story-3.png",
    size: STORY,
    eyebrow: "Today",
    title: "Grain updates today",
    date: `Older versions of the app stop working <b>today</b>.`,
    body: "Grain is down for about 15 minutes while the update goes out. Update the app if you haven’t yet.",
  },
  {
    file: "post.png",
    size: { width: 1080, height: 1350 },
    post: true,
    eyebrow: "Update Grain",
    title: "This version has stopped working",
    body: "Update Grain from the App Store or Google Play to see your feed again. Your photos and galleries are all still there.",
  },
];

const browser = await chromium.launch();
for (const n of NOTICES) {
  const page = await browser.newPage({ viewport: n.size, deviceScaleFactor: 1 });
  await page.goto(`file://${path.join(here, "notice.html")}`, { waitUntil: "networkidle" });
  await page.evaluate((n) => {
    document.body.classList.toggle("post", !!n.post);
    document.getElementById("eyebrow").textContent = n.eyebrow;
    document.getElementById("title").textContent = n.title;
    document.getElementById("body").textContent = n.body;
    document.getElementById("date").innerHTML = n.date ?? "";
    return document.fonts.ready;
  }, n);
  await page.screenshot({ path: path.join(here, n.file) });
  await page.close();
  console.log("wrote", n.file);
}
await browser.close();
