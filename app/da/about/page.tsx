import type { Metadata } from "next";
import AboutView from "@/components/pages/AboutView";
import { pageMeta } from "@/lib/meta";
import { MESSAGES } from "@/lib/messages";

const t = MESSAGES.da.pages;

export const metadata: Metadata = pageMeta("da", "/about/", t.aboutTitle, t.aboutDescription);

export default function Page() {
  return <AboutView locale="da" />;
}
