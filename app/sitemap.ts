import type { MetadataRoute } from "next";
import areas from "../public/data/areas.json";
import postnrAreas from "../public/data/areas_postnr.json";
import { LOCALES, localePath } from "@/lib/i18n";
import { areaPath, pageUrl } from "@/lib/site";

export const dynamic = "force-static";

/**
 * Every page in both languages, each entry naming its counterpart.
 *
 * Nothing links to the area pages in the static HTML except /areas, so the
 * sitemap is how a crawler learns that all of them exist. The hreflang pairs
 * tell it that /area/147/ and /da/area/147/ are one page in two languages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number; freq: "monthly" | "yearly" }[] = [
    { path: "/", priority: 1, freq: "monthly" },
    { path: "/areas/", priority: 0.8, freq: "monthly" },
    { path: "/methods/", priority: 0.6, freq: "yearly" },
    { path: "/about/", priority: 0.5, freq: "yearly" },
    ...(areas as { code: string; level: string }[])
      .filter((a) => a.level !== "country")
      .map((a) => ({
        path: areaPath(a.code, a.level),
        priority: 0.6,
        freq: "monthly" as const,
      })),
    ...(postnrAreas as { code: string }[]).map((a) => ({
      path: areaPath(a.code, "postnr"),
      priority: 0.4,
      freq: "monthly" as const,
    })),
  ];

  return pages.flatMap((p) =>
    LOCALES.map((locale) => ({
      url: pageUrl(localePath(locale, p.path)),
      changeFrequency: p.freq,
      priority: p.priority,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((l) => [l, pageUrl(localePath(l, p.path))]),
        ),
      },
    })),
  );
}
