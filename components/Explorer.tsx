"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MarketMap from "./MarketMap";
import Legend from "./Legend";
import Timeline from "./Timeline";
import MoversBoard from "./MoversBoard";
import AreaCard from "./AreaCard";
import {
  CategoryPicker,
  MetricPicker,
  Segmented,
  Headline,
  RealToggle,
} from "./Controls";
import Ticker, { type Facts, type Monthly } from "./Ticker";
import ThemeToggle, { useTheme } from "./ThemeToggle";
import { getConnection } from "@/lib/db";
import {
  mapSlice,
  monthlySlice,
  growthSlice,
  type GeoLevel,
} from "@/lib/queries";
import {
  METRIC_BY_ID,
  metricsFor,
  resolveMetric,
  hasRealVariant,
  GEO_LEVELS,
  WINDOWS,
  shiftQuarter,
  fmtKrM2,
  fmtPct,
  fmtDays,
  fmtInt,
  fmtQ,
  monthLabel,
  type Category,
  type Domains,
  type Frequency,
  type MetricId,
  type PanelRow,
  type WindowId,
} from "@/lib/metrics";

interface Props {
  initialRows: PanelRow[];
  latestQuarter: string;
  quarters: string[];
  months: string[];
  domains: Domains;
  domainsMonthly: Domains;
  areas: { code: string; name: string; level: string }[];
  monthly: Monthly;
  facts: Facts;
  postnrByKommune: Record<string, string[]>;
}

