import type { Metadata } from "next";
import AboutView from "@/components/pages/AboutView";
import { pageMeta } from "@/lib/meta";
import { MESSAGES } from "@/lib/messages";

const t = MESSAGES.en.pages;

export const metadata: Metadata = pageMeta("en", "/about/", t.aboutTitle, t.aboutDescription);

export default function Page() {
  return <AboutView locale="en" />;
}
