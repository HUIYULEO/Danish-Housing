# 部署

全站静态，没有服务端。两种发法：

```bash
npm run build          # Node / Vercel 托管，headers() 生效
npm run build:static   # 纯静态导出到 out/
```

## GitHub Pages

`.github/workflows/pages.yml` 已经配好，仓库 Settings → Pages → Source 选
"GitHub Actions"，推 main 就自动发。

一开始以为上不了：DuckDB WASM 那边加了 `Cross-Origin-Opener-Policy` 和
`Cross-Origin-Embedder-Policy`，而静态托管设不了响应头。**实测发现根本不需要** ——
那两个头是 SharedArrayBuffer（coi bundle）才要的，我们用的 eh bundle 只要求
浏览器支持 wasm exception handling，和跨源隔离无关。在不带任何自定义头的
静态服务器上验证过：`crossOriginIsolated === false`，DuckDB 照样起来。
那两个头已经从 next.config 里删掉了。

### basePath

项目站点挂在 `/<repo>/` 下面，要带前缀：

```bash
BASE_PATH=/Danish-Housing npm run build:static
```

**Next 的 basePath 只管它自己生成的 URL。**我们代码里手写的
`fetch("/geo/…")`、DuckDB 注册的 Parquet URL、worker 路径，它一个都不加前缀，
部署上去全是 404。所以这些路径一律走 `lib/paths.ts` 的 `asset()` / `assetUrl()`，
**不要在组件里手写以 `/` 开头的资源路径**。

用户站点（`<user>.github.io`）或自定义域名不用设。

## 体积和带宽

| | 大小 |
|---|---|
| `out/` 总计 | 88 MB |
| 其中 DuckDB wasm | 75 MB（mvp + eh 两个 bundle） |
| 数据（Parquet + JSON） | 4.2 MB |
| 边界 | 968 KB |

实测传输量：

| 资源 | 原始 | 传输（gzip） |
|---|---|---|
| duckdb-eh.wasm | 34.0 MB | **6.9 MB** |
| panel_kommune.parquet | 1.71 MB | 1.73 MB（压不动） |
| panel_monthly.parquet | 2.19 MB | 2.22 MB（压不动） |
| kommuner.geojson | 0.42 MB | 85 KB |
| snapshot.json | 84 KB | 11 KB |

**Parquet 已经是 zstd 压过的，再 gzip 一遍不会更小**，反而多几 KB 头部 ——
别指望托管方的压缩帮上忙。

一个冷访客实际大概 8-9 MB：首屏 HTML + JS + snapshot + 边界不到 1 MB
（这时地图已经画出来了），然后后台拉 6.9 MB 的引擎，最后按需拉几百 KB 的
Parquet row group。mvp bundle（41 MB）只有不支持 wasm exception handling 的
老浏览器才会下，现代浏览器一个字节都不碰，所以它只占托管空间不占带宽。

Pages 的站点上限 1 GB，88 MB 没问题。软带宽上限 100 GB/月，按 9 MB 折算
约一万次冷访问。真要放量，**换 Cloudflare Pages** —— 不限带宽，而且认
`public/_headers`，缓存策略能生效（Pages 设不了响应头）。

Parquet 不会整包下载：DuckDB 走 HTTP Range 按需拉 row group。
GitHub Pages 实测返回 206，Range 是支持的。

## 仓库里放什么

- `public/data`、`public/geo`（约 5 MB）**提交**。数据季度更新，CI 里不跑 ETL，
  没必要每次推代码都去拉 20 MB。
- `public/duckdb`（77 MB）**不提交**，`npm install` 的 postinstall 会从
  node_modules 确定性地复制过来。
- `data/` 下的中间产物（原始 geojson 两三百 MB、parquet）不提交，
  只留 `REPORT.md`。

数据更新流程：本机 `npm run etl && npm run simplify`，提交 `public/` 下的变化，
推上去 CI 自动发。

## 其它平台

Cloudflare Pages / Netlify / S3+CloudFront：build 命令 `npm run build:static`，
产物目录 `out`，不需要 basePath。Vercel 用 `npm run build`，那边 `headers()`
生效，缓存策略更好。

## 已知的小毛病

静态导出下 Next 会为 `/methods` 之类的链接预取一个 RSC 载荷
（`__next.methods.__PAGE__.txt`），而那个文件它自己没生成，控制台会有一条 404。
页面导航本身正常（直接请求返回 200），预取失败只是退回整页导航。
这是 Next `output: export` 自己的粗糙处，不是站点的问题。

## 截图

README 里的图用 `scripts/screenshot.mjs` 生成：

```bash
npm run build:static
node scripts/serve-static.mjs &
npx playwright@1.62.1 install chromium   # 第一次
npm install --no-save playwright@1.62.1
npm run screenshot
```

playwright 不进依赖 —— 为几张图往 `npm ci` 里塞一个浏览器不值得。
