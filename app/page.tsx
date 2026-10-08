import { renderHome } from "@/lib/theme/render";

export const instant = false;

type Props = { searchParams: Promise<{ page?: string }> };

export default async function HomePage({ searchParams }: Props) {
  const { page } = await searchParams;
  return renderHome(Number(page) || 1);
}
