import Link from "next/link";
import type { Metadata } from "next";
import Explorer from "@/components/Explorer";
import snapshot from "../public/data/snapshot.json";
import areas from "../public/data/areas.json";
import monthly from "../public/data/monthly.json";
import facts from "../public/data/facts.json";
import postnrByKommune from "../public/data/postnr_by_kommune.json";
import postnrAreas from "../public/data/areas_postnr.json";
import type { Domains, PanelRow } from "@/lib/metrics";
import type { Facts, Monthly } from "@/components/Ticker";
import { pageUrl } from "@/lib/site";

export const metadata: Metadata = { alternates: { canonical: pageUrl("/") } };

/** schema.org Dataset, so search engines index this as data rather than as
 *  an app with no text. */
const DATASET = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Danish Housing: prices, selling times and supply by kommune and postal district",
  description:
    "Quarterly realised house prices per square metre, days on market, transaction volume and supply for every Danish landsdel, region, kommune and postal district since 1992, with monthly listing statistics since 2004.",
  url: pageUrl("/"),
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
};

/**
 * The first screen renders the latest quarter's slice on the server.
 *
 * snapshot.json is only 67 KB and is imported straight into the bundle, so
 * the page opens with a fully coloured map. DuckDB WASM (7 MB gzipped) loads
 * in the background on the client and only then unlocks the timeline and
 * the boards. Done the other way round, the first screen would wait for
 * 7 MB and the first success criterion in PRD §16 would be gone.
 */

interface Area {
  code: string;
  name: string;
  level: string;
}

export default function Home() {
  // Names for every level are needed: the map can switch to region / landsdel
  const areaList = (areas as Area[]).filter((a) => a.level !== "country");

  return (
    <div className="shell shell--app">
      <header className="masthead">
        <div className="masthead__mark">
          Danish Housing<span>.</span>
        </div>
        <div className="masthead__tag">
          See what is happening in Danish real estate
        </div>
        <nav className="masthead__nav">
          <Link href="/areas">All areas</Link>
          <Link href="/methods">Data &amp; methods</Link>
          <Link href="/about">About</Link>
        </nav>
      </header>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DATASET) }}
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
