"use client";

/**
 * Market Movers sidebar.
 *
 * Two hard rules from the PRD land here:
 *
 *   §5  Low-sample units are **excluded from the boards**, not shown with a
 *       caveat. The filter is in the SQL (reliability = 'ok'); this
 *       component only displays.
 *
 *   §7  Base effect: areas rebounding from a low level have a built-in edge
 *       on the Accelerating board, so every card must also show the absolute
 *       price level, letting people see whether it went
 *       "from 12,000 to 14,000" or "from 45,000 to 52,000".
 */

import { useEffect, useMemo, useState } from "react";
import {
  board,
  boardsFor,
  type GeoLevel,
  type MoverRow,
} from "@/lib/queries";
import {
  fmtInt,
  fmtKrM2,
  fmtPct,
  fmtPp,
  fmtDaysDelta,
  fmtYearsDelta,
  trendClass,
  GEO_LEVELS,
  type Category,
} from "@/lib/metrics";

const FMT = {
  yoy_pct: fmtPct,
  yoy_real_pct: fmtPct,
  accel_pp: fmtPp,
  dom_yoy_days: fmtDaysDelta,
  years_income_chg: fmtYearsDelta,
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

  // The postal level has no income data, so the two affordability boards do not exist there.
  const boards = useMemo(() => boardsFor(level), [level]);

  useEffect(() => {
    if (!dbReady || monthlyMode) return;
    let cancelled = false;
    setBusy(true);
    Promise.all(
      boards.map((b) => board(b.id, quarter, category, 5, real, level)),
    )
      .then((res) => {
        if (cancelled) return;
        setData(Object.fromEntries(boards.map((b, i) => [b.id, res[i]])));
      })
      .catch((e) => console.error("[movers]", e))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [boards, quarter, category, real, level, monthlyMode, dbReady]);

  // The small print states each board's threshold and basis, and the wording
  // has to change with the level: "Kommuner with 40+ sales" at the postal
  // level would be reporting the wrong basis.
  const unit = GEO_LEVELS.find((l) => l.id === level)!.label;

  return (
    <div className="rail">
      <div className="rail__head">
        <div className="rail__title">Market movers</div>
        <div className="rail__sub">
          {monthlyMode ? (
            <>Monthly listings mode</>
          ) : dbReady ? (
            <>
              {unit} with 40+ sales in the trailing four quarters ·{" "}
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
      boards.map((b) => (
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
                ? `Transaction counts start in 2004, so nothing can be ranked in
                   ${quarter.replace("Q", " Q")} — the map still shows published prices.`
                : `No ${unit.toLowerCase().replace(/r$/, "")} clears the 40-sale bar
                   for this measure in ${quarter.replace("Q", " Q")}.`}
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
                suffix={
                  b.valueColumn === "years_income_chg" && r.years_income != null
                    ? `now ${r.years_income.toFixed(1)} yrs`
                    : null
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
  suffix,
  onSelect,
}: {
  row: MoverRow;
  name: string;
  column: keyof typeof FMT;
  invert?: boolean;
  real: boolean;
  active: boolean;
  /** On the affordability boards, show "how many years now" as well as "changed by how many years" */
  suffix?: string | null;
  onSelect: (code: string) => void;
}) {
  const v = row[column] as number | null;
  // The absolute price on the card follows nominal/real too
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
        {/* Absolute price + number of sales. Without these two numbers the
            board invites misreading. */}
        <span className="row__meta num">
          {row.price_4q != null ? fmtKrM2(row.price_4q) : "—"}
          {suffix
            ? ` · ${suffix}`
            : row.n_sold_4q != null
              ? ` · ${fmtInt(row.n_sold_4q)} sales`
              : ""}
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
