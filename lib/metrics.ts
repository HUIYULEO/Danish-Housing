/**
 * 指标定义、配色和格式化。
 *
 * 这个文件是"地图上的颜色到底是什么意思"的唯一出处。
 * 三条规则写死在这里，别在组件里绕过去：
 *   1. reliability = insufficient 的单元永远不上色，画中性灰 + 斜线。
 *   2. 值域是全局固定的（ETL 算好放在 snapshot.json 里），不随季度重算。
 *      否则拖时间轴只能看到排名变化，看不到 2009 年崩盘和 2021 年狂热的区别。
 *   3. 所有增长率都读滚动 4 季度的列（price_4q / yoy_pct），不读单季度。
 */

export type Category = "house" | "flat" | "holiday";
export type Reliability = "ok" | "low" | "unverified" | "insufficient";
export type MetricId =
  | "price"
  | "growth"
  | "dom"
  | "volume"
  | "supply"
  | "gap"
  // 月度（UDB010/020/030），只有挂牌侧
  | "stock"
  | "asking"
  | "listed";

export interface PanelRow {
  area_code: string;
  category: Category;
  price_4q: number | null;
  yoy_pct: number | null;
  accel_pp: number | null;
  dom_4q: number | null;
  dom_yoy_days: number | null;
  n_sold: number | null;
  n_sold_4q: number | null;
  n_for_sale: number | null;
  quarters_of_supply: number | null;
  discount_pct: number | null;
  reliability: Reliability;
  /** CPI 平减到最新季度克朗。名义/实际开关读这两列。 */
  price_4q_real?: number | null;
  yoy_real_pct?: number | null;
  /** 月度列（UDB010/020/030），只在月度模式下有值 */
  for_sale?: number | null;
  asking_price_m2?: number | null;
  days_listed?: number | null;
  for_sale_yoy?: number | null;
  asking_price_m2_yoy?: number | null;
  days_listed_yoy?: number | null;
}

export type Frequency = "quarter" | "month";

export type DomainKey =
  | "for_sale"
  | "asking_price_m2"
  | "days_listed"
  | "for_sale_yoy"
  | "asking_price_m2_yoy"
  | "days_listed_yoy"
  | "price_4q"
  | "price_4q_real"
  | "yoy_pct"
  | "yoy_real_pct"
  | "accel_pp"
  | "dom_4q"
  | "dom_yoy_days"
  | "n_sold_4q"
  | "quarters_of_supply"
  | "discount_pct";

export type Domains = Record<string, Partial<Record<DomainKey, [number, number]>>>;

export interface Metric {
  id: MetricId;
  label: string;
  short: string;
  column: DomainKey;
  kind: "sequential" | "diverging";
  /**
   * 色阶在值域内怎么走。
   *
   * 价格和成交量都是强右偏的比例量：最贵的 kommune 是最便宜的 8 倍，
   * 线性铺开的话 98 个里有 70 个挤在最暗的两档里，地图看着像一整块。
   * 取对数之后"两倍价差"在色阶上任何位置都是同样的距离，这才是
   * 比例量该有的读法。去化季数偏得没那么狠，用 sqrt 就够。
   */
  scale?: "linear" | "log" | "sqrt";
  /** true = 值越大颜色越"热"。挂牌天数和去化季数要反过来：天数越少市场越热。 */
  invert?: boolean;
  unit: string;
  blurb: string;
  format: (v: number) => string;
  /** 图例两端和中点的刻度文本 */
  tick: (v: number) => string;
}

const nf = (d: number) =>
  new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

