/**
 * DuckDB WASM。整包 Parquet 进浏览器，没有后端。
 *
 * 两件事值得说明：
 *
 * 1. wasm 和 worker 都自己托管（public/duckdb/，由 scripts/sync-duckdb.mjs 同步），
 *    不走 jsDelivr。CDN 挂了整个站就查不了数，而部署形态是一个静态站，
 *    没道理把可用性押在第三方 CDN 上。
 *
 * 2. **懒加载**。DuckDB 本体 gzip 后 7 MB，比它要查的 1.4 MB 数据还大 5 倍。
 *    首屏地图读 snapshot.json（67 KB）直接涂色，DuckDB 在后台加载，
 *    加载完时间轴和排行榜才解锁。首屏不等引擎。
 */

import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { asset, assetUrl } from "./paths";

export type DbStatus = "idle" | "loading" | "ready" | "error";

let dbPromise: Promise<AsyncDuckDBConnection> | null = null;
let handle: { db: AsyncDuckDB; conn: AsyncDuckDBConnection } | null = null;

async function boot(): Promise<AsyncDuckDBConnection> {
  const duckdb = await import("@duckdb/duckdb-wasm");

  // 自托管 bundle。selectBundle 会探测浏览器支不支持 exception handling，
  // 支持就用 eh（快一截），不支持退回 mvp。
  const bundle = await duckdb.selectBundle({
    mvp: {
      mainModule: asset("/duckdb/duckdb-mvp.wasm"),
      mainWorker: asset("/duckdb/duckdb-browser-mvp.worker.js"),
    },
    eh: {
      mainModule: asset("/duckdb/duckdb-eh.wasm"),
      mainWorker: asset("/duckdb/duckdb-browser-eh.worker.js"),
    },
  });

  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  await db.open({ query: { castBigIntToDouble: true } });

  const conn = await db.connect();

  // 数据版本号。Parquet 值得长缓存，但季度更新之后如果 URL 不变，
  // 浏览器会拿着上一季的 Parquet 配这一季的 snapshot.json，
  // 地图和时间轴就会讲两个不同的故事。所以 URL 带上内容哈希。
  const version = await fetch(asset("/data/version.json"), {
    cache: "no-store",
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((v) => (v?.version as string | undefined) ?? "")
    .catch(() => "");
  const q = version ? `?v=${encodeURIComponent(version)}` : "";

  // 面板注册成视图。Parquet 直接从 HTTP 读，DuckDB 按需拉 row group，
  // 不需要先把整个文件塞进内存。
  //
  // postnr 面板**冻结**，不注册。它有 4.1 MB，而现在界面上没有任何地方查它 ——
  // 下钻功能没做。挂在这里只会白白占仓库和托管的空间。
  // 解冻要做的事都写在 lib/queries.ts 的 postnrIn() 上面。
  for (const level of ["kommune", "monthly"]) {
    await db.registerFileURL(
      `panel_${level}.parquet`,
      `${assetUrl(`/data/panel_${level}.parquet`)}${q}`,
      duckdb.DuckDBDataProtocol.HTTP,
      false,
    );
    await conn.query(
      `CREATE OR REPLACE VIEW ${level} AS
       SELECT * FROM read_parquet('panel_${level}.parquet')`,
    );
  }

  handle = { db, conn };
  return conn;
}

/** 幂等。多个组件同时叫也只会启动一次。 */
export function getConnection(): Promise<AsyncDuckDBConnection> {
  if (!dbPromise) {
    dbPromise = boot().catch((e) => {
      dbPromise = null; // 失败了允许重试
      throw e;
    });
  }
  return dbPromise;
}

export async function closeConnection() {
  if (handle) {
    await handle.conn.close();
    await handle.db.terminate();
    handle = null;
    dbPromise = null;
  }
}

/**
 * 查询并转成普通对象数组。
 *
 * Arrow 的行对象带一堆 proxy，直接塞进 React state 会很难受；
 * 而且 BigInt 不能 JSON 序列化。这里统一拍平成 plain object + number。
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
): Promise<T[]> {
  const conn = await getConnection();
  const table = await conn.query(sql);
  const out: T[] = [];
  for (const row of table.toArray()) {
    const o: Record<string, unknown> = {};
    for (const f of table.schema.fields) {
      const v = row[f.name];
      o[f.name] =
        typeof v === "bigint"
          ? Number(v)
          : v === null || v === undefined
            ? null
            : v;
    }
    out.push(o as T);
  }
  return out;
}

/**
 * SQL 字面量转义。
 *
 * PRD §10 的架构约束是 LLM 只能填参数、不能生成 SQL；这个函数保证
 * 就算参数是用户可控的，也拼不出第二条语句。
 */
export function lit(s: string): string {
  return `'${String(s).replace(/'/g, "''")}'`;
}
