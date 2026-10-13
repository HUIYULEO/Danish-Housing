import type { Metadata } from "next";
import MethodsView from "@/components/pages/MethodsView";
import { pageMeta } from "@/lib/meta";
import { MESSAGES } from "@/lib/messages";

const t = MESSAGES.da.pages;

export const metadata: Metadata = pageMeta("da", "/methods/", t.methodsTitle, t.methodsDescription);

export default function Page() {
  return <MethodsView locale="da" />;
}
