# Danish Housing

**See what is happening in Danish real estate.**

An interactive map of the Danish housing market: prices, selling times,
transaction volume and supply for every kommune, region and landsdel, from
1992 to today. Built on free public data from Finans Danmark and Danmarks
Statistik.

**→ [huiyuleo.github.io/Danish-Housing](https://huiyuleo.github.io/Danish-Housing/)**

It is a market observatory, not a listings site. There is no property search,
no valuation, no advice about buying or selling.

---

## Features

- **Map of all of Denmark** at three official levels — 11 landsdele, 5 regioner,
  98 kommuner — with six measures: price, price growth, days on market,
  transaction volume, quarters of supply, and the gap between asking and
  realised prices.
- **A 34-year timeline** with playback, from 1992Q1 to the latest quarter.
- **Inflation-adjusted prices.** Nominal prices are up 232% since 1995; in real
  kroner the rise is 84%. The toggle matters more than it sounds.
- **Two clocks.** Realised sale prices are quarterly — that is the only
  frequency they exist at. Listings (stock, asking price, days waiting) are
  monthly and run four months ahead. The map switches between them rather than
  pretending they are one series.
- **Market Movers** — fastest rising and falling, accelerating, cooling,
  heating up, stalling.
- **114 area pages** with full history charts, one per kommune, region and
  landsdel.
- **Grey is a first-class state.** Areas with too few sales are drawn neutral
  and hatched, and never show a number.
- Light, dark and system themes. Works on mobile.

## Data

| Source | Tables | What it gives |
|---|---|---|
| [Finans Danmark](https://www.finansdanmark.dk/) Boligmarkedsstatistik | `BM010`/`BM011`, `BM020`/`BM021`, `BM030`/`BM031` | Quarterly prices, volumes, time on market — 1992Q1 onward |
| Finans Danmark supply statistics | `UDB010`, `UDB020`, `UDB030` | Monthly listings — 2004M01 onward |
| [Danmarks Statistik](https://www.dst.dk/) | `PRIS113` | Consumer price index, for the inflation adjustment |
| [DAWA](https://dawadocs.dataforsyningen.dk/) (Styrelsen for Dataforsyning og Infrastruktur) | — | Administrative boundaries |

All of it is free and needs no API key. Served through Danmarks Statistik's
[Statistikbanken API](https://www.dst.dk/en/Statistik/brug-statistikken/muligheder-i-statistikbanken/api).

Some quirks in this data will quietly ruin a chart if you do not know about
them — a zero that means "missing", two series that start a decade apart, and
postal codes that do not nest inside municipalities. They are written up in
**[docs/data-notes.md](docs/data-notes.md)**, and the reader-facing version
lives on the site's [Data & methods](https://huiyuleo.github.io/Danish-Housing/methods/)
page.

## Tech

Next.js 16 · TypeScript · MapLibre GL · Observable Plot · DuckDB WASM

No backend and no database. The whole dataset is a few megabytes of Parquet
served as static files; DuckDB WASM queries it in the browser over HTTP range
requests. The site is a static export that runs on any static host.

## Getting started

Requires Node 20+ and Python 3.10+.

```bash
git clone https://github.com/HUIYULEO/Danish-Housing.git
cd Danish-Housing
npm install
npm run dev
```

The committed data is enough to run the site — the ETL is only needed to
refresh it.

### Refreshing the data

Quarterly, when Finans Danmark publishes.

```bash
pip install requests pandas pyarrow
npm run etl        # ~3 min: pulls every table, rebuilds the panels
npm run simplify   # boundaries -> public/geo, simplified to well under 500 KB
```

Then commit whatever changed under `public/data` and `public/geo`.

> **Run the ETL on your own machine, not in a sandboxed shell.** Cowork's cloud
> container and desktop VM both have outbound allowlists that cannot reach
> `api.statbank.dk`.

`npm run etl` also writes [`data/REPORT.md`](data/REPORT.md), a coverage
diagnostic showing how much of the map each property type can actually fill.

## Scripts

| | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (Node/Vercel; sets cache headers) |
| `npm run build:static` | Static export to `out/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run etl` | Rebuild all data from the APIs |
| `npm run simplify` | Simplify DAWA boundaries for the web |

## Deployment

Static export, so it runs anywhere. GitHub Pages is wired up in
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) — push to `main`
and it deploys.

For a project site served from `/<repo>/`, set the base path:

```bash
BASE_PATH=/Danish-Housing npm run build:static
```

Runtime asset paths go through `lib/paths.ts`; do not hardcode `/data`, `/geo`
or `/duckdb` in components, because Next's `basePath` does not rewrite `fetch`
calls.

**Sizes.** The deployed site is ~88 MB, but 75 MB of that is the two DuckDB
WASM bundles and a modern browser only ever downloads one of them. A cold visit
transfers roughly 8–9 MB: under 1 MB to first paint with the map already drawn,
then the 6.9 MB query engine in the background. Parquet is already
zstd-compressed, so host gzip does nothing for it.

That puts GitHub Pages' 100 GB/month soft limit at around 11k cold visits.
Cloudflare Pages has no bandwidth cap and honours the `_headers` file, so it is
the better home if this gets shared around.

## Project layout

```
dk_housing_etl.py     ETL: APIs -> Parquet panels + REPORT.md
app/                  Next.js routes: map, /methods, /area/[code]
components/           Map, timeline, movers, charts, controls
lib/
  metrics.ts          Measure definitions, colour scales, sample-size tiers
  queries.ts          Parameterised queries — the only place SQL is written
  db.ts               DuckDB WASM setup
public/data/          Parquet + JSON the browser reads
public/geo/           Simplified boundaries
docs/                 PRD and data notes
```

## Attribution

Housing market data: **Finans Danmark**, Boligmarkedsstatistikken, via Danmarks
Statistik. Administrative boundaries: **Styrelsen for Dataforsyning og
Infrastruktur** (DAWA). Danish place names are kept in Danish.

This is a data visualisation project. It is not a valuation, a forecast, or
advice about buying or selling a home.

## License

Not yet chosen — see [#1](https://github.com/HUIYULEO/Danish-Housing/issues).
Until one is added, all rights are reserved. Note that the underlying data has
its own terms set by Finans Danmark and Danmarks Statistik.
