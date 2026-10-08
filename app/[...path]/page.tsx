import { renderPath } from "@/lib/theme/render";
import { notFound } from "next/navigation";

export const instant = false;

type Props = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ page?: string; rp_preview?: string }>;
};

/** Public catch-all: posts, pages and taxonomy archives, rendered by the active theme. */
export default async function PublicPage({ params, searchParams }: Props) {
  const [{ path }, { page, rp_preview }] = await Promise.all([params, searchParams]);
  const rendered = await renderPath(path, Number(page) || 1, rp_preview === "1");
  if (!rendered) notFound(); // 404 status; app/not-found.tsx renders the theme's 404 template
  return rendered;
}
