import type { NextConfig } from "next";

/**
 * 两种部署形态：
 *
 *   npm run build          Node / Vercel 托管。headers() 生效，缓存策略由应用声明。
 *   npm run build:static   纯静态导出到 out/，可以扔到 GitHub Pages、
 *                          Cloudflare Pages、S3、任何静态托管。
 *
 * 静态导出下 headers() 不生效（Next 直接忽略），缓存和 MIME 由托管方决定。
 * 这不影响正确性：Parquet 的 URL 带内容哈希，数据换了 URL 就换；
 * version.json 那边前端已经用 fetch(cache:'no-store') 兜住了。
 *
 * BASE_PATH 给 GitHub Pages 的项目站点用（站点挂在 /<repo>/ 下面）。
 * 设了它之后运行时那些 /data /geo /duckdb 的绝对路径也要跟着带前缀，
 * 见 lib/paths.ts —— 不要在组件里手写这些路径。
 */
const isExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.BASE_PATH ?? "";

/**
 * 关于 COOP/COEP：**不需要**，已经实测过。
 *
 * 一开始为了 DuckDB WASM 加了 Cross-Origin-Opener-Policy 和
 * Cross-Origin-Embedder-Policy，那是 SharedArrayBuffer（coi bundle）才要的。
 * 我们注册的是 mvp + eh 两个 bundle，eh 只要求浏览器支持 wasm exception
 * handling，和跨源隔离无关。
 *
 * 实测：静态导出 + 不带任何自定义响应头的服务器，crossOriginIsolated 是 false，
 * DuckDB 照样起来、排行榜照样出数。
 *
 * 这件事直接决定了能不能上 GitHub Pages —— 静态托管设不了响应头。
 */
const config: NextConfig = {
  // 开发模式的浮标默认压在左下角/左上角，正好盖住时间轴上的季度标签
  // 和站名。这个界面四个角都有东西，没有地方能让给它。
  devIndicators: false,

  // 静态导出时用 trailingSlash：产物是 methods/index.html 而不是 methods.html。
  // GitHub Pages 会自动帮你补 .html，但 S3、某些 CDN 不会，
  // 目录 + index.html 是所有静态托管都认的形式。
  ...(isExport ? { output: "export" as const, trailingSlash: true } : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),

  // 静态导出时 Next 会忽略 headers()，所以干脆不声明，免得看着像生效了
  ...(isExport
    ? {}
    : {
        async headers() {
          return [
            {
              // version.json 用来判断"数据换了没有"，它自己绝不能被缓存
              source: "/data/version.json",
              headers: [{ key: "Cache-Control", value: "no-store" }],
            },
            {
              // Parquet 的 URL 带内容哈希（?v=），DuckDB 的 wasm 由文件名定版，
              // 所以这两类可以放心 immutable 长缓存。
              // 别把 snapshot.json / areas.json 圈进来 —— 它们没有版本化的 URL。
              source: "/data/:file(.*\\.parquet)",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
            {
              source: "/duckdb/:file*",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
            {
              // 边界只在行政区划调整时才变，一天足够
              source: "/geo/:file*",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=86400, stale-while-revalidate=604800",
                },
              ],
            },
          ];
        },
      }),
};

export default config;