export default function Explorer({
  initialRows,
  latestQuarter,
  quarters,
  months,
  domains,
  domainsMonthly,
  areas,
  monthly,
  facts,
  postnrByKommune,
}: Props) {
  const [theme, themeChoice, setThemeChoice] = useTheme();

  const [freq, setFreq] = useState<Frequency>("quarter");
  const [level, setLevel] = useState<GeoLevel>("kommune");
  const [category, setCategory] = useState<Category>("house");
  // 默认看增长率而不是价格水平。价格水平那张图三十年来的形状几乎不变
  // —— 哥本哈根一直最贵，西日德兰一直最便宜，看一眼就没什么可看的了。
  // 增长率每个季度都在变，而且 snapshot 里就有 yoy_pct，首屏照样不用等 DuckDB。
  const [metricId, setMetricId] = useState<MetricId>("growth");
  const [windowId, setWindowId] = useState<WindowId>("4Q");
  const [quarter, setQuarter] = useState(latestQuarter);
  const [month, setMonth] = useState(months[months.length - 1] ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [real, setReal] = useState(false);
  // 时间轴默认只铺近十年。整条 1992-2026 有 137 个季度，滑块一格不到 3px，
  // 想停在某个具体季度基本靠运气；而绝大多数人想看的就是最近这些年。
  const [span, setSpan] = useState<"10y" | "all">("10y");
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [rows, setRows] = useState<PanelRow[]>(() =>
    initialRows.filter((r) => r.category === "house"),
  );

  const isMonthly = freq === "month";
  const metric = resolveMetric(METRIC_BY_ID[metricId], real && !isMonthly);
  const activeDomains = isMonthly ? domainsMonthly : domains;

  // 切频率时把指标换成新频率里的第一个 —— 月度没有 Price / Growth，
  // 留着旧的 metricId 会去查一个月度面板里根本不存在的列
  useEffect(() => {
    const allowed = metricsFor(freq).map((m) => m.id);
    if (!allowed.includes(metricId)) setMetricId(allowed[0]);
  }, [freq, metricId]);

  const areaNames = useMemo(
    () => new Map(areas.map((a) => [a.code, a.name])),
    [areas],
  );

  useEffect(() => {
    let alive = true;
    getConnection()
      .then(() => alive && setDbReady(true))
      .catch((e) => {
        console.error("[duckdb]", e);
        if (alive) setDbError(String(e?.message ?? e));
      });
    return () => {
      alive = false;
    };
  }, []);

  /* -------- 时间轴上铺哪些刻度 -------- */
  const allTicks = useMemo(
    () => (isMonthly ? months : quarters),
    [isMonthly, months, quarters],
  );
  const shownTicks = useMemo(() => {
    if (span === "all") return allTicks;
    return allTicks.slice(-(isMonthly ? 120 : 40)); // 十年
  }, [allTicks, span, isMonthly]);

  const tick = isMonthly ? month : quarter;
  const setTick = isMonthly ? setMonth : setQuarter;

  useEffect(() => {
    if (shownTicks.length && !shownTicks.includes(tick)) {
      setTick(shownTicks[0]);
    }
  }, [shownTicks, tick, setTick]);

  /* -------- 地图数据 -------- *
   * 季度 + 最新季度 + kommune + 4Q 窗口 = 直接用 snapshot，一次网络都不用走。
   * 其它任何组合都查 DuckDB。 */
  const isSnapshotView =
    !isMonthly &&
    level === "kommune" &&
    quarter === latestQuarter &&
    (metricId !== "growth" || windowId === "4Q");

  useEffect(() => {
    if (isSnapshotView) {
      setRows(initialRows.filter((r) => r.category === category));
      return;
    }
    if (!dbReady) return;

    let alive = true;
    const win = WINDOWS.find((w) => w.id === windowId)!;
    const p = isMonthly
      ? monthlySlice(month, category, level)
      : metricId === "growth" && windowId !== "4Q"
        ? growthSlice(
            quarter,
            shiftQuarter(quarter, -win.quarters),
            category,
            real,
            level,
          )
        : mapSlice(quarter, category, level);

    p.then((r) => alive && setRows(r)).catch((e) => console.error("[slice]", e));
    return () => {
      alive = false;
    };
  }, [
    isMonthly,
    month,
    quarter,
    category,
    level,
    metricId,
    windowId,
    real,
    dbReady,
    isSnapshotView,
    initialRows,
  ]);

  const visible = rows;
  const colored = visible.filter((r) => r.reliability !== "insufficient").length;
  const national = useMemo(
    () => summarise(visible, real, isMonthly),
    [visible, real, isMonthly],
  );
  const onSelect = useCallback((code: string | null) => setSelected(code), []);

  // 值域随时间窗缩放。10 年的累计涨幅当然比 1 年大，
  // 用 sqrt 缩放让颜色在不同窗口下都还有分辨率，不至于全糊成一片。
  const scaledDomains = useMemo(() => {
    if (isMonthly || metricId !== "growth" || windowId === "4Q") {
      return activeDomains;
    }
    const win = WINDOWS.find((w) => w.id === windowId)!;
    const k = Math.sqrt(win.quarters / 4);
    const out: Domains = {};
    for (const [cat, cols] of Object.entries(activeDomains)) {
      out[cat] = { ...cols };
      for (const key of ["yoy_pct", "yoy_real_pct"] as const) {
        const d = cols[key];
        if (d) out[cat][key] = [d[0] * k, d[1] * k];
      }
    }
    return out;
  }, [activeDomains, metricId, windowId, isMonthly]);

  const selectedRow = selected
    ? (visible.find((r) => r.area_code === selected) ?? null)
    : null;

  const levelLabel = GEO_LEVELS.find((l) => l.id === level)!.label;
  const timeLabel = isMonthly ? monthLabel(month) : quarter.replace("Q", " Q");

  return (
    <>
      <Ticker monthly={monthly} facts={facts} />

      <div className="ribbon">
        {/* 月度模式下季度那几列全是空的，换成这个月真正有的量 */}
        {isMonthly ? (
          <>
            <Cell k="Median asking price" v={national.asking} />
            <Cell k="Homes for sale" v={national.stock} d="all areas" />
            <Cell k="Median days listed" v={national.listed} />
            <Cell k="Stock vs a year ago" v={national.stockYoy} />
          </>
        ) : (
          <>
            <Cell
              k={real ? "All Denmark · real price" : "All Denmark · price"}
              v={national.price}
            />
            <Cell k="Year on year" v={national.yoy} d="median area" />
            <Cell k="Median days on market" v={national.dom} />
            <Cell k="Sales, 4 quarters" v={national.sales} />
            <Cell k="Quarters of supply" v={national.supply} />
          </>
        )}
        <Cell k={`${levelLabel} shown`} v={`${colored} / ${visible.length}`} />
        <div className="ribbon__cell">
          <div className="ribbon__k">Theme</div>
          <div style={{ marginTop: 4 }}>
            <ThemeToggle choice={themeChoice} onChange={setThemeChoice} />
          </div>
        </div>
      </div>

      <div className="stage">
        <div className="mapwrap">
          <MarketMap
            rows={visible}
            metric={metric}
            domains={scaledDomains}
            category={category}
            quarter={timeLabel}
            selected={selected}
            onSelect={onSelect}
            areaNames={areaNames}
            postnrByKommune={postnrByKommune}
            level={level}
            theme={theme}
          />
          <div className="overlay overlay--tl">
            {selectedRow ? (
              <AreaCard
                row={selectedRow}
                name={areaNames.get(selectedRow.area_code) ?? ""}
                category={category}
                quarter={timeLabel}
                real={real && !isMonthly}
                monthlyMode={isMonthly}
                postnrs={
                  level === "kommune"
                    ? (postnrByKommune[selectedRow.area_code] ?? [])
                    : []
                }
                dbReady={dbReady}
                onClose={() => setSelected(null)}
              />
            ) : (
              <Headline
                metric={metric}
                category={category}
                quarter={timeLabel}
                real={real && !isMonthly}
                colored={colored}
                total={visible.length}
                levelLabel={levelLabel.toLowerCase()}
              />
            )}
          </div>
          <div className="overlay overlay--bl">
            <Legend
              metric={metric}
              domains={scaledDomains}
              category={category}
              theme={theme}
            />
          </div>
        </div>

        <MoversBoard
          quarter={quarter}
          category={category}
          real={real}
          level={level}
          monthlyMode={isMonthly}
          dbReady={dbReady}
          areaNames={areaNames}
          selected={selected}
          onSelect={onSelect}
        />
      </div>

      <div className="controls">
        {/* PRD §6.1 说"没有月度价格数据"—— 成交价确实没有，但挂牌侧有，
            而且比季度新四个月。所以这里给的是频率切换，不是把季度插值成月度。 */}
        <Segmented
          label="Data"
          value={freq}
          onChange={(v) => setFreq(v as Frequency)}
          disabled={!dbReady}
          options={[
            {
              id: "quarter",
              label: "Quarterly · sold",
              title:
                "Realised transaction prices. The only frequency they exist at.",
            },
            {
              id: "month",
              label: "Monthly · listed",
              title:
                "Listings: stock, asking price, days waiting. Four months fresher, but not sales.",
            },
          ]}
        />
        <Segmented
          label="Areas"
          value={level}
          onChange={(v) => setLevel(v as GeoLevel)}
          disabled={!dbReady}
          options={GEO_LEVELS.map((l) => ({
            id: l.id,
            label: l.label,
            title: l.note,
          }))}
        />
        <MetricPicker value={metricId} onChange={setMetricId} freq={freq} />
        <CategoryPicker value={category} onChange={setCategory} />
        {!isMonthly && (
          <RealToggle
            value={real}
            onChange={setReal}
            disabled={!hasRealVariant(metricId)}
          />
        )}
        {metricId === "growth" && (
          <Segmented
            label="Change over"
            value={windowId}
            onChange={setWindowId}
            disabled={!dbReady}
            options={WINDOWS.map((w) => ({ id: w.id, label: w.label }))}
          />
        )}
        {dbError && (
          <span className="ctl__label" style={{ color: "var(--accent)" }}>
            History unavailable — {dbError}
          </span>
        )}
      </div>

      <Timeline
        ticks={shownTicks}
        value={tick}
        onChange={setTick}
        monthly={isMonthly}
        playing={playing}
        onPlayToggle={() => setPlaying((p) => !p)}
        span={span}
        onSpanChange={setSpan}
        disabled={!dbReady}
      />
    </>
  );
}

function Cell({ k, v, d }: { k: string; v: string; d?: string }) {
  return (
    <div className="ribbon__cell">
      <div className="ribbon__k">{k}</div>
      <div className="ribbon__v num">
        {v}
        {d && <span className="ribbon__d">{d}</span>}
      </div>
    </div>
  );
}

/**
 * 顶条的全国数字。用中位数而不是平均数，免得 København 一个人说了算。
 *
 * 参与计算的是所有能上色的单元，包括 low 和 unverified。
 * 只取 ok 的话，2004 年以前整条顶条都是横杠 —— 而那十二年的价格
 * 是官方发布的，只是没有成交量可以核样本。
 */
function summarise(rows: PanelRow[], real: boolean, monthly = false) {
  const ok = rows.filter((r) => r.reliability !== "insufficient");
  const med = (get: (r: PanelRow) => number | null | undefined) => {
    const v = ok
      .map(get)
      .filter((x): x is number => x != null && Number.isFinite(x))
      .sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  };
  const sum = (get: (r: PanelRow) => number | null | undefined) =>
    rows.reduce((a, r) => a + (get(r) ?? 0), 0);

  const p = med((r) => (real ? r.price_4q_real : r.price_4q));
  const y = med((r) => (real ? r.yoy_real_pct : r.yoy_pct));
  const d = med((r) => r.dom_4q);
  const s = sum((r) => r.n_sold_4q);
  const q = med((r) => r.quarters_of_supply);

  // 月度那三个量
  const ask = med((r) => r.asking_price_m2);
  const lst = med((r) => r.days_listed);
  const stk = sum((r) => r.for_sale);
  const stkYoy = med((r) => r.for_sale_yoy);

  return {
    price: p != null ? fmtKrM2(p) : "—",
    yoy: y != null ? fmtPct(y) : "—",
    dom: d != null ? fmtDays(d) : "—",
    sales: s ? fmtInt(s) : "—",
    supply: q != null ? fmtQ(q) : "—",
    asking: ask != null ? fmtKrM2(ask) : "—",
    listed: lst != null ? fmtDays(lst) : "—",
    stock: stk ? fmtInt(stk) : "—",
    stockYoy: stkYoy != null ? fmtPct(stkYoy) : "—",
  };
}
