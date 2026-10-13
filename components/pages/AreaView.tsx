import type { Metadata } from "next";
import AreaDetail from "@/components/AreaDetail";
import AreaSummary from "@/components/AreaSummary";
import Masthead from "@/components/Masthead";
import areas from "../../public/data/areas.json";
import postnrAreas from "../../public/data/areas_postnr.json";
import snapshot from "../../public/data/snapshot.json";
import postnrByKommune from "../../public/data/postnr_by_kommune.json";
import type { Locale } from "@/lib/i18n";
import { pageMeta } from "@/lib/meta";
import { MESSAGES } from "@/lib/messages";
import type { Domains } from "@/lib/metrics";
import { areaPath } from "@/lib/site";
import { metaDescription } from "@/lib/summaries";

interface Area {
  code: string;
  name: string;
  level: string;
}

type Kind = "admin" | "postnr";

/**
 * Under static export every area has to be pre-generated: 114 administrative
 * areas (98 kommuner + 11 landsdele + 5 regioner) and 605 postal districts,
 * each in two languages. In return every one of them has a fixed URL that
 * can be shared directly. "What does 2100 cost now" is something Danes
 * really do send each other.
 *
 * The charts are queried live by DuckDB in the browser; the headline numbers
 * are written into the HTML at build time (AreaSummary) so the page is not
 * empty without JavaScript.
 */
const LISTS: Record<Kind, Area[]> = {
  admin: (areas as Area[]).filter((a) => a.level !== "country"),
  postnr: (postnrAreas as Area[]).map((a) => ({ ...a, level: "postnr" })),
};

export const areaParams = (kind: Kind) => LISTS[kind].map((a) => ({ code: a.code }));

const find = (kind: Kind, code: string) => LISTS[kind].find((a) => a.code === code);

/** Postal districts are known by number first, so the number leads the name. */
const display = (a: Area) => (a.level === "postnr" ? `${a.code} ${a.name}` : a.name);

export function areaMetadata(locale: Locale, kind: Kind, code: string): Metadata {
  const area = find(kind, code);
  if (!area) return { title: "Danish Housing" };
  const name = display(area);
  return pageMeta(
    locale,
    areaPath(area.code, area.level),
    MESSAGES[locale].pages.areaTitle(name),
    metaDescription(locale, name, area.code),
  );
}

export default function AreaView({
  locale,
  kind,
  code,
}: {
  locale: Locale;
  kind: Kind;
  code: string;
}) {
  const area = find(kind, code)!;
  const name = display(area);
  const level = area.level as keyof (typeof MESSAGES)["en"]["levels"];

  return (
    <div className="shell">
      <Masthead
        locale={locale}
        path={areaPath(area.code, area.level)}
        tag={MESSAGES[locale].levels[level].one}
      />
      <AreaDetail
        code={area.code}
        name={name}
        level={area.level}
        latestQuarter={snapshot.quarter}
        domains={snapshot.domains as unknown as Domains}
        postnrs={
          kind === "admin"
            ? ((postnrByKommune as Record<string, string[]>)[code] ?? [])
            : []
        }
        summary={<AreaSummary locale={locale} code={area.code} name={name} />}
      />
    </div>
  );
}
