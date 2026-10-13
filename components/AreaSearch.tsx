"use client";

/**
 * The input box for finding a place.
 *
 * The reason is simple: the map has 98 kommuner and 605 postal codes, and
 * the first thing people do on this site is usually "how is my own area
 * doing". Hunting for Ikast-Brande with a mouse on a map of Denmark is not
 * something anyone should have to do, and finding 8600 is impossible:
 * postal codes are not labelled on the map at all.
 *
 * Three things worth explaining:
 *
 * 1. **All four levels are searched together.** Picking an entry also
 *    switches the map to that entry's level. Making people choose a level
 *    before searching would require them to already know that Ikast-Brande
 *    is a kommune and not a landsdel.
 *
 * 2. **Postal codes match by numeric prefix**, names by substring. Danes
 *    give the four digits first when stating an address, so "2100" has to
 *    hit Østerbro directly.
 *
 * 3. The postal level has no numbers until DuckDB is up (it lives in another
 *    Parquet). Until then postal entries are still listed but disabled, with
 *    the reason given; leaving them out would suggest the site has no
 *    postal-code data.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "./LocaleProvider";

export interface SearchArea {
  code: string;
  name: string;
  level: "landsdel" | "region" | "kommune" | "postnr";
}

/** Level weights for sorting. On an equal match, larger levels come first. */
const LEVEL_RANK: Record<SearchArea["level"], number> = {
  kommune: 0,
  postnr: 1,
  landsdel: 2,
  region: 3,
};

/**
 * Folding of Danish letters. Searching "koge" must hit "Køge" and "aarhus"
 * must hit "Aarhus" (the city reverted from Århus to the Aa spelling in
 * 2011, and both forms are still in use).
 *
 * Folding just these three letters is enough: no other diacritics occur in
 * Danish place names, and pulling in full Unicode normalisation would solve
 * a problem that does not exist.
 */
function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "aa");
}

const MAX_HITS = 8;

export default function AreaSearch({
  areas,
  onPick,
  postnrReady,
}: {
  areas: SearchArea[];
  onPick: (area: SearchArea) => void;
  /** Postal codes cannot be queried before DuckDB is up */
  postnrReady: boolean;
}) {
  const { t } = useLocale();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const index = useMemo(
    () => areas.map((a) => ({ area: a, key: fold(a.name) })),
    [areas],
  );

  const hits = useMemo(() => {
    const raw = q.trim();
    if (raw.length < 1) return [];
    const k = fold(raw);
    const digits = /^\d+$/.test(raw);
    const out: { area: SearchArea; score: number }[] = [];
    for (const { area, key } of index) {
      let score = -1;
      if (digits) {
        // Digits only match postal codes, and by prefix: typing "21" should
        // give 2100, 2150, not anything with 21 somewhere in its name
        if (area.level === "postnr" && area.code.startsWith(raw)) {
          score = area.code === raw ? 0 : 1;
        }
      } else {
        const i = key.indexOf(k);
        if (i === 0) score = 0;
        else if (i > 0) score = 2;
        // Postal-code names are searchable too ("Østerbro" -> 2100)
      }
      if (score >= 0) out.push({ area, score });
    }
    out.sort(
      (a, b) =>
        a.score - b.score ||
        LEVEL_RANK[a.area.level] - LEVEL_RANK[b.area.level] ||
        a.area.name.localeCompare(b.area.name, "da"),
    );
    return out.slice(0, MAX_HITS).map((h) => h.area);
  }, [q, index]);

  useEffect(() => setCursor(0), [q]);

  // Close on a click outside
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // "/" focuses the box, provided no other input is being typed in, or it
  // would swallow a slash.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      e.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const usable = (a: SearchArea) => a.level !== "postnr" || postnrReady;

  const choose = (a: SearchArea) => {
    if (!usable(a)) return;
    onPick(a);
    setQ("");
    setOpen(false);
    input.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      input.current?.blur();
      return;
    }
    if (!hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(hits[cursor]);
    }
  };

  const listId = "areasearch-list";
  const showList = open && hits.length > 0;

  return (
    <div className="search" ref={box}>
      <input
        ref={input}
        className="search__in"
        type="search"
        value={q}
        placeholder={t.search.placeholder}
        aria-label={t.search.aria}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <kbd className="search__kbd" aria-hidden="true">
        /
      </kbd>
      {showList && (
        <ul className="search__list" id={listId} role="listbox">
          {hits.map((a, i) => (
            <li key={`${a.level}:${a.code}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === cursor}
                className={`search__hit${i === cursor ? " is-on" : ""}${
                  usable(a) ? "" : " is-off"
                }`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => choose(a)}
                disabled={!usable(a)}
                title={usable(a) ? undefined : t.search.locked}
              >
                <span className="search__name">{a.name}</span>
                <span className="search__meta num">
                  {a.level === "postnr" ? a.code : t.levels[a.level].one}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
