"use client";

/**
 * The rotating strip at the top of the page.
 *
 * It mixes two kinds of things, so every item carries a source label and
 * they cannot be confused:
 *
 *   Jul 2026 · listings   Monthly listing data (UDB010/020/030). Four months
 *                         fresher than the quarterly map below, but only
 *                         listing-side measures: homes for sale, asking
 *                         price, days listed. The free data has **no monthly
 *                         sale prices**, and this never pretends otherwise.
 *   Worth knowing         Fun Facts (PRD §8): structural facts computed from
 *                         the quarterly panel, reliability=ok units only.
 *
 * It shows one item at a time rather than scrolling as a marquee: a marquee
 * suits lots of numbers, but half of these are sentences, and nobody can
 * finish reading a moving sentence.
 */

import { useCallback, useEffect, useState } from "react";
import { fmtInt, fmtKrM2, fmtPct } from "@/lib/metrics";

export interface Monthly {
  latest: string | null;
  months: string[];
  series: Record<string, Record<string, number>>;
}

export interface Facts {
  quarter: string;
  facts: { label: string; value: string }[];
}

interface Item {
  tag: string;
  label: string;
  value: string;
  delta?: number;
  /** true = a falling value is the "hot" direction (days, inventory), so the colouring is inverted */
  invert?: boolean;
}

const ROTATE_MS = 7000;

export default function Ticker({
  monthly,
  facts,
}: {
  monthly: Monthly;
  facts: Facts;
}) {
  const items = build(monthly, facts);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback(
    (d: number) => setI((x) => (x + d + items.length) % items.length),
    [items.length],
  );

  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = setInterval(() => go(1), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, go, items.length]);

  if (!items.length) return null;
  const it = items[i];

  return (
    <div
      className="ticker"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="ticker__tag">
        <span className="ticker__dot" aria-hidden />
        {it.tag}
      </div>

      {/* aria-live announces only the current item, not the whole list */}
      <div className="ticker__viewport" aria-live="polite">
        <span className="ticker__item" key={i}>
          {it.label} <b className="num">{it.value}</b>
          {it.delta != null && Number.isFinite(it.delta) && (
            <i
              className={`num ${
                (it.invert ? -it.delta : it.delta) > 0 ? "up" : "down"
              }`}
            >
              {fmtPct(it.delta)} y/y
            </i>
          )}
        </span>
      </div>

      <div className="ticker__nav">
        <button type="button" onClick={() => go(-1)} aria-label="Previous">
          ‹
        </button>
        <span className="ticker__count num">
          {i + 1}/{items.length}
        </span>
        <button type="button" onClick={() => go(1)} aria-label="Next">
          ›
        </button>
      </div>
    </div>
  );
}

function build(monthly: Monthly, facts: Facts): Item[] {
  const out: Item[] = [];
  const { months, series } = monthly ?? {};

  if (months?.length) {
    const tag = `${fmtMonth(months[months.length - 1])} · listings`;
    const cur = series[months[months.length - 1]] ?? {};
    const back = months[months.length - 13];
    const prev = back ? (series[back] ?? {}) : {};
    const yoy = (k: string) =>
      cur[k] != null && prev[k] ? ((cur[k] - prev[k]) / prev[k]) * 100 : undefined;

    if (cur.for_sale != null)
      out.push({
        tag,
        label: "Houses on the market right now",
        value: fmtInt(cur.for_sale),
        delta: yoy("for_sale"),
        invert: true,
      });
    if (cur.asking_price != null)
      // UDB020 is kr/m², not total price (measured: Lolland 7,301 /
      // Frederiksberg 114,346, fully consistent with each one's realised
      // kr/m²). It measures the asking price of the **standing stock**,
      // which is naturally above sale prices: expensive homes linger, cheap
      // ones sell fast, and what remains is the unsold lot.
      out.push({
        tag,
        label: "They are asking, on average",
        value: fmtKrM2(cur.asking_price),
        delta: yoy("asking_price"),
      });
    if (cur.days_listed != null)
      out.push({
        tag,
        label: "And have been waiting",
        value: `${Math.round(cur.days_listed)} days`,
        delta: yoy("days_listed"),
        invert: true,
      });
    if (cur.withdrawn != null)
      out.push({
        tag,
        label: "Taken off the market unsold this month",
        value: fmtInt(cur.withdrawn),
        delta: yoy("withdrawn"),
        invert: true,
      });
  }

  for (const f of facts?.facts ?? []) {
    out.push({ tag: "Worth knowing", label: f.label, value: f.value });
  }
  return out;
}

function fmtMonth(m: string) {
  const [y, mm] = m.split("M");
  const name = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ][Number(mm) - 1];
  return `${name} ${y}`;
}
