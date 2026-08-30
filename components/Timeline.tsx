"use client";

/**
 * 时间轴。拖动和播放全部是本地的 —— 面板已经在浏览器里了，不走网络。
 *
 * 播放速度定在 260ms/季度：太快看不清 2007-2009 的转折，
 * 太慢又没有"动起来"的观感。
 */

import { useEffect, useRef } from "react";
import { monthLabel, quarterLabel } from "@/lib/metrics";

const STEP_MS = 260;
// 月度一年十二格，用同样的节奏放完二十年要一分钟，所以月度放快一倍
const STEP_MS_MONTH = 130;

export default function Timeline({
  ticks: quarters,
  value,
  onChange,
  monthly,
  playing,
  onPlayToggle,
  span,
  onSpanChange,
  disabled,
}: {
  ticks: string[];
  value: string;
  monthly: boolean;
  onChange: (q: string) => void;
  playing: boolean;
  onPlayToggle: () => void;
  span: "10y" | "all";
  onSpanChange: (s: "10y" | "all") => void;
  disabled?: boolean;
}) {
  const i = Math.max(0, quarters.indexOf(value));
  const label = (t: string) => (monthly ? monthLabel(t) : quarterLabel(t));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 播放时逐季推进，到末尾自动停。
  //
  // 起点：默认停在最新季度，那已经是终点了。所以按播放时如果已经在末尾，
  // 就从头开始放 —— 用户按播放是想看整段变化，不是想让它一动不动。
  // 这个跳转在 onPlayToggle 之前发生，见下面的 handlePlay。
  useEffect(() => {
    if (!playing || disabled) return;
    timer.current = setInterval(() => {
      const cur = quarters.indexOf(value);
      if (cur >= quarters.length - 1) {
        onPlayToggle();
        return;
      }
      onChange(quarters[cur + 1]);
    }, monthly ? STEP_MS_MONTH : STEP_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, value, quarters, onChange, onPlayToggle, disabled, monthly]);

  const handlePlay = () => {
    if (!playing && i >= quarters.length - 1) onChange(quarters[0]);
    onPlayToggle();
  };

  // 刻度密度跟着跨度走：十年视图每两年一个，全量视图每十年一个，
  // 两种情况下轴上的字数差不多
  // 刻度密度跟着跨度和频率走，两种情况下轴上的字数差不多
  const every = span === "10y" ? 2 : 10;
  const isJan = (t: string) => (monthly ? t.endsWith("M01") : t.endsWith("Q1"));
  const marks = quarters
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => isJan(q) && Number(q.slice(0, 4)) % every === 0);

  return (
    <div className="timeline">
      <button
        type="button"
        className="timeline__play"
        onClick={handlePlay}
        disabled={disabled}
        aria-label={playing ? "Pause" : "Play through time"}
        title={playing ? "Pause" : i >= quarters.length - 1 ? "Play from the start" : "Play through time"}
      >
        {playing ? (
          <svg width="10" height="11" viewBox="0 0 10 11" aria-hidden>
            <rect x="0" y="0" width="3.4" height="11" fill="currentColor" />
            <rect x="6.2" y="0" width="3.4" height="11" fill="currentColor" />
          </svg>
        ) : (
          <svg width="10" height="11" viewBox="0 0 10 11" aria-hidden>
            <path d="M0 0 L10 5.5 L0 11 Z" fill="currentColor" />
          </svg>
        )}
      </button>

      <div className="timeline__q num">{label(value)}</div>

      <div className="timeline__track">
        <input
          type="range"
          min={0}
          max={Math.max(0, quarters.length - 1)}
          step={1}
          value={i}
          disabled={disabled}
          aria-label="Quarter"
          aria-valuetext={label(value)}
          onChange={(e) => onChange(quarters[Number(e.target.value)])}
        />
        <div className="timeline__marks" aria-hidden>
          {/* 当前停在哪一年，光看滑块位置不够明确，这里再标一条竖线 */}
          <span
            className="timeline__cursor"
            style={{ left: `${(i / Math.max(1, quarters.length - 1)) * 100}%` }}
          />
          {marks.map(({ q, idx }) => (
            <span
              key={q}
              className="timeline__mark"
              style={{ left: `${(idx / (quarters.length - 1)) * 100}%` }}
            >
              {q.slice(0, 4)}
            </span>
          ))}
        </div>
      </div>

      <div className="seg" role="group" aria-label="Timeline span">
        {(
          [
            ["10y", "10Y"],
            ["all", monthly ? "Since 2004" : "Since 1992"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={span === id}
            disabled={disabled}
            onClick={() => onSpanChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
