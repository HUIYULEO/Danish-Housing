/**
 * Where the site is published, for the places that need an absolute URL:
 * canonical links, the sitemap, llms.txt and structured data.
 *
 * Set NEXT_PUBLIC_SITE_URL when the site moves to its own domain.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://huiyuleo.github.io/Danish-Housing"
).replace(/\/$/, "");

/** Absolute URL of a page. Paths end in "/" because the export uses trailingSlash. */
export const pageUrl = (path: string) => `${SITE_URL}${path}`;

export const areaPath = (code: string, level: string) =>
  level === "postnr" ? `/area/postnr/${code}/` : `/area/${code}/`;
