import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = "file://" + path.join(__dirname, "logo.html");
const out = path.join(__dirname, "logo.png");

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 512, height: 512 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(file, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const el = await page.locator(".logo");
await el.screenshot({ path: out, omitBackground: true });
await browser.close();
console.log("wrote", out);
