"use client";

/**
 * Market Movers 侧栏。
 *
 * 两条 PRD 里的硬规则在这里落地：
 *
 *   §5  低样本单元**排除出榜单**，不是显示后加标注。
 *       过滤在 SQL 里（reliability = 'ok'），这里只负责显示。
 *
 *   §7  基数效应：Accelerating 榜上从低位反弹的地区天然占优，
 *       所以每张卡片必须同时显示绝对价位，让人看到是
 *       "从 12,000 涨到 14,000" 还是 "从 45,000 涨到 52,000"。
 */

import { useEffect, useState } from "react";
import {
  board,
  BOARDS,
  type BoardId,
  type GeoLevel,
  type MoverRow,
} from "@/lib/queries";
import {
  fmtInt,
  fmtKrM2,
  fmtPct,
  fmtPp,
  fmtDaysDelta,
  trendClass,
  type Category,
} from "@/lib/metrics";

const FMT = {
  yoy_pct: fmtPct,
  yoy_real_pct: fmtPct,
  accel_pp: fmtPp,
  dom_yoy_days: fmtDaysDelta,
} as const;

export default function MoversBoard({
  quarter,
  category,
  real,
  level,
  monthlyMode,
  dbReady,
  areaNames,
  selected,
  onSelect,
}: {
  quarter: string;
  category: Category;
  real: boolean;
  level: GeoLevel;
  monthlyMode: boolean;
  dbReady: boolean;
  areaNames: Map<string, string>;
  selected: string | null;
  onSelect: (code: string) => void;
}) {
  const [data, setData] = useState<Record<string, MoverRow[]>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!dbReady || monthlyMode) return;
    let cancelled = false;
    setBusy(true);
    Promise.all(
      BOARDS.map((b) => board(b.id, quarter, category, 5, real, level)),
    )
      .then((res) => {
        if (cancelled) return;
        setData(Object.fromEntries(BOARDS.map((b, i) => [b.id, res[i]])));
      })
      .catch((e) => console.error("[movers]", e))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [quarter, category, real, level, monthlyMode, dbReady]);

  return (
    <div className="rail">
      <div className="rail__head">
        <div className="rail__title">Market movers</div>
        <div className="rail__sub">
          {monthlyMode ? (
            <>Monthly listings mode</>
          ) : dbReady ? (
            <>
              Kommuner with 40+ sales in the trailing four quarters ·{" "}
              {quarter.replace("Q", " Q")}
              {real ? " · real kroner" : ""}
            </>
          ) : (
            <span className="loading">
              <span className="loading__dot" />
              Loading full history…
            </span>
          )}
        </div>
      </div>

      {monthlyMode ? (
        <section className="board">
          <p className="empty">
            The rankings rank movements in realised prices, which only exist
            quarterly. Switch back to <strong>Quarterly · sold</strong> to see
            them. The map is still live — it is showing listings.
          </p>
        </section>
      ) : (
      BOARDS.map((b) => (
        <section className="board" key={b.id}>
          <div className="board__h">
            <h3>{b.title}</h3>
            <em>{b.hint}</em>
          </div>
          {!dbReady || (busy && !data[b.id]) ? (
            <Skeletons />
          ) : (data[b.id] ?? []).length === 0 ? (
            <p className="empty">
              {quarter < "2005"
                ? `Transaction counts start in 2004, so no kommune can be ranked in
                   ${quarter.replace("Q", " Q")} — the map still shows published prices.`
                : `No kommune clears the 40-sale bar for this measure in
                   ${quarter.replace("Q", " Q")}.`}
            </p>
          ) : (
            (data[b.id] ?? []).map((r) => (
              <Row
                key={r.area_code}
                row={r}
                name={areaNames.get(r.area_code) ?? r.area_code}
                column={
                  real && b.valueColumn === "yoy_pct"
                    ? "yoy_real_pct"
                    : b.valueColumn
                }
                invert={b.invert}
                real={real}
                active={selected === r.area_code}
                onSelect={onSelect}
              />
            ))
          )}
        </section>
      )))}
    </div>
  );
}

function Row({
  row,
  name,
  column,
  invert,
  real,
  active,
  onSelect,
}: {
  row: MoverRow;
  name: string;
  column: keyof typeof FMT;
  invert?: boolean;
  real: boolean;
  active: boolean;
  onSelect: (code: string) => void;
}) {
  const v = row[column] as number | null;
  // 卡片上的绝对价位也要跟着名义/实际走
  const price = real ? (row.price_4q_real ?? null) : row.price_4q;
  return (
    <button
      type="button"
      className="row"
      data-active={active}
      onClick={() => onSelect(row.area_code)}
    >
      <span>
        <span className="row__n">{name}</span>
        {/* 绝对价位 + 成交笔数。没有这两个数，榜单就是在诱导误读。 */}
        <span className="row__meta num">
          {row.price_4q != null ? fmtKrM2(row.price_4q) : "—"}
          {row.n_sold_4q != null ? ` · ${fmtInt(row.n_sold_4q)} sales` : ""}
        </span>
      </span>
      <span className={`row__v num ${trendClass(v, invert)}`}>
        {v != null && Number.isFinite(v) ? FMT[column](v) : "—"}
      </span>
    </button>
  );
}

function Skeletons() {
  return (
    <div style={{ display: "grid", gap: 11, padding: "4px 0 2px" }}>
      {[68, 82, 55, 74, 62].map((w, i) => (
        <div key={i} className="skeleton" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}
