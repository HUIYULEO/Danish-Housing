/**
 * 参数化查询模板。
 *
 * PRD §10 说 NLQ 阶段不放开自由 SQL，只让 LLM 填一组固定模板的参数。
 * 那组模板就是这个文件 —— UI 现在用的和以后 LLM 用的是同一批函数，
 * 所以"AI 只能看到查询返回的数字"这件事是架构保证的，不是 prompt 保证的。
 *
 * 所有函数都只从 reliability 列过滤，不自己重算门槛。
 */

import { query, lit } from "./db";
import type { Category, PanelRow } from "./metrics";

/** 行政层级。三层的数字来自同一张 kommune 面板 —— BM010/020/030 的 OMR20
 *  本来就含 region（081-085）和 landsdel（01-11）的行，不是我们自己聚合的。 */
export type GeoLevel = "landsdel" | "region" | "kommune";

/** 面板里所有要往界面上送的列，两级共用。 */
const COLS = `price_4q, price_4q_real, yoy_pct, yoy_real_pct,
              accel_pp, dom_4q, dom_yoy_days,
              n_sold, n_sold_4q, n_for_sale, quarters_of_supply,
              discount_pct, reliability`;

export interface MoverRow extends PanelRow {
  name?: string;
}

/** 某个季度、某个房产类型的全部 kommune 切片。地图涂色用这一条。 */
export function mapSlice(
  quarter: string,
  category: Category,
  level: GeoLevel = "kommune",
) {
  return query<PanelRow>(
    `SELECT area_code, category, ${COLS}
     FROM kommune
     WHERE area_level = ${lit(level)}
       AND quarter = ${lit(quarter)}
       AND category = ${lit(category)}`,
  );
}

/**
 * 月度切片。UDB010/020/030，只有挂牌侧的三个指标。
 *
 * 这是"季度是不是最小颗粒度"的答案：成交价是，挂牌数据不是。
 * 月度模式下不做样本量分级 —— 在售套数是个普查量，不是抽样，
 * 没有"样本太薄"这回事；缺就是缺。
 */
export function monthlySlice(
  month: string,
  category: Category,
  level: GeoLevel = "kommune",
) {
  return query<PanelRow>(
    `SELECT area_code, category,
            for_sale, asking_price_m2, days_listed,
            for_sale_yoy, asking_price_m2_yoy, days_listed_yoy,
            CASE WHEN asking_price_m2 IS NULL AND for_sale IS NULL
                 THEN 'insufficient' ELSE 'ok' END AS reliability
     FROM monthly
     WHERE area_level = ${lit(level)}
       AND month = ${lit(month)}
       AND category = ${lit(category)}`,
  );
}

/** 月度面板里有哪些月份可选 */
export function monthlyMonths() {
  return query<{ month: string }>(
    `SELECT DISTINCT month FROM monthly ORDER BY month`,
  );
}

/** 一个区域的完整时间序列，用于详情页的走势图。 */
export function areaSeries(areaCode: string, category: Category) {
  // area_code 唯一，三层都能用同一条
  return query<PanelRow & { quarter: string }>(
    `SELECT quarter, area_code, category, ${COLS}
     FROM kommune
     WHERE area_code = ${lit(areaCode)}
       AND category = ${lit(category)}
     ORDER BY quarter`,
  );
}

/** 全国基准线（OMR20 的 '00'）。详情页和首页顶条都要它。 */
export function nationalSeries(category: Category) {
  return query<PanelRow & { quarter: string }>(
    `SELECT quarter, area_code, category, ${COLS}
     FROM kommune
     WHERE area_code = '00' AND category = ${lit(category)}
     ORDER BY quarter`,
  );
}

