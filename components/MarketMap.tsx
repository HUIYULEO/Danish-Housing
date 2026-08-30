"use client";

/**
 * 主地图。MapLibre GL，没有底图瓦片。
 *
 * 不挂 OSM/卫星底图是有意的：这是一张统计图，不是导航地图。
 * 底图会和 choropleth 抢注意力，而且要么要 API key 要么要外部依赖。
 * 画面上只有丹麦的形状和数据的颜色。
 *
 * 涂色走 feature-state 而不是重建 GeoJSON：时间轴拖动时每季度只更新
 * 98 个 feature 的 state，几何完全不动，所以是本地毫秒级的。
 */

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl, { type Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { asset } from "@/lib/paths";
import {
  colorFor,
  palette,
  RELIABILITY_NOTE,
  fmtInt,
  type Domains,
  type Metric,
  type PanelRow,
  type Reliability,
  type Theme,
} from "@/lib/metrics";

/** 三个行政层级各自的边界文件。数据全在同一张 kommune 面板里，
 *  因为 BM010/020/030 的 OMR20 本来就含 region 和 landsdel 的行。 */
export type GeoLevel = "landsdel" | "region" | "kommune";

const GEO_SRC: Record<GeoLevel, string> = {
  landsdel: "/geo/landsdele.geojson",
  region: "/geo/regioner.geojson",
  kommune: "/geo/kommuner.geojson",
};

const geoUrl = (l: GeoLevel) => asset(GEO_SRC[l]);

export interface AreaMeta {
  code: string;
  name: string;
  region?: string;
}

interface Props {
  rows: PanelRow[];
  metric: Metric;
  domains: Domains;
  category: string;
  quarter: string;
  selected: string | null;
  onSelect: (code: string | null) => void;
  areaNames: Map<string, string>;
  postnrByKommune: Record<string, string[]>;
  level: GeoLevel;
  theme: Theme;
}

interface HoverInfo {
  x: number;
  y: number;
  code: string;
  name: string;
}

const DK_BOUNDS: [number, number, number, number] = [7.5, 54.4, 15.4, 57.9];

/**
 * 建图那一刻的海水色直接从 CSS 变量读，不从 React 的 theme state 读。
 *
 * 原因是时序：theme state 第一帧一定是 "light"（服务端渲染不知道系统偏好），
 * 要等 matchMedia 的 effect 跑完才变成 dark。而地图在那之前就建好了，
 * 背景层会先刷一块浅色。CSS 变量在首帧就已经是对的了（data-theme 由
 * layout 里的内联脚本在绘制前落好，prefers-color-scheme 更是立即生效）。
 */
function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}
const FIT_PADDING = { top: 28, bottom: 28, left: 28, right: 28 };

