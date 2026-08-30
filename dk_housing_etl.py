#!/usr/bin/env python3
"""
Danish housing ETL  (v2, 已按 2026-08-29 实测数据修正)
=====================================================

在**你自己的 Windows 终端**里跑，不要在 Cowork 的沙箱里跑。
Cowork 的两个 shell（云容器和桌面 VM）都有出站白名单，够不到 api.statbank.dk。
你本机的 Python 有正常网络。

    pip install requests pandas pyarrow
    python dk_housing_etl.py

数据源（已实测确认，免 key）：
    Finans Danmark Boligmarkedsstatistik   https://api.statbank.dk/v1/s20/
    Danmarks Statistik                     https://api.statbank.dk/v1/
    URL:  {base}data/{TABLE}/BULK?lang=en&valuePresentation=Code&DIM=*&...

实测结论，代码里已经按这些事实处理：

  BM011  postnummer 价格 kr/m2   1992Q1-2026Q1  605 邮编
         独栋/联排 最近5年 74% 有数，283 个邮编有完整 20 季度序列
         公寓 592 个邮编里 422 个**从来没有数据**，只有城市有意义
         整表 63% 的格子是 '..'

  BM031  postnummer 挂牌天数     2004Q1-2026Q1
         >>> 陷阱：28% 的"有效值"是 0。房子不可能 0 天卖掉。
         >>> 0 = 当季无成交，是伪装成数据的缺失。必须当缺失处理。
         >>> 修正后独栋真实覆盖率约 71%，不是 99%
         真实分布（独栋）: p10=81 天, 中位 150 天, p90=288 天

  BM021  postnummer 成交量 + 期末在售  2004Q1-2026Q1
         SALG 和 ULTIMO 都是 99.7% 覆盖，几乎无缺失
         >>> 这是样本量门槛的分母，PRD §12 需要的就是它
         >>> 2026Q1 独栋：邮编中位数只有 10 笔成交，599 个里 295 个不足 10 笔
         >>> 所以单季度门槛会砍掉一半地图，必须用滚动 4 季度

  BM010  kommune 级价格  115 个区域，独栋 99.4% 覆盖，113/115 有完整序列
         >>> 修正：kommune 级价格是**免费**的（DST 那边才要付费）
         >>> 整表只有 1.1 MB

  BM020 / BM030  kommune 级成交量 / 挂牌天数（v3 新增）
         >>> BM011/BM021/BM031 有 kommune 级的孪生表 BM010/BM020/BM030，维度完全一致。
         >>> 没有它们的话，PRD 默认的 kommune 地图既没有样本量分级也没有挂牌天数，
         >>> 只能拿邮编成交量按 crosswalk 硬凑。而 22.6% 的邮编跨多个 kommune，
         >>> 用"第一个 kommune"分配会让 Frederiksberg 只剩 6 笔成交、7 个 kommune 挂零。
         >>> 官方直接给 kommune 级的数，就不要自己凑。crosswalk 只用来做下钻列表。
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import time
from pathlib import Path

import requests

try:
    import pandas as pd
except ImportError:
    sys.exit("pip install requests pandas pyarrow")

S20 = "https://api.statbank.dk/v1/s20/"
DST = "https://api.statbank.dk/v1/"
DAWA = "https://api.dataforsyningen.dk/"

SUPPRESSED = {"..", ".", "", "-", "M", "U"}

# 表 -> (base, 维度顺序, 值列含义)
SPECS = {
    "BM011": (S20, ["PNR20", "EJKAT20", "PRIS20", "Tid"], "price_m2"),
    "BM021": (S20, ["PNR20", "EJKAT20", "BEV20", "Tid"], "count"),
    "BM031": (S20, ["PNR20", "EJKAT20", "Tid"], "days_on_market"),
    "BM010": (S20, ["OMR20", "EJKAT20", "PRIS20", "Tid"], "price_m2"),
    "BM020": (S20, ["OMR20", "EJKAT20", "BEV20", "Tid"], "count"),
    "BM030": (S20, ["OMR20", "EJKAT20", "Tid"], "days_on_market"),
}

# 挂牌天数表里的 0 是"当季无成交"，postnummer 和 kommune 两级都一样
DOM_TABLES = {"BM031", "BM030"}

CAT = {"1": "house", "2": "flat", "3": "holiday"}
PRIS = {"UDBUD": "list_initial", "NEDTAG": "list_final", "REAL": "realised"}
BEV = {"SALG": "sold", "ULTIMO": "for_sale_eop"}

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
            print(f"  重试 {i+1}: {e}", file=sys.stderr)
            time.sleep(2 ** i)
    raise RuntimeError(url)


def fetch(table: str) -> pd.DataFrame:
    base, dims, valname = SPECS[table]
    q = "&".join(f"{d}=*" for d in dims)
    url = f"{base}data/{table}/BULK?lang=en&valuePresentation=Code&{q}"
    print(f"[{table}] {url}")
    txt = get(url).text
    df = pd.read_csv(io.StringIO(txt), sep=";", dtype=str, keep_default_na=False)
    df.columns = [c.strip().upper() for c in df.columns]
    for c in df.columns:
        df[c] = df[c].str.strip()

    raw = df.pop("INDHOLD")
    df[valname] = pd.to_numeric(raw.where(~raw.isin(SUPPRESSED)), errors="coerce")

    # ---- 关键修正：挂牌天数表里的 0 是伪装的缺失，不是"0 天卖掉" ----
    if table in DOM_TABLES:
        n_zero = int((df[valname] == 0).sum())
        df.loc[df[valname] == 0, valname] = pd.NA
        print(f"  {table}: 把 {n_zero:,} 个 0 值当作缺失处理（当季无成交）")

    df["quarter"] = df["TID"].str.replace("K", "Q", regex=False)
    df = df.drop(columns=["TID"])
    df["category"] = df["EJKAT20"].map(CAT)
    df = df.drop(columns=["EJKAT20"])
    if "PRIS20" in df:
        df["price_type"] = df.pop("PRIS20").map(PRIS)
    if "BEV20" in df:
        df["measure"] = df.pop("BEV20").map(BEV)
    df = df.rename(columns={"PNR20": "postnr", "OMR20": "area_code"})
    print(f"  {len(df):,} 行，{df[valname].notna().mean():.1%} 有效")
    return df


def fetch_cpi() -> pd.DataFrame:
    """消费者价格指数，用来把名义价格换算成实际价格。

    PRIS113：1980M01 起的月度 CPI，单一序列，正好盖住房价数据的 1992-2026。
    月度取季度平均，因为房价本来就是季度的。

    为什么必须做：时间轴一路拉到 1992 年，那时候全国房价 4,121 kr/m²，
    今天 13,672。不平减的话看着像涨了 232%，但其中一大半只是钱变毛了。
    """
    url = (f"{DST}data/PRIS113/BULK?lang=en&valuePresentation=Code"
           f"&TYPE=*&Tid=*")
    print(f"[PRIS113] {url}")
    df = pd.read_csv(io.StringIO(get(url).text), sep=";", dtype=str,
                     keep_default_na=False)
    df.columns = [c.strip().upper() for c in df.columns]
    df["cpi"] = pd.to_numeric(
        df["INDHOLD"].str.strip().where(~df["INDHOLD"].str.strip().isin(SUPPRESSED)),
        errors="coerce")
    t = df["TID"].str.strip()
    df["quarter"] = (t.str[:4] + "Q"
                     + ((pd.to_numeric(t.str[5:7]) - 1) // 3 + 1).astype(str))
    q = (df.dropna(subset=["cpi"]).groupby("quarter", as_index=False)["cpi"]
         .mean().sort_values("quarter"))
    print(f"  {len(q)} 个季度，{q['quarter'].iloc[0]} - {q['quarter'].iloc[-1]}")
    return q


def add_real_prices(p: pd.DataFrame, cpi: pd.DataFrame, unit: str) -> pd.DataFrame:
    """加上以最新季度克朗计价的实际价格，以及实际同比。

    平减基准取面板里最新的那个季度，所以 price_4q_real 读作
    "换算成今天的钱是多少"，不需要读者自己换算基期。
    """
    base_q = p["quarter"].max()

    # CPI 通常比房价数据晚一个季度发布（现在房价到 2026Q1，CPI 到 2025Q4）。
    # 缺的那一两个季度用最后一个已知值前推 —— 少算一个季度的通胀，
    # 幅度在 0.5% 上下，比整个功能不做要好得多。前推了要说出来。
    quarters = sorted(p["quarter"].unique())
    cpi_last = cpi["quarter"].max()
    n_ffill = sum(1 for q in quarters if q > cpi_last)
    cpi = (cpi.set_index("quarter").reindex(quarters).ffill()
           .rename_axis("quarter").reset_index())
    if n_ffill:
        print(f"  CPI 只到 {cpi_last}，最后 {n_ffill} 个季度按最后一个已知值前推")

    base = cpi.loc[cpi["quarter"] == base_q, "cpi"]
    base = float(base.iloc[0]) if len(base) and pd.notna(base.iloc[0]) else None
    if not base:
        print("  CPI 完全没盖住面板区间，跳过实际价格")
        return p

    p = p.merge(cpi, on="quarter", how="left")
    p["price_4q_real"] = p["price_4q"] * base / p["cpi"]
    g = p.groupby([unit, "category"], sort=False)
    p["yoy_real_pct"] = g["price_4q_real"].transform(lambda s: s.pct_change(4) * 100)
    print(f"  实际价格基准 = {base_q}（CPI {base:.1f}）")
    return p


# DST 的 landsdel 名字和 DAWA 的对不上一个：DST 叫 "Landsdel København by"，
# DAWA 叫 "Byen København"。其余十个去掉 "Landsdel " 前缀就一样。
# 按 NUTS3 编号对齐更危险 —— DST 的 09/10 是 Østjylland/Vestjylland，
# DAWA 的 DK041/DK042 顺序正好相反。所以按名字对，并把这一个特例写死。
LANDSDEL_ALIAS = {"københavn by": "byen københavn"}


def _norm(s: str) -> str:
    return s.replace("Landsdel ", "").strip().lower()


def fetch_monthly_panel(outdir: Path) -> pd.DataFrame:
    """kommune 级月度面板。UDB010/020/030，2004M01 起，跑到 2026M07。

    这是"季度是不是最小颗粒度"的答案：**成交价是**，但挂牌侧不是。
    在售套数、要价、已挂天数三样都有月度，而且比季度成交数据新四个月。
    所以地图给一个频率开关，月度模式下只放这三个指标 ——
    不是把季度数据插值成月度，是换一批本来就是月度的指标。
    """
    specs = [
        ("UDB010", "BOLA20", {"6": "for_sale", "7": "withdrawn"}),
        ("UDB020", "BOLB20", {"4": "asking_price_m2", "5": "withdrawn_price_m2"}),
        ("UDB030", "BOLC20", {"8": "days_listed", "9": "days_withdrawn"}),
    ]
    frames = []
    for table, dim, names in specs:
        url = (f"{S20}data/{table}/BULK?lang=en&valuePresentation=Code"
               f"&OMR20=*&EJKAT20=*&{dim}=*&Tid=*")
        print(f"[{table}] kommune 级月度")
        df = pd.read_csv(io.StringIO(get(url).text), sep=";", dtype=str,
                         keep_default_na=False)
        df.columns = [c.strip().upper() for c in df.columns]
        for c in df.columns:
            df[c] = df[c].str.strip()
        df["v"] = pd.to_numeric(
            df["INDHOLD"].where(~df["INDHOLD"].isin(SUPPRESSED)), errors="coerce")
        # 挂牌天数表里的 0 同样是"当月无此事件"，不是 0 天
        if table == "UDB030":
            df.loc[df["v"] == 0, "v"] = pd.NA
        df["measure"] = df[dim].map(names)
        df = df.dropna(subset=["measure"])
        frames.append(df[["OMR20", "EJKAT20", "TID", "measure", "v"]])
        print(f"  {len(df):,} 行")

    m = pd.concat(frames, ignore_index=True)
    m["category"] = m["EJKAT20"].map(CAT)
    m = m.rename(columns={"OMR20": "area_code", "TID": "month"})
    wide = (m.pivot_table(index=["area_code", "category", "month"],
                          columns="measure", values="v")
            .reset_index())
    wide.columns.name = None
    wide["area_level"] = wide["area_code"].map(area_level)
    wide = wide.sort_values(["area_code", "category", "month"])

    # 同比：月度数据季节性很强（春天挂牌多），环比没法看，只能比去年同月
    g = wide.groupby(["area_code", "category"], sort=False)
    for col in ("for_sale", "asking_price_m2", "days_listed"):
        if col in wide:
            wide[f"{col}_yoy"] = g[col].transform(
                lambda s: s.pct_change(12) * 100)

    for c in wide.columns:
        if pd.api.types.is_float_dtype(wide[c]):
            wide[c] = wide[c].astype("float32")
    wide.to_parquet(outdir / "panel_monthly.parquet", index=False)
    print(f"  -> panel_monthly.parquet  {len(wide):,} 行，"
          f"{wide['month'].min()} - {wide['month'].max()}")
    return wide


def fetch_monthly(webdir: Path) -> str:
    """全国月度温度条。PRD §6.3。

    UDB010/020/030 都是月度的，而且跑到 2026M07 —— 比季度的成交数据
    新四个月。三张表给的都是**挂牌侧**的量（在售套数、要价、已挂天数），
    不是成交价。这正是它有用的地方：要价和库存先动，成交价后动。

    刻意不做的事：不把月度要价冒充成月度成交价。免费数据里没有后者，
    PRD 也说清楚了不许假装有。
    """
    print("[UDB010/020/030] 全国月度")
    out: dict[str, dict[str, float]] = {}
    specs = [
        ("UDB010", "BOLA20", {"6": "for_sale", "7": "withdrawn"}),
        ("UDB020", "BOLB20", {"4": "asking_price", "5": "withdrawn_price"}),
        ("UDB030", "BOLC20", {"8": "days_listed", "9": "days_withdrawn"}),
    ]
    for table, dim, names in specs:
        url = (f"{S20}data/{table}/BULK?lang=en&valuePresentation=Code"
               f"&OMR20=00&EJKAT20=1&{dim}=*&Tid=*")
        df = pd.read_csv(io.StringIO(get(url).text), sep=";", dtype=str,
                         keep_default_na=False)
        df.columns = [c.strip().upper() for c in df.columns]
        for c in df.columns:
            df[c] = df[c].str.strip()
        df["v"] = pd.to_numeric(df["INDHOLD"].where(~df["INDHOLD"].isin(SUPPRESSED)),
                                errors="coerce")
        for code, name in names.items():
            sub = df[(df[dim] == code) & df["v"].notna()]
            for m, v in zip(sub["TID"], sub["v"]):
                out.setdefault(m, {})[name] = round(float(v), 1)

    months = sorted(out)
    payload = {"latest": months[-1] if months else None,
               "months": months,
               "series": out}
    dst = webdir / "monthly.json"
    dst.write_text(json.dumps(payload, separators=(",", ":")), "utf-8")
    print(f"  monthly.json  {dst.stat().st_size/1024:.0f} KB  "
          f"{months[0]} - {months[-1]}")
    return (f"\n## 月度指标（全国，独栋）\n\n"
            f"- UDB010/020/030，{months[0]} - **{months[-1]}**\n"
            f"- 比季度成交数据新四个月，但只有挂牌侧的量，没有成交价\n")


def build_panel(outdir: Path, level: str, cpi: pd.DataFrame) -> pd.DataFrame:
    """把三张表拼成一张面板，并算好样本量和滚动指标。

    level="postnr"   BM011/BM021/BM031，605 个邮编
    level="kommune"  BM010/BM020/BM030，115 个区域（全国 + 地区 + 98 个 kommune）

    两级的维度结构完全一致，所以走同一段代码。
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

    # ---- 样本量：滚动 4 季度成交笔数。单季度中位数只有 10，太薄 ----
    g = p.groupby([unit, "category"], sort=False)
    p["n_sold_4q"] = g["n_sold"].transform(lambda s: s.rolling(4, min_periods=4).sum())
    # 价格也用滚动 4 季度均值，吸收样本抖动
    p["price_4q"] = g["price_m2_realised"].transform(
        lambda s: s.rolling(4, min_periods=3).mean())
    p["yoy_pct"] = g["price_4q"].transform(lambda s: s.pct_change(4) * 100)
    p["yoy_prev"] = g["yoy_pct"].transform(lambda s: s.shift(4))
    p["accel_pp"] = p["yoy_pct"] - p["yoy_prev"]
    # 挂牌天数同样滚动 4 季度。剔除伪 0 之后单季度太稀，直接点对点比会跳。
    # Heating up / Stalling 两个榜单用的是 dom_yoy_days，负数=卖得更快了
    p["dom_4q"] = g["days_on_market"].transform(
        lambda s: s.rolling(4, min_periods=2).mean())
    p["dom_yoy_days"] = p["dom_4q"] - g["dom_4q"].transform(lambda s: s.shift(4))
    # 去化季数：期末在售 / 当季成交
    p["quarters_of_supply"] = p["n_for_sale"] / p["n_sold"].replace(0, pd.NA)

    # ---- 可信度分级。地图和排行榜直接读这一列 ----
    #
    # 四档，不是三档。PRD §5 写的是三档，但那是在只看最新季度的前提下写的。
    # 价格从 1992 年就有，成交量（BM020/BM021）2004 年才开始。
    # 拿三档去套 1992-2003，那十二年会整片变灰 —— 而那等于在说
    # "我们知道那里成交太少"，可我们并不知道，我们只是没有那个数。
    # 所以多一档 unverified：官方价格有，样本量无从查证。
    # 它照常上色（有官方发布的价格），但和 low 一样不上排行榜。
    p["reliability"] = pd.cut(
        p["n_sold_4q"], [-1, 9, 39, float("inf")],
        labels=["insufficient", "low", "ok"]).astype(str)
    # 有价格但那个年代根本没发布成交量
    p.loc[p["n_sold_4q"].isna(), "reliability"] = "unverified"
    # 连价格都没有，那就是真的什么都不能画
    p.loc[p["price_4q"].isna(), "reliability"] = "insufficient"

    p = add_real_prices(p, cpi, unit)

    if level == "kommune":
        p["area_level"] = p["area_code"].map(area_level)

    p = p.reset_index(drop=True)
    p.to_parquet(outdir / f"panel_{level}.parquet", index=False)
    print(f"  -> panel_{level}.parquet  {len(p):,} 行")
    return p


