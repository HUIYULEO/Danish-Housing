import type { Metadata } from "next";
import AreasView from "@/components/pages/AreasView";
import { pageMeta } from "@/lib/meta";
import { MESSAGES } from "@/lib/messages";
import { summaryQuarter } from "@/lib/summaries";

const t = MESSAGES.en.pages;

export const metadata: Metadata = pageMeta("en", "/areas/", t.areasTitle, t.areasDescription(summaryQuarter("en")));

export default function Page() {
  return <AreasView locale="en" />;
}
