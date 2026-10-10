// DuckDB WASM's wasm + worker are self-hosted, not loaded from the jsDelivr CDN.
// Reason: if the CDN went down the whole site could not query, and the PRD
// says the deployment is just a static site.
import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const src = "node_modules/@duckdb/duckdb-wasm/dist";
const dst = "public/duckdb";

if (!existsSync(src)) {
  console.log("[duckdb] dependencies not installed yet, skipping");
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
    console.warn(`[duckdb] missing file: ${f}`);
    continue;
  }
  await cp(from, path.join(dst, f));
  total += (await stat(from)).size;
}
console.log(`[duckdb] synced ${want.length} files to ${dst}  (${(total / 1e6).toFixed(1)} MB)`);
