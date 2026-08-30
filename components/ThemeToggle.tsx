"use client";

/**
 * 亮/暗切换。
 *
 * 三态而不是两态：Auto 跟随系统，Light / Dark 手动锁定。
 * 只给两个按钮的话，系统是暗色的人点一下"亮"，就再也回不到跟随系统了。
 *
 * 选择存在 localStorage，读取和落 data-theme 由 layout 里的内联脚本完成 ——
 * 必须在首次绘制之前跑，否则暗色模式的人会先被闪一下白。
 */

import { useEffect, useState } from "react";

export type ThemeChoice = "auto" | "light" | "dark";
export type Theme = "light" | "dark";

const KEY = "dkh-theme";

export function useTheme(): [Theme, ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>("auto");
  const [system, setSystem] = useState<Theme>("light");

  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as ThemeChoice) || "auto";
    setChoice(stored);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystem(mq.matches ? "dark" : "light");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const apply = (c: ThemeChoice) => {
    setChoice(c);
    localStorage.setItem(KEY, c);
    const root = document.documentElement;
    if (c === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", c);
  };

  return [choice === "auto" ? system : choice, choice, apply];
}

export default function ThemeToggle({
  choice,
  onChange,
}: {
  choice: ThemeChoice;
  onChange: (c: ThemeChoice) => void;
}) {
  const opts: { id: ThemeChoice; label: string; title: string }[] = [
    { id: "light", label: "☀", title: "Light" },
    { id: "auto", label: "A", title: "Follow system" },
    { id: "dark", label: "☾", title: "Dark" },
  ];
  return (
    <div className="themetoggle" role="group" aria-label="Colour theme">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.title}
          aria-label={o.title}
          aria-pressed={choice === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
