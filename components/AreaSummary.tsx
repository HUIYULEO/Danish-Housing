/**
 * The headline numbers for an area, in words, rendered on the server.
 *
 * Everything else on an area page waits for DuckDB. This paragraph is in the
 * HTML itself, so a crawler, an LLM fetching the page, or a reader on a slow
 * connection gets the substance without running any JavaScript.
 */

import { describe, hasPrice, summaryOf } from "@/lib/summaries";
import { fmtKrM2 } from "@/lib/metrics";

export default function AreaSummary({ code, name }: { code: string; name: string }) {
  const all = summaryOf(code);
  const lines = (["house", "flat", "holiday"] as const)
    .map((cat) => describe(name, cat, all[cat]))
    .filter((l): l is string => l !== null);
  const national = summaryOf("00").house;

  if (!lines.length) {
    return (
      <section className="detail__block">
        <p className="detail__prose">
          Too few homes change hands in {name} for a square-metre price to be
          published, so no figure is shown.
        </p>
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
          Houses across Denmark as a whole sold for {fmtKrM2(national.price)}.
        </p>
      )}
    </section>
  );
}
