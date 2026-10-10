/**
 * Encodes "what I am looking at right now" into the URL.
 *
 * Why it exists: before this, nothing worth showing on the site could be
 * pointed out to anyone else. Not the 2009 map with Zealand all blue, not
 * the cliff between inner and outer Copenhagen at the postal level, not
 * Frederiksberg at 17 years of income. You could only say "go and click
 * four times yourself".
 *
 * Two rules:
 *
 * 1. **Only write what differs from the defaults.** The home page URL has to
 *    stay clean, not open with eight parameters attached. Omitted means
 *    default, so when a default changes, the meaning of old links changes
 *    with it. That is an acceptable price: the default is "latest quarter",
 *    and the things a link really wants to pin (quarter, level, metric) are
 *    all written out explicitly.
 *
 * 2. **Every value read in is untrusted input.** Users can edit the URL by
 *    hand. Each field is checked against its table of allowed values and
 *    falls back to the default if it does not match; it is never spliced
 *    straight into SQL.
 */

import {
  CATEGORIES,
  GEO_LEVELS,
  METRIC_BY_ID,
  WINDOWS,
  type Category,
  type Frequency,
  type MetricId,
  type WindowId,
} from "./metrics";

export interface ViewState {
  freq: Frequency;
  level: string;
  category: Category;
  metric: MetricId;
  window: WindowId;
  quarter: string;
  month: string;
  real: boolean;
  span: "10y" | "all";
  selected: string | null;
}

/** Parameter names in the URL. Short, but still recognisable. */
const KEYS = {
  freq: "f",
  level: "l",
  category: "c",
  metric: "m",
  window: "w",
  quarter: "q",
  month: "mo",
  real: "r",
  span: "s",
  selected: "a",
} as const;

const oneOf = <T extends string>(v: string | null, allowed: readonly T[]) =>
  v != null && (allowed as readonly string[]).includes(v) ? (v as T) : null;

/**
 * Read the fields explicitly written in the URL. Unwritten ones come back
 * undefined and the caller applies its own defaults; this module does not
 * know which quarter is "the latest".
 */
export function readViewState(
  search: string,
  quarters: string[],
  months: string[],
): Partial<ViewState> {
  const p = new URLSearchParams(search);
  const out: Partial<ViewState> = {};

  const freq = oneOf(p.get(KEYS.freq), ["quarter", "month"] as const);
  if (freq) out.freq = freq;

  const level = oneOf(
    p.get(KEYS.level),
    GEO_LEVELS.map((l) => l.id),
  );
  if (level) out.level = level;

  const category = oneOf(
    p.get(KEYS.category),
    CATEGORIES.map((c) => c.id),
  );
  if (category) out.category = category;

  const metric = p.get(KEYS.metric);
  if (metric && metric in METRIC_BY_ID) out.metric = metric as MetricId;

  const win = oneOf(
    p.get(KEYS.window),
    WINDOWS.map((w) => w.id),
  );
  if (win) out.window = win;

  // Quarter and month must actually exist in the panel. Hand-edit it to
  // "9999Q9" and the map would query an empty slice and go entirely grey,
  // which looks like a broken feature.
  const q = p.get(KEYS.quarter);
  if (q && quarters.includes(q)) out.quarter = q;
  const mo = p.get(KEYS.month);
  if (mo && months.includes(mo)) out.month = mo;

  if (p.get(KEYS.real) === "1") out.real = true;
  const span = oneOf(p.get(KEYS.span), ["10y", "all"] as const);
  if (span) out.span = span;

  // The area code only gets a shape check (digits, at most 4). If it does
  // not exist, nothing is selected on the map and nothing else happens.
  const a = p.get(KEYS.selected);
  if (a && /^\d{1,4}$/.test(a)) out.selected = a;

  return out;
}

/** Only fields that differ from the defaults go into the URL. */
export function writeViewState(state: ViewState, defaults: ViewState): string {
  const p = new URLSearchParams();
  const put = (k: string, v: string | null, d: string | null) => {
    if (v != null && v !== d) p.set(k, v);
  };
  put(KEYS.freq, state.freq, defaults.freq);
  put(KEYS.level, state.level, defaults.level);
  put(KEYS.category, state.category, defaults.category);
  put(KEYS.metric, state.metric, defaults.metric);
  // The time window only matters under growth; under any other metric it is noise in the URL
  if (state.metric === "growth") {
    put(KEYS.window, state.window, defaults.window);
  }
  if (state.freq === "month") put(KEYS.month, state.month, defaults.month);
  else put(KEYS.quarter, state.quarter, defaults.quarter);
  if (state.real) p.set(KEYS.real, "1");
  put(KEYS.span, state.span, defaults.span);
  put(KEYS.selected, state.selected, defaults.selected);
  const s = p.toString();
  return s ? `?${s}` : "";
}
