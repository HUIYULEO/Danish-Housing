import Link from "next/link";
import type { Metadata } from "next";
import AreaDetail from "@/components/AreaDetail";
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
 * 静态导出下每个区域都要预生成。114 个页面（98 kommune + 11 landsdel + 5 region），
 * 构建一秒多，换来的是每个区域都有一个可以直接分享的固定 URL。
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
    description: `House prices, selling times, transaction volume and supply in ${area.name}, from Finans Danmark and Danmarks Statistik.`,
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
      />
    </div>
  );
}
