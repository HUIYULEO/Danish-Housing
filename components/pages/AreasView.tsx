import Link from "next/link";
import Masthead from "@/components/Masthead";
import areas from "../../public/data/areas.json";
import postnrAreas from "../../public/data/areas_postnr.json";
import { formatters } from "@/lib/format";
import { localePath, type Locale } from "@/lib/i18n";
import { MESSAGES } from "@/lib/messages";
import { GEO_LEVELS } from "@/lib/metrics";
import { areaPath } from "@/lib/site";
import { hasPrice, summaryOf, summaryQuarter } from "@/lib/summaries";

interface Area {
  code: string;
  name: string;
  level: string;
}

/**
 * Every area on one page, as a plain table.
 *
 * The map is the way in for a person, but it is a canvas: nothing on it is
 * text and nothing on it is a link. This page is the way in for everything
 * that reads HTML instead, and it is the only static page linking to the
 * area pages.
 */
export default function AreasView({ locale }: { locale: Locale }) {
  const t = MESSAGES[locale];
  const fmt = formatters(locale);
  const all: Area[] = [
    ...(areas as Area[]),
    ...(postnrAreas as Area[]).map((a) => ({ ...a, level: "postnr" })),
  ];

  return (
    <div className="shell">
      <Masthead locale={locale} path="/areas/" />

      <main className="prose">
        <h1>{t.pages.areasH1}</h1>
        <p>
          {t.pages.areasIntroBefore}
          <strong>{summaryQuarter(locale)}</strong>
          {t.pages.areasIntroAfter}
        </p>

        {GEO_LEVELS.map(({ id: level, label }) => (
          <section key={level}>
            <h2>{label}</h2>
            <table>
              <thead>
                <tr>
                  <th>{t.pages.colArea}</th>
                  <th>{t.pages.colPrice}</th>
                  <th>{t.pages.colYoy}</th>
                  <th>{t.pages.colDays}</th>
                  <th>{t.pages.colSales}</th>
                </tr>
              </thead>
              <tbody>
                {all
                  .filter((a) => a.level === level)
                  .map((a) => {
                    const s = summaryOf(a.code).house;
                    const ok = hasPrice(s);
                    return (
                      <tr key={a.code}>
                        <td>
                          <Link href={localePath(locale, areaPath(a.code, level))}>
                            {level === "postnr" ? `${a.code} ${a.name}` : a.name}
                          </Link>
                        </td>
                        <td>{ok ? fmt.krM2(s.price) : "—"}</td>
                        <td>{ok && s.yoy != null ? fmt.pct(s.yoy) : "—"}</td>
                        <td>{ok && s.dom != null ? fmt.days(s.dom) : "—"}</td>
                        <td>{ok && s.sales != null ? fmt.int(s.sales) : "—"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </section>
        ))}
      </main>
    </div>
  );
}
