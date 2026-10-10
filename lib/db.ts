/**
 * DuckDB WASM. All the Parquet goes to the browser; there is no backend.
 *
 * Two things worth explaining:
 *
 * 1. The wasm and worker are self-hosted (public/duckdb/, synced by
 *    scripts/sync-duckdb.mjs) rather than loaded from jsDelivr. If the CDN
 *    went down the whole site could no longer query, and the deployment is a
 *    static site; there is no reason to stake availability on a third-party
 *    CDN.
 *
 * 2. **Lazy loading.** DuckDB itself is 7 MB gzipped, 5 times the 1.4 MB of
 *    data it queries. The first-paint map reads snapshot.json (67 KB) and
 *    colours straight away while DuckDB loads in the background; the timeline
 *    and boards unlock once it is up. The first screen never waits for the
 *    engine.
 */

import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { asset, assetUrl } from "./paths";

export type DbStatus = "idle" | "loading" | "ready" | "error";

let dbPromise: Promise<AsyncDuckDBConnection> | null = null;
let handle: { db: AsyncDuckDB; conn: AsyncDuckDBConnection } | null = null;

/**
 * The shape each of the three panels is registered in.
 *
 * The postal panel's key column is called postnr and it has no income data:
 * INDKF132 only goes down to kommune. The columns are padded here to match
 * the kommune panel so the templates in lib/queries.ts need no fork for the
 * postal level; the four missing columns are real NULLs, not numbers we
 * spread around.
 */
const VIEWS: Record<string, string> = {
  kommune: `SELECT * FROM read_parquet('panel_kommune.parquet')`,
  postnr: `SELECT postnr AS area_code,
                  'postnr' AS area_level,
                  NULL::DOUBLE AS years_income,
                  NULL::DOUBLE AS years_income_chg,
                  NULL::DOUBLE AS income_family,
                  NULL::INTEGER AS income_year,
                  * EXCLUDE (postnr)
           FROM read_parquet('panel_postnr.parquet')`,
  monthly: `SELECT * FROM read_parquet('panel_monthly.parquet')`,
};

async function boot(): Promise<AsyncDuckDBConnection> {
  const duckdb = await import("@duckdb/duckdb-wasm");

  // Self-hosted bundles. selectBundle probes whether the browser supports
  // exception handling: eh if so (noticeably faster), mvp otherwise.
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

  // Data version. The Parquet deserves a long cache, but if the URL stayed
  // the same after a quarterly update, the browser would pair last quarter's
  // Parquet with this quarter's snapshot.json and the map and timeline would
  // tell two different stories. So the URL carries a content hash.
  const version = await fetch(asset("/data/version.json"), {
    cache: "no-store",
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((v) => (v?.version as string | undefined) ?? "")
    .catch(() => "");
  const q = version ? `?v=${encodeURIComponent(version)}` : "";

  // Register the panels as views. Parquet is read straight over HTTP and
  // DuckDB pulls row groups on demand, so the whole file never has to sit in
  // memory. The postal panel is 4 MB, but querying the dozen or so postal
  // codes under one kommune touches only a few row groups (the ETL sorts by
  // postal code).
  for (const [level, body] of Object.entries(VIEWS)) {
    await db.registerFileURL(
      `panel_${level}.parquet`,
      `${assetUrl(`/data/panel_${level}.parquet`)}${q}`,
      duckdb.DuckDBDataProtocol.HTTP,
      false,
    );
    await conn.query(`CREATE OR REPLACE VIEW ${level} AS ${body}`);
  }

  handle = { db, conn };
  return conn;
}

/** Idempotent. Many components can call it at once and it still boots only once. */
export function getConnection(): Promise<AsyncDuckDBConnection> {
  if (!dbPromise) {
    dbPromise = boot().catch((e) => {
      dbPromise = null; // allow a retry after a failure
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
 * Run a query and convert the result to an array of plain objects.
 *
 * Arrow row objects carry a pile of proxies and are awkward to put into
 * React state, and BigInt cannot be JSON-serialised. Everything is flattened
 * here into plain objects + numbers.
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
 * SQL literal escaping.
 *
 * The architectural constraint in PRD §10 is that an LLM may only fill in
 * parameters, never generate SQL. This function guarantees that even a
 * user-controlled parameter cannot be turned into a second statement.
 */
export function lit(s: string): string {
  return `'${String(s).replace(/'/g, "''")}'`;
}
