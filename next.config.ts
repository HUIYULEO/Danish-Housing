import type { NextConfig } from "next";

/**
 * Two deployment shapes:
 *
 *   npm run build          Node / Vercel hosting. headers() applies and the
 *                          app declares its own caching policy.
 *   npm run build:static   Pure static export to out/, deployable to GitHub
 *                          Pages, Cloudflare Pages, S3, any static host.
 *
 * Under static export headers() does not apply (Next ignores it); caching
 * and MIME types are up to the host. Correctness is unaffected: the Parquet
 * URLs carry a content hash, so new data means a new URL, and version.json
 * is already covered on the frontend by fetch(cache:'no-store').
 *
 * BASE_PATH is for GitHub Pages project sites (served under /<repo>/).
 * Once it is set, the absolute /data /geo /duckdb paths used at runtime need
 * the prefix too; see lib/paths.ts, and never hand-write those paths in
 * components.
 */
const isExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.BASE_PATH ?? "";

/**
 * About COOP/COEP: **not needed**, and this has been tested.
 *
 * Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy were added at
 * first for DuckDB WASM, but only SharedArrayBuffer (the coi bundle) needs
 * them. We register the mvp + eh bundles, and eh only requires wasm
 * exception handling support in the browser, which has nothing to do with
 * cross-origin isolation.
 *
 * Tested: with a static export and a server sending no custom response
 * headers, crossOriginIsolated is false and DuckDB still starts and the
 * boards still fill.
 *
 * This directly decides whether GitHub Pages is an option: static hosting
 * cannot set response headers.
 */
const config: NextConfig = {
  // The dev-mode indicator sits bottom-left/top-left by default, right over
  // the quarter labels on the timeline and the site name. This UI has
  // something in all four corners and no room to give it.
  devIndicators: false,

  // Static export uses trailingSlash: the output is methods/index.html, not
  // methods.html. GitHub Pages adds .html for you, but S3 and some CDNs do
  // not; directory + index.html is the form every static host understands.
  ...(isExport ? { output: "export" as const, trailingSlash: true } : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),

  // Next ignores headers() under static export, so it is not declared at
  // all, to avoid looking as if it applied
  ...(isExport
    ? {}
    : {
        async headers() {
          return [
            {
              // version.json decides "has the data changed", so it must
              // never be cached itself
              source: "/data/version.json",
              headers: [{ key: "Cache-Control", value: "no-store" }],
            },
            {
              // Parquet URLs carry a content hash (?v=) and DuckDB's wasm is
              // versioned by filename, so both can safely be cached
              // long-term as immutable. Do not include snapshot.json /
              // areas.json here: they have no versioned URL.
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
              // Boundaries only change when administrative divisions do; one day is enough
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
