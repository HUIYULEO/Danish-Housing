"""Household income and the affordability measure built on it."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from .areas import area_level, area_parents
from .statbank import DST, read_bulk, to_number


# -------------------------------------------------------------- affordability
#
# INDKF132: household disposable income, 98 kommuner × 1987-2024, annual,
# no key.
#
# Price over income is the standard affordability measure in housing
# statistics everywhere (the ONS uses median price / median annual income and
# draws the line at 5 years). What is computed here:
#
#     the years of a family's entire disposable income needed to buy 100 m²
#
# 100 m² is used rather than "a standard dwelling" because the panel only has
# kr/m², not the floor areas sold. Inventing a dwelling size would only hide
# an assumption inside the number. 100 m² is a yardstick, not a floor plan.
#
# The ratio is naturally immune to inflation, since numerator and denominator
# are nominal kroner of the same year. The nominal / real switch therefore
# means nothing for it, and the UI must exclude it from that switch.
INCOME_TABLE = "INDKF132"
AFFORD_M2 = 100


def fetch_income(outdir: Path) -> pd.DataFrame:
    """Household disposable income for all four levels, by year.

    Landsdel and region are not published separately, but total income
    (ENHED 110) and the number of families (102) are both additive, so
    sum(110)/sum(102) is an exact aggregate. Averaging the kommune averages
    would be wrong: it would weight Læsø the same as Aalborg.
    """
    url = (f"{DST}data/{INCOME_TABLE}/BULK?lang=en&valuePresentation=Code"
           "&OMR%C3%85DE=*&ENHED=*&FAMTYP=FAIA&INDKINTB=99&Tid=*")
    print(f"[{INCOME_TABLE}] {url}")
    df = read_bulk(url)
    acol = next(c for c in df.columns if c.startswith("OMR"))
    df["v"] = to_number(df.pop("INDHOLD"))
    wide = (df.pivot_table(index=[acol, "TID"], columns="ENHED", values="v",
                           aggfunc="first")
              .reset_index()
              .rename(columns={acol: "area_code", "TID": "year",
                               "110": "amount_1000", "102": "families",
                               "117": "income_family"}))
    wide["year"] = wide["year"].astype(int)

    parents = area_parents(json.loads((outdir / "areas.json").read_text("utf-8")))
    kom = wide[wide["area_code"].map(lambda c: area_level(c) == "kommune")].copy()
    unmatched = sorted(set(kom["area_code"]) - set(parents))
    if unmatched:
        print(f"  !! no parent found in areas.json for these kommuner: {unmatched}")
    kom["landsdel"] = kom["area_code"].map(lambda c: parents.get(c, ("", ""))[0])
    kom["region"] = kom["area_code"].map(lambda c: parents.get(c, ("", ""))[1])

    keep = ["area_code", "year", "income_family", "families"]
    parts = [kom[keep]]
    for lvl in ("landsdel", "region"):
        g = (kom[kom[lvl] != ""]
             .groupby([lvl, "year"], as_index=False)[["amount_1000", "families"]]
             .sum())
        g["income_family"] = g["amount_1000"] * 1000 / g["families"]
        parts.append(g.rename(columns={lvl: "area_code"})[keep])
    nat = wide[wide["area_code"] == "000"].copy()   # national is '000' in DST, '00' in OMR20
    nat["area_code"] = "00"
    parts.append(nat[keep])

    inc = pd.concat(parts, ignore_index=True)
    inc = inc[inc["income_family"].notna()]
    print(f"  {len(inc):,} rows, {inc['area_code'].nunique()} areas, "
          f"{inc['year'].min()}-{inc['year'].max()}")
    return inc


def add_affordability(p: pd.DataFrame, inc: pd.DataFrame) -> pd.DataFrame:
    """Attach annual income to the quarterly panel and compute years_income.

    Income only runs to 2024 while prices run to 2026Q1. Missing years
    **reuse the last published year**, and the year actually used is written
    to the income_year column so the UI can state it honestly.

    Without that, the metric would be grey for the last two years, and nobody
    clicks twice on a metric that opens with no current value. Reusing a year
    without saying so is another matter, which is why income_year has to be
    carried all the way to the tooltip.
    """
    last_year = int(inc["year"].max())
    p = p.copy()
    p["income_year"] = p["quarter"].str[:4].astype(int).clip(upper=last_year)
    p = p.merge(inc.rename(columns={"year": "income_year"}),
                on=["area_code", "income_year"], how="left")
    p["years_income"] = p["price_4q"] * AFFORD_M2 / p["income_family"]
    p = p.sort_values(["area_code", "category", "quarter"]).reset_index(drop=True)
    prev = p.groupby(["area_code", "category"], sort=False)["years_income"].shift(4)
    p["years_income_chg"] = p["years_income"] - prev
    return p.drop(columns=["families"])
