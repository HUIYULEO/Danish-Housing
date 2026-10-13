"use client";

/**
 * Which language this page is in, for client components.
 *
 * Only the locale string travels through context; the messages and the
 * formatters are looked up from it. English is the default, so the English
 * routes need no provider at all.
 */

import { createContext, useContext } from "react";
import { formatters } from "@/lib/format";
import { localePath, type Locale } from "@/lib/i18n";
import { MESSAGES } from "@/lib/messages";

const Ctx = createContext<Locale>("en");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useLocale() {
  const locale = useContext(Ctx);
  return {
    locale,
    t: MESSAGES[locale],
    fmt: formatters(locale),
    /** Locale-less path -> link target in the current language */
    href: (path: string) => localePath(locale, path),
  };
}
