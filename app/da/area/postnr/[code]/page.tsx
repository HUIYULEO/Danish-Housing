import type { Metadata } from "next";
import AreaView, { areaMetadata, areaParams } from "@/components/pages/AreaView";

export const generateStaticParams = () => areaParams("postnr");
export const dynamicParams = false;

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return areaMetadata("da", "postnr", (await params).code);
}

export default async function Page({ params }: Props) {
  return <AreaView locale="da" kind="postnr" code={(await params).code} />;
}
