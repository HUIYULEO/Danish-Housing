"""Monthly listing-side statistics (UDB010/020/030)."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from .areas import area_level
from .statbank import CAT, S20, read_bulk, to_number

# table -> (its measure dimension, measure code -> column name)
TABLES = {
    "UDB010": ("BOLA20", {"6": "for_sale", "7": "withdrawn"}),
    "UDB020": ("BOLB20", {"4": "asking_price_m2", "5": "withdrawn_price_m2"}),
    "UDB030": ("BOLC20", {"8": "days_listed", "9": "days_withdrawn"}),
}

# monthly.json predates the panel and names the two price series without _m2
STRIP_NAMES = {"asking_price_m2": "asking_price",
               "withdrawn_price_m2": "withdrawn_price"}


def _fetch(table: str, area: str = "*", category: str = "*") -> pd.DataFrame:
    """One UDB table as long rows: OMR20, EJKAT20, TID, measure, v."""
    dim, names = TABLES[table]
    df = read_bulk(f"{S20}data/{table}/BULK?lang=en&valuePresentation=Code"
                   f"&OMR20={area}&EJKAT20={category}&{dim}=*&Tid=*")
    df["v"] = to_number(df["INDHOLD"])
    df["measure"] = df[dim].map(names)
    return df.dropna(subset=["measure"])[["OMR20", "EJKAT20", "TID", "measure", "v"]]


def fetch_monthly_panel(outdir: Path) -> pd.DataFrame:
    """Kommune-level monthly panel. UDB010/020/030, from 2004M01 to 2026M07.

    This answers "is quarterly the finest grain?": **for sale prices yes**,
    for the listing side no. Homes for sale, asking prices and days listed
    all exist monthly, and run four months ahead of the quarterly sales data.
    So the map gets a frequency switch, and monthly mode shows only these
    three metrics. Quarterly data is not interpolated to monthly; it is a
    different set of metrics that are monthly to begin with.
    """
    frames = []
    for table in TABLES:
        print(f"[{table}] kommune-level monthly")
        df = _fetch(table)
        # A 0 in the days-listed table likewise means "no such event this
        # month", not 0 days
        if table == "UDB030":
            df.loc[df["v"] == 0, "v"] = pd.NA
        frames.append(df)
        print(f"  {len(df):,} rows")

    m = pd.concat(frames, ignore_index=True)
    m["category"] = m["EJKAT20"].map(CAT)
    m = m.rename(columns={"OMR20": "area_code", "TID": "month"})
    wide = (m.pivot_table(index=["area_code", "category", "month"],
                          columns="measure", values="v")
            .reset_index())
    wide.columns.name = None
    wide["area_level"] = wide["area_code"].map(area_level)
    wide = wide.sort_values(["area_code", "category", "month"])

    # Year on year: monthly data is strongly seasonal (more listings in
    # spring), so month-on-month is unreadable; the only fair comparison is
    # the same month a year earlier
    g = wide.groupby(["area_code", "category"], sort=False)
    for col in ("for_sale", "asking_price_m2", "days_listed"):
        if col in wide:
            wide[f"{col}_yoy"] = g[col].transform(
                lambda s: s.pct_change(12) * 100)

    for c in wide.columns:
        if pd.api.types.is_float_dtype(wide[c]):
            wide[c] = wide[c].astype("float32")
    wide.to_parquet(outdir / "panel_monthly.parquet", index=False)
    print(f"  -> panel_monthly.parquet  {len(wide):,} rows, "
          f"{wide['month'].min()} - {wide['month'].max()}")
    return wide


def fetch_monthly(webdir: Path) -> str:
    """National monthly temperature strip. PRD §6.3.

    UDB010/020/030 are all monthly and run to 2026M07, four months ahead of
    the quarterly sales data. All three tables measure the **listing side**
    (homes for sale, asking price, days listed), not sale prices. That is
    exactly why they are useful: asking prices and inventory move first,
    sale prices follow.

    Deliberately not done: passing monthly asking prices off as monthly sale
    prices. The free data has no such thing, and the PRD is explicit that we
    must not pretend it does.
    """
    print("[UDB010/020/030] national monthly")
    out: dict[str, dict[str, float]] = {}
    for table in TABLES:
        df = _fetch(table, area="00", category="1").dropna(subset=["v"])
        for measure in TABLES[table][1].values():
            sub = df[df["measure"] == measure]
            name = STRIP_NAMES.get(measure, measure)
            for month, v in zip(sub["TID"], sub["v"]):
                out.setdefault(month, {})[name] = round(float(v), 1)

    months = sorted(out)
    payload = {"latest": months[-1] if months else None,
               "months": months,
               "series": out}
    dst = webdir / "monthly.json"
    dst.write_text(json.dumps(payload, separators=(",", ":")), "utf-8")
    print(f"  monthly.json  {dst.stat().st_size/1024:.0f} KB  "
          f"{months[0]} - {months[-1]}")
    return (f"\n## Monthly indicators (national, houses)\n\n"
            f"- UDB010/020/030, {months[0]} - **{months[-1]}**\n"
            f"- Four months fresher than the quarterly sales data, but "
            f"listing-side only: no sale prices\n")
