import Link from "next/link";
import type { Metadata } from "next";
import areas from "../../public/data/areas.json";
import postnrAreas from "../../public/data/areas_postnr.json";
import { fmtDays, fmtInt, fmtKrM2, fmtPct } from "@/lib/metrics";
import { hasPrice, summaryOf, SUMMARY_QUARTER } from "@/lib/summaries";
import { areaPath, pageUrl } from "@/lib/site";

interface Area {
  code: string;
  name: string;
  level: string;
}

export const metadata: Metadata = {
  title: "All areas — Danish Housing",
  description: `House prices, year-on-year growth and selling times for every Danish landsdel, region, kommune and postal district, ${SUMMARY_QUARTER}.`,
  alternates: { canonical: pageUrl("/areas/") },
};

const GROUPS = [
  ["landsdel", "Landsdele"],
  ["region", "Regioner"],
  ["kommune", "Kommuner"],
  ["postnr", "Postnumre"],
] as const;

/**
 * Every area on one page, as a plain table.
 *
 * The map is the way in for a person, but it is a canvas: nothing on it is
 * text and nothing on it is a link. This page is the way in for everything
 * that reads HTML instead, and it is the only static page linking to the 719
 * area pages.
 */
export default function Areas() {
  const all: Area[] = [
    ...(areas as Area[]),
    ...(postnrAreas as Area[]).map((a) => ({ ...a, level: "postnr" })),
  ];

  return (
    <div className="shell">
      <header className="masthead">
        <div className="masthead__mark">
          Danish Housing<span>.</span>
        </div>
        <nav className="masthead__nav">
          <Link href="/">Map</Link>
          <Link href="/methods">Data &amp; methods</Link>
          <Link href="/about">About</Link>
        </nav>
      </header>

      <main className="prose">
        <h1>All areas</h1>
        <p>
          Houses (detached and terraced), <strong>{SUMMARY_QUARTER}</strong>.
          Prices are realised sale prices per square metre, averaged over the
          trailing four quarters; growth compares that average with a year
          earlier. A dash means too few sales for a figure to be published.
        </p>

        {GROUPS.map(([level, label]) => (
          <section key={level}>
            <h2>{label}</h2>
            <table>
              <thead>
                <tr>
                  <th>Area</th>
                  <th>Price</th>
                  <th>Year on year</th>
                  <th>Days to sell</th>
                  <th>Sales, 4 quarters</th>
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
                          <Link href={areaPath(a.code, level)}>
                            {level === "postnr" ? `${a.code} ${a.name}` : a.name}
                          </Link>
                        </td>
                        <td>{ok ? fmtKrM2(s.price) : "—"}</td>
                        <td>{ok && s.yoy != null ? fmtPct(s.yoy) : "—"}</td>
                        <td>{ok && s.dom != null ? fmtDays(s.dom) : "—"}</td>
                        <td>{ok && s.sales != null ? fmtInt(s.sales) : "—"}</td>
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
