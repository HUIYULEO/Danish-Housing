// 用最笨的静态服务器把 out/ 端出来，模拟 GitHub Pages：
// 不设任何自定义响应头，只支持 Range（Pages 背后的 Fastly 也支持）。
// 用来验证"没有 COOP/COEP 的纯静态托管，DuckDB 还能不能跑"。
import { createServer } from "node:http";
import { createReadStream, statSync, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const ROOT = "out";
const BASE = process.env.BASE_PATH ?? "";
const PORT = Number(process.env.PORT ?? 4321);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json",
  ".wasm": "application/wasm",
  ".parquet": "application/octet-stream",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length);
  if (p === "" || p === "/") p = "/index.html";
  const safe = normalize(p).split(/[\/]+/).filter((x) => x && x !== "..").join("/");
  let file = join(ROOT, safe);
  if (!existsSync(file)) {
    if (existsSync(file + ".html")) file += ".html";
    else {
      res.writeHead(404).end("not found");
      return;
    }
  }
  const st = statSync(file);
  if (st.isDirectory()) {
    file = join(file, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
  }
  const size = statSync(file).size;
  const type = MIME[extname(file)] ?? "application/octet-stream";
  const range = req.headers.range;

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m[1] ? Number(m[1]) : 0;
    const end = m[2] ? Number(m[2]) : size - 1;
    res.writeHead(206, {
      "Content-Type": type,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
    });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": size,
    "Accept-Ranges": "bytes",
  });
  createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`[static] http://localhost:${PORT}${BASE || ""}/  (root=${ROOT})`);
});
