"use client";

/**
 * The main map. MapLibre GL, with no basemap tiles.
 *
 * Leaving out an OSM/satellite basemap is deliberate: this is a statistical
 * map, not a navigation map. A basemap would compete with the choropleth
 * for attention and would need either an API key or an external dependency.
 * The only things on screen are the shape of Denmark and the colour of the
 * data.
 *
 * Colouring goes through feature-state rather than rebuilding the GeoJSON:
 * when the timeline is dragged, each quarter only updates the state of 98
 * features and the geometry is untouched, so it takes local milliseconds.
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

/** The boundary file for each of the four levels.
 *
 * Data for the first three levels sits in the same kommune panel, because
 * the OMR20 dimension of BM010/020/030 already contains region and landsdel
 * rows. postnr uses another panel (BM011/021/031).
 *
 * postnumre.geojson has been dissolved: inner Copenhagen's 1050-1999 are 486
 * polygons in DAWA, while BM011 only publishes three cells, 1000 / 1500 /
 * 1800. The merge rule is written in scripts/simplify-geo.mjs and in
 * postnr_bucket() in etl/geo.py; the two must agree, or the map gets
 * a hole in the most densely populated part of Denmark. */
export type GeoLevel = "landsdel" | "region" | "kommune" | "postnr";

const GEO_SRC: Record<GeoLevel, string> = {
  landsdel: "/geo/landsdele.geojson",
  region: "/geo/regioner.geojson",
  kommune: "/geo/kommuner.geojson",
  postnr: "/geo/postnumre.geojson",
};

const geoUrl = (l: GeoLevel) => asset(GEO_SRC[l]);

type BBox = [number, number, number, number];

/** Walk the coordinates to compute a bbox. Runs once per level change; 98 polygons cost nothing. */
function bboxOf(geometry: GeoJSON.Geometry): BBox | null {
  let w = 180, s = 90, e = -180, n = -90;
  const walk = (c: unknown): void => {
    if (typeof (c as number[])[0] === "number") {
      const [x, y] = c as number[];
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
      return;
    }
    for (const k of c as unknown[]) walk(k);
  };
  if (!("coordinates" in geometry)) return null;
  walk(geometry.coordinates);
  return e > w && n > s ? [w, s, e, n] : null;
}

function indexBBoxes(geo: GeoJSON.FeatureCollection): Map<string, BBox> {
  const out = new Map<string, BBox>();
  for (const f of geo.features) {
    const code = f.properties?.code as string | undefined;
    if (!code || !f.geometry) continue;
    const b = bboxOf(f.geometry);
    if (b) out.set(code, b);
  }
  return out;
}

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
 * At map creation the sea colour is read straight from the CSS variable, not
 * from React's theme state.
 *
 * The reason is timing: the theme state is always "light" on the first frame
 * (server rendering cannot know the system preference) and only turns dark
 * after the matchMedia effect has run. The map is built before that, so a
 * background layer would first flash a light colour. The CSS variable is
 * already correct on the first frame (data-theme is set before paint by the
 * inline script in layout, and prefers-color-scheme applies immediately).
 */
function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}
const FIT_PADDING = { top: 28, bottom: 28, left: 28, right: 28 };

/** Focusing must zoom in by at least this much, or it looks like "clicked
 *  and nothing happened". Roughly a 2x zoom. */
const MIN_FOCUS_STEP = 1.1;
/** Any closer and only streets are left, which means nothing on a statistical map.
 *  The postal level gets one more step: a postal code is only a tenth the
 *  size of a kommune to begin with. */
const MAX_FOCUS_ZOOM = 9.2;
const MAX_FOCUS_ZOOM_POSTNR = 10.6;

/**
 * Padding when focusing. The info card sits over the top left and the legend
 * over the bottom left; unless those two areas are kept clear, the selected
 * area ends up hiding right behind the card.
 *
 * Each side is clamped against the canvas size. **Once the padding eats the
 * whole canvas, cameraForBounds returns a NaN centre and the camera does not
 * move at all, which looks like the feature was never built.**
 * In short windows and on phones in landscape, the map area really can be
 * only two or three hundred pixels tall.
 */
function focusPadding(m: MlMap) {
  const cv = m.getCanvas();
  const w = cv.clientWidth || 1;
  const h = cv.clientHeight || 1;
  const wide = w >= 700;
  return {
    left: Math.min(wide ? 430 : 30, w * 0.35),
    right: Math.min(60, w * 0.15),
    top: Math.min(wide ? 60 : 140, h * 0.25),
    bottom: Math.min(wide ? 120 : 140, h * 0.25),
  };
}

/** cameraForBounds can return NaN (when the padding is too large, for
 *  instance), so it must be checked before use */