export const fmtKr = (v: number) => `${nf(0).format(Math.round(v))} kr`;
export const fmtKrM2 = (v: number) => `${nf(0).format(Math.round(v))} kr/m²`;
export const fmtPct = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(1).format(Math.abs(v))}%`;
export const fmtPp = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(1).format(Math.abs(v))} pp`;
export const fmtDays = (v: number) => `${nf(0).format(Math.round(v))} days`;
export const fmtDaysDelta = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(0).format(Math.abs(Math.round(v)))} d`;
export const fmtInt = (v: number) => nf(0).format(Math.round(v));
export const fmtQ = (v: number) => `${nf(1).format(v)}Q`;

export const METRICS: Metric[] = [
  {
    id: "price",
    label: "Price level",
    short: "Price",
    column: "price_4q",
    kind: "sequential",
    scale: "log",
    unit: "kr/m²",
    blurb:
      "Realised transaction price per square metre, averaged over the trailing four quarters.",
    format: fmtKrM2,
    tick: (v) => `${Math.round(v / 1000)}k`,
  },
  {
    id: "growth",
    label: "Price growth (YoY)",
    short: "Growth",
    column: "yoy_pct",
    kind: "diverging",
    unit: "%",
    blurb:
      "Change in the trailing-four-quarter average price against the same period a year earlier.",
    format: fmtPct,
    tick: (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v))}%`,
  },
  {
    id: "dom",
    label: "Days on market",
    short: "Days",
    column: "dom_4q",
    kind: "sequential",
    invert: true,
    unit: "days",
    blurb:
      "Median time from listing to sale. Prices lag the market; selling time leads it — this moves first when the market turns.",
    format: fmtDays,
    tick: (v) => `${Math.round(v)}d`,
  },
  {
    id: "volume",
    label: "Transactions",
    short: "Volume",
    column: "n_sold_4q",
    kind: "sequential",
    scale: "log",
    unit: "sales",
    blurb: "Dwellings sold over the trailing four quarters.",
    format: (v) => `${fmtInt(v)} sales`,
    tick: (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v)}`),
  },
  {
    id: "supply",
    label: "Quarters of supply",
    short: "Supply",
    column: "quarters_of_supply",
    kind: "sequential",
    scale: "sqrt",
    unit: "quarters",
    blurb:
      "Homes for sale at quarter end divided by homes sold that quarter — how long the standing stock would take to clear.",
    format: fmtQ,
    tick: (v) => `${nf(1).format(v)}Q`,
  },
  {
    id: "gap",
    label: "Asking vs realised",
    short: "Gap",
    column: "discount_pct",
    kind: "diverging",
    invert: true,
    unit: "%",
    blurb:
      "How far the realised price landed from the initial asking price. Negative means sellers took less than they asked.",
    format: fmtPct,
    tick: (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v))}%`,
  },
];

/**
 * 月度指标。UDB010/020/030。
 *
 * 只有三个，而且全是**挂牌侧**的量：在售套数、要价、已挂天数。
 * 免费数据里没有月度成交价，所以月度模式下没有 "Price" 和 "Growth" ——
 * 不是漏了，是那两个指标在月度上根本不存在。菜单里不列出来，
 * 比列出来再灰掉更诚实。
 *
 * 好处是它比季度数据新四个月，而且挂牌先动、成交后动。
 */
