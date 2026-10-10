// Generates the screenshots for the README.
//
//   npm run build:static
//   node scripts/serve-static.mjs &
//   npx playwright@1.62.1 install chromium   # first time only
//   node scripts/screenshot.mjs
//
// playwright is not a project dependency; a one-off npx run is enough. A
// browser of several hundred MB is not worth adding to the dependencies for
// a few images.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const OUT = "docs/img";
mkdirSync(OUT, { recursive: true });

/** Wait for DuckDB to come up and the map to finish drawing its 98 polygons.
 *  Waiting for networkidle is not enough: the wasm compiles in a worker, and
 *  the main thread's network went idle long before. */
async function settle(page, { needsDb = true } = {}) {
  if (needsDb) {
    await page
      .waitForFunction(
        () => {
          const r = document.querySelector('input[type=range]');
          return r && !r.disabled && document.querySelectorAll(".board .row").length > 0;
        },
        { timeout: 90_000 },
      )
      .catch(() => console.warn("  ! DuckDB not ready within 90s, taking the screenshot anyway"));
  }
  // The map's last frame
  await page.waitForTimeout(2500);
}

const shots = [
  {
    name: "map-light",
    url: "/",
    theme: "light",
    async prep(page) {
      await settle(page);
    },
  },
  {
    name: "map-crisis",
    url: "/",
    theme: "dark",
    // Year-on-year at 2009Q1: Zealand all cold blue, west Jutland still
    // rising. The best-looking and most telling frame in this data.
    async prep(page) {
      await settle(page);
      // Select by text, not by title: title is only a tooltip, not an accessible name
      await page.locator(".controls .seg button", { hasText: /^Growth$/ }).click();
      await page.waitForTimeout(500);
      await page.locator(".timeline .seg button", { hasText: /^Since 1992$/ }).click();
      await page.waitForTimeout(800);
      const slider = page.locator('input[type=range]');
      await slider.evaluate((el) => {
        const set = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        ).set;
        set.call(el, "68"); // 2009Q1
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForTimeout(2500);
    },
  },
  {
    name: "area",
    url: "/area/101/",
    theme: "light",
    async prep(page) {
      await page
        .waitForFunction(() => document.querySelectorAll(".chart svg").length >= 3, {
          timeout: 90_000,
        })
        .catch(() => console.warn("  ! the charts did not render"));
      await page.waitForTimeout(1200);
    },
  },
];

const browser = await chromium.launch();
for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: s.theme,
  });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && console.warn("  console:", m.text().slice(0, 120)));
  await page.goto(BASE + s.url, { waitUntil: "networkidle", timeout: 60_000 });
  await s.prep(page);
  const file = `${OUT}/${s.name}.png`;
  await page.screenshot({ path: file });
  console.log(`[shot] ${file}`);
  await ctx.close();
}
await browser.close();
