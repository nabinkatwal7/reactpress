import { renderSearch } from "@/lib/theme/render";

export const instant = false;

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  return renderSearch(q);
}
