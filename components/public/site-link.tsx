import Link from "next/link";
import { withBase } from "@/lib/network/resolve";
import { siteBasePath } from "@/lib/site";

/**
 * `next/link` for internal links in themes: adds the site's `/slug` prefix when the site is
 * served under a path (a no-op on the main site and on custom domains).
 * Theme authors: use this (or `ctx.basePath`) instead of hard-coding "/search", "/admin", "/".
 */
export async function SiteLink({ href, ...props }: React.ComponentProps<typeof Link>) {
  const base = await siteBasePath();
  return <Link href={typeof href === "string" ? withBase(base, href) : href} {...props} />;
}
