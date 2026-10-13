import Explorer from "@/components/Explorer";
import Masthead from "@/components/Masthead";
import snapshot from "../../public/data/snapshot.json";
import areas from "../../public/data/areas.json";
import monthly from "../../public/data/monthly.json";
import facts from "../../public/data/facts.json";
import postnrByKommune from "../../public/data/postnr_by_kommune.json";
import postnrAreas from "../../public/data/areas_postnr.json";
import type { Domains, PanelRow } from "@/lib/metrics";
import type { Facts, Monthly } from "@/components/Ticker";
import { localePath, type Locale } from "@/lib/i18n";
import { MESSAGES } from "@/lib/messages";
import { pageUrl } from "@/lib/site";

interface Area {
  code: string;
  name: string;
  level: string;
}

/** schema.org Dataset, so search engines index this as data rather than as
 *  an app with no text. */
const dataset = (locale: Locale) => ({
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Danish Housing: prices, selling times and supply by kommune and postal district",
  description: MESSAGES[locale].pages.siteDescription,
  url: pageUrl(localePath(locale, "/")),
  inLanguage: locale,
  temporalCoverage: `1992/${snapshot.quarter.slice(0, 4)}`,
  spatialCoverage: { "@type": "Place", name: "Denmark" },
  isAccessibleForFree: true,
  isBasedOn: [
    "https://finansdanmark.dk/tal-og-data/boligstatistik/",
    "https://www.statbank.dk/",
  ],
  distribution: ["kommune", "postnr", "monthly"].map((p) => ({
    "@type": "DataDownload",
    encodingFormat: "application/vnd.apache.parquet",
    contentUrl: pageUrl(`/data/panel_${p}.parquet`),
  })),
});

/**
 * The map page.
 *
 * The first screen renders the latest quarter's slice on the server:
 * snapshot.json is small and imported straight into the bundle, so the page
 * opens with a fully coloured map. DuckDB WASM (7 MB gzipped) loads in the
 * background on the client and only then unlocks the timeline and the
 * boards. Done the other way round, the first screen would wait for 7 MB.
 */
export default function HomeView({ locale }: { locale: Locale }) {
  // Names for every level are needed: the map can switch to region / landsdel
  const areaList = (areas as Area[]).filter((a) => a.level !== "country");

  return (
    <div className="shell shell--app">
      <Masthead locale={locale} path="/" tag={MESSAGES[locale].tagline} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset(locale)) }}
      />

      <Explorer
        initialRows={snapshot.rows as PanelRow[]}
        latestQuarter={snapshot.quarter}
        quarters={snapshot.quarters}
        months={snapshot.months}
        domains={snapshot.domains as unknown as Domains}
        domainsMonthly={snapshot.domainsMonthly as unknown as Domains}
        areas={areaList}
        monthly={monthly as Monthly}
        facts={facts as Facts}
        postnrByKommune={postnrByKommune as Record<string, string[]>}
        postnrAreas={postnrAreas as { code: string; name: string }[]}
      />
    </div>
  );
}
