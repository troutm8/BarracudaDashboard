// Full-page screenshots of the main routes, for eyeballing a build.
//   node scripts/screenshots.mjs [baseUrl] [outDir]
// Needs a browser: pnpm exec playwright install chromium
import { chromium } from "playwright";
import fs from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "screenshots";
fs.mkdirSync(out, { recursive: true });

const routes = ["/", "/scores", "/schedule", "/standings", "/standings?view=league", "/roster", "/moves", "/team", "/stats", "/rankings", "/games/1029239", "/players/5912"];

const browser = await chromium.launch();
for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 900 }],
  ["phone", { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport, colorScheme: name === "phone" ? "dark" : "light" });
  for (const route of routes) {
    const file = `${out}/${name}-${route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}.png`;
    const res = await page.goto(base + route, { waitUntil: "networkidle", timeout: 120_000 });
    await page.screenshot({ path: file, fullPage: true });
    console.log(res?.status(), route, "->", file);
  }
  await page.close();
}
await browser.close();
