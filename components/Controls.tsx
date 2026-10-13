"use client";

import {
  CATEGORIES,
  metricsFor,
  type Category,
  type Frequency,
  type Metric,
  type MetricId,
} from "@/lib/metrics";
import { useLocale } from "./LocaleProvider";

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
  level,
}: {
  value: MetricId;
  onChange: (v: MetricId) => void;
  freq: Frequency;
  /** The postal level has no income data, so Years of income is not listed there */
  level?: string;
}) {
  const { t, locale } = useLocale();
  return (
    <Segmented
      label={t.controls.measure}
      value={value}
      onChange={onChange}
      options={metricsFor(freq, level, locale).map((m) => ({
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
  /** Show only these types. PRD §9: types without data are simply not shown; no empty charts. */
  only?: Category[];
}) {
  const { t } = useLocale();
  const list = only ? CATEGORIES.filter((c) => only.includes(c.id)) : CATEGORIES;
  return (
    <Segmented
      label={t.controls.homes}
      value={value}
      onChange={onChange}
      options={list.map((c) => ({
        id: c.id,
        label: t.categories[c.id].label,
        title: t.categories[c.id].note,
      }))}
    />
  );
}

/**
 * The info card on the map.
 *
 * The eyebrow line is "what period and what basis am I looking at". Once a
 * kommune is opened, AreaCard carries on showing the same line: there must
 * never be a moment on screen when the user cannot find the current quarter.
 */
export function Headline({
  metric,
  category,
  quarter,
  real,
  colored,
  total,
  levelLabel,
  incomeYear,
}: {
  metric: Metric;
  category: Category;
  quarter: string;
  real: boolean;
  colored: number;
  total: number;
  levelLabel: string;
  /** The income year used for affordability. Income is published two years
   *  behind prices, and that has to be stated up front. */
  incomeYear?: number | null;
}) {
  const { t } = useLocale();
  const gray = total - colored;
  return (
    <div className="card">
      <Eyebrow quarter={quarter} category={category} real={real} />
      <div className="card__t">
        {metric.label} · {t.categories[category].label.toLowerCase()}
      </div>
      <div className="card__s">
        {metric.blurb}
        {gray > 0 && <> {t.headline.grey(gray, total, levelLabel)}</>}
        {metric.id === "afford" && incomeYear != null && (
          <> {t.headline.afford(quarter, incomeYear)}</>
        )}
      </div>
    </div>
  );
}

/** Quarter + property type + nominal/real. Every card on the map carries it. */
export function Eyebrow({
  quarter,
  category,
  real,
}: {
  quarter: string;
  category: Category;
  real: boolean;
}) {
  const { t } = useLocale();
  return (
    <div className="card__eyebrow">
      <b>{quarter}</b>
      <span>{t.categories[category].label}</span>
      <span>{real ? t.controls.realShort : t.controls.nominal}</span>
    </div>
  );
}

/**
 * Nominal / real kroner.
 *
 * Only meaningful for price and growth. Under other metrics the switch is
 * disabled rather than removed; if it vanished, people would think they had
 * pressed the wrong thing.
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
  const { t } = useLocale();
  return (
    <Segmented
      label={t.controls.kroner}
      value={value ? "real" : "nominal"}
      disabled={disabled}
      onChange={(v) => onChange(v === "real")}
      options={[
        { id: "nominal", label: t.controls.nominal, title: t.controls.nominalTitle },
        { id: "real", label: t.controls.real, title: t.controls.realTitle },
      ]}
    />
  );
}
