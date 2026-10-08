import { renderSearch } from "@/lib/theme/render";

export const instant = false;

type Props = { searchParams: Promise<{ q?: string; rp_preview?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "", rp_preview } = await searchParams;
  return renderSearch(q, rp_preview === "1");
}
