import { renderHome } from "@/lib/theme/render";

export const instant = false;

type Props = { searchParams: Promise<{ page?: string; rp_preview?: string }> };

export default async function HomePage({ searchParams }: Props) {
  const { page, rp_preview } = await searchParams;
  return renderHome(Number(page) || 1, rp_preview === "1");
}