function usableCamera(cam: { center?: unknown; zoom?: number } | null | undefined) {
  if (!cam || typeof cam.zoom !== "number" || !Number.isFinite(cam.zoom)) {
    return false;
  }
  const c = cam.center as { lng?: number; lat?: number } | undefined;
  const lng = c?.lng ?? (Array.isArray(c) ? c[0] : undefined);
  const lat = c?.lat ?? (Array.isArray(c) ? c[1] : undefined);
  return Number.isFinite(lng) && Number.isFinite(lat);
}

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
  const bboxes = useRef<Map<string, BBox>>(new Map());
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  // rows changes very often (dragging the timeline). Refs let the event
  // callbacks always read the latest values without rebinding the map events
  const rowsRef = useRef<Map<string, PanelRow>>(new Map());
  rowsRef.current = new Map(rows.map((r) => [r.area_code, r]));
  const metricRef = useRef(metric);
  metricRef.current = metric;
  const levelRef = useRef(level);
  levelRef.current = level;

  /* ---------------- Initialisation ---------------- */
  useEffect(() => {
    if (!holder.current || map.current) return;

    const m = new maplibregl.Map({
      container: holder.current,
      // Deliberately no background layer: the canvas stays transparent and
      // shows the CSS background of .mapwrap, which is var(--water) and
      // changes with the rest of the page on a theme switch, so there is no
      // timing problem. A background layer would need setPaintProperty to
      // chase the theme, and setPaintProperty throws while the style is
      // still loading, so the very first frame could paint the wrong colour.
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
      // Hatch texture for "insufficient data". Grey is a first-class citizen,
      // but it has to be obvious at a glance that it is not the neutral
      // colour for "no change", hence the texture on top.
      m.addImage("hatch", makeHatch(palette(theme).grayLine), { pixelRatio: 2 });

      const geo = await fetch(geoUrl(levelRef.current)).then((r) => r.json());
      bboxes.current = indexBBoxes(geo);
      m.addSource("kom", {
        type: "geojson",
        data: geo,
        promoteId: "code", // feature-state is addressed by code
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

      // Units with insufficient data get an extra hatch layer on top.
      // Note: feature-state cannot be used in a layer filter (MapLibre
      // throws), so all three "show by state" effects go through paint
      // expressions, switched with opacity.
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

    // When the container resizes (window resize, phone rotation), fit again.
    // But only while the user has not panned or zoomed: someone already
    // zoomed in on a kommune does not want to be pulled back to the national
    // view just for rotating the screen.
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

  /* ---------------- Switching administrative level ---------------- */
  // Only the source data is swapped; layers are not rebuilt. All levels use
  // the same paint expressions, because the data all comes from the same
  // panel and the only difference is the number of digits in OMR20.
  // What is tracked is "which level the source holds now", not "which level
  // it started with". With the latter, switching from kommune to landsdel
  // and back would be skipped for equalling the initial value, leaving
  // landsdel geometry in the source paired with kommune data: an all-grey
  // map.
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
        bboxes.current = indexBBoxes(geo);
        loadedLevel.current = level;
        m.fitBounds(DK_BOUNDS, { padding: FIT_PADDING, animate: false });
      })
      .catch((e) => console.error("[geo]", e));
    return () => {
      alive = false;
    };
  }, [level, ready]);

  /* ---------------- Switching theme ---------------- */
  // The base colour and the three outlines are not feature-state, so a theme
  // change has to reset them explicitly.
  // Fill colours are handled by the colouring effect below (it depends on theme).
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
    // setPaintProperty throws "Style is not done loading" while the style is
    // still loading, so if it is not ready, wait for one idle and then apply
    if (m.isStyleLoaded()) apply();
    else m.once("idle", apply);
  }, [theme, ready]);

  /* ---------------- Interaction ---------------- */
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

  /* ---------------- Colouring ---------------- */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    const pal = palette(theme);
    const domain = domains[category]?.[metric.column];
    const seen = new Set<string>();

    for (const r of rows) {
      const raw = r[metric.column] as number | null;
      // insufficient is never coloured, even if this column happens to hold
      // a value. This is the hard rule from PRD §5: do not show numbers we
      // do not trust ourselves.
      const usable = r.reliability !== "insufficient" ? raw : null;
      const color = colorFor(metric, usable, domain, theme);
      m.setFeatureState(
        { source: "kom", id: r.area_code },
        { color, gray: usable == null },
      );
      seen.add(r.area_code);
    }

    // A kommune entirely absent from the panel this quarter must go grey
    // too, or it keeps last quarter's colour
    for (const code of areaNames.keys()) {
      if (!seen.has(code)) {
        m.setFeatureState(
          { source: "kom", id: code },
          { color: pal.gray, gray: true },
        );
      }
    }
  }, [rows, metric, domains, category, ready, areaNames, theme]);

  /* ---------------- Selected state + focus ---------------- */
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

    // When an area name is clicked in the sidebar, an outline alone is not
    // enough: spotting the highlighted one among 98 kommuner is hard work in
    // itself. So the camera follows.
    if (selected) {
      const b = bboxes.current.get(selected);
      if (b) {
        const cam = m.cameraForBounds(b, { padding: focusPadding(m) });
        if (usableCamera(cam)) {
          // Clamp both ends: without the lower bound, picking a very large
          // landsdel barely moves the camera and looks like no response;
          // without the upper bound, picking Frederiksberg dives to street
          // level.
          const base = m.getZoom();
          const z = Math.min(
            levelRef.current === "postnr"
              ? MAX_FOCUS_ZOOM_POSTNR
              : MAX_FOCUS_ZOOM,
            Math.max(cam!.zoom ?? base, base + MIN_FOCUS_STEP),
          );
          m.easeTo({ center: cam!.center, zoom: z, duration: 600 });
        }
      }
    } else if (prevSel.current) {
      // Return to the national view only when a selection was "just
      // cleared". At mount selected is null anyway, and the camera should
      // not move then (the initial fitBounds has already run).
      const home = m.cameraForBounds(DK_BOUNDS, { padding: FIT_PADDING });
      if (usableCamera(home)) m.easeTo({ ...home!, duration: 500 });
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
        {/* Postal codes are how Danes identify places: saying "2100" is
            quicker than saying "around Østerbro". List the first four and
            fold the rest. */}
        {levelRef.current === "kommune" &&
          (postnrByKommune[hover.code]?.length ?? 0) > 0 && (
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
        aria-label={`Map of Denmark showing ${metric.label} by ${level} for ${quarter}`}
        role="img"
      />
      {tip()}
    </>
  );
}

/** 45° hatch texture for "insufficient data" areas. */
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
