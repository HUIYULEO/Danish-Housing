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
import AreaSearch, { type SearchArea } from "./AreaSearch";
import ThemeToggle, { useTheme } from "./ThemeToggle";
import { getConnection } from "@/lib/db";
import {
  mapSlice,
  monthlySlice,
  growthSlice,
  boardsFor,
  type GeoLevel,
} from "@/lib/queries";
import {
  readViewState,
  writeViewState,
  type ViewState,
} from "@/lib/viewstate";
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
  /** Place names for the postal layer. The map tooltip reads the geojson; the sidebar and search read this. */
  postnrAreas: { code: string; name: string }[];
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
  postnrAreas,
}: Props) {
  const [theme, themeChoice, setThemeChoice] = useTheme();

  const [freq, setFreq] = useState<Frequency>("quarter");
  const [level, setLevel] = useState<GeoLevel>("kommune");
  const [category, setCategory] = useState<Category>("house");
  // Default to growth rather than price level. The price-level map has kept
  // almost the same shape for thirty years: København always the most
  // expensive, west Jutland always the cheapest; one glance and there is
  // nothing left to see. Growth changes every quarter, and the snapshot
  // already carries yoy_pct, so the first screen still does not wait for
  // DuckDB.
  const [metricId, setMetricId] = useState<MetricId>("growth");
  const [windowId, setWindowId] = useState<WindowId>("4Q");
  const [quarter, setQuarter] = useState(latestQuarter);
  const [month, setMonth] = useState(months[months.length - 1] ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [real, setReal] = useState(false);
  // The timeline covers only the last ten years by default. The full
  // 1992-2026 run is 137 quarters, under 3px per step on the slider, so
  // stopping on a particular quarter is mostly luck; and the recent years
  // are what most people want to see.
  const [span, setSpan] = useState<"10y" | "all">("10y");
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [rows, setRows] = useState<PanelRow[]>(() =>
    initialRows.filter((r) => r.category === "house"),
  );

  const isMonthly = freq === "month";
  const metric = resolveMetric(METRIC_BY_ID[metricId], real && !isMonthly);
  const activeDomains = isMonthly ? domainsMonthly : domains;

  // On a frequency change, switch the metric to the first one in the new
  // frequency. Monthly has no Price / Growth, and keeping the old metricId
  // would query a column that does not exist in the monthly panel
  useEffect(() => {
    const allowed = metricsFor(freq, level).map((m) => m.id);
    if (!allowed.includes(metricId)) setMetricId(allowed[0]);
  }, [freq, level, metricId]);

  // Postal codes only have quarterly data. UDB010/020/030 stop at kommune,
  // so monthly mode at the postal level would give an empty map; flip the
  // frequency straight back to quarterly.
  useEffect(() => {
    if (level === "postnr" && freq === "month") setFreq("quarter");
  }, [level, freq]);

  // Names for all four levels go in one table. Codes cannot collide:
  // landsdel is two digits, region three with a leading 0, kommune three,
  // postal codes four.
  const areaNames = useMemo(() => {
    const m = new Map(areas.map((a) => [a.code, a.name]));
    for (const a of postnrAreas) m.set(a.code, a.name);
    return m;
  }, [areas, postnrAreas]);

  const searchAreas = useMemo<SearchArea[]>(
    () => [
      ...areas.map((a) => ({
        code: a.code,
        name: a.name,
        level: a.level as SearchArea["level"],
      })),
      ...postnrAreas.map((a) => ({
        code: a.code,
        name: a.name,
        level: "postnr" as const,
      })),
    ],
    [areas, postnrAreas],
  );

  /* -------- URL sync -------- *
   *
   * Reading happens once, after mount. Putting it in the initial useState
   * values would be faster, but then the server-rendered HTML (always the
   * default view) would differ from the first client frame and React would
   * report a hydration mismatch. One extra render buys a clean hydration.
   */
  const defaults = useMemo<ViewState>(
    () => ({
      freq: "quarter",
      level: "kommune",
      category: "house",
      metric: "growth",
      window: "4Q",
      quarter: latestQuarter,
      month: months[months.length - 1] ?? "",
      real: false,
      span: "10y",
      selected: null,
    }),
    [latestQuarter, months],
  );
  const [urlRead, setUrlRead] = useState(false);

  useEffect(() => {
    const v = readViewState(window.location.search, quarters, months);
    if (v.freq) setFreq(v.freq);
    if (v.level) setLevel(v.level as GeoLevel);
    if (v.category) setCategory(v.category);
    if (v.metric) setMetricId(v.metric);
    if (v.window) setWindowId(v.window);
    if (v.quarter) setQuarter(v.quarter);
    if (v.month) setMonth(v.month);
    if (v.real) setReal(v.real);
    if (v.span) setSpan(v.span);
    if (v.selected) setSelected(v.selected);
    setUrlRead(true);
    // quarters / months are fixed at build time and do not change during a session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Write back. replaceState, not pushState: one drag of the timeline passes
  // through dozens of quarters, and pushing each step into history would
  // make the browser's back button useless.
  useEffect(() => {
    if (!urlRead) return;
    const qs = writeViewState(
      {
        freq,
        level,
        category,
        metric: metricId,
        window: windowId,
        quarter,
        month,
        real,
        span,
        selected,
      },
      defaults,
    );
    const next = `${window.location.pathname}${qs}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [
    urlRead,
    freq,
    level,
    category,
    metricId,
    windowId,
    quarter,
    month,
    real,
    span,
    selected,
    defaults,
  ]);

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

  /* -------- Which ticks go on the timeline -------- */
  const allTicks = useMemo(
    () => (isMonthly ? months : quarters),
    [isMonthly, months, quarters],
  );
  const shownTicks = useMemo(() => {
    if (span === "all") return allTicks;
    return allTicks.slice(-(isMonthly ? 120 : 40)); // ten years
  }, [allTicks, span, isMonthly]);

  const tick = isMonthly ? month : quarter;
  const setTick = isMonthly ? setMonth : setQuarter;

  useEffect(() => {
    if (shownTicks.length && !shownTicks.includes(tick)) {
      setTick(shownTicks[0]);
    }
  }, [shownTicks, tick, setTick]);

  /* -------- Map data -------- *
   * Quarterly + latest quarter + kommune + 4Q window = use the snapshot
   * directly, with no network round trip at all.
   * Any other combination queries DuckDB. */
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

  /**
   * A search result was picked. Whichever level the picked area belongs to,
   * the map switches to that level. Otherwise, after finding 8600 Silkeborg
   * the map would still sit on the kommune level, where that postal code
   * does not exist on screen at all.
   */
  const pickArea = useCallback((a: SearchArea) => {
    setLevel(a.level as GeoLevel);
    setSelected(a.code);
  }, []);

  // The domain scales with the time window. Cumulative growth over 10 years
  // is naturally larger than over 1; sqrt scaling keeps the colours
  // distinguishable in every window instead of blurring into one.
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
  // The income year used for affordability. The whole slice shares one year,
  // so the first non-null value is enough.
  const incomeYear =
    visible.find((r) => r.income_year != null)?.income_year ?? null;
  const timeLabel = isMonthly ? monthLabel(month) : quarter.replace("Q", " Q");

  return (
    <>
      <Ticker monthly={monthly} facts={facts} />

      <div className="ribbon">
        {/* In monthly mode the quarterly columns are all empty; show what this month actually has */}
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
        <div className="ribbon__cell ribbon__cell--search">
          <div className="ribbon__k">Find an area</div>
          <AreaSearch
            areas={searchAreas}
            onPick={pickArea}
            postnrReady={dbReady}
          />
        </div>
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
                level={level}
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
                incomeYear={incomeYear}
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
        {/* PRD §6.1 says "there is no monthly price data". True for sale
            prices, but the listing side has it, and four months fresher than
            quarterly. So this is a frequency switch, not quarterly data
            interpolated to monthly. */}
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
              disabled: level === "postnr",
              title:
                level === "postnr"
                  ? "Listing statistics stop at kommune level — there is no monthly postal-district table."
                  : "Listings: stock, asking price, days waiting. Four months fresher, but not sales.",
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
        <MetricPicker
          value={metricId}
          onChange={setMetricId}
          freq={freq}
          level={level}
        />
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
 * National figures for the top strip. Median rather than mean, so København
 * alone does not decide the number.
 *
 * All colourable units take part, including low and unverified. With ok
 * only, the whole strip would be dashes before 2004, while prices for those
 * twelve years are officially published; there is just no volume to check
 * the sample against.
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

  // The three monthly measures
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
