import type { MetadataRoute } from "next";
import { pageUrl } from "@/lib/site";

export const dynamic = "force-static";

/**
 * Everything is open, to search engines and to AI crawlers alike.
 *
 * Crawlers only read robots.txt at the root of a host. Under a GitHub Pages
 * project path (/<repo>/robots.txt) this file is ignored, which is harmless:
 * no robots.txt means everything is allowed. It takes effect once the site
 * has its own domain.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: pageUrl("/sitemap.xml"),
  };
}
