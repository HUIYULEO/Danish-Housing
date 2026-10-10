#!/usr/bin/env python3
"""Rebuild every data file the site needs. Entry point for `npm run etl`.

    pip install requests pandas pyarrow
    python dk_housing_etl.py

The work lives in the etl/ package; this file only fixes the order of the
steps and assembles data/REPORT.md. See etl/__init__.py for what the source
tables look like and the traps in them.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import pandas  # noqa: F401
    import requests  # noqa: F401
except ImportError:
    sys.exit("pip install requests pandas pyarrow")

from etl.areas import fetch_areas
from etl.cpi import fetch_cpi
from etl.facts import build_facts
from etl.geo import build_crosswalk
from etl.income import fetch_income
from etl.monthly import fetch_monthly, fetch_monthly_panel
from etl.panel import build_panel, coverage_report
from etl.web import export_web

REPORT_INTRO = (
    "# Panel diagnostics\n\n"
    "Every area on the map meets one of four fates: coloured normally (ok), "
    "coloured but flagged as low sample (low), coloured with a sample size "
    "that cannot be checked (unverified: no volume data before 2004), or "
    "neutral grey (insufficient).\n\n"
    "The two tables below show the distribution for the **latest quarter**, "
    "which has complete volume data, so unverified is 0 and the grey column "
    "is simply insufficient.\n\n"
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--outdir", default="data")
    ap.add_argument("--skip-geo", action="store_true")
    ap.add_argument("--webdir", default="public/data")
    a = ap.parse_args()
    out, web = Path(a.outdir), Path(a.webdir)
    out.mkdir(parents=True, exist_ok=True)

    cpi = fetch_cpi()
    # areas.json has to come first: fetch_income relies on the **order**
    # inside it to rebuild the kommune -> landsdel -> region parent links.
    fetch_areas(out)
    income = fetch_income(out)
    kom = build_panel(out, "kommune", cpi, income)
    pnr = build_panel(out, "postnr", cpi)

    report = (REPORT_INTRO
              + coverage_report(kom, "kommune")
              + "\n" + coverage_report(pnr, "postnr"))
    if not a.skip_geo:
        report += build_crosswalk(out, web, set(pnr["postnr"].unique()))
    fetch_monthly_panel(out)
    report += export_web(out, web)
    report += fetch_monthly(web)
    report += build_facts(out, web)
    (out / "REPORT.md").write_text(report, encoding="utf-8")
    print(report)
    print(f"\ndone -> {out.resolve()}")


if __name__ == "__main__":
    main()
