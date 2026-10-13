/**
 * Page metadata that every route needs in the same shape: a canonical URL
 * and the hreflang pair, so search engines treat the English and Danish
 * versions of a page as one page in two languages rather than as duplicates.
 */

import type { Metadata } from "next";
import { localePath, type Locale } from "./i18n";
import { pageUrl } from "./site";

/** `path` is locale-less and ends in "/", e.g. "/areas/". */
export function pageMeta(
  locale: Locale,
  path: string,
  title: string,
  description: string,
): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: pageUrl(localePath(locale, path)),
      languages: {
        en: pageUrl(localePath("en", path)),
        da: pageUrl(localePath("da", path)),
        "x-default": pageUrl(localePath("en", path)),
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Danish Housing",
      locale: locale === "da" ? "da_DK" : "en_GB",
      url: pageUrl(localePath(locale, path)),
    },
  };
}
