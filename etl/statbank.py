"""HTTP access to the StatBank APIs, plus the shared code tables."""

from __future__ import annotations

import io
import sys
import time

import pandas as pd
import requests


S20 = "https://api.statbank.dk/v1/s20/"
DST = "https://api.statbank.dk/v1/"

SUPPRESSED = {"..", ".", "", "-", "M", "U"}

CAT = {"1": "house", "2": "flat", "3": "holiday"}


SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "dk-housing-etl/2.0"})


def get(url: str, tries: int = 4, timeout: int = 300) -> requests.Response:
    for i in range(tries):
        try:
            r = SESSION.get(url, timeout=timeout)
            r.raise_for_status()
            return r
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            print(f"  retry {i+1}: {e}", file=sys.stderr)
            time.sleep(2 ** i)
    raise RuntimeError(url)


def read_bulk(url: str) -> pd.DataFrame:
    """Download a BULK extract as an all-string frame.

    Column names are upper-cased and every cell is stripped; values stay
    strings so that suppression markers survive until to_number() sees them.
    """
    df = pd.read_csv(io.StringIO(get(url).text), sep=";", dtype=str,
                     keep_default_na=False)
    df.columns = [c.strip().upper() for c in df.columns]
    for c in df.columns:
        df[c] = df[c].str.strip()
    return df


def to_number(raw: pd.Series) -> pd.Series:
    """Parse a value column, turning suppression markers ('..', '-') into NaN."""
    return pd.to_numeric(raw.where(~raw.isin(SUPPRESSED)), errors="coerce")