/**
 * ⚠️ 冻结中（frozen）—— 目前没有任何地方调用它。
 *
 * kommune 下面样本量够的 postnummer，用于详情页的下钻列表。
 *
 * 冻结的原因：邮编下钻界面没做，而 panel_postnr.parquet 有 4.1 MB。
 * 与其发一份没人查的数据，不如先不注册那个视图。
 * ETL 照常产出 data/panel_postnr.parquet，覆盖率也照常进 REPORT.md，
 * 只是不进 public/data、不注册成 DuckDB 视图。
 *
 * 解冻要做三件事：
 *   1. dk_housing_etl.py 的 export_web() 把 "postnr" 加回导出列表
 *   2. lib/db.ts 的 registerFileURL 循环把 "postnr" 加回去
 *   3. 界面上接下钻入口（AreaCard / Area Detail 已经有邮编号可用）
 *
 * 注意：这里用的是 postnummer 面板自己的数字，crosswalk 只负责
 * "哪些邮编属于这个 kommune"。22.6% 的邮编跨多个 kommune，
 * 所以那是一份展示用的归属，不是加总用的权重。
 */
export function postnrIn(codes: string[], quarter: string, category: Category) {
  if (!codes.length) return Promise.resolve([]);
  const list = codes.map(lit).join(",");
  return query<PanelRow & { postnr: string }>(
    `SELECT postnr, category, ${COLS}
     FROM postnr
     WHERE postnr IN (${list})
       AND quarter = ${lit(quarter)}
       AND category = ${lit(category)}
       AND reliability <> 'insufficient'
     ORDER BY n_sold_4q DESC`,
  );
}

export type BoardId =
  | "rising"
  | "falling"
  | "accelerating"
  | "cooling"
  | "heating"
  | "stalling";

export interface BoardSpec {
  id: BoardId;
  title: string;
  hint: string;
  /** 卡片右侧显示哪一列 */
  valueColumn: "yoy_pct" | "accel_pp" | "dom_yoy_days";
  /** 数值染色时是否要反转（天数下降是好事） */
  invert?: boolean;
}

export const BOARDS: BoardSpec[] = [
  {
    id: "rising",
    title: "Fastest rising",
    hint: "Biggest year-on-year price gain",
    valueColumn: "yoy_pct",
  },
  {
    id: "falling",
    title: "Fastest falling",
    hint: "Biggest year-on-year price fall",
    valueColumn: "yoy_pct",
  },
  {
    id: "accelerating",
    title: "Accelerating",
    hint: "Growth speeding up, and still positive",
    valueColumn: "accel_pp",
  },
  {
    id: "cooling",
    title: "Cooling",
    hint: "Growth slowing, but still positive",
    valueColumn: "accel_pp",
  },
  {
    id: "heating",
    title: "Heating up",
    hint: "Selling faster than a year ago",
    valueColumn: "dom_yoy_days",
    invert: true,
  },
  {
    id: "stalling",
    title: "Stalling",
    hint: "Taking longer to sell than a year ago",
    valueColumn: "dom_yoy_days",
    invert: true,
  },
];

/**
 * 排行榜。PRD §7 的定义逐条对应：
 *
 *   Fastest Rising    g(latest) 最大
 *   Fastest Falling   g(latest) 最小
 *   Accelerating      g(latest) - g(latest-4) 最大，且 g(latest) > 0
 *   Cooling           g(latest) - g(latest-4) 最小，且 g(latest) > 0
 *   Heating up        挂牌天数同比下降最多
 *   Stalling          挂牌天数同比上升最多
 *
 * Cooling 那条 g > 0 的约束不能省，不然它会和 Fastest Falling 是同一批人。
 * 全部只取 reliability = 'ok'：榜单是"我们认为值得看的东西"，
 * 不该混进我们自己都不信的数字。
 */
