"""The quarterly panel: price, volume and days on market joined per area."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from .areas import area_level
from .cpi import add_real_prices
from .income import add_affordability
from .statbank import CAT, S20, read_bulk, to_number


# table -> (base, dimension order, meaning of the value column)
SPECS = {
    "BM011": (S20, ["PNR20", "EJKAT20", "PRIS20", "Tid"], "price_m2"),
    "BM021": (S20, ["PNR20", "EJKAT20", "BEV20", "Tid"], "count"),
    "BM031": (S20, ["PNR20", "EJKAT20", "Tid"], "days_on_market"),
    "BM010": (S20, ["OMR20", "EJKAT20", "PRIS20", "Tid"], "price_m2"),
    "BM020": (S20, ["OMR20", "EJKAT20", "BEV20", "Tid"], "count"),
    "BM030": (S20, ["OMR20", "EJKAT20", "Tid"], "days_on_market"),
}

# A 0 in the days-on-market tables means "no sale that quarter", at both the
# postnummer and the kommune level
DOM_TABLES = {"BM031", "BM030"}


PRIS = {"UDBUD": "list_initial", "NEDTAG": "list_final", "REAL": "realised"}
BEV = {"SALG": "sold", "ULTIMO": "for_sale_eop"}


def fetch(table: str) -> pd.DataFrame:
    base, dims, valname = SPECS[table]
    q = "&".join(f"{d}=*" for d in dims)
    url = f"{base}data/{table}/BULK?lang=en&valuePresentation=Code&{q}"
    print(f"[{table}] {url}")
    df = read_bulk(url)
    df[valname] = to_number(df.pop("INDHOLD"))

    # ---- Key fix: a 0 in the days-on-market tables is a disguised missing
    # value, not "sold in 0 days" ----
    if table in DOM_TABLES:
        n_zero = int((df[valname] == 0).sum())
        df.loc[df[valname] == 0, valname] = pd.NA
        print(f"  {table}: treated {n_zero:,} zeros as missing (no sale that quarter)")

    df["quarter"] = df["TID"].str.replace("K", "Q", regex=False)
    df = df.drop(columns=["TID"])
    df["category"] = df["EJKAT20"].map(CAT)
    df = df.drop(columns=["EJKAT20"])
    if "PRIS20" in df:
        df["price_type"] = df.pop("PRIS20").map(PRIS)
    if "BEV20" in df:
        df["measure"] = df.pop("BEV20").map(BEV)
    df = df.rename(columns={"PNR20": "postnr", "OMR20": "area_code"})
    print(f"  {len(df):,} rows, {df[valname].notna().mean():.1%} valid")
    return df


def build_panel(outdir: Path, level: str, cpi: pd.DataFrame,
                income: "pd.DataFrame | None" = None) -> pd.DataFrame:
    """Join the three tables into one panel, with sample sizes and rolling
    metrics already computed.

    level="postnr"   BM011/BM021/BM031, 605 postal codes
    level="kommune"  BM010/BM020/BM030, 115 areas (country + regions + 98 kommuner)

    Both levels have exactly the same dimension structure, so they share one
    code path.
    """
    tables = {"postnr": ("BM011", "BM021", "BM031"),
              "kommune": ("BM010", "BM020", "BM030")}[level]
    unit = {"postnr": "postnr", "kommune": "area_code"}[level]

    price = fetch(tables[0])
    vol = fetch(tables[1])
    dom = fetch(tables[2])

    price_r = (price[price["price_type"] == "realised"]
               .drop(columns=["price_type"])
               .rename(columns={"price_m2": "price_m2_realised"}))
    spread = (price.pivot_table(index=[unit, "category", "quarter"],
                                columns="price_type", values="price_m2")
              .reset_index())
    if {"list_initial", "realised"} <= set(spread.columns):
        spread["discount_pct"] = (
            (spread["realised"] - spread["list_initial"]) / spread["list_initial"] * 100)
    spread = spread[[unit, "category", "quarter"] +
                    [c for c in ("list_initial", "discount_pct") if c in spread]]

    sold = (vol[vol["measure"] == "sold"].drop(columns=["measure"])
            .rename(columns={"count": "n_sold"}))
    stock = (vol[vol["measure"] == "for_sale_eop"].drop(columns=["measure"])
             .rename(columns={"count": "n_for_sale"}))

    keys = [unit, "category", "quarter"]
    p = (price_r.merge(spread, on=keys, how="outer")
                .merge(sold, on=keys, how="outer")
                .merge(stock, on=keys, how="outer")
                .merge(dom, on=keys, how="outer")
                .sort_values(keys))

    # ---- Sample size: sales over a rolling 4 quarters. The single-quarter
    # median is only 10, far too thin ----
    g = p.groupby([unit, "category"], sort=False)
    p["n_sold_4q"] = g["n_sold"].transform(lambda s: s.rolling(4, min_periods=4).sum())
    # Prices use a rolling 4-quarter mean too, to absorb sampling noise
    p["price_4q"] = g["price_m2_realised"].transform(
        lambda s: s.rolling(4, min_periods=3).mean())
    p["yoy_pct"] = g["price_4q"].transform(lambda s: s.pct_change(4) * 100)
    p["yoy_prev"] = g["yoy_pct"].transform(lambda s: s.shift(4))
    p["accel_pp"] = p["yoy_pct"] - p["yoy_prev"]
    # Days on market is rolled over 4 quarters as well. With the fake zeros
    # removed, a single quarter is too sparse and point-to-point comparisons
    # jump around. The Heating up / Stalling boards use dom_yoy_days;
    # negative = selling faster
    p["dom_4q"] = g["days_on_market"].transform(
        lambda s: s.rolling(4, min_periods=2).mean())
    p["dom_yoy_days"] = p["dom_4q"] - g["dom_4q"].transform(lambda s: s.shift(4))
    # Quarters of supply: for sale at period end / sold in the quarter
    p["quarters_of_supply"] = p["n_for_sale"] / p["n_sold"].replace(0, pd.NA)

    # ---- Reliability tiers. The map and the boards read this column ----
    #
    # Four tiers, not three. PRD §5 says three, but it was written with only
    # the latest quarter in mind.
    # Prices start in 1992; volumes (BM020/BM021) only start in 2004.
    # Apply three tiers to 1992-2003 and those twelve years go solid grey,
    # which amounts to saying "we know too few homes sold there". We do not
    # know that; we simply lack the number.
    # Hence the extra tier, unverified: an official price exists but the
    # sample size cannot be checked.
    # It is coloured as usual (the price is officially published) but, like
    # low, it stays off the boards.
    p["reliability"] = pd.cut(
        p["n_sold_4q"], [-1, 9, 39, float("inf")],
        labels=["insufficient", "low", "ok"]).astype(str)
    # A price exists, but volumes were simply not published in that era
    p.loc[p["n_sold_4q"].isna(), "reliability"] = "unverified"
    # No price at all: there is truly nothing to draw
    p.loc[p["price_4q"].isna(), "reliability"] = "insufficient"

    p = add_real_prices(p, cpi, unit)

    if level == "kommune":
        p["area_level"] = p["area_code"].map(area_level)
        # Only the kommune panel can be matched to income; INDKF132 has no
        # postal codes. The postal level is not forced: spreading a kommune's
        # income over the postal codes inside it is a model, and this project
        # publishes no modelled numbers at all.
        if income is not None:
            p = add_affordability(p, income)

    p = p.reset_index(drop=True)
    p.to_parquet(outdir / f"panel_{level}.parquet", index=False)
    print(f"  -> panel_{level}.parquet  {len(p):,} rows")
    return p


def coverage_report(p: pd.DataFrame, level: str) -> str:
    """How much of the map can be filled is this table. ok/low get colour,
    insufficient is always neutral grey."""
    unit, noun = {"postnr": ("postnr", "postal code"),
                  "kommune": ("area_code", "kommune")}[level]
    if level == "kommune":
        p = p[p["area_level"] == "kommune"]
    last = p["quarter"].max()
    title = {"postnr": "postnummer level (drill-down layer)",
             "kommune": "kommune level (**default map layer**)"}[level]

    lines = [f"## {title}", "",
             f"Latest quarter **{last}**, panel of {len(p):,} rows.", "",
             f"| {noun} | with data | ok (>=40) | low (10-39) | insufficient | colourable |",
             "|---|---|---|---|---|---|"]
    detail = []
    for cat in ("house", "flat", "holiday"):
        s = p[(p["category"] == cat) & (p["quarter"] == last)]
        if not len(s):
            continue
        vc = s["reliability"].value_counts()
        ok_n, low_n, ins_n, unv_n = (
            int(vc.get(k, 0)) for k in ("ok", "low", "insufficient", "unverified"))
        n = int(s[unit].nunique())
        lines.append(f"| {cat} | {n} | **{ok_n}** | {low_n} | {ins_n + unv_n} | "
                     f"{(ok_n + low_n) / n:.0%} |")
        ok = s[s["reliability"] == "ok"]
        if len(ok):
            detail += [f"- **{cat}** ({ok_n} ok units): "
                       f"median YoY {ok['yoy_pct'].median():.1f}%, "
                       f"median days on market {ok['dom_4q'].median():.0f}, "
                       f"supply {ok['quarters_of_supply'].median():.1f} quarters"]
    return "\n".join(lines + [""] + detail + [""])
