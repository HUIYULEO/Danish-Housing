// 给 README 生成截图。
//
//   npm run build:static
//   node scripts/serve-static.mjs &
//   npx playwright@1.62.1 install chromium   # 第一次才需要
//   node scripts/screenshot.mjs
//
// playwright 不是项目依赖，用 npx 临时跑就行 —— 为了几张图往依赖里
// 塞一个几百 MB 的浏览器不值得。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const OUT = "docs/img";
mkdirSync(OUT, { recursive: true });

/** 等 DuckDB 起来 + 地图把 98 个多边形画完。
 *  光等 networkidle 不够：wasm 是在 worker 里编译的，主线程的网络早就空了。 */
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
      .catch(() => console.warn("  ! DuckDB 没在 90s 内就绪，继续截"));
  }
  // 地图的最后一帧
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
    // 2009Q1 的同比：西兰岛整片冷蓝，西日德兰还在涨。
    // 这是这份数据里最好看也最能说明问题的一帧。
    async prep(page) {
      await settle(page);
      // 按文字选，别按 title —— title 只是 tooltip，不是可及名称
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
        .catch(() => console.warn("  ! 图表没画出来"));
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
