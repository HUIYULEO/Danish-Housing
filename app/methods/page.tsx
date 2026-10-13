import type { Metadata } from "next";
import MethodsView from "@/components/pages/MethodsView";
import { pageMeta } from "@/lib/meta";
import { MESSAGES } from "@/lib/messages";

const t = MESSAGES.en.pages;

export const metadata: Metadata = pageMeta("en", "/methods/", t.methodsTitle, t.methodsDescription);

export default function Page() {
  return <MethodsView locale="en" />;
}
