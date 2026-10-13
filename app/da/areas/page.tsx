import type { Metadata } from "next";
import AreasView from "@/components/pages/AreasView";
import { pageMeta } from "@/lib/meta";
import { MESSAGES } from "@/lib/messages";
import { summaryQuarter } from "@/lib/summaries";

const t = MESSAGES.da.pages;

export const metadata: Metadata = pageMeta("da", "/areas/", t.areasTitle, t.areasDescription(summaryQuarter("da")));

export default function Page() {
  return <AreasView locale="da" />;
}