export default function MarketMap({
  rows,
  metric,
  domains,
  category,
  quarter,
  selected,
  onSelect,
  areaNames,
  postnrByKommune,
  level,
  theme,
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const resizeObs = useRef<ResizeObserver | null>(null);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  // rows 变化很频繁（拖时间轴），用 ref 让事件回调永远读到最新的，
  // 而不用把地图事件重新绑一遍
  const rowsRef = useRef<Map<string, PanelRow>>(new Map());
  rowsRef.current = new Map(rows.map((r) => [r.area_code, r]));
  const metricRef = useRef(metric);
  metricRef.current = metric;
  const levelRef = useRef(level);
  levelRef.current = level;

  /* ---------------- 初始化 ---------------- */
  useEffect(() => {
    if (!holder.current || map.current) return;

    const m = new maplibregl.Map({
      container: holder.current,
      // 故意不放 background 图层：canvas 保持透明，露出 .mapwrap 的 CSS 背景，
      // 那个背景是 var(--water)，切主题时和整页一起变，不存在时序问题。
      // 用 background 图层的话，它的颜色要靠 setPaintProperty 去追主题，
      // 而 setPaintProperty 在样式没加载完时会抛错，第一帧就可能刷错颜色。
      style: { version: 8, sources: {}, layers: [] },
      bounds: DK_BOUNDS,
      fitBoundsOptions: { padding: FIT_PADDING },
      minZoom: 5,
      maxZoom: 11,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchZoomRotate: true,
    });
    m.touchZoomRotate.disableRotation();

    m.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    m.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          "Boundaries: DAWA / Styrelsen for Dataforsyning og Infrastruktur · Data: Finans Danmark, Danmarks Statistik",
      }),
      "bottom-right",
    );

    m.on("load", async () => {
      // "数据不足"的斜线纹理。灰色是一等公民，但要让人一眼看出
      // 它和"零变化"的中性色不是一回事，所以给它一层纹理。
      m.addImage("hatch", makeHatch(palette(theme).grayLine), { pixelRatio: 2 });

      const geo = await fetch(geoUrl(levelRef.current)).then((r) => r.json());
      m.addSource("kom", {
        type: "geojson",
        data: geo,
        promoteId: "code", // feature-state 要按 code 寻址
      });
      loadedLevel.current = levelRef.current;

      m.addLayer({
        id: "kom-fill",
        type: "fill",
        source: "kom",
        paint: {
          "fill-color": [
            "coalesce",
            ["feature-state", "color"],
            palette(theme).gray,
          ],
          "fill-opacity": 1,
        },
      });

      // 数据不足的单元额外盖一层斜线。
      // 注意：feature-state 不能用在 layer 的 filter 里（MapLibre 会直接报错），
      // 所以这三层"按状态显示"的效果都走 paint 表达式，用 opacity 开关。
      m.addLayer({
        id: "kom-hatch",
        type: "fill",
        source: "kom",
        paint: {
          "fill-pattern": "hatch",
          "fill-opacity": [
            "case",
            ["==", ["feature-state", "gray"], true],
            0.5,
            0,
          ],
        },
      });

      m.addLayer({
        id: "kom-line",
        type: "line",
        source: "kom",
        paint: {
          "line-color": palette(theme).border,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 10, 1.4],
          "line-opacity": 0.9,
        },
      });

      m.addLayer({
        id: "kom-hover",
        type: "line",
        source: "kom",
        paint: {
          "line-color": palette(theme).hover,
          "line-width": 1.4,
          "line-opacity": [
            "case",
            ["==", ["feature-state", "hover"], true],
            0.85,
            0,
          ],
        },
      });

      m.addLayer({
        id: "kom-sel",
        type: "line",
        source: "kom",
        paint: {
          "line-color": palette(theme).select,
          "line-width": 2.4,
          "line-opacity": [
            "case",
            ["==", ["feature-state", "selected"], true],
            1,
            0,
          ],
        },
      });

      setReady(true);
    });

    m.on("error", (e) => console.error("[maplibre]", e?.error ?? e));

    // 容器尺寸变了（窗口缩放、手机横竖屏切换）就重新 fit 一次。
    // 但只在用户还没自己平移缩放过的时候做 —— 已经放大到某个 kommune 的人
    // 不会希望转个屏幕就被拉回全国视图。
    let userMoved = false;
    m.on("movestart", (e) => {
      if ((e as { originalEvent?: unknown }).originalEvent) userMoved = true;
    });
    const ro = new ResizeObserver(() => {
      m.resize();
      if (!userMoved) {
        m.fitBounds(DK_BOUNDS, { padding: FIT_PADDING, animate: false });
      }
    });
    ro.observe(holder.current);
    resizeObs.current = ro;
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __map?: MlMap }).__map = m;
    }

    map.current = m;
    return () => {
      resizeObs.current?.disconnect();
      resizeObs.current = null;
      m.remove();
      map.current = null;
    };
  }, []);

  /* ---------------- 换行政层级 ---------------- */
  // 只换 source 的数据，不重建图层。三层用的是同一批 paint 表达式，
  // 因为数据都来自同一张面板，区别只是 OMR20 的位数。
  // 记的是"source 里现在装的是哪一层"，不是"初始是哪一层"。
  // 用后者的话，从 kommune 切到 landsdel 再切回来，会因为等于初始值而被跳过，
  // source 里就一直留着 landsdel 的几何，配着 kommune 的数据 —— 全图变灰。
  const loadedLevel = useRef<GeoLevel | null>(null);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (loadedLevel.current === level) return;
    let alive = true;
    fetch(geoUrl(level))
      .then((r) => r.json())
      .then((geo) => {
        if (!alive || !map.current) return;
        (m.getSource("kom") as maplibregl.GeoJSONSource).setData(geo);
        loadedLevel.current = level;
        m.fitBounds(DK_BOUNDS, { padding: FIT_PADDING, animate: false });
      })
      .catch((e) => console.error("[geo]", e));
    return () => {
      alive = false;
    };
  }, [level, ready]);

  /* ---------------- 换主题 ---------------- */
  // 底色和三条描边不是 feature-state，改主题要显式重设一遍。
  // 填充色由下面的涂色 effect 负责（它依赖 theme）。
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const pal = palette(theme);
    const apply = () => {
      if (!map.current) return;
      m.setPaintProperty("kom-line", "line-color", pal.border);
      m.setPaintProperty("kom-hover", "line-color", pal.hover);
      m.setPaintProperty("kom-sel", "line-color", pal.select);
      if (m.hasImage("hatch")) m.removeImage("hatch");
      m.addImage("hatch", makeHatch(pal.grayLine), { pixelRatio: 2 });
    };
    // setPaintProperty 在样式还没加载完时会抛 "Style is not done loading"，
    // 所以没就绪就等一次 idle 再改
    if (m.isStyleLoaded()) apply();
    else m.once("idle", apply);
  }, [theme, ready]);

  /* ---------------- 交互 ---------------- */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    let hovered: string | null = null;

    const setHoverState = (code: string | null) => {
      if (hovered === code) return;
      if (hovered != null) {
        m.setFeatureState({ source: "kom", id: hovered }, { hover: false });
      }
      hovered = code;
      if (code != null) {
        m.setFeatureState({ source: "kom", id: code }, { hover: true });
      }
    };

    const onMove = (e: maplibregl.MapMouseEvent) => {
      const f = m.queryRenderedFeatures(e.point, { layers: ["kom-fill"] })[0];
      if (!f) {
        setHoverState(null);
        setHover(null);
        m.getCanvas().style.cursor = "";
        return;
      }
      const code = String(f.id ?? f.properties?.code ?? "");
      setHoverState(code);
      m.getCanvas().style.cursor = "pointer";
      setHover({
        x: e.point.x,
        y: e.point.y,
        code,
        name: String(f.properties?.name ?? code),
      });
    };

    const onLeave = () => {
      setHoverState(null);
      setHover(null);
      m.getCanvas().style.cursor = "";
    };

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const f = m.queryRenderedFeatures(e.point, { layers: ["kom-fill"] })[0];
      onSelect(f ? String(f.id ?? f.properties?.code ?? "") : null);
    };

    m.on("mousemove", onMove);
    m.on("mouseout", onLeave);
    m.on("click", onClick);
    return () => {
      m.off("mousemove", onMove);
      m.off("mouseout", onLeave);
      m.off("click", onClick);
    };
  }, [ready, onSelect]);

  /* ---------------- 涂色 ---------------- */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    const pal = palette(theme);
    const domain = domains[category]?.[metric.column];
    const seen = new Set<string>();

    for (const r of rows) {
      const raw = r[metric.column] as number | null;
      // insufficient 永远不上色，哪怕这一列碰巧有值。
      // 这是 PRD §5 的硬规则：不显示我们自己都不信的数字。
      const usable = r.reliability !== "insufficient" ? raw : null;
      const color = colorFor(metric, usable, domain, theme);
      m.setFeatureState(
        { source: "kom", id: r.area_code },
        { color, gray: usable == null },
      );
      seen.add(r.area_code);
    }

    // 这一季完全没出现在面板里的 kommune 也要灰掉，否则会留着上一季的颜色
    for (const code of areaNames.keys()) {
      if (!seen.has(code)) {
        m.setFeatureState(
          { source: "kom", id: code },
          { color: pal.gray, gray: true },
        );
      }
    }
  }, [rows, metric, domains, category, ready, areaNames, theme]);

  /* ---------------- 选中态 ---------------- */
  const prevSel = useRef<string | null>(null);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (prevSel.current) {
      m.setFeatureState(
        { source: "kom", id: prevSel.current },
        { selected: false },
      );
    }
    if (selected) {
      m.setFeatureState({ source: "kom", id: selected }, { selected: true });
    }
    prevSel.current = selected;
  }, [selected, ready]);

  const tip = useCallback(() => {
    if (!hover) return null;
    const r = rowsRef.current.get(hover.code);
    const mt = metricRef.current;
    const note = r ? RELIABILITY_NOTE[r.reliability as Reliability] : null;
    const value = r && r.reliability !== "insufficient" ? r[mt.column] : null;

    return (
      <div
        className="tip"
        style={{ left: hover.x, top: hover.y }}
        role="status"
        aria-live="polite"
      >
        <div className="tip__n">{hover.name}</div>
        {/* 邮编是丹麦人认地方的方式 —— 说 "2100" 比说 "Østerbro 那一带" 更快。
            列前四个，多的折起来。 */}
        {(postnrByKommune[hover.code]?.length ?? 0) > 0 && (
          <div className="tip__sub num">
            {postnrByKommune[hover.code].slice(0, 4).join(" · ")}
            {postnrByKommune[hover.code].length > 4
              ? ` +${postnrByKommune[hover.code].length - 4}`
              : ""}
          </div>
        )}
        <div className="tip__r">
          <span>{mt.short}</span>
          <b className="num">
            {value != null && Number.isFinite(value)
              ? mt.format(value as number)
              : "—"}
          </b>
        </div>
        {r?.n_sold_4q != null && (
          <div className="tip__r">
            <span>Sales, 4 quarters</span>
            <b className="num">{fmtInt(r.n_sold_4q)}</b>
          </div>
        )}
        {note && (
          <div
            className={`tip__flag${
              r?.reliability === "insufficient" ? " tip__flag--gray" : ""
            }`}
          >
            {note}
            {r?.reliability === "low" && r.n_sold_4q != null
              ? ` · ${fmtInt(r.n_sold_4q)} sales`
              : ""}
          </div>
        )}
      </div>
    );
  }, [hover, postnrByKommune]);

  return (
    <>
      <div
        ref={holder}
        style={{ position: "absolute", inset: 0 }}
        aria-label={`Map of Denmark showing ${metric.label} by kommune for ${quarter}`}
        role="img"
      />
      {tip()}
    </>
  );
}

/** 45° 斜线纹理，给"数据不足"的区域用。 */
function makeHatch(stroke: string): ImageData {
  const s = 8;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, s, s);
  g.strokeStyle = stroke;
  g.lineWidth = 1.1;
  g.beginPath();
  g.moveTo(-2, s + 2);
  g.lineTo(s + 2, -2);
  g.moveTo(s / 2 - 2, s + s / 2 + 2);
  g.lineTo(s + s / 2 + 2, s / 2 - 2);
  g.stroke();
  return g.getImageData(0, 0, s, s);
}
