/**
 * The headline numbers for an area, in words, rendered on the server.
 *
 * Everything else on an area page waits for DuckDB. This paragraph is in the
 * HTML itself, so a crawler, an LLM fetching the page, or a reader on a slow
 * connection gets the substance without running any JavaScript.
 */

import { formatters } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { MESSAGES } from "@/lib/messages";
import { describe, hasPrice, summaryOf } from "@/lib/summaries";

export default function AreaSummary({
  locale,
  code,
  name,
}: {
  locale: Locale;
  code: string;
  name: string;
}) {
  const t = MESSAGES[locale];
  const all = summaryOf(code);
  const lines = (["house", "flat", "holiday"] as const)
    .map((cat) => describe(locale, name, cat, all[cat]))
    .filter((l): l is string => l !== null);
  const national = summaryOf("00").house;

  if (!lines.length) {
    return (
      <section className="detail__block">
        <p className="detail__prose">{t.summary.tooFew(name)}</p>
      </section>
    );
  }

  return (
    <section className="detail__block">
      {lines.map((l) => (
        <p className="detail__prose" key={l}>
          {l}
        </p>
      ))}
      {code !== "00" && hasPrice(all.house) && hasPrice(national) && (
        <p className="detail__prose">
          {t.summary.national(formatters(locale).krM2(national.price))}
        </p>
      )}
    </section>
  );
}
