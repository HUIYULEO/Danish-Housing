import Link from "next/link";
import type { Metadata } from "next";
import AreaDetail from "@/components/AreaDetail";
import AreaSummary from "@/components/AreaSummary";
import { metaDescription } from "@/lib/summaries";
import { areaPath, pageUrl } from "@/lib/site";
import areas from "../../../public/data/areas.json";
import snapshot from "../../../public/data/snapshot.json";
import postnrByKommune from "../../../public/data/postnr_by_kommune.json";
import type { Domains } from "@/lib/metrics";

interface Area {
  code: string;
  name: string;
  level: string;
}

const LIST = (areas as Area[]).filter((a) => a.level !== "country");

/**
 * Under static export every area has to be pre-generated. 114 pages
 * (98 kommuner + 11 landsdele + 5 regioner) build in just over a second, and
 * in return every area has a fixed URL that can be shared directly.
 */
export function generateStaticParams() {
  return LIST.map((a) => ({ code: a.code }));
}

export const dynamicParams = false;

const LEVEL_LABEL: Record<string, string> = {
  kommune: "Kommune",
  region: "Region",
  landsdel: "Landsdel",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const area = LIST.find((a) => a.code === code);
  if (!area) return { title: "Area — Danish Housing" };
  return {
    title: `${area.name} — Danish Housing`,
    description: metaDescription(area.name, area.code),
    alternates: { canonical: pageUrl(areaPath(area.code, area.level)) },
  };
}

export default async function AreaPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const area = LIST.find((a) => a.code === code)!;
  const codes = (postnrByKommune as Record<string, string[]>)[code] ?? [];

  return (
    <div className="shell">
      <header className="masthead">
        <div className="masthead__mark">
          Danish Housing<span>.</span>
        </div>
        <div className="masthead__tag">
          {LEVEL_LABEL[area.level] ?? area.level}
        </div>
        <nav className="masthead__nav">
          <Link href="/">Map</Link>
          <Link href="/areas">All areas</Link>
          <Link href="/methods">Data &amp; methods</Link>
        </nav>
      </header>

      <AreaDetail
        code={area.code}
        name={area.name}
        level={area.level}
        latestQuarter={snapshot.quarter}
        domains={snapshot.domains as unknown as Domains}
        postnrs={codes}
        summary={<AreaSummary code={area.code} name={area.name} />}
      />
    </div>
  );
}
