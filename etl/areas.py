"""The administrative hierarchy: levels, parent links and place names."""

from __future__ import annotations

import json
from pathlib import Path

from .statbank import S20, get


def area_parents(areas: list[dict]) -> dict[str, tuple[str, str]]:
    """kommune -> (landsdel, region).

    The parent links need no extra API call: the OMR20 value list in BM010 is
    already ordered depth-first by hierarchy (region -> its landsdele -> each
    landsdel's kommuner), so the order itself is the tree. areas.json keeps
    that order as is.
    """
    out: dict[str, tuple[str, str]] = {}
    region = landsdel = ""
    for a in areas:
        if a["level"] == "region":
            region = a["code"]
        elif a["level"] == "landsdel":
            landsdel = a["code"]
        elif a["level"] == "kommune":
            out[a["code"]] = (landsdel, region)
    return out


def area_level(code: str) -> str:
    """The OMR20 dimension of BM010/BM020/BM030 mixes four levels; the kommune
    map can only use the kommune one.

    '00'                   country
    2 digits               landsdel (Subregion Copenhagen City and the like)
    3 digits, leading 0    region (081-085)
    other 3 digits         kommune (101 København … 860 Hjørring), 98 of them
    """
    if code == "00":
        return "country"
    if len(code) == 2:
        return "landsdel"
    return "region" if code.startswith("0") else "kommune"


def fetch_areas(outdir: Path) -> None:
    """Area names for OMR20. Fetched with lang=da because lang=en turns
    København into Copenhagen, and PRD §12 requires place names to stay in
    Danish."""
    print("[BM010] area names (lang=da)")
    info = get(f"{S20}tableinfo/BM010?lang=da&format=JSON").json()
    vals = next(v for v in info["variables"] if v["id"] == "OMR20")["values"]
    areas = [{"code": v["id"], "name": v["text"], "level": area_level(v["id"])}
             for v in vals]
    (outdir / "areas.json").write_text(json.dumps(areas, ensure_ascii=False), "utf-8")
    n_kom = sum(a["level"] == "kommune" for a in areas)
    print(f"  {len(areas)} areas, of which {n_kom} kommuner")


def reconcile_names(outdir: Path, webdir: Path) -> None:
    """Place names follow DAWA, overriding DST's spelling.

    In practice the two differ in one place only: DST writes "Århus", DAWA
    writes "Aarhus". The city officially reverted to the Aa spelling in 2011,
    and DAWA is the authoritative register of current administrative
    divisions, so DAWA wins.

    Otherwise the same kommune would show up with two spellings in the UI:
    the map tooltip reads the geojson (DAWA) while the sidebar and detail
    page read areas.json (DST). A Dane would spot it immediately.
    """
    af = outdir / "areas.json"
    if not af.exists():
        return
    areas = json.loads(af.read_text("utf-8"))
    dawa: dict[str, str] = {}
    for name in ("kommuner", "regioner", "landsdele"):
        gf = webdir.parent / "geo" / f"{name}.geojson"
        if not gf.exists():
            continue
        for f in json.loads(gf.read_text("utf-8"))["features"]:
            code = f["properties"].get("code")
            if code:
                dawa[code] = f["properties"]["name"]

    fixed = []
    for a in areas:
        want = dawa.get(a["code"])
        # The landsdel level keeps DST's "Landsdel Xxx" prefix (the UI relies
        # on it to tell levels apart); only kommune spellings are aligned
        if want and a["level"] == "kommune" and want != a["name"]:
            fixed.append((a["name"], want))
            a["name"] = want
    if fixed:
        af.write_text(json.dumps(areas, ensure_ascii=False), "utf-8")
        for old, new in fixed:
            print(f"  place name aligned to DAWA: {old} -> {new}")
