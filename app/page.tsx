import type { Metadata } from "next";
import HomeView from "@/components/pages/HomeView";
import { pageMeta } from "@/lib/meta";
import { MESSAGES } from "@/lib/messages";

const t = MESSAGES.en.pages;

export const metadata: Metadata = pageMeta("en", "/", t.siteTitle, t.siteDescription);

export default function Page() {
  return <HomeView locale="en" />;
}
