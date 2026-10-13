"""Fun Facts: structural facts computed from the kommune panel."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


def dk(x: float, decimals: int = 0, sign: bool = False) -> str:
    """A number the Danish way: 88.282 and 11,1, not 88,282 and 11.1."""
    s = f"{x:+,.{decimals}f}" if sign else f"{x:,.{decimals}f}"
    return s.replace(",", "\u00a0").replace(".", ",").replace("\u00a0", ".")


def build_facts(outdir: Path, webdir: Path) -> str:
    """Fun Facts. PRD §8: structural facts at area level, all computable from
    the existing data.

    The v0.1 ideas like "highest sale price" and "biggest discount" need
    individual transaction records, which the free data does not have and
    could only come from scraping Boliga, so the PRD moved them out of the
    MVP. What is built here are aggregate-level facts; each one is computed
    straight from the panel with no extra dependency.

    Everything uses reliability = 'ok' units only. Fun Facts are meant to be
    shared, so they must not rest on numbers we do not trust ourselves.
    """
    kom = pd.read_parquet(outdir / "panel_kommune.parquet")
    areas = {a["code"]: a["name"]
             for a in json.loads((outdir / "areas.json").read_text("utf-8"))}
    last = kom["quarter"].max()

    def slab(cat: str, quarter: str = last, ok_only: bool = True) -> pd.DataFrame:
        s = kom[(kom["category"] == cat) & (kom["quarter"] == quarter)
                & (kom["area_level"] == "kommune")]
        if ok_only:
            s = s[s["reliability"] == "ok"]
        return s.assign(name=s["area_code"].map(areas))

    facts: list[dict[str, str]] = []
    facts_da: list[dict[str, str]] = []

    def add(label: str, value: str, da_label: str, da_value: str) -> None:
        """One fact, in English and in Danish. Both are written here, next to
        the numbers, so the two languages can never drift onto different
        figures."""
        facts.append({"label": label, "value": value})
        facts_da.append({"label": da_label, "value": da_value})

    h = slab("house")

    # 1. Most expensive vs cheapest, and the multiple
    if len(h) > 2:
        top = h.loc[h["price_4q"].idxmax()]
        bot = h.loc[h["price_4q"].idxmin()]
        add(f"{top['name']} costs {top.price_4q / bot.price_4q:.0f}× "
            f"what {bot['name']} does",
            f"{top.price_4q:,.0f} vs {bot.price_4q:,.0f} kr/m²",
            f"{top['name']} koster {dk(top.price_4q / bot.price_4q)} gange "
            f"så meget som {bot['name']}",
            f"{dk(top.price_4q)} mod {dk(bot.price_4q)} kr./m²")

    # 2. Fastest / slowest to sell, with the national median as a benchmark
    d = h.dropna(subset=["dom_4q"])
    if len(d) > 2:
        fast = d.loc[d["dom_4q"].idxmin()]
        slow = d.loc[d["dom_4q"].idxmax()]
        add(f"A house sells in {fast.dom_4q:.0f} days in {fast['name']}, "
            f"{slow.dom_4q:.0f} in {slow['name']}",
            f"national median {d['dom_4q'].median():.0f} days",
            f"Et hus sælges på {dk(fast.dom_4q)} dage i {fast['name']}, "
            f"{dk(slow.dom_4q)} i {slow['name']}",
            f"landsmedian {dk(d['dom_4q'].median())} dage")

    # 3. Where asking and realised prices are furthest apart
    g = h.dropna(subset=["discount_pct"])
    if len(g) > 2:
        worst = g.loc[g["discount_pct"].idxmin()]
        add(f"Sellers in {worst['name']} accept the biggest cut below asking",
            f"{worst.discount_pct:.1f}%",
            f"Sælgerne i {worst['name']} giver det største afslag i forhold "
            f"til udbudsprisen",
            f"{dk(worst.discount_pct, 1)} %")

    # 4. Slowest to clear its inventory
    q = h.dropna(subset=["quarters_of_supply"])
    if len(q) > 2:
        stuck = q.loc[q["quarters_of_supply"].idxmax()]
        add(f"At the current pace, {stuck['name']} would take "
            f"{stuck.quarters_of_supply:.1f} quarters to clear its listings",
            f"national median {q['quarters_of_supply'].median():.1f}",
            f"I det nuværende tempo ville det tage "
            f"{dk(stuck.quarters_of_supply, 1)} kvartaler at sælge udbuddet "
            f"i {stuck['name']}",
            f"landsmedian {dk(q['quarters_of_supply'].median(), 1)}")

    # 5. Ten-year real return. Uses the deflated column: half of the nominal
    #    return is inflation, and a "bought ten years ago, sold today" claim
    #    only counts after inflation is taken out.
    ten_ago = f"{int(last[:4]) - 10}Q{last[5]}"
    then = slab("house", ten_ago)[["area_code", "price_4q_real"]]
    if len(then) > 2 and "price_4q_real" in h:
        m = h.merge(then, on="area_code", suffixes=("", "_then"))
        m = m.dropna(subset=["price_4q_real", "price_4q_real_then"])
        m["ret"] = (m["price_4q_real"] / m["price_4q_real_then"] - 1) * 100
        if len(m) > 2:
            best = m.loc[m["ret"].idxmax()]
            wors = m.loc[m["ret"].idxmin()]
            add(f"Bought in {ten_ago.replace('Q', ' Q')} and sold today, "
                f"{best['name']} beat every other kommune",
                f"{best.ret:+.0f}% vs {wors.ret:+.0f}% in {wors['name']}, "
                f"after inflation",
                f"Købt i {ten_ago[5]}. kvt. {ten_ago[:4]} og solgt i dag: "
                f"{best['name']} klarede sig bedst af alle kommuner",
                f"{dk(best.ret, sign=True)} % mod {dk(wors.ret, sign=True)} % "
                f"i {wors['name']}, efter inflation")

    # 6. Flats and houses moving in opposite directions within one kommune
    f = slab("flat")[["area_code", "yoy_pct"]].rename(columns={"yoy_pct": "flat_yoy"})
    both = h.merge(f, on="area_code").dropna(subset=["yoy_pct", "flat_yoy"])
    opp = both[(both["yoy_pct"] * both["flat_yoy"]) < 0]
    if len(opp):
        opp = opp.assign(gap=(opp["yoy_pct"] - opp["flat_yoy"]).abs())
        r = opp.loc[opp["gap"].idxmax()]
        add(f"In {r['name']} houses and flats are moving in opposite directions",
            f"houses {r.yoy_pct:+.1f}%, flats {r.flat_yoy:+.1f}%",
            f"I {r['name']} går huse og ejerlejligheder hver sin vej",
            f"huse {dk(r.yoy_pct, 1, sign=True)} %, "
            f"ejerlejligheder {dk(r.flat_yoy, 1, sign=True)} %")

    # 7. Places still below the 2007 peak. This is the weightiest fact in the
    #    data: after Denmark's 2007 bubble burst, real prices in some kommuner
    #    have still not returned to that level, nineteen years on. In nominal
    #    terms they "recovered" long ago; it only shows once inflation is
    #    taken out.
    if "price_4q_real" in kom:
        peak_win = kom[(kom["area_level"] == "kommune")
                       & (kom["category"] == "house")
                       & (kom["quarter"] >= "2006Q1")
                       & (kom["quarter"] <= "2008Q4")]
        peak = (peak_win.groupby("area_code")["price_4q_real"].max()
                .rename("peak").reset_index())
        now = h[["area_code", "name", "price_4q_real"]].dropna()
        pk = now.merge(peak, on="area_code").dropna()
        pk["vs_peak"] = (pk["price_4q_real"] / pk["peak"] - 1) * 100
        below = pk[pk["vs_peak"] < 0]
        if len(pk) > 10:
            worst = pk.loc[pk["vs_peak"].idxmin()]
            add(f"{len(below)} of {len(pk)} kommuner are still below their "
                f"2006-08 peak once you strip out inflation",
                f"{worst['name']} is the furthest back, {worst.vs_peak:.0f}%",
                f"{len(below)} af {len(pk)} kommuner ligger stadig under "
                f"deres top fra 2006-08, når inflationen trækkes fra",
                f"{worst['name']} er længst tilbage, {dk(worst.vs_peak)} %")

        # The same thing at national level. The weightiest sentence in the
        # whole dataset: nominal prices "recovered" long ago, but after
        # inflation Denmark as a whole is still below 2007.
        nat = kom[(kom["area_code"] == "00") & (kom["category"] == "house")]
        nat_peak = nat[(nat["quarter"] >= "2006Q1")
                       & (nat["quarter"] <= "2008Q4")]["price_4q_real"].max()
        nat_now = nat[nat["quarter"] == last]["price_4q_real"]
        if pd.notna(nat_peak) and len(nat_now) and pd.notna(nat_now.iloc[0]):
            gap = (nat_now.iloc[0] / nat_peak - 1) * 100
            years = int(last[:4]) - 2007
            add(f"Adjusted for inflation, Denmark as a whole has still not got "
                f"back to its 2007 peak — {years} years on",
                f"{nat_now.iloc[0]:,.0f} vs {nat_peak:,.0f} kr/m², {gap:+.0f}%",
                f"Korrigeret for inflation er Danmark som helhed stadig ikke "
                f"tilbage på toppen fra 2007 – {years} år efter",
                f"{dk(nat_now.iloc[0])} mod {dk(nat_peak)} kr./m², "
                f"{dk(gap, sign=True)} %")

    # 8. Places where flats cost more than houses. Intuitively houses should
    #    cost more, but per square metre it flips in dense cities.
    fl = slab("flat")[["area_code", "price_4q"]].rename(
        columns={"price_4q": "flat_price"})
    hf = h.merge(fl, on="area_code").dropna(subset=["price_4q", "flat_price"])
    pricier = hf[hf["flat_price"] > hf["price_4q"]]
    if len(hf) > 10:
        if len(pricier):
            r = pricier.assign(
                gap=(pricier["flat_price"] / pricier["price_4q"] - 1) * 100
            ).nlargest(1, "gap").iloc[0]
            add(f"In {len(pricier)} kommuner a square metre of flat costs more "
                f"than a square metre of house",
                f"{r['name']} tops it at {r.gap:.0f}% more",
                f"I {len(pricier)} kommuner koster en kvadratmeter "
                f"ejerlejlighed mere end en kvadratmeter hus",
                f"{r['name']} ligger øverst med {dk(r.gap)} % mere")

    # 9. Places where holiday homes cost more than year-round houses: the
    #    coastline premium
    ho = slab("holiday")[["area_code", "price_4q"]].rename(
        columns={"price_4q": "hol_price"})
    hh = h.merge(ho, on="area_code").dropna(subset=["price_4q", "hol_price"])
    hh = hh[hh["hol_price"] > hh["price_4q"]]
    if len(hh):
        r = hh.assign(gap=(hh["hol_price"] / hh["price_4q"] - 1) * 100) \
              .nlargest(1, "gap").iloc[0]
        add(f"A holiday home in {r['name']} costs more per square metre than "
            f"a house you can live in year round",
            f"{r.hol_price:,.0f} vs {r.price_4q:,.0f} kr/m²",
            f"Et fritidshus i {r['name']} koster mere pr. kvadratmeter end "
            f"et helårshus",
            f"{dk(r.hol_price)} mod {dk(r.price_4q)} kr./m²")

    # 10. Zealand vs Jutland. The comparison users ask for, computed directly.
    #     Landsdele 01-06 are Zealand and the capital area, 08-11 are Jutland.
    lds = kom[(kom["area_level"] == "landsdel")
              & (kom["category"] == "house")
              & (kom["quarter"] == last)]
    zeal = lds[lds["area_code"].isin(["01", "02", "03", "05", "06"])]
    jut = lds[lds["area_code"].isin(["08", "09", "10", "11"])]
    if len(zeal) and len(jut):
        z = zeal["price_4q"].median()
        j = jut["price_4q"].median()
        if pd.notna(z) and pd.notna(j) and j:
            add("Zealand against Jutland, the oldest divide in Danish housing",
                f"{z:,.0f} vs {j:,.0f} kr/m² — {z / j:.1f}× as much",
                "Sjælland mod Jylland, den ældste skillelinje på det danske "
                "boligmarked",
                f"{dk(z)} mod {dk(j)} kr./m² – {dk(z / j, 1)} gange så meget")

    # 11. The biggest price cliff between neighbouring kommuner.
    #    Adjacency is computed straight from the simplified boundaries:
    #    sharing any vertex counts as adjacent. After precision=0.001 the
    #    points along a shared border are identical, which is reliable enough.
    geo = webdir.parent / "geo" / "kommuner.geojson"
    if geo.exists():
        gj = json.loads(geo.read_text("utf-8"))
        pts: dict[str, set] = {}
        for feat in gj["features"]:
            code = feat["properties"].get("code")
            acc: set = set()

            def walk(c):
                if isinstance(c[0], (int, float)):
                    acc.add((round(c[0], 3), round(c[1], 3)))
                else:
                    for x in c:
                        walk(x)

            walk(feat["geometry"]["coordinates"])
            pts[code] = acc

        price = dict(zip(h["area_code"], h["price_4q"]))
        codes = [c for c in pts if c in price]
        best_pair, best_gap = None, 0.0
        for i, a in enumerate(codes):
            for b in codes[i + 1:]:
                if not (pts[a] & pts[b]):
                    continue
                gap = abs(price[a] - price[b])
                if gap > best_gap:
                    best_gap, best_pair = gap, (a, b)
        if best_pair:
            a, b = best_pair
            hi, lo = (a, b) if price[a] > price[b] else (b, a)
            add(f"Cross the line from {areas.get(lo)} into {areas.get(hi)} "
                f"and the price per square metre jumps",
                f"{price[lo]:,.0f} → {price[hi]:,.0f} kr/m²",
                f"Kryds grænsen fra {areas.get(lo)} til {areas.get(hi)}, og "
                f"kvadratmeterprisen springer",
                f"{dk(price[lo])} → {dk(price[hi])} kr./m²")

    payload = {"quarter": last, "facts": facts, "facts_da": facts_da}
    dst = webdir / "facts.json"
    dst.write_text(json.dumps(payload, ensure_ascii=False,
                              separators=(",", ":")), "utf-8")
    print(f"  facts.json  {len(facts)} facts")
    return (f"\n## Fun Facts\n\n- {len(facts)} facts, all from reliability=ok units only\n"
            + "".join(f"  - {f['label']} — {f['value']}\n" for f in facts))
