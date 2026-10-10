"""The postnummer -> kommune crosswalk, built from the last DAWA extract.

DAWA (api.dataforsyningen.dk) was retired on 2026-10-01 and now answers
410 Gone. Its official successor, Datafordeleren (DAGI), only serves
requests carrying an API key tied to a user account, and this project uses
no keyed sources. So nothing here goes over the network any more:

  data/postnumre.json   the postnummer list as DAWA last served it, committed
  public/geo/*.geojson  the simplified boundaries, committed

Boundaries only move with an administrative reform and postal codes change
rarely, so a frozen extract is good for years. Refreshing either one means
exporting from DAGI by hand and replacing those files.
"""

from __future__ import annotations

import json
from pathlib import Path


def postnr_bucket(nr: str) -> str:
    """Map DAWA postal codes onto the cells BM011 actually publishes.

    BM011 does not publish inner Copenhagen code by code (1050, 1051, ...);
    it publishes three big cells:

        1000-1499  København K
        1500-1799  København V
        1800-1999  Frederiksberg C

    DAWA draws a boundary for every single postal code (232 polygons for
    1050-1499 alone). Without merging, the densest and most interesting part
    of Denmark would be solid grey on the postal-code map. Not because there
    is no data, but because the two sides' codes do not refer to the same
    thing.
    """
    try:
        n = int(nr)
    except ValueError:
        return nr
    if 1000 <= n < 1500:
        return "1000"
    if 1500 <= n < 1800:
        return "1500"
    if 1800 <= n < 2000:
        return "1800"
    return nr


BUCKET_NAME = {"1000": "København K", "1500": "København V",
               "1800": "Frederiksberg C"}


def build_crosswalk(outdir: Path, webdir: Path,
                    pnr_codes: "set[str] | None" = None) -> str:
    """postnummer -> kommune membership, and the postal-layer place names.

    Returns the crosswalk section of the report.
    """
    src = outdir / "postnumre.json"
    print(f"[crosswalk] {src}")
    pn = json.loads(src.read_text("utf-8"))
    kommuner = {k["kode"] for x in pn for k in x.get("kommuner") or []}
    multi = [p for p in pn if len(p.get("kommuner", [])) > 1]

    # kommune -> the postal codes inside it. For the detail card and later
    # drill-downs. A postal code that straddles a boundary appears under every
    # kommune it touches. This is membership for **display**, not a weight
    # for summing, so the repetition is correct.
    by_kom: dict[str, list[str]] = {}
    names: dict[str, str] = {}
    for x in pn:
        code = postnr_bucket(x["nr"])
        # After merging, the name is the cell's official one, not that of
        # whichever postal code happened to come first
        names.setdefault(code, BUCKET_NAME.get(code) or x["navn"])
        if code in BUCKET_NAME:
            names[code] = BUCKET_NAME[code]
        for k in x.get("kommuner") or []:
            kk = k["kode"].lstrip("0") or "0"
            by_kom.setdefault(kk, []).append(code)
    if pnr_codes:
        # Postal codes missing from the panel are left out of the drill-down
        # list; clicking through would only give an empty page
        by_kom = {k: [c for c in v if c in pnr_codes] for k, v in by_kom.items()}
        names = {c: n for c, n in names.items() if c in pnr_codes}
        for c in pnr_codes - set(names):
            names[c] = BUCKET_NAME.get(c, c)
    for code in by_kom:
        by_kom[code] = sorted(set(by_kom[code]))
    by_kom = {k: v for k, v in by_kom.items() if v}
    webdir.mkdir(parents=True, exist_ok=True)
    (webdir / "postnr_by_kommune.json").write_text(
        json.dumps(by_kom, separators=(",", ":")), "utf-8")
    print(f"  postnr_by_kommune.json  {len(by_kom)} kommuner")
    # Place names for the postal layer. The map tooltip reads the geojson, but
    # the sidebar, search box and detail page read this file; both sides must
    # use the same set of codes.
    pnr_areas = [{"code": c, "name": names[c], "level": "postnr"}
                 for c in sorted(names)]
    (webdir / "areas_postnr.json").write_text(
        json.dumps(pnr_areas, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"  areas_postnr.json  {len(pnr_areas)} postal codes")
    return (f"\n## Crosswalk\n\n- {len(pn)} postnumre in total, {len(kommuner)} kommuner\n"
            f"- postnumre spanning several kommuner: **{len(multi)}** ({len(multi)/len(pn):.1%})\n"
            f"- So the crosswalk is **only used for the drill-down list on kommune "
            f"pages**, never to aggregate numbers.\n"
            f"  Kommune-level price/volume/days on market all have official tables "
            f"(BM010/BM020/BM030);\n"
            f"  aggregating postal codes yourself leaves a kommune swallowed by its "
            f"neighbours, like Frederiksberg, with 6 sales.\n")