export const MONTHLY_METRICS: Metric[] = [
  {
    id: "stock",
    label: "Homes for sale",
    short: "For sale",
    column: "for_sale",
    kind: "sequential",
    scale: "log",
    unit: "homes",
    blurb:
      "Homes standing on the market at the end of the month. Inventory builds before prices move.",
    format: (v) => `${fmtInt(v)} homes`,
    tick: (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v)}`),
  },
  {
    id: "asking",
    label: "Asking price",
    short: "Asking",
    column: "asking_price_m2",
    kind: "sequential",
    scale: "log",
    unit: "kr/m²",
    blurb:
      "What sellers are asking for homes currently on the market. Higher than realised prices, because expensive homes linger and cheap ones clear.",
    format: fmtKrM2,
    tick: (v) => `${Math.round(v / 1000)}k`,
  },
  {
    id: "listed",
    label: "Days listed so far",
    short: "Days listed",
    column: "days_listed",
    kind: "sequential",
    invert: true,
    unit: "days",
    blurb:
      "How long the homes still for sale have been waiting. Not time-to-sale — these are the ones that have not sold.",
    format: fmtDays,
    tick: (v) => `${Math.round(v)}d`,
  },
];

export const METRIC_BY_ID = Object.fromEntries(
  [...METRICS, ...MONTHLY_METRICS].map((m) => [m.id, m]),
) as Record<MetricId, Metric>;

export const metricsFor = (freq: Frequency) =>
  freq === "month" ? MONTHLY_METRICS : METRICS;

/**
 * 名义 / 实际。
 *
 * 时间轴一路拉到 1992 年，那年全国房价 4,121 kr/m²，今天 13,672。
 * 名义值看着是涨了 232%，但其中一大半只是钱变毛了 —— 同期 CPI 也涨了一倍多。
 * 实际价格用 DST 的 PRIS113 平减到最新季度的克朗，所以读作
 * "换算成今天的钱是多少"。
 *
 * 只有价格和价格增长有名义/实际之分。天数、笔数、去化季数本来就不是钱。
 */
export function resolveMetric(metric: Metric, real: boolean): Metric {
  if (!real) return metric;
  if (metric.id === "price") {
    return {
      ...metric,
      column: "price_4q_real",
      label: "Price level, real",
      blurb:
        "Realised price per square metre, averaged over four quarters and " +
        "deflated to today's kroner using the consumer price index.",
    };
  }
  if (metric.id === "growth") {
    return {
      ...metric,
      column: "yoy_real_pct",
      label: "Price growth, real (YoY)",
      blurb:
        "Change in the four-quarter average price against a year earlier, " +
        "after stripping out consumer price inflation.",
    };
  }
  return metric;
}

/** 这个指标有没有实际口径。没有的话切换开关对它不起作用。 */
export const hasRealVariant = (id: MetricId) => id === "price" || id === "growth";

/** 行政层级。三层的数字都来自 BM010/020/030 自己的行，不是我们聚合的。 */
export const GEO_LEVELS: {
  id: "landsdel" | "region" | "kommune";
  label: string;
  note: string;
}[] = [
  {
    id: "landsdel",
    label: "Landsdele",
    note: "11 areas — the level where Zealand, Funen and Jutland separate",
  },
  { id: "region", label: "Regioner", note: "5 administrative regions" },
  { id: "kommune", label: "Kommuner", note: "98 municipalities" },
];

export const CATEGORIES: { id: Category; label: string; note: string }[] = [
  { id: "house", label: "Houses", note: "Detached and terraced" },
  { id: "flat", label: "Flats", note: "Owner-occupied flats — an urban market" },
  { id: "holiday", label: "Holiday homes", note: "Concentrated on the coasts" },
];

/* ------------------------------------------------------------------ *
 * 配色
 * ------------------------------------------------------------------ */

export type Theme = "light" | "dark";

/**
 * 两套配色，浅色深色各一套。不是把浅色的反过来用 ——
 * 浅底上"深 = 高"，暗底上"亮 = 高"，两边的语义方向是相反的。
 *
 * 色相都收在北欧的暖调里：陶土、赭石、旧木头，发散色阶的另一端用
 * 苔绿偏青，避开纯蓝纯红那种警报灯的观感。
 */
interface Palette {
  /** 数据不足。中性 + 斜线纹理，绝不参与任何色阶。 */
  gray: string;
  grayLine: string;
  /** 海。地图背景不能是空白 */
  water: string;
  coast: string;
  /** 区域之间的分隔线 */
  border: string;
  hover: string;
  select: string;
  /** 单调色阶 */
  seq: string[];
  /** 发散色阶：青绿（跌）-> 接近纸的中性（不动）-> 陶土（涨） */
  div: string[];
}

const PALETTES: Record<Theme, Palette> = {
  light: {
    gray: "#cdc5b6",
    grayLine: "#a89e8c",
    water: "#dde3e2",
    coast: "#c3ccca",
    border: "#f4efe6",
    hover: "#2a2621",
    select: "#a35a38",
    // 亚麻 -> 赭石 -> 深褐。浅底上越深越高。
    seq: ["#f2e8d6", "#e5cfa9", "#d3ad78", "#b9854f", "#95602f", "#653c18"],
    div: [
      "#1f5c58",
      "#3d8480",
      "#8fb5b0",
      "#ece4d6",
      "#dda683",
      "#bf6a45",
      "#8c3a20",
    ],
  },
  dark: {
    gray: "#423b31",
    grayLine: "#5d5445",
    water: "#14171a",
    coast: "#2a3033",
    border: "#1a1714",
    hover: "#f0e9dd",
    select: "#d98a5f",
    // 暗底上反过来：越亮越高
    seq: ["#2b241c", "#4a3826", "#6d4f2e", "#956b38", "#c29352", "#e8c384"],
    div: [
      "#4fa39d",
      "#3a807b",
      "#2c5450",
      "#332c24",
      "#7a4a30",
      "#b26a42",
      "#e59460",
    ],
  },
};

export const palette = (theme: Theme) => PALETTES[theme];

/** 兼容旧调用：默认浅色的灰 */
export const GRAY_DATA = PALETTES.light.gray;

function hex2rgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgb2hex(r: number, g: number, b: number) {
  const c = (x: number) =>
    Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** 在色阶数组里按 t∈[0,1] 线性插值。够用了，不值得为此拉一个 d3 进来。 */
function ramp(stops: string[], t: number) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = hex2rgb(stops[i]);
  const b = hex2rgb(stops[i + 1]);
  return rgb2hex(
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  );
}

/** 正向变换：把原始值映射到 [0,1]。log 的下界夹到 1 以上，避免 0 和负数。 */
function toUnit(metric: Metric, v: number, lo: number, hi: number): number {
  const s = metric.scale ?? "linear";
  if (s === "log") {
    const a = Math.log(Math.max(lo, 1e-6));
    const b = Math.log(Math.max(hi, 1e-6));
    return (Math.log(Math.max(v, 1e-6)) - a) / (b - a || 1);
  }
  if (s === "sqrt") {
    const a = Math.sqrt(Math.max(lo, 0));
    const b = Math.sqrt(Math.max(hi, 0));
    return (Math.sqrt(Math.max(v, 0)) - a) / (b - a || 1);
  }
  return (v - lo) / (hi - lo || 1);
}

/** 反向变换：图例上 t 处对应的原始值，用来标中间那个刻度。 */
export function unitToValue(
  metric: Metric,
  t: number,
  lo: number,
  hi: number,
): number {
  const s = metric.scale ?? "linear";
  if (s === "log") {
    const a = Math.log(Math.max(lo, 1e-6));
    const b = Math.log(Math.max(hi, 1e-6));
    return Math.exp(a + (b - a) * t);
  }
  if (s === "sqrt") {
    const a = Math.sqrt(Math.max(lo, 0));
    const b = Math.sqrt(Math.max(hi, 0));
    return (a + (b - a) * t) ** 2;
  }
  return lo + (hi - lo) * t;
}

/* ------------------------------------------------------------------ *
 * 分档
 *
 * 地图用**离散色块**而不是连续渐变。渐变好看，但看图的人没法把一块颜色
 * 还原成一个数 —— 只能读出"比旁边深一点"。分档之后每块颜色对应一个
 * 写在图例上的区间，可以直接读数。纽约联储那张房价地图就是这么做的
 * （PRD §12 把它列为参考方向）。
 * ------------------------------------------------------------------ */

/**
 * 1 / 2 / 2.5 / 5 / 10 那一族"好看的数"。
 *
 * 往**下**取，不往上取。往上取的话 ±26% 的值域会得到 10% 的步长、
 * 分界一直铺到 ±40%，而实际数据只落在 ±20% 以内 —— 结果 98 个 kommune
 * 挤在中间两档里，等于白分。往下取得到 5%，分界到 ±20%，
 * 外面两档是开区间，正好接住尾巴。
 */
function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm >= 10 ? 10 : norm >= 5 ? 5 : norm >= 2.5 ? 2.5 : norm >= 2 ? 2 : 1;
  return step * mag;
}

export interface Bins {
  /** 分界值，升序 */
  breaks: number[];
  /** breaks.length + 1 个颜色，第 i 个对应 breaks[i-1] 到 breaks[i] */
  colors: string[];
}

/**
 * 给一个指标算出分档。
 *
 * 发散型（增长率、议价空间）在 0 两侧对称分档，**0 必须正好是一个分界**，
 * 否则"涨一点"和"跌一点"会共用一块颜色，这在房价图上是不能接受的。
 * 单调型沿各自的变换（log / sqrt）等距分档，再把分界圆整成好看的数。
 */
export function binsFor(
  metric: Metric,
  domain: [number, number] | undefined,
  theme: Theme = "light",
): Bins | null {
  if (!domain) return null;
  const [lo, hi] = domain;
  if (!(hi > lo)) return null;
  const pal = PALETTES[theme];

  if (metric.kind === "diverging") {
    // 每侧四档，0 居中。±26% 会得到 ±5 / ±10 / ±15 / ±20。
    const per = 4;
    const step = niceStep(Math.max(Math.abs(lo), Math.abs(hi)) / per);
    const breaks = Array.from({ length: per * 2 + 1 }, (_, i) => (i - per) * step);
    const colors = Array.from({ length: breaks.length + 1 }, (_, i) =>
      ramp(pal.div, i / breaks.length),
    );
    return { breaks, colors: metric.invert ? colors.slice().reverse() : colors };
  }

  const n = 6;
  const raw = Array.from({ length: n - 1 }, (_, i) =>
    unitToValue(metric, (i + 1) / n, lo, hi),
  );
  const breaks: number[] = [];
  for (const v of raw) {
    const st = niceStep(Math.abs(v) / 2 || 1);
    const r = Math.round(v / st) * st;
    if (!breaks.length || r > breaks[breaks.length - 1]) breaks.push(r);
  }
  if (!breaks.length) return null;
  const colors = Array.from({ length: breaks.length + 1 }, (_, i) =>
    ramp(pal.seq, i / breaks.length),
  );
  return { breaks, colors: metric.invert ? colors.slice().reverse() : colors };
}

/** 值落在哪一档 */
export function binIndex(breaks: number[], v: number): number {
  let i = 0;
  while (i < breaks.length && v >= breaks[i]) i++;
  return i;
}

/**
 * 一个单元最终画什么颜色。
 * 超出两端归进最外面那一档 —— Frederiksberg 的 88,000 kr/m² 是真实的
 * 离群值，让它把整条色阶拉平会毁掉其它 97 个 kommune 的可读性。
 */
export function colorFor(
  metric: Metric,
  value: number | null | undefined,
  domain: [number, number] | undefined,
  theme: Theme = "light",
): string {
  const pal = PALETTES[theme];
  if (value == null || !Number.isFinite(value)) return pal.gray;
  const bins = binsFor(metric, domain, theme);
  if (!bins) return pal.gray;
  return bins.colors[binIndex(bins.breaks, value)] ?? pal.gray;
}

/** 涨跌染色用在排行榜数字上，和地图的发散色阶保持一致。 */
export function trendClass(v: number | null | undefined, invert = false) {
  if (v == null || !Number.isFinite(v)) return "";
  const positive = invert ? v < 0 : v > 0;
  return positive ? "row__v--pos" : "row__v--neg";
}

/* ------------------------------------------------------------------ *
 * 样本量
 * ------------------------------------------------------------------ */

/**
 * 四档门槛。ETL 已经算好写进 reliability 列，这里只负责说人话。
 *
 * unverified 是 PRD 三档之外多出来的一档：成交量数据 2004 年才开始，
 * 而价格从 1992 年就有。把那十二年划成 insufficient 等于宣称
 * "我们知道那里成交太少"，但我们只是没有那个数。区别很重要。
 */
export const RELIABILITY_NOTE: Record<Reliability, string | null> = {
  ok: null,
  low: "Low sample",
  unverified: "Sample size not published before 2004",
  insufficient: "Insufficient data",
};

/** 能不能上色。只有 insufficient 是灰的。 */
export const canColor = (r: Reliability) => r !== "insufficient";

/** 能不能上排行榜。PRD §5：低样本单元直接排除，不是显示后加标注。
 *  样本量查不到的也一样排除 —— 排不了就是排不了。 */
export const canRank = (r: Reliability) => r === "ok";

/* ------------------------------------------------------------------ *
 * 季度工具
 * ------------------------------------------------------------------ */

export const quarterLabel = (q: string) => q.replace("Q", " Q");

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026M07" -> "Jul 2026" */
export function monthLabel(m: string): string {
  if (!m || !m.includes("M")) return m;
  const [y, mm] = m.split("M");
  return `${MONTH_NAMES[Number(mm) - 1] ?? mm} ${y}`;
}

/** "2026Q1" -> 8104，用来做大小比较和减法 */
export function quarterIndex(q: string): number {
  const y = Number(q.slice(0, 4));
  const n = Number(q.slice(5));
  return y * 4 + (n - 1);
}

export function shiftQuarter(q: string, by: number): string {
  const i = quarterIndex(q) + by;
  return `${Math.floor(i / 4)}Q${(i % 4) + 1}`;
}

/** 时间窗按钮。PRD §6.1：没有月度价格数据，所以最短就是 1 个季度。 */
export const WINDOWS = [
  { id: "1Q", quarters: 1, label: "1Q" },
  { id: "4Q", quarters: 4, label: "4Q" },
  { id: "3Y", quarters: 12, label: "3Y" },
  { id: "5Y", quarters: 20, label: "5Y" },
  { id: "10Y", quarters: 40, label: "10Y" },
] as const;

export type WindowId = (typeof WINDOWS)[number]["id"];
