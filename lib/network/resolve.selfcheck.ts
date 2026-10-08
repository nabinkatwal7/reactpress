/** ponytail: run with `npx tsx lib/network/resolve.selfcheck.ts` */
import { normalizeHost, resolveRequestSite, withBase, type SiteRef } from "./resolve";

const main: SiteRef = { id: "m", slug: "main", domain: null, isDefault: true };
const blog: SiteRef = { id: "b", slug: "blog-two", domain: "blog.example.com", isDefault: false };
const shop: SiteRef = { id: "s", slug: "shop", domain: null, isDefault: false };
const index = [main, blog, shop];

let failures = 0;
const eq = (actual: unknown, expected: unknown, msg: string) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.error(`FAIL ${msg}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  }
};
const r = (host: string | null, pathname: string, cookieSlug?: string) => {
  const x = resolveRequestSite(index, { host, pathname, cookieSlug });
  return [x.site.id, x.via, x.basePath, x.pathname];
};

// default
eq(r("localhost:3000", "/"), ["m", "default", "", "/"], "root -> default");
eq(r("localhost:3000", "/hello-world"), ["m", "default", "", "/hello-world"], "page on default");
eq(r(null, "/blog/post-1"), ["m", "default", "", "/blog/post-1"], "no host -> default");
// domain
eq(r("blog.example.com", "/"), ["b", "domain", "", "/"], "domain");
eq(r("Blog.Example.com:8080", "/x/y"), ["b", "domain", "", "/x/y"], "domain is case/port-insensitive");
eq(r("blog.example.com", "/shop/thing"), ["b", "domain", "", "/shop/thing"], "no path prefixes on a mapped domain");
eq(r("blog.example.com", "/admin", "shop"), ["b", "domain", "", "/admin"], "domain beats admin cookie");
eq(r("other.example.com", "/"), ["m", "default", "", "/"], "unknown host -> default");
// path mode
eq(r("localhost", "/shop"), ["s", "path", "/shop", "/"], "/slug is that site's home");
eq(r("localhost", "/shop/"), ["s", "path", "/shop", "/"], "trailing slash");
eq(r("localhost", "/shop/about"), ["s", "path", "/shop", "/about"], "/slug/page");
eq(r("localhost", "/shop/blog/hello"), ["s", "path", "/shop", "/blog/hello"], "/slug/post");
eq(r("localhost", "/shop/search"), ["s", "path", "/shop", "/search"], "/slug/search");
eq(r("localhost", "/shop/api/comments"), ["s", "path", "/shop", "/api/comments"], "/slug/api");
eq(r("localhost", "/shopping"), ["m", "default", "", "/shopping"], "prefix must match a whole segment");
eq(r("localhost", "/main/about"), ["m", "default", "", "/main/about"], "default site is not path-addressable");
// admin entry
eq(r("localhost", "/shop/admin"), ["s", "admin-entry", "", "/admin"], "/slug/admin is an entry point");
eq(r("localhost", "/shop/admin/posts"), ["s", "admin-entry", "", "/admin/posts"], "/slug/admin/posts keeps the rest");
eq(r("localhost", "/main/admin"), ["m", "admin-entry", "", "/admin"], "default site can be switched back to");
// cookie only affects admin paths
eq(r("localhost", "/admin/posts", "shop"), ["s", "cookie", "", "/admin/posts"], "admin uses cookie site");
eq(r("localhost", "/api/admin/posts", "shop"), ["s", "cookie", "", "/api/admin/posts"], "admin API uses cookie site");
eq(r("localhost", "/", "shop"), ["m", "default", "", "/"], "public pages ignore the cookie");
eq(r("localhost", "/api/comments", "shop"), ["m", "default", "", "/api/comments"], "public API ignores the cookie");
eq(r("localhost", "/admin", "nope"), ["m", "default", "", "/admin"], "unknown cookie slug -> default");
eq(r("localhost", "/administrator", "shop"), ["m", "default", "", "/administrator"], "/admin must match a whole segment");

// helpers
eq(normalizeHost("EXAMPLE.com:3000"), "example.com", "normalizeHost");
eq(withBase("/shop", "/"), "/shop", "withBase home");
eq(withBase("/shop", "/about"), "/shop/about", "withBase path");
eq(withBase("", "/about"), "/about", "withBase no base");
eq(withBase("/shop", "https://x.com/a"), "https://x.com/a", "withBase external");
eq(withBase("/shop", "//cdn.x.com/a"), "//cdn.x.com/a", "withBase protocol-relative");
eq(withBase("/shop", "?page=2"), "?page=2", "withBase relative");

let threw = false;
try {
  resolveRequestSite([], { host: "x", pathname: "/" });
} catch {
  threw = true;
}
eq(threw, true, "empty index throws");

if (failures) {
  console.error(`${failures} resolve check(s) failed`);
  process.exit(1);
}
console.log("resolve self-check passed");
