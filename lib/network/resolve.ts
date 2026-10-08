/**
 * Which site serves a request? Pure logic (no I/O) so it is easy to test; proxy.ts feeds it the
 * site index and applies the result.
 *
 * Order:
 *  1. Host matches a site's custom domain      -> that site (path prefixes are not interpreted)
 *  2. `/<slug>/admin…`                          -> admin entry for that site (proxy sets the site cookie
 *                                                  and redirects to `/admin…`; any site, including the main one)
 *  3. `/<slug>/…` for a non-default site        -> that site, `/<slug>` stripped (basePath = `/<slug>`)
 *  4. admin/API-admin path with a site cookie   -> the cookie's site (admin links are not site-prefixed)
 *  5. otherwise                                 -> the default site
 */

export type SiteRef = { id: string; slug: string; domain: string | null; isDefault: boolean };

export type RequestInfo = { host: string | null; pathname: string; cookieSlug?: string | null };

export type Resolution = {
  site: SiteRef;
  via: "domain" | "path" | "admin-entry" | "cookie" | "default";
  /** Prefix links must carry for this site ("" except in path mode). */
  basePath: string;
  /** Path the app routes should see (site prefix removed). */
  pathname: string;
};

export const SITE_COOKIE = "rp_site";

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

const isAdminPath = (p: string) => p === "/admin" || p.startsWith("/admin/") || p === "/api/admin" || p.startsWith("/api/admin/");

export function resolveRequestSite(index: SiteRef[], req: RequestInfo): Resolution {
  const fallback = index.find((s) => s.isDefault) ?? index[0];
  if (!fallback) throw new Error("No site found. Run npm run db:seed.");

  const host = normalizeHost(req.host);
  const byDomain = host ? index.find((s) => s.domain === host) : undefined;
  if (byDomain) return { site: byDomain, via: "domain", basePath: "", pathname: req.pathname };

  const segs = req.pathname.split("/").filter(Boolean);
  const first = segs[0];
  const bySlug = first ? index.find((s) => s.slug === first) : undefined;
  if (bySlug) {
    const rest = "/" + segs.slice(1).join("/");
    if (segs[1] === "admin") return { site: bySlug, via: "admin-entry", basePath: "", pathname: rest };
    if (!bySlug.isDefault) return { site: bySlug, via: "path", basePath: `/${bySlug.slug}`, pathname: rest };
  }

  if (isAdminPath(req.pathname) && req.cookieSlug) {
    const byCookie = index.find((s) => s.slug === req.cookieSlug);
    if (byCookie) return { site: byCookie, via: "cookie", basePath: "", pathname: req.pathname };
  }
  return { site: fallback, via: "default", basePath: "", pathname: req.pathname };
}

/** Prefix an internal (root-relative) URL with a site's base path. External and relative URLs pass through. */
export function withBase(basePath: string, url: string): string {
  if (!basePath || !url.startsWith("/") || url.startsWith("//")) return url;
  return url === "/" ? basePath : basePath + url;
}
