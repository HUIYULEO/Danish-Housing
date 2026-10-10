/**
 * Runtime asset paths.
 *
 * basePath in next.config only covers the URLs Next generates itself (pages,
 * build output under _next/). The fetch("/geo/...") calls written by hand,
 * the Parquet URLs registered with DuckDB and the worker paths get no prefix
 * from Next at all, and would all 404 when deployed to a GitHub Pages
 * project site (served under /<repo>/).
 *
 * So all those paths go through here; never hand-write an asset path
 * starting with "/" in a component.
 */

// Environment variables with the NEXT_PUBLIC_ prefix are inlined into the client build
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

/** Prefix a site asset path with basePath. The path passed in must start with "/". */
export function asset(path: string): string {
  return `${BASE}${path}`;
}

/** Absolute URL; DuckDB needs a full origin when registering an HTTP file. */
export function assetUrl(path: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${asset(path)}`;
}
