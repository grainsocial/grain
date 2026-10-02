import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

// The share card for pages without an image of their own (home, explore, the
// support pages). Served from static/, so it ships with the app.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = "file://" + path.join(__dirname, "og.html");
const out = path.join(__dirname, "..", "static", "og-default.jpg");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 } });
const page = await ctx.newPage();
await page.goto(file, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.locator(".logo").screenshot({ path: out, type: "jpeg", quality: 85 });
await browser.close();
console.log("wrote", out);
