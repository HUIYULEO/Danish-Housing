"use client";

/**
 * 页面顶部的轮播条。
 *
 * 里面混着两种东西，所以每一条都带一个来源标签，不能让人混淆：
 *
 *   Jul 2026 · listings   月度挂牌数据（UDB010/020/030）。比下面的季度地图新四个月，
 *                         但只有挂牌侧的量 —— 在售套数、要价、已挂天数。
 *                         免费数据里**没有月度成交价**，这里也绝不假装有。
 *   Worth knowing         Fun Facts（PRD §8），从季度面板算出来的结构性事实，
 *                         只用 reliability=ok 的单元。
 *
 * 做成一次只显示一条的轮播而不是跑马灯：跑马灯适合塞很多数字，
 * 但这里有一半是句子，移动的句子没人读得完。
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
  /** true = 数值下降才是"热"（天数、库存），染色要反过来 */
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

      {/* aria-live 只播报当前这一条，不会把整串都念一遍 */}
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
      // UDB020 是 kr/m²，不是总价（实测 Lolland 7,301 / Frederiksberg 114,346，
      // 和各自的成交 kr/m² 完全对得上）。它衡量的是**在售存量**的要价，
      // 天然高于成交价：贵的房子挂得久，便宜的卖得快，剩下的就是没卖掉那批。
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
