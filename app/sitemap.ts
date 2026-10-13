import type { MetadataRoute } from "next";
import areas from "../public/data/areas.json";
import postnrAreas from "../public/data/areas_postnr.json";
import { areaPath, pageUrl } from "@/lib/site";

export const dynamic = "force-static";

/** Nothing links to the area pages in the static HTML except /areas, so the
 *  sitemap is how a crawler learns that all 719 of them exist. */
export default function sitemap(): MetadataRoute.Sitemap {
  const list = [
    ...(areas as { code: string; level: string }[]).filter(
      (a) => a.level !== "country",
    ),
    ...(postnrAreas as { code: string; level: string }[]),
  ];
  return [
    { url: pageUrl("/"), changeFrequency: "monthly", priority: 1 },
    { url: pageUrl("/areas/"), changeFrequency: "monthly", priority: 0.8 },
    { url: pageUrl("/methods/"), changeFrequency: "yearly", priority: 0.6 },
    { url: pageUrl("/about/"), changeFrequency: "yearly", priority: 0.5 },
    ...list.map((a) => ({
      url: pageUrl(areaPath(a.code, a.level)),
      changeFrequency: "monthly" as const,
      priority: a.level === "postnr" ? 0.4 : 0.6,
    })),
  ];
}
