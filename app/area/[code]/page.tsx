import type { Metadata } from "next";
import AreaView, { areaMetadata, areaParams } from "@/components/pages/AreaView";

export const generateStaticParams = () => areaParams("admin");
export const dynamicParams = false;

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return areaMetadata("en", "admin", (await params).code);
}

export default async function Page({ params }: Props) {
  return <AreaView locale="en" kind="admin" code={(await params).code} />;
}