def area_level(code: str) -> str:
    """BM010/BM020/BM030 的 OMR20 里混了四个层级，画地图只能用 kommune 那一层。

    '00'            全国
    2 位            landsdel（Subregion Copenhagen City 之类）
    3 位以 0 开头   region（081-085）
    3 位其它        kommune（101 København … 860 Hjørring），98 个
    """
    if code == "00":
        return "country"
    if len(code) == 2:
        return "landsdel"
    return "region" if code.startswith("0") else "kommune"


def coverage_report(p: pd.DataFrame, level: str) -> str:
    """地图能涂满多少，就是这张表。ok/low 能上色，insufficient 一律中性灰。"""
    unit, noun = {"postnr": ("postnr", "邮编"),
                  "kommune": ("area_code", "kommune")}[level]
    if level == "kommune":
        p = p[p["area_level"] == "kommune"]
    last = p["quarter"].max()
    title = {"postnr": "postnummer 级（下钻层）",
             "kommune": "kommune 级（**地图默认层**）"}[level]

    lines = [f"## {title}", "",
             f"最新季度 **{last}**，面板 {len(p):,} 行。", "",
             f"| {noun} | 有数据 | ok (>=40) | low (10-39) | insufficient | 可上色 |",
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
            detail += [f"- **{cat}**（{ok_n} 个 ok 单元）："
                       f"YoY 中位数 {ok['yoy_pct'].median():.1f}%，"
                       f"挂牌天数中位数 {ok['dom_4q'].median():.0f} 天，"
                       f"去化 {ok['quarters_of_supply'].median():.1f} 季度"]
    return "\n".join(lines + [""] + detail + [""])


def fetch_areas(outdir: Path) -> None:
    """OMR20 的区域名。用 lang=da 拿，因为 lang=en 会把 København 写成 Copenhagen，
    而 PRD §12 要求地名保留丹麦语原文。"""
    print("[BM010] 区域名（lang=da）")
    info = get(f"{S20}tableinfo/BM010?lang=da&format=JSON").json()
    vals = next(v for v in info["variables"] if v["id"] == "OMR20")["values"]
    areas = [{"code": v["id"], "name": v["text"], "level": area_level(v["id"])}
             for v in vals]
    (outdir / "areas.json").write_text(json.dumps(areas, ensure_ascii=False), "utf-8")
    n_kom = sum(a["level"] == "kommune" for a in areas)
    print(f"  {len(areas)} 个区域，其中 kommune {n_kom} 个")


def fetch_geo(outdir: Path) -> str:
    print("[DAWA] postnummer -> kommune")
    pn = get(f"{DAWA}postnumre?format=json").json()
    (outdir / "postnumre.json").write_text(json.dumps(pn, ensure_ascii=False), "utf-8")
    kom = get(f"{DAWA}kommuner?format=json").json()
    (outdir / "kommuner.json").write_text(json.dumps(
        [{"kode": k["kode"], "navn": k["navn"],
          "regionskode": k.get("regionskode"),
          "regionsnavn": (k.get("region") or {}).get("navn")} for k in kom],
        ensure_ascii=False), "utf-8")
    multi = [p for p in pn if len(p.get("kommuner", [])) > 1]

    # kommune -> 它境内的邮编号。给详情卡片和以后的下钻用。
    # 一个跨界的邮编会出现在它涉及的每一个 kommune 下面 —— 这是**展示**用的
    # 归属，不是加总用的权重，重复出现是对的。
    by_kom: dict[str, list[str]] = {}
    for x in pn:
        for k in x.get("kommuner") or []:
            code = k["kode"].lstrip("0") or "0"
            by_kom.setdefault(code, []).append(x["nr"])
    for code in by_kom:
        by_kom[code] = sorted(set(by_kom[code]))
    web = Path("public/data")
    web.mkdir(parents=True, exist_ok=True)
    (web / "postnr_by_kommune.json").write_text(
        json.dumps(by_kom, separators=(",", ":")), "utf-8")
    print(f"  postnr_by_kommune.json  {len(by_kom)} 个 kommune")
    # ---- region / landsdel 的边界和 DST 编码的对应 ----
    # 用户想按"西兰岛 vs 日德兰岛"看的时候，看的其实是 landsdel 这一层：
    # 01-06 是西兰岛和首都圈，07 是菲英岛，08-11 是日德兰半岛，04 是博恩霍尔姆。
    # BM010/020/030 本来就带这两层的行，缺的只是几何。
    print("[DAWA] region / landsdel")
    reg = get(f"{DAWA}regioner?format=geojson").json()
    for f in reg["features"]:
        # DAWA 的 region kode 是 '1084'，DST 的 OMR20 是 '084'
        f["properties"] = {"code": f["properties"]["kode"][1:],
                           "name": f["properties"]["navn"]}
    (outdir / "regioner.geojson").write_text(json.dumps(reg, ensure_ascii=False),
                                             "utf-8")

    lds = get(f"{DAWA}landsdele?format=geojson").json()
    dst_lds = {_norm(a["name"]): a["code"]
               for a in json.loads((outdir / "areas.json").read_text("utf-8"))
               if a["level"] == "landsdel"}
    missed = []
    for f in lds["features"]:
        navn = f["properties"]["navn"]
        key = _norm(navn)
        code = dst_lds.get(key) or dst_lds.get(
            next((k for k, v in LANDSDEL_ALIAS.items() if v == key), ""))
        if not code:
            missed.append(navn)
        f["properties"] = {"code": code or "", "name": navn}
    if missed:
        print(f"  !! 没对上 DST 编码的 landsdel: {missed}")
    else:
        print(f"  {len(lds['features'])} 个 landsdel 全部对上 DST 编码")
    (outdir / "landsdele.geojson").write_text(json.dumps(lds, ensure_ascii=False),
                                              "utf-8")

    print("[DAWA] geojson")
    for name, path in (("kommuner", "kommuner"), ("postnumre", "postnumre")):
        f = outdir / f"{name}.geojson"
        if f.exists() and f.stat().st_size > 1_000_000:
            print(f"  {name}.geojson 已存在（{f.stat().st_size/1e6:.0f} MB），跳过下载")
            continue
        gj = get(f"{DAWA}{path}?format=geojson").text
        f.write_text(gj, "utf-8")
        print(f"  {name}.geojson  {len(gj)/1e6:.1f} MB（用 npm run simplify 简化）")
    return (f"\n## Crosswalk\n\n- postnummer 总数 {len(pn)}，kommune {len(kom)} 个\n"
            f"- 跨多个 kommune 的 postnummer: **{len(multi)}**（{len(multi)/len(pn):.1%}）\n"
            f"- 所以 crosswalk **只用来做 kommune 页的下钻列表**，不用来聚合数字。\n"
            f"  kommune 级的价格/成交量/挂牌天数都有官方表（BM010/BM020/BM030），\n"
            f"  自己按邮编聚合会把 Frederiksberg 这种被邻居吃掉的 kommune 算成 6 笔成交。\n")


def build_facts(outdir: Path, webdir: Path) -> str:
    """Fun Facts。PRD §8：区域层面的结构性事实，全部由现有数据算得出来。

    v0.1 里那些"最高成交价""最大成交折价"需要单套成交记录，免费数据里没有，
    只能靠抓 Boliga —— PRD 把它们移出 MVP 了。这里做的是聚合层面的事实，
    每一条都能从面板直接算，不需要任何额外依赖。

    全部只取 reliability = 'ok' 的单元。Fun Fact 是要被人转发的，
    更不能建在我们自己都不信的数字上。
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

    def add(label: str, value: str) -> None:
        facts.append({"label": label, "value": value})

    h = slab("house")

    # 1. 最贵 vs 最便宜，以及倍数
    if len(h) > 2:
        top = h.loc[h["price_4q"].idxmax()]
        bot = h.loc[h["price_4q"].idxmin()]
        add(f"{top['name']} costs {top.price_4q / bot.price_4q:.0f}× "
            f"what {bot['name']} does",
            f"{top.price_4q:,.0f} vs {bot.price_4q:,.0f} kr/m²")

    # 2. 卖得最快 / 最慢，附全国中位数做基准
    d = h.dropna(subset=["dom_4q"])
    if len(d) > 2:
        fast = d.loc[d["dom_4q"].idxmin()]
        slow = d.loc[d["dom_4q"].idxmax()]
        add(f"A house sells in {fast.dom_4q:.0f} days in {fast['name']}, "
            f"{slow.dom_4q:.0f} in {slow['name']}",
            f"national median {d['dom_4q'].median():.0f} days")

    # 3. 要价和成交价差得最狠的地方
    g = h.dropna(subset=["discount_pct"])
    if len(g) > 2:
        worst = g.loc[g["discount_pct"].idxmin()]
        add(f"Sellers in {worst['name']} accept the biggest cut below asking",
            f"{worst.discount_pct:.1f}%")

    # 4. 库存去化最慢
    q = h.dropna(subset=["quarters_of_supply"])
    if len(q) > 2:
        stuck = q.loc[q["quarters_of_supply"].idxmax()]
        add(f"At the current pace, {stuck['name']} would take "
            f"{stuck.quarters_of_supply:.1f} quarters to clear its listings",
            f"national median {q['quarters_of_supply'].median():.1f}")

    # 5. 十年实际回报。用平减过的列 —— 名义回报里有一半是通胀，
    #    "十年前买入今天卖出"这种说法必须扣掉通胀才算数。
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
                f"after inflation")

    # 6. 同一个 kommune 里公寓和独栋走反方向
    f = slab("flat")[["area_code", "yoy_pct"]].rename(columns={"yoy_pct": "flat_yoy"})
    both = h.merge(f, on="area_code").dropna(subset=["yoy_pct", "flat_yoy"])
    opp = both[(both["yoy_pct"] * both["flat_yoy"]) < 0]
    if len(opp):
        opp = opp.assign(gap=(opp["yoy_pct"] - opp["flat_yoy"]).abs())
        r = opp.loc[opp["gap"].idxmax()]
        add(f"In {r['name']} houses and flats are moving in opposite directions",
            f"houses {r.yoy_pct:+.1f}%, flats {r.flat_yoy:+.1f}%")

    # 7. 还没回到 2007 年顶点的地方。这是这份数据里最有分量的一条：
    #    丹麦 2007 年那轮泡沫破了之后，有些 kommune 的实际房价到今天
    #    还没回到当年的水平 —— 十九年。名义上早就"涨回来了"，
    #    扣掉通胀才看得见。
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
                f"{worst['name']} is the furthest back, {worst.vs_peak:.0f}%")

        # 全国口径的同一件事。这是整份数据里最有分量的一句：
        # 名义房价早就"涨回来了"，扣掉通胀，全丹麦到今天还没回到 2007 年。
        nat = kom[(kom["area_code"] == "00") & (kom["category"] == "house")]
        nat_peak = nat[(nat["quarter"] >= "2006Q1")
                       & (nat["quarter"] <= "2008Q4")]["price_4q_real"].max()
        nat_now = nat[nat["quarter"] == last]["price_4q_real"]
        if pd.notna(nat_peak) and len(nat_now) and pd.notna(nat_now.iloc[0]):
            gap = (nat_now.iloc[0] / nat_peak - 1) * 100
            years = int(last[:4]) - 2007
            add(f"Adjusted for inflation, Denmark as a whole has still not got "
                f"back to its 2007 peak — {years} years on",
                f"{nat_now.iloc[0]:,.0f} vs {nat_peak:,.0f} kr/m², {gap:+.0f}%")

    # 8. 公寓比独栋还贵的地方。直觉上房子应该比公寓贵，
    #    但在密度高的城市里每平米反过来。
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
                f"{r['name']} tops it at {r.gap:.0f}% more")

    # 9. 度假屋比住人的房子还贵的地方 —— 海岸线的溢价
    ho = slab("holiday")[["area_code", "price_4q"]].rename(
        columns={"price_4q": "hol_price"})
    hh = h.merge(ho, on="area_code").dropna(subset=["price_4q", "hol_price"])
    hh = hh[hh["hol_price"] > hh["price_4q"]]
    if len(hh):
        r = hh.assign(gap=(hh["hol_price"] / hh["price_4q"] - 1) * 100) \
              .nlargest(1, "gap").iloc[0]
        add(f"A holiday home in {r['name']} costs more per square metre than "
            f"a house you can live in year round",
            f"{r.hol_price:,.0f} vs {r.price_4q:,.0f} kr/m²")

    # 10. 西兰岛 vs 日德兰半岛。用户想看的那个对比，直接算出来。
    #     landsdel 01-06 是西兰岛和首都圈，08-11 是日德兰。
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
                f"{z:,.0f} vs {j:,.0f} kr/m² — {z / j:.1f}× as much")

    # 11. 相邻 kommune 之间最大的价格断层。
    #    邻接关系直接从简化后的边界算：共享任何一个顶点就算相邻。
    #    precision=0.001 之后同一条边界线上的点是完全一致的，够可靠。
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
                f"{price[lo]:,.0f} → {price[hi]:,.0f} kr/m²")

    payload = {"quarter": last, "facts": facts}
    dst = webdir / "facts.json"
    dst.write_text(json.dumps(payload, ensure_ascii=False,
                              separators=(",", ":")), "utf-8")
    print(f"  facts.json  {len(facts)} 条")
    return (f"\n## Fun Facts\n\n- {len(facts)} 条，全部只用 reliability=ok 的单元\n"
            + "".join(f"  - {f['label']} — {f['value']}\n" for f in facts))


def _write_version(webdir: Path, quarter: str) -> None:
    """按 Parquet 内容算一个短哈希，前端请求时带 ?v=。

    数据是季度更新的，Parquet 值得长缓存；但如果 URL 不变，
    浏览器会拿着上一季的 Parquet 配这一季的 snapshot.json，
    地图和时间轴讲的就不是同一个故事了。URL 带上内容哈希就没这问题。
    """
    h = hashlib.sha1()
    for level in ("kommune", "monthly"):
        h.update((webdir / f"panel_{level}.parquet").read_bytes())
    version = h.hexdigest()[:12]
    (webdir / "version.json").write_text(
        json.dumps({"version": version, "quarter": quarter}), "utf-8")
    print(f"  web: version.json  {version}")


def export_web(outdir: Path, webdir: Path) -> str:
    """整包数据要进浏览器，所以 web 副本用 float32 + zstd 再压一道。

    kr/m2 和百分比都不需要 float64 的精度，float32 有 7 位有效数字，
    价格最大也就 9 万出头。行数不变，语义不变，只是小一半。
    """
    webdir.mkdir(parents=True, exist_ok=True)
    lines = ["\n## 浏览器要下载的东西\n", "| 文件 | 大小 | gzip 后 |", "|---|---|---|"]
    # postnr 冻结：仍然在 data/ 下产出、仍然进 REPORT.md 的覆盖率表，
    # 但不发给浏览器 —— 界面上没有任何地方查它，4.1 MB 白占空间。
    # 解冻见 lib/queries.ts 的 postnrIn()。
    for level in ("kommune", "monthly"):
        df = pd.read_parquet(outdir / f"panel_{level}.parquet")
        for c in df.columns:
            if pd.api.types.is_float_dtype(df[c]):
                df[c] = df[c].astype("float32")
        for c in ("category", "reliability", "area_level"):
            if c in df:
                df[c] = df[c].astype("category")
        dst = webdir / f"panel_{level}.parquet"
        df.to_parquet(dst, index=False, compression="zstd", row_group_size=20000)
        raw = dst.stat().st_size
        lines.append(f"| panel_{level}.parquet | {raw/1e6:.2f} MB | ~{raw/1e6/3:.2f} MB |")
        print(f"  web: panel_{level}.parquet  {raw/1e6:.2f} MB")
    for name in ("areas.json",):
        (webdir / name).write_bytes((outdir / name).read_bytes())

    # ---- 数据版本号 ----
    # Parquet 缓存一小时的话，季度更新之后浏览器会拿着旧文件配新的 snapshot，
    # 两边对不上。所以按内容算一个短哈希，前端请求时带上 ?v=，
    # 内容变了 URL 就变，缓存自然失效。
    # ---- 首屏快照 ----
    # DuckDB WASM 本体 gzip 后 7 MB，比它要查的数据还大 5 倍。地图不能等它。
    # 所以把最新季度的 kommune 切片单独出一个几十 KB 的 JSON，首屏直接涂色，
    # DuckDB 在后台加载，加载完时间轴和排行榜才需要它。
    kom = pd.read_parquet(outdir / "panel_kommune.parquet")
    last = kom["quarter"].max()
    cols = ["area_code", "category", "price_4q", "yoy_pct", "accel_pp", "dom_4q",
            "dom_yoy_days", "n_sold", "n_sold_4q", "n_for_sale",
            "quarters_of_supply", "discount_pct", "reliability",
            "price_4q_real", "yoy_real_pct"]
    snap = kom[(kom["quarter"] == last) & (kom["area_level"] == "kommune")][cols]
    # 先 round 再转 object 才能把 NaN 换成 None。直接 where 会被 float 列吃回去，
    # 写出来就是裸的 NaN，那不是合法 JSON，浏览器 JSON.parse 直接抛。
    snap = snap.round(2).astype(object)
    snap = snap.where(pd.notna(snap), None)
    # ---- 配色的固定值域 ----
    # 每个季度重新算 min/max 的话，拖时间轴就只能看到"排名"变化，
    # 看不到整体变热还是变冷 —— 2009 年崩盘和 2021 年狂热会长得一模一样。
    # 所以值域一次算死，用 2004 年以后所有季度、样本量够的单元的 2/98 分位。
    dom_src = kom[(kom["area_level"] == "kommune")
                  & (kom["reliability"].isin(["ok", "low"]))
                  & (kom["quarter"] >= "2004Q1")]
    domains: dict[str, dict[str, list[float]]] = {}
    for cat, grp in dom_src.groupby("category", observed=True):
        d = {}
        for col in ("price_4q", "yoy_pct", "accel_pp", "dom_4q", "dom_yoy_days",
                    "n_sold_4q", "quarters_of_supply", "discount_pct",
                    "price_4q_real", "yoy_real_pct"):
            s = grp[col].dropna()
            if len(s) < 50:
                continue
            lo, hi = float(s.quantile(0.02)), float(s.quantile(0.98))
            if col in ("yoy_pct", "yoy_real_pct", "accel_pp", "dom_yoy_days",
                       "discount_pct"):
                # 发散型指标要对称，否则 0 不在颜色中点上，看着就像在骗人
                m = max(abs(lo), abs(hi))
                lo, hi = -m, m
            d[col] = [round(lo, 2), round(hi, 2)]
        domains[str(cat)] = d

    # 月度指标的值域，和季度的分开算。月度只有挂牌侧三个量。
    mon = pd.read_parquet(outdir / "panel_monthly.parquet")
    mon_src = mon[(mon["area_level"] == "kommune") & (mon["month"] >= "2007M01")]
    dom_m: dict[str, dict[str, list[float]]] = {}
    for cat, grp in mon_src.groupby("category", observed=True):
        d = {}
        for col in ("for_sale", "asking_price_m2", "days_listed",
                    "for_sale_yoy", "asking_price_m2_yoy", "days_listed_yoy"):
            if col not in grp:
                continue
            v = grp[col].dropna()
            if len(v) < 50:
                continue
            lo, hi = float(v.quantile(0.02)), float(v.quantile(0.98))
            if col.endswith("_yoy"):
                mx = max(abs(lo), abs(hi))
                lo, hi = -mx, mx
            d[col] = [round(lo, 2), round(hi, 2)]
        dom_m[str(cat)] = d

    payload = {"quarter": last, "level": "kommune", "domains": domains,
               "domainsMonthly": dom_m,
               "quarters": sorted(kom["quarter"].unique().tolist()),
               "months": sorted(mon["month"].unique().tolist()),
               "rows": snap.to_dict(orient="records")}
    dst = webdir / "snapshot.json"
    dst.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":"),
                              allow_nan=False), "utf-8")
    print(f"  web: snapshot.json  {dst.stat().st_size/1024:.0f} KB  ({len(snap)} 行 @ {last})")
    lines.append(f"| snapshot.json（首屏） | {dst.stat().st_size/1024:.0f} KB | — |")
    _write_version(webdir, last)
    return "\n".join(lines) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--outdir", default="data")
    ap.add_argument("--skip-geo", action="store_true")
    ap.add_argument("--webdir", default="public/data")
    a = ap.parse_args()
    out = Path(a.outdir)
    out.mkdir(parents=True, exist_ok=True)

    cpi = fetch_cpi()
    kom = build_panel(out, "kommune", cpi)
    pnr = build_panel(out, "postnr", cpi)
    fetch_areas(out)

    report = ("# 面板诊断\n\n"
              "地图上每个区域四种命运：正常上色（ok）、上色但标注低样本（low）、"
              "上色但样本量无从查证（unverified，2004 年以前没有成交量数据）、"
              "中性灰（insufficient）。\n\n"
              "下面两张表是**最新季度**的分布，那个季度成交量数据齐全，"
              "所以 unverified 是 0，灰色那一列就是 insufficient。\n\n"
              + coverage_report(kom, "kommune")
              + "\n" + coverage_report(pnr, "postnr"))
    if not a.skip_geo:
        report += fetch_geo(out)
    fetch_monthly_panel(out)
    report += export_web(out, Path(a.webdir))
    report += fetch_monthly(Path(a.webdir))
    report += build_facts(out, Path(a.webdir))
    (out / "REPORT.md").write_text(report, encoding="utf-8")
    print(report)
    print(f"\n完成 -> {out.resolve()}")


if __name__ == "__main__":
    main()
