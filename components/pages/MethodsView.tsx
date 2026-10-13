import Masthead from "@/components/Masthead";
import snapshot from "../../public/data/snapshot.json";
import { formatters } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { PanelRow } from "@/lib/metrics";
import MethodsDa from "./MethodsDa";
import MethodsEn from "./MethodsEn";

export interface MethodsProps {
  /** Latest quarter, written out ("2026 Q2" / "2. kvt. 2026") */
  quarter: string;
  /** Latest quarter as the source tables code it ("2026Q2") */
  quarterCode: string;
  latestMonth: string;
  tally: (cat: string) => { n: number; ok: number; low: number; unv: number; ins: number };
}

/**
 * For a product that stands on credibility, this page is not optional
 * (PRD §12). The coverage numbers on it are computed straight from the
 * snapshot, not hard-coded, so the copy follows the data on every update.
 *
 * The text is long-form prose, so each language has its own component
 * rather than a table of sentence fragments.
 */
export default function MethodsView({ locale }: { locale: Locale }) {
  const rows = snapshot.rows as PanelRow[];
  const tally = (cat: string) => {
    const s = rows.filter((r) => r.category === cat);
    const c = (k: string) => s.filter((r) => r.reliability === k).length;
    return {
      n: s.length,
      ok: c("ok"),
      low: c("low"),
      unv: c("unverified"),
      ins: c("insufficient"),
    };
  };
  const props: MethodsProps = {
    quarter: formatters(locale).quarter(snapshot.quarter),
    quarterCode: snapshot.quarter,
    latestMonth: snapshot.months[snapshot.months.length - 1],
    tally,
  };

  return (
    <div className="shell">
      <Masthead locale={locale} path="/methods/" />
      {locale === "da" ? <MethodsDa {...props} /> : <MethodsEn {...props} />}
    </div>
  );
}
