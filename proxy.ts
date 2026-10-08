import { NextResponse, type NextRequest } from "next/server";
import { SITE_COOKIE, resolveRequestSite } from "@/lib/network/resolve";
import { loadSiteIndex } from "@/lib/network/site-index";

/**
 * Multisite entry point: decide which site serves the request (custom domain, `/site-slug`
 * path, or the admin's selected site) and tell the app through request headers.
 *
 * `x-rp-site` / `x-rp-base` are set here on EVERY request and any client-sent value is dropped,
 * so the app can trust them. See lib/network/resolve.ts for the rules.
 */
export async function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("x-rp-site");
  headers.delete("x-rp-base");

  let resolution;
  try {
    resolution = resolveRequestSite(await loadSiteIndex(), {
      host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
      pathname: request.nextUrl.pathname,
      cookieSlug: request.cookies.get(SITE_COOKIE)?.value,
    });
  } catch (e) {
    // never take the whole site down because the index failed: the app falls back to the default site
    console.error("[proxy] site resolution failed:", e);
    return NextResponse.next({ request: { headers } });
  }

  // `/<slug>/admin…`: remember the site for the (unprefixed) admin and go there.
  if (resolution.via === "admin-entry") {
    const url = request.nextUrl.clone();
    url.pathname = resolution.pathname;
    const res = NextResponse.redirect(url);
    res.cookies.set(SITE_COOKIE, resolution.site.slug, { path: "/", httpOnly: true, sameSite: "lax" });
    return res;
  }

  headers.set("x-rp-site", resolution.site.id);
  headers.set("x-rp-base", resolution.basePath);

  if (resolution.pathname !== request.nextUrl.pathname) {
    const url = request.nextUrl.clone();
    url.pathname = resolution.pathname;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // everything except Next's static assets and the favicon
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
