import Link from "next/link";
import type { Metadata } from "next";
import snapshot from "../../public/data/snapshot.json";
import type { PanelRow } from "@/lib/metrics";

export const metadata: Metadata = {
  title: "Data & methods — Danish Housing",
  description:
    "Sources, definitions, sample-size rules and known limits behind the Danish housing map.",
};

/**
 * PRD §12：对一个靠可信度立足的产品，这一页不是可选项。
 * 页面上的覆盖率数字直接从 snapshot 算，不写死 —— 数据一更新文案就跟着变。
 */
export default function Methods() {
  const rows = snapshot.rows as PanelRow[];
  const tally = (cat: string) => {
    const s = rows.filter((r) => r.category === cat);
    const c = (k: string) => s.filter((r) => r.reliability === k).length;
    return {
      n: s.length,
      ok: c("ok"),
      low: c("low"),
      unv: c("unverified"),
      ins: c("insufficient"),
    };
  };
  const cats = [
    ["Houses", "house"],
    ["Flats", "flat"],
    ["Holiday homes", "holiday"],
  ] as const;

  return (
    <div className="shell">
      <header className="masthead">
        <div className="masthead__mark">
          Danish Housing<span>.</span>
        </div>
        <nav className="masthead__nav">
          <Link href="/">Map</Link>
        </nav>
      </header>

      <main className="prose">
        <h1>Data &amp; methods</h1>
        <p>
          Everything here comes from two free public sources. There is no
          proprietary data, no scraping, and no estimated or modelled prices.
          The most recent quarter is <strong>{snapshot.quarter}</strong>.
        </p>

        <h2>Sources</h2>
        <table>
          <thead>
            <tr>
              <th>Table</th>
              <th>Level</th>
              <th>Covers</th>
              <th>What it gives</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>BM010</code> / <code>BM011</code></td>
              <td>Kommune / postal code</td>
              <td>1992Q1–{snapshot.quarter}</td>
              <td>Price per m², asking and realised</td>
            </tr>
            <tr>
              <td><code>BM020</code> / <code>BM021</code></td>
              <td>Kommune / postal code</td>
              <td>2004Q1–{snapshot.quarter}</td>
              <td>Dwellings sold, and for sale at quarter end</td>
            </tr>
            <tr>
              <td><code>BM030</code> / <code>BM031</code></td>
              <td>Kommune / postal code</td>
              <td>2004Q1–{snapshot.quarter}</td>
              <td>Time on market, in days</td>
            </tr>
            <tr>
              <td>
                <code>UDB010</code> / <code>UDB020</code> /{" "}
                <code>UDB030</code>
              </td>
              <td>Kommune, monthly</td>
              <td>2004M01–2026M07</td>
              <td>Listings: stock, asking price, days listed</td>
            </tr>
            <tr>
              <td><code>PRIS113</code></td>
              <td>National, monthly</td>
              <td>1980M01–</td>
              <td>Consumer price index, for the inflation adjustment</td>
            </tr>
          </tbody>
        </table>
        <p>
          Housing market statistics are published by{" "}
          <strong>Finans Danmark</strong> (Boligmarkedsstatistikken) and served
          through Danmarks Statistik&rsquo;s Statistikbanken API. Boundaries come
          from <strong>DAWA</strong>, Styrelsen for Dataforsyning og
          Infrastruktur. Danish place names are kept in Danish.
        </p>

        <h2>Three levels of area, one set of tables</h2>
        <p>
          The map draws <strong>11 landsdele</strong>, <strong>5 regioner</strong>{" "}
          or <strong>98 kommuner</strong>. None of these is aggregated by us:
          Finans Danmark publishes all three levels as their own rows in the
          same tables, so a landsdel figure is their number, not our sum of
          kommuner. That matters, because postal codes and kommuner do not nest
          cleanly and summing across boundaries would quietly double-count.
        </p>
        <p>
          The landsdel level is where Denmark&rsquo;s real geography shows up:
          Zealand and the capital ring, Funen, the four Jutland areas, and
          Bornholm on its own. At {snapshot.quarter} the median landsdel on
          Zealand runs about 2.9× the median in Jutland.
        </p>

        <h2>Quarterly sales, monthly listings</h2>
        <p>
          There are two different clocks in this data, and the map switches
          between them rather than pretending they are one.
        </p>
        <ul>
          <li>
            <strong>Quarterly · sold</strong> — realised transaction prices,
            volumes and time-to-sale. Quarterly is the only frequency these
            exist at. The latest is {snapshot.quarter}.
          </li>
          <li>
            <strong>Monthly · listed</strong> — homes standing on the market,
            what sellers are asking for them, and how long they have been
            waiting. Monthly, per kommune, and four months fresher than the
            sales data.
          </li>
        </ul>
        <p>
          The listing side is not a faster version of the sales side. Asking
          prices for unsold stock sit well above realised prices, because
          expensive homes linger and cheap ones clear quickly; the two series
          are measuring different populations. What the listing side gives you
          is a lead: inventory and asking prices move before realised prices
          do. There is no monthly series of realised prices in the free data,
          and we do not manufacture one by interpolating the quarterly one.
        </p>

        <h2>The sample-size rule</h2>
        <p>
          A price per square metre computed from four sales is not a market
          signal, it is an anecdote. Every area is graded on how many homes
          actually sold there in the <strong>trailing four quarters</strong>,
          and the grade decides what we are willing to draw.
        </p>
        <table>
          <thead>
            <tr>
              <th>Grade</th>
              <th>Sales in 4 quarters</th>
              <th>What we do</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>ok</code></td>
              <td>40 or more</td>
              <td>Coloured on the map, eligible for rankings</td>
            </tr>
            <tr>
              <td><code>low</code></td>
              <td>10–39</td>
              <td>Coloured, labelled &ldquo;low sample&rdquo;, kept out of rankings</td>
            </tr>
            <tr>
              <td><code>unverified</code></td>
              <td>Not published</td>
              <td>Coloured, flagged, kept out of rankings</td>
            </tr>
            <tr>
              <td><code>insufficient</code></td>
              <td>Under 10, or no price</td>
              <td>Neutral grey, no number shown at all</td>
            </tr>
          </tbody>
        </table>
        <p>
          The threshold sits on four quarters rather than one for a concrete
          reason: in a single quarter the median postal code sees about ten
          house sales, and roughly half of them fall under ten. A single-quarter
          rule would grey out half the country.
        </p>
        <p>
          <code>unverified</code> exists because the two series start in
          different decades. Prices go back to 1992; transaction counts only
          begin in 2004. Grading 1992&ndash;2003 as{" "}
          <code>insufficient</code> would claim we know those markets were thin,
          and we do not — we simply have no count for them. So those quarters
          keep their published price and carry the flag instead, and no ranking
          is drawn from them. Scrub the timeline before 2004 and the map still
          works; the movers lists correctly go empty.
        </p>

        <h2>Coverage right now</h2>
        <p>
          For {snapshot.quarter}, out of {tally("house").n} kommuner:
        </p>
        <table>
          <thead>
            <tr>
              <th>Homes</th>
              <th>ok</th>
              <th>low</th>
              <th>unverified</th>
              <th>insufficient</th>
            </tr>
          </thead>
          <tbody>
            {cats.map(([label, id]) => {
              const t = tally(id);
              return (
                <tr key={id}>
                  <td>{label}</td>
                  <td className="num">{t.ok}</td>
                  <td className="num">{t.low}</td>
                  <td className="num">{t.unv}</td>
                  <td className="num">{t.ins}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p>
          Houses fill the map almost completely. Flats and holiday homes do not,
          and that is not a defect in the data — most of rural Denmark has no
          block of flats to sell, and holiday homes sit on the coasts. Grey
          means &ldquo;we do not know&rdquo;, never &ldquo;zero&rdquo;.
        </p>

        <h2>Definitions</h2>
        <ul>
          <li>
            <strong>Price</strong> — realised price per square metre, averaged
            over the trailing four quarters.
          </li>
          <li>
            <strong>Price growth</strong> — that four-quarter average against
            the same average a year earlier. Growth is never computed from
            single-quarter prices; on thin samples that produces a sawtooth that
            looks like news and is noise.
          </li>
          <li>
            <strong>Real prices</strong> — the same figures deflated by the
            consumer price index and expressed in {snapshot.quarter} kroner, so
            &ldquo;real&rdquo; reads as &ldquo;what that would be worth today&rdquo;.
            Over three decades this matters enormously: the national figure
            rises 232% in nominal terms since 1995 and 84% after inflation.
          </li>
          <li>
            <strong>Days on market</strong> — median days from listing to sale.
          </li>
          <li>
            <strong>Quarters of supply</strong> — homes for sale at quarter end
            divided by homes sold that quarter.
          </li>
          <li>
            <strong>Asking vs realised</strong> — realised price against the
            initial asking price. Negative means sellers accepted less than they
            first asked.
          </li>
        </ul>

        <h2>Known limits</h2>
        <ul>
          <li>
            <strong>A zero in the time-on-market table is missing data.</strong>{" "}
            About 28% of the &ldquo;valid&rdquo; postal-code values are 0 days,
            which means no sale that quarter, not an instant sale. Left alone it
            would paint every quiet rural area as the hottest market in Denmark.
            We treat those zeros as missing.
          </li>
          <li>
            <strong>The monthly strip is not the map.</strong> The strip at the
            top runs four months ahead of the quarterly data, but it measures
            listings, not sales: what sellers are asking for the homes standing
            on the market, and how long those homes have been waiting. Asking
            prices for unsold stock sit well above realised prices, because
            expensive homes linger and cheap ones clear. There is no monthly
            series of realised prices in the free data, and we do not
            manufacture one.
          </li>
          <li>
            <strong>The inflation adjustment carries one assumption.</strong>{" "}
            The consumer price index is published a quarter behind the housing
            data, so the most recent quarter reuses the last published index
            value. That understates inflation by at most a single quarter,
            roughly half a percent.
          </li>
          <li>
            <strong>Quarterly, not monthly.</strong> The free series of realised
            prices is quarterly, so the shortest step on the map is one quarter.
            We would rather show a slower true frequency than interpolate a
            faster fake one.
          </li>
          <li>
            <strong>Colour scales are fixed across time.</strong> They are set
            once from the 2nd–98th percentile over all quarters since 2004, so
            that scrubbing the timeline shows the market actually heating and
            cooling. Extreme areas are clamped to the ends of the scale rather
            than being allowed to flatten everyone else.
          </li>
          <li>
            <strong>Postal codes do not nest inside kommuner.</strong> About 23%
            straddle a boundary, so postal-code figures are never summed to make
            kommune figures — the kommune numbers come from their own official
            tables.
          </li>
        </ul>

        <h2>Attribution</h2>
        <p>
          Housing market data: Finans Danmark, Boligmarkedsstatistikken, via
          Danmarks Statistik. Administrative boundaries: Styrelsen for
          Dataforsyning og Infrastruktur (DAWA). This is a data visualisation
          project. It is not a valuation, a forecast, or advice about buying or
          selling a home.
        </p>
      </main>
    </div>
  );
}
