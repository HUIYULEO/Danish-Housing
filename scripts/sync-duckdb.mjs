// DuckDB WASM 的 wasm + worker 自己托管，不走 jsDelivr CDN。
// 理由：CDN 挂了整个站就查不了数，而且 PRD 说部署就是一个静态站。
import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const src = "node_modules/@duckdb/duckdb-wasm/dist";
const dst = "public/duckdb";

if (!existsSync(src)) {
  console.log("[duckdb] 依赖还没装，跳过");
  process.exit(0);
}

await mkdir(dst, { recursive: true });
const want = [
  "duckdb-mvp.wasm",
  "duckdb-browser-mvp.worker.js",
  "duckdb-eh.wasm",
  "duckdb-browser-eh.worker.js",
];
let total = 0;
for (const f of want) {
  const from = path.join(src, f);
  if (!existsSync(from)) {
    console.warn(`[duckdb] 缺文件: ${f}`);
    continue;
  }
  await cp(from, path.join(dst, f));
  total += (await stat(from)).size;
}
console.log(`[duckdb] 同步 ${want.length} 个文件到 ${dst}  (${(total / 1e6).toFixed(1)} MB)`);
