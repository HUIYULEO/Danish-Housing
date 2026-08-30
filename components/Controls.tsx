"use client";

import {
  CATEGORIES,
  metricsFor,
  quarterLabel,
  type Category,
  type Frequency,
  type Metric,
  type MetricId,
} from "@/lib/metrics";

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; title?: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="ctl">
      <span className="ctl__label">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            title={o.title}
            aria-pressed={value === o.id}
            disabled={disabled || o.disabled}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MetricPicker({
  value,
  onChange,
  freq,
}: {
  value: MetricId;
  onChange: (v: MetricId) => void;
  freq: Frequency;
}) {
  return (
    <Segmented
      label="Measure"
      value={value}
      onChange={onChange}
      options={metricsFor(freq).map((m) => ({
        id: m.id,
        label: m.short,
        title: m.blurb,
      }))}
    />
  );
}

export function CategoryPicker({
  value,
  onChange,
  only,
}: {
  value: Category;
  onChange: (v: Category) => void;
  /** 只显示这几个类型。PRD §9：没有数据的类型直接不显示，不显示空图表。 */
  only?: Category[];
}) {
  const list = only ? CATEGORIES.filter((c) => only.includes(c.id)) : CATEGORIES;
  return (
    <Segmented
      label="Homes"
      value={value}
      onChange={onChange}
      options={list.map((c) => ({
        id: c.id,
        label: c.label,
        title: c.note,
      }))}
    />
  );
}

/**
 * 地图上的说明卡。
 *
 * eyebrow 那一行是"我现在看的是什么时候、什么口径的数"，
 * 点开某个 kommune 之后 AreaCard 会接着显示同一行 —— 不能让画面上
 * 出现任何一个时刻，用户找不到当前季度。
 */
export function Headline({
  metric,
  category,
  quarter,
  real,
  colored,
  total,
  levelLabel,
}: {
  metric: Metric;
  category: Category;
  quarter: string;
  real: boolean;
  colored: number;
  total: number;
  levelLabel: string;
}) {
  const cat = CATEGORIES.find((c) => c.id === category)!;
  const gray = total - colored;
  return (
    <div className="card">
      <Eyebrow quarter={quarter} category={category} real={real} />
      <div className="card__t">
        {metric.label} · {cat.label.toLowerCase()}
      </div>
      <div className="card__s">
        {metric.blurb}
        {gray > 0 && (
          <>
            {" "}
            {gray} of {total} {levelLabel} are grey: too little data to put a
            number on.
          </>
        )}
      </div>
    </div>
  );
}

/** 季度 + 房产类型 + 名义/实际。地图上任何一张卡片都戴着它。 */
export function Eyebrow({
  quarter,
  category,
  real,
}: {
  quarter: string;
  category: Category;
  real: boolean;
}) {
  const cat = CATEGORIES.find((c) => c.id === category)!;
  return (
    <div className="card__eyebrow">
      <b>{quarter}</b>
      <span>{cat.label}</span>
      <span>{real ? "Real kroner" : "Nominal"}</span>
    </div>
  );
}

/**
 * 名义 / 实际克朗。
 *
 * 只对价格和增长率有意义，其它指标下这个开关会禁用而不是消失 ——
 * 消失会让人以为自己按错了地方。
 */
export function RealToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Segmented
      label="Kroner"
      value={value ? "real" : "nominal"}
      disabled={disabled}
      onChange={(v) => onChange(v === "real")}
      options={[
        {
          id: "nominal",
          label: "Nominal",
          title: "Prices as they were quoted at the time",
        },
        {
          id: "real",
          label: "Inflation-adjusted",
          title: "Deflated to today's kroner using the consumer price index",
        },
      ]}
    />
  );
}