export function board(
  id: BoardId,
  quarter: string,
  category: Category,
  limit = 5,
  real = false,
  level: GeoLevel = "kommune",
) {
  // 名义/实际要跟着地图走。地图标着 "real kroner" 而旁边榜单排的是名义涨幅，
  // 那是两张表放在一起互相拆台。
  const yoy = real ? "yoy_real_pct" : "yoy_pct";
  const base = `FROM kommune
     WHERE area_level = ${lit(level)}
       AND quarter = ${lit(quarter)}
       AND category = ${lit(category)}
       AND reliability = 'ok'`;

  const spec: Record<BoardId, { where: string; order: string }> = {
    rising: { where: `${yoy} IS NOT NULL`, order: `${yoy} DESC` },
    falling: { where: `${yoy} IS NOT NULL`, order: `${yoy} ASC` },
    accelerating: {
      where: `accel_pp IS NOT NULL AND ${yoy} > 0`,
      order: "accel_pp DESC",
    },
    cooling: {
      where: `accel_pp IS NOT NULL AND ${yoy} > 0`,
      order: "accel_pp ASC",
    },
    heating: { where: "dom_yoy_days IS NOT NULL", order: "dom_yoy_days ASC" },
    stalling: { where: "dom_yoy_days IS NOT NULL", order: "dom_yoy_days DESC" },
  };

  const s = spec[id];
  return query<MoverRow>(
    `SELECT area_code, category, ${COLS}
     ${base} AND ${s.where}
     ORDER BY ${s.order}
     LIMIT ${Math.max(1, Math.min(50, Math.floor(limit)))}`,
  );
}

/** 覆盖率统计，给 Data & Methods 页用真实数字而不是写死的文案。 */
export function coverage(quarter: string, category: Category) {
  return query<{ reliability: string; n: number }>(
    `SELECT reliability, COUNT(*)::INT AS n
     FROM kommune
     WHERE area_level = 'kommune'
       AND quarter = ${lit(quarter)}
       AND category = ${lit(category)}
     GROUP BY reliability`,
  );
}

/**
 * 任意时间窗的价格变化。
 *
 * PRD §6.1 的时间切换是 1Q/4Q/3Y/5Y/10Y，但面板里预算好的只有 4Q 同比。
 * 其它窗口在这里现算：拿当前季度的滚动 4 季度均价，比 N 个季度之前的同一列。
 *
 * 用 price_4q 而不是 price_m2_realised 是 PRD §5 的规则 ——
 * 增长率一律用滚动 4 季度均价算，不用单季度点对点，否则薄样本会把曲线打成锯齿。
 */
export function growthSlice(
  quarter: string,
  prevQuarter: string,
  category: Category,
  real = false,
  level: GeoLevel = "kommune",
) {
  // 实际口径下起点和终点都要用平减过的列，否则算出来的是
  // "名义终点比实际起点"，那不是任何一个有意义的数
  const priceCol = real ? "price_4q_real" : "price_4q";
  return query<PanelRow>(
    `WITH s AS (
       SELECT area_code, quarter, ${COLS}
       FROM kommune
       WHERE area_level = ${lit(level)} AND category = ${lit(category)}
     ),
     cur AS (SELECT * FROM s WHERE quarter = ${lit(quarter)}),
     prv AS (
       SELECT area_code, ${priceCol} AS p0, reliability AS r0
       FROM s WHERE quarter = ${lit(prevQuarter)}
     )
     SELECT
       cur.area_code,
       ${lit(category)} AS category,
       cur.price_4q, cur.price_4q_real, cur.accel_pp, cur.dom_4q, cur.dom_yoy_days,
       cur.n_sold, cur.n_sold_4q, cur.n_for_sale,
       cur.quarters_of_supply, cur.discount_pct,
       CASE WHEN prv.p0 > 0 AND prv.r0 <> 'insufficient'
            THEN (cur.${priceCol} / prv.p0 - 1) * 100 END
         AS ${real ? "yoy_real_pct" : "yoy_pct"},
       ${real ? "cur.yoy_pct" : "cur.yoy_real_pct"} AS
         ${real ? "yoy_pct" : "yoy_real_pct"},
       -- 起点样本量确实不够的话，这个变化率也不可信，一并降级。
       -- 但"2004 年以前没发布成交量"不算不够 —— 那会让 10Y 窗口
       -- 在 2014 年之前的每一个季度都整片变灰，而起点价格是官方发布的。
       CASE
         WHEN prv.p0 IS NULL THEN 'insufficient'
         WHEN prv.r0 = 'insufficient' THEN 'insufficient'
         WHEN prv.r0 = 'unverified' AND cur.reliability = 'ok'
              THEN 'unverified'
         ELSE cur.reliability
       END AS reliability
     FROM cur LEFT JOIN prv USING (area_code)`,
  );
}
