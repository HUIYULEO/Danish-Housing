import Link from "next/link";
import type { Metadata } from "next";
import snapshot from "../../public/data/snapshot.json";
import { quarterLabel } from "@/lib/metrics";
import { pageUrl } from "@/lib/site";

const REPO = "https://github.com/HUIYULEO/Danish-Housing";
const EMAIL = "luhy0629@outlook.com";

export const metadata: Metadata = {
  title: "About — Danish Housing",
  description:
    "Who built Danish Housing and how: a static site with no backend, querying Parquet in the browser with DuckDB WASM. Source code on GitHub.",
  alternates: { canonical: pageUrl("/about/") },
};

/**
 * The site is a technical showcase as much as a data product, so this page
 * says how it is put together, not only who made it.
 */
export default function About() {
  return (
    <div className="shell">
      <header className="masthead">
        <div className="masthead__mark">
          Danish Housing<span>.</span>
        </div>
        <nav className="masthead__nav">
          <Link href="/">Map</Link>
          <Link href="/areas">All areas</Link>
          <Link href="/methods">Data &amp; methods</Link>
        </nav>
      </header>

      <main className="prose">
        <h1>About</h1>
        <p>
          Danish Housing puts thirty-four years of Danish house prices, selling
          times, transaction volume and supply on one map: every kommune and
          postal district, every quarter since 1992. It is an independent
          project, built to see what official statistics can show when they
          are made easy to look at. It is not a valuation, a forecast, or
          advice about buying or selling a home.
        </p>
        <p>
          The data currently runs to{" "}
          <strong>{quarterLabel(snapshot.quarter)}</strong> and is refreshed
          automatically every month. Where the numbers come from and how they
          are treated is on the <Link href="/methods">Data &amp; methods</Link>{" "}
          page.
        </p>

        <h2>How it is built</h2>
        <p>
          There is no backend and no database server. The whole site is static
          files.
        </p>
        <ul>
          <li>
            <strong>Pipeline.</strong> A Python job pulls the public tables
            from Finans Danmark and Danmarks Statistik, joins them into one
            panel per geographic level, computes rolling four-quarter measures
            and inflation-adjusted prices, grades every figure by sample size,
            and writes a few megabytes of Parquet.
          </li>
          <li>
            <strong>Queries in the browser.</strong> DuckDB compiled to
            WebAssembly reads that Parquet over HTTP range requests, fetching
            only the row groups a query touches. The timeline, the rankings
            and every chart are SQL running on your own machine.
          </li>
          <li>
            <strong>First paint without the engine.</strong> The query engine
            is larger than the data it queries, so the map does not wait for
            it: the latest quarter ships as a small snapshot and the engine
            loads behind it.
          </li>
          <li>
            <strong>Map.</strong> MapLibre GL with no basemap tiles. Colours
            are set through feature state, so scrubbing the timeline updates
            the map without rebuilding any geometry.
          </li>
          <li>
            <strong>Pages.</strong> Next.js static export. Each of the 700-odd
            area pages has its headline figures written into the HTML at build
            time, so it reads without JavaScript.
          </li>
        </ul>

        <h2>Rules it holds itself to</h2>
        <ul>
          <li>
            Only official, published figures. Nothing scraped, estimated or
            modelled.
          </li>
          <li>
            An area with too few sales shows grey and no number, however good
            the map would look with it filled in.
          </li>
          <li>
            Growth is always measured on four-quarter averages, never one
            quarter against another.
          </li>
        </ul>

        <h2>Source and contact</h2>
        <p>
          The code is open source under the MIT licence:{" "}
          <a href={REPO}>github.com/HUIYULEO/Danish-Housing</a>. Bug reports
          and questions are welcome as{" "}
          <a href={`${REPO}/issues`}>issues on GitHub</a>, or by email at{" "}
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
        </p>
        <p>
          Housing market data: Finans Danmark, Boligmarkedsstatistikken, via
          Danmarks Statistik. Boundaries: Styrelsen for Dataforsyning og
          Infrastruktur.
        </p>
      </main>
    </div>
  );
}
