import Link from "next/link";
import type { Metadata } from "next";
import AreaDetail from "@/components/AreaDetail";
import AreaSummary from "@/components/AreaSummary";
import { metaDescription } from "@/lib/summaries";
import { areaPath, pageUrl } from "@/lib/site";
import postnrAreas from "../../../../public/data/areas_postnr.json";
import snapshot from "../../../../public/data/snapshot.json";
import type { Domains } from "@/lib/metrics";

interface Area {
  code: string;
  name: string;
  level: string;
}

const LIST = postnrAreas as Area[];

/**
 * 605 postal-code pages. With the existing 114 area pages, the static export
 * totals 719 pages.
 *
 * Worth it for the same reason as the kommune pages: every postal code gets
 * a fixed URL that can be shared directly. "What does 2100 cost now" is
 * something Danes really do send each other. The charts are queried live by
 * DuckDB in the browser; the headline numbers are written into the HTML at
 * build time (AreaSummary) so the page is not empty without JavaScript.
 */
export function generateStaticParams() {
  return LIST.map((a) => ({ code: a.code }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const area = LIST.find((a) => a.code === code);
  if (!area) return { title: "Postal district — Danish Housing" };
  return {
    title: `${area.code} ${area.name} — Danish Housing`,
    description: metaDescription(`${area.code} ${area.name}`, area.code),
    alternates: { canonical: pageUrl(areaPath(area.code, "postnr")) },
  };
}

export default async function PostnrPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const area = LIST.find((a) => a.code === code)!;

  return (
    <div className="shell">
      <header className="masthead">
        <div className="masthead__mark">
          Danish Housing<span>.</span>
        </div>
        <div className="masthead__tag">Postal district</div>
        <nav className="masthead__nav">
          <Link href="/">Map</Link>
          <Link href="/areas">All areas</Link>
          <Link href="/methods">Data &amp; methods</Link>
        </nav>
      </header>

      <AreaDetail
        code={area.code}
        name={`${area.code} ${area.name}`}
        level="postnr"
        latestQuarter={snapshot.quarter}
        domains={snapshot.domains as unknown as Domains}
        postnrs={[]}
        summary={
          <AreaSummary code={area.code} name={`${area.code} ${area.name}`} />
        }
      />
    </div>
  );
}
