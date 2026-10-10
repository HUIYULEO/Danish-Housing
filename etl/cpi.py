"""Consumer prices, for deflating nominal prices into real ones."""

from __future__ import annotations

import pandas as pd

from .statbank import DST, read_bulk, to_number


def fetch_cpi() -> pd.DataFrame:
    """Consumer price index, used to turn nominal prices into real ones.

    PRIS113: monthly CPI from 1980M01, a single series that neatly covers the
    1992-2026 span of the price data. Months are averaged into quarters
    because the prices are quarterly anyway.

    Why this is necessary: the timeline runs all the way back to 1992, when
    the national price was 4,121 kr/m²; today it is 13,672. Undeflated, that
    looks like a 232% rise, but more than half of it is just money losing
    value.
    """
    url = (f"{DST}data/PRIS113/BULK?lang=en&valuePresentation=Code"
           f"&TYPE=*&Tid=*")
    print(f"[PRIS113] {url}")
    df = read_bulk(url)
    df["cpi"] = to_number(df["INDHOLD"])
    t = df["TID"]
    df["quarter"] = (t.str[:4] + "Q"
                     + ((pd.to_numeric(t.str[5:7]) - 1) // 3 + 1).astype(str))
    q = (df.dropna(subset=["cpi"]).groupby("quarter", as_index=False)["cpi"]
         .mean().sort_values("quarter"))
    print(f"  {len(q)} quarters, {q['quarter'].iloc[0]} - {q['quarter'].iloc[-1]}")
    return q


def add_real_prices(p: pd.DataFrame, cpi: pd.DataFrame, unit: str) -> pd.DataFrame:
    """Add real prices in latest-quarter kroner, plus real year-on-year growth.

    The deflation base is the latest quarter in the panel, so price_4q_real
    reads as "what that is in today's money" and readers never have to
    convert base periods themselves.
    """
    base_q = p["quarter"].max()

    # CPI is usually published a quarter behind the price data (prices now run
    # to 2026Q1, CPI to 2025Q4). The missing quarter or two are carried
    # forward from the last known value. That under-counts one quarter of
    # inflation, around 0.5%, which is far better than dropping the feature.
    # When values are carried forward, say so.
    quarters = sorted(p["quarter"].unique())
    cpi_last = cpi["quarter"].max()
    n_ffill = sum(1 for q in quarters if q > cpi_last)
    cpi = (cpi.set_index("quarter").reindex(quarters).ffill()
           .rename_axis("quarter").reset_index())
    if n_ffill:
        print(f"  CPI only runs to {cpi_last}; the last {n_ffill} quarter(s) "
              f"carry the last known value forward")

    base = cpi.loc[cpi["quarter"] == base_q, "cpi"]
    base = float(base.iloc[0]) if len(base) and pd.notna(base.iloc[0]) else None
    if not base:
        print("  CPI does not cover the panel period at all; skipping real prices")
        return p

    p = p.merge(cpi, on="quarter", how="left")
    p["price_4q_real"] = p["price_4q"] * base / p["cpi"]
    g = p.groupby([unit, "category"], sort=False)
    p["yoy_real_pct"] = g["price_4q_real"].transform(lambda s: s.pct_change(4) * 100)
    print(f"  real price base = {base_q} (CPI {base:.1f})")
    return p
