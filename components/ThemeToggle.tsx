"use client";

/**
 * Light/dark switch.
 *
 * Three states rather than two: Auto follows the system, Light / Dark lock
 * it manually. With only two buttons, someone on a dark system who clicks
 * "light" once could never get back to following the system.
 *
 * The choice is stored in localStorage; reading it and setting data-theme is
 * done by the inline script in layout. It has to run before first paint, or
 * dark-mode users get a white flash first.
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
