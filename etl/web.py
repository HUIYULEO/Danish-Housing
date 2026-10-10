"""Everything the browser downloads: compact Parquet, snapshot, version."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd

from .areas import reconcile_names

# Panels shipped to the browser. postnr was unfrozen in v0.3: the map now has
# a postal-code layer and the detail page has a drill-down table, so those
# 4 MB are actually queried.
WEB_PANELS = ("kommune", "postnr", "monthly")

SNAPSHOT_COLS = [
    "area_code", "category", "price_4q", "yoy_pct", "accel_pp", "dom_4q",
    "dom_yoy_days", "n_sold", "n_sold_4q", "n_for_sale",
    "quarters_of_supply", "discount_pct", "reliability",
    "price_4q_real", "yoy_real_pct",
    "years_income", "years_income_chg", "income_family", "income_year",
]

QUARTERLY_DOMAIN_COLS = (
    "price_4q", "yoy_pct", "accel_pp", "dom_4q", "dom_yoy_days",
    "n_sold_4q", "quarters_of_supply", "discount_pct",
    "price_4q_real", "yoy_real_pct", "years_income", "years_income_chg",
)
MONTHLY_DOMAIN_COLS = (
    "for_sale", "asking_price_m2", "days_listed",
    "for_sale_yoy", "asking_price_m2_yoy", "days_listed_yoy",
)
# Diverging metrics must be symmetric, otherwise 0 is not at the colour
# midpoint and the map looks like it is lying
DIVERGING = {
    "yoy_pct", "yoy_real_pct", "accel_pp", "dom_yoy_days", "discount_pct",
    "years_income_chg", "for_sale_yoy", "asking_price_m2_yoy", "days_listed_yoy",
}


def export_web(outdir: Path, webdir: Path) -> str:
    """Write everything under public/data and return the report section."""
    webdir.mkdir(parents=True, exist_ok=True)
    lines = ["\n## What the browser downloads\n", "| file | size | gzipped |",
             "|---|---|---|"]
    lines += _export_panels(outdir, webdir)
    reconcile_names(outdir, webdir)
    (webdir / "areas.json").write_bytes((outdir / "areas.json").read_bytes())
    _write_summaries(webdir)
    quarter, size = _write_snapshot(outdir, webdir)
    lines.append(f"| snapshot.json (first paint) | {size/1024:.0f} KB | — |")
    _write_version(webdir, quarter)
    return "\n".join(lines) + "\n"


def _export_panels(outdir: Path, webdir: Path) -> list[str]:
    """The whole dataset goes to the browser, so the web copy is squeezed
    again with float32 + zstd.

    Neither kr/m2 nor percentages need float64 precision; float32 has 7
    significant digits and the highest price is just over 90,000. Same row
    count, same meaning, half the size.
    """
    lines = []
    for level in WEB_PANELS:
        df = pd.read_parquet(outdir / f"panel_{level}.parquet")
        for c in df.columns:
            if pd.api.types.is_float_dtype(df[c]):
                df[c] = df[c].astype("float32")
        for c in ("category", "reliability", "area_level"):
            if c in df:
                df[c] = df[c].astype("category")
        # Sort by area before writing. DuckDB fetches row groups over HTTP
        # range requests, and the UI's postal-code question is always "the
        # dozen or so postal codes under one kommune". With one postal code's
        # 137 quarters sitting in adjacent row groups, a drill-down does not
        # have to pull the whole 4 MB.
        key = "postnr" if "postnr" in df else "area_code"
        tcol = "month" if "month" in df else "quarter"
        df = df.sort_values([key, "category", tcol]).reset_index(drop=True)
        dst = webdir / f"panel_{level}.parquet"
        df.to_parquet(dst, index=False, compression="zstd", row_group_size=20000)
        raw = dst.stat().st_size
        lines.append(f"| panel_{level}.parquet | {raw/1e6:.2f} MB | ~{raw/1e6/3:.2f} MB |")
        print(f"  web: panel_{level}.parquet  {raw/1e6:.2f} MB")
    return lines


# panel column -> (name in summaries.json, decimals)
SUMMARY_COLS = {"price_4q": ("price", 0), "yoy_pct": ("yoy", 1),
                "dom_4q": ("dom", 0), "n_sold_4q": ("sales", 0)}


def _write_summaries(webdir: Path) -> None:
    """Latest-quarter headline numbers for every area at every level.

    The area pages are static HTML, but their numbers are drawn by DuckDB in
    the browser, and search crawlers and LLM fetchers mostly do not run
    JavaScript: to them each page was an empty shell. This file lets the
    site build write the headline numbers into the HTML itself. It is read
    at build time only; the browser never requests it.

    Insufficient units carry their reliability and nothing else, so the
    build cannot print a number the map itself refuses to show.
    """
    areas: dict[str, dict[str, dict]] = {}
    quarter = ""
    for level in ("kommune", "postnr"):
        df = pd.read_parquet(webdir / f"panel_{level}.parquet")
        key = "postnr" if "postnr" in df else "area_code"
        last = df["quarter"].max()
        quarter = quarter or last
        for r in df[df["quarter"] == last].to_dict(orient="records"):
            entry: dict = {"reliability": str(r["reliability"])}
            if entry["reliability"] != "insufficient":
                for col, (name, decimals) in SUMMARY_COLS.items():
                    if pd.notna(r[col]):
                        v = round(float(r[col]), decimals)
                        entry[name] = v if decimals else int(v)
            areas.setdefault(str(r[key]), {})[str(r["category"])] = entry
    dst = webdir / "summaries.json"
    dst.write_text(json.dumps({"quarter": quarter, "areas": areas},
                              separators=(",", ":")), "utf-8")
    print(f"  web: summaries.json  {dst.stat().st_size/1024:.0f} KB  ({len(areas)} areas)")


def _write_snapshot(outdir: Path, webdir: Path) -> tuple[str, int]:
    """First-paint snapshot. Returns (latest quarter, file size in bytes).

    DuckDB WASM itself is 7 MB gzipped, 5 times the data it queries. The map
    cannot wait for it. So the latest quarter's kommune slice goes out as a
    separate JSON of a few dozen KB that colours the first screen directly,
    while DuckDB loads in the background; only the timeline and the boards
    need it once it is up.
    """
    kom = pd.read_parquet(outdir / "panel_kommune.parquet")
    mon = pd.read_parquet(outdir / "panel_monthly.parquet")
    last = kom["quarter"].max()

    cols = [c for c in SNAPSHOT_COLS if c in kom.columns]
    snap = kom[(kom["quarter"] == last) & (kom["area_level"] == "kommune")][cols]
    # Round first, then cast to object, so NaN can become None. A plain where
    # gets swallowed back by the float columns and writes bare NaN, which is
    # not valid JSON; the browser's JSON.parse throws on it.
    snap = snap.round(2).astype(object)
    snap = snap.where(pd.notna(snap), None)

    # Quarterly domains come from every adequately sampled unit in all
    # quarters since 2004. Monthly ones are computed separately; monthly only
    # has the three listing-side measures.
    quarterly_src = kom[(kom["area_level"] == "kommune")
                        & (kom["reliability"].isin(["ok", "low"]))
                        & (kom["quarter"] >= "2004Q1")]
    monthly_src = mon[(mon["area_level"] == "kommune")
                      & (mon["month"] >= "2007M01")]

    payload = {"quarter": last, "level": "kommune",
               "domains": _domains(quarterly_src, QUARTERLY_DOMAIN_COLS),
               "domainsMonthly": _domains(monthly_src, MONTHLY_DOMAIN_COLS),
               "quarters": sorted(kom["quarter"].unique().tolist()),
               "months": sorted(mon["month"].unique().tolist()),
               "rows": snap.to_dict(orient="records")}
    dst = webdir / "snapshot.json"
    dst.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":"),
                              allow_nan=False), "utf-8")
    size = dst.stat().st_size
    print(f"  web: snapshot.json  {size/1024:.0f} KB  ({len(snap)} rows @ {last})")
    return last, size


def _domains(src: pd.DataFrame, cols: tuple[str, ...]) -> dict[str, dict[str, list[float]]]:
    """Fixed colour domains per property type: the 2nd/98th percentiles.

    Recomputing min/max every quarter would make the timeline show only
    changes in ranking, not whether the market as a whole is heating or
    cooling: the 2009 crash and the 2021 frenzy would look identical. So the
    domain is fixed once, over the whole history.
    """
    out: dict[str, dict[str, list[float]]] = {}
    for cat, grp in src.groupby("category", observed=True):
        d = {}
        for col in cols:
            if col not in grp:
                continue
            s = grp[col].dropna()
            if len(s) < 50:
                continue
            lo, hi = float(s.quantile(0.02)), float(s.quantile(0.98))
            if col in DIVERGING:
                m = max(abs(lo), abs(hi))
                lo, hi = -m, m
            d[col] = [round(lo, 2), round(hi, 2)]
        out[str(cat)] = d
    return out


def _write_version(webdir: Path, quarter: str) -> None:
    """Compute a short hash of the Parquet contents; the frontend appends it
    as ?v= on its requests.

    The data updates quarterly, so the Parquet deserves a long cache. But if
    the URL never changed, a browser would pair last quarter's Parquet with
    this quarter's snapshot.json, and the map and timeline would no longer
    tell the same story. A content hash in the URL removes the problem.
    """
    h = hashlib.sha1()
    for level in WEB_PANELS:
        h.update((webdir / f"panel_{level}.parquet").read_bytes())
    version = h.hexdigest()[:12]
    (webdir / "version.json").write_text(
        json.dumps({"version": version, "quarter": quarter}), "utf-8")
    print(f"  web: version.json  {version}")
