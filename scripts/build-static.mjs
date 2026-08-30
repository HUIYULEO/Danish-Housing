// 纯静态导出。产物在 out/，可以直接扔到 GitHub Pages / Cloudflare Pages / S3。
//
// BASE_PATH 给 GitHub Pages 的项目站点用：仓库叫 dk-housing 就设成 "/dk-housing"。
// 用户站点（<user>.github.io）或自定义域名不需要设。
//
//   BASE_PATH=/dk-housing npm run build:static
import { spawnSync } from "node:child_process";

const base = process.env.BASE_PATH ?? "";
const env = {
  ...process.env,
  STATIC_EXPORT: "1",
  BASE_PATH: base,
  // 客户端代码要在构建时把前缀内联进去（见 lib/paths.ts）
  NEXT_PUBLIC_BASE_PATH: base,
};

if (base) console.log(`[static] basePath = ${base}`);
const r = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  { stdio: "inherit", env },
);
process.exit(r.status ?? 1);
