/** ponytail: run with `npx tsx lib/rest/public.selfcheck.ts` (needs the dev database) */
import { PrismaClient } from "@prisma/client";
import { createMedia } from "@/lib/media";
import { createSite, deleteSite, getDefaultNetwork } from "@/lib/network/sites";
import { createPage } from "@/lib/pages";
import { createPost } from "@/lib/posts";
import { createTerm } from "@/lib/terms";
import { pageParams } from "./http";
import {
  getPublicMedia,
  getPublicPage,
  getPublicPost,
  getPublicUser,
  listPublicMedia,
  listPublicPages,
  listPublicPosts,
  listPublicTerms,
  listPublicUsers,
  publicTaxonomies,
  restContext,
} from "./public";

const prisma = new PrismaClient();
let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) failures += 1;
  console.assert(ok, msg);
};
const q = (s: string) => new URLSearchParams(s);

async function main() {
  const net = await getDefaultNetwork();
  await prisma.site.deleteMany({ where: { slug: { startsWith: "sc-" } } });
  const site = await createSite(net.id, { name: "REST", slug: "sc-rest" });
  const other = await createSite(net.id, { name: "Other", slug: "sc-other" });
  const author = await prisma.user.create({ data: { email: "sc-author@example.com", name: "Ann Author" } });
  const lurker = await prisma.user.create({ data: { email: "sc-lurker@example.com", name: "Lurker" } });
  const c = await restContext(site.id, "");
  const cBase = await restContext(site.id, "/sc-rest");

  try {
    const cat = await createTerm(site.id, { taxonomy: "category", name: "News", slug: "news" });
    const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "a.png");
    const pub = await createMedia(site.id, author.id, png);
    const hidden = await createMedia(site.id, author.id, new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "h.png"));

    const mk = (title: string, status: "publish" | "draft" | "private" | "trash", extra = {}) =>
      createPost(site.id, author.id, { title, status, content: [{ type: "paragraph", text: `${title} body zebra` }], ...extra });
    const p1 = await mk("Alpha post", "publish", { termIds: [cat.id], featuredMediaId: pub.id });
    await mk("Bravo post", "publish");
    await mk("Secret draft", "draft");
    await mk("Private note", "private");
    await mk("Trashed", "trash");
    await createPost(other.id, author.id, { title: "Other site post", status: "publish" });
    await createPost(site.id, lurker.id, { title: "Lurker draft", status: "draft" });
    await createPage(site.id, author.id, { title: "About us", status: "publish", content: [] });
    await createPage(site.id, author.id, { title: "Hidden page", status: "draft", content: [] });

    // ---- posts: published only, this site only
    const all = await listPublicPosts(c, q(""), pageParams(q("")));
    const titles = all.data.map((p) => p.title).sort();
    check(titles.join() === "Alpha post,Bravo post", `only published posts of this site: ${titles}`);
    check(all.meta.total === 2 && all.meta.pages === 1, "meta");
    check(all.data.every((p) => p.status === "publish"), "status");
    check(!JSON.stringify(all).includes("example.com"), "no emails anywhere in the payload");

    // pagination
    const one = await listPublicPosts(c, q("per_page=1&orderby=title&order=asc"), pageParams(q("per_page=1")));
    check(one.data.length === 1 && one.data[0].title === "Alpha post" && one.meta.pages === 2, "per_page + orderby");
    const two = await listPublicPosts(c, q("per_page=1&page=2&orderby=title&order=asc"), pageParams(q("per_page=1&page=2")));
    check(two.data[0]?.title === "Bravo post", "page 2");
    check(pageParams(q("per_page=9999")).perPage === 100 && pageParams(q("page=-3&per_page=abc")).page === 1, "params are clamped");

    // filters
    const byTerm = await listPublicPosts(c, q("taxonomy=category&term=news"), pageParams(q("")));
    check(byTerm.data.length === 1 && byTerm.data[0].id === p1.id, "term filter");
    check((await listPublicPosts(c, q("search=zebra"), pageParams(q("")))).data.length === 2, "search finds published only");
    check((await listPublicPosts(c, q("search=Secret"), pageParams(q("")))).data.length === 0, "search never finds drafts");
    check((await listPublicPosts(c, q(`author=${lurker.id}`), pageParams(q("")))).data.length === 0, "author filter (drafts only)");
    check((await listPublicPosts(c, q("type=page"), pageParams(q("")))).data.length === 0, "unknown type is empty");

    // single
    const got = await getPublicPost(c, "alpha-post");
    check(got?.id === p1.id && got.featured_media?.url.startsWith("/media/") === true, "by slug, with featured media");
    check((await getPublicPost(c, p1.id))?.slug === "alpha-post", "by id");
    check((await getPublicPost(c, "secret-draft")) === null, "draft by slug is 404");
    const drafts = await prisma.post.findMany({ where: { siteId: site.id, status: { not: "publish" } } });
    for (const d of drafts) check((await getPublicPost(c, d.id)) === null, `non-published by id is 404 (${d.status})`);
    check((await getPublicPost(await restContext(other.id, ""), "alpha-post")) === null, "other site cannot read it");
    check(got?.link === "/posts/alpha-post" && (await getPublicPost(cBase, "alpha-post"))?.link === "/sc-rest/posts/alpha-post", "links carry the site base path");

    // pages
    const pages = await listPublicPages(c, q(""), pageParams(q("")));
    check(pages.data.length === 1 && pages.data[0].title === "About us", "published pages only");
    check((await getPublicPage(c, "hidden-page")) === null && (await getPublicPage(c, "about-us"))?.link === "/about-us", "single page");

    // media
    const media = await listPublicMedia(c, pageParams(q("")));
    check(media.data.length === 1 && media.data[0].id === pub.id, "only featured media is public");
    check((await getPublicMedia(c, hidden.id)) === null && (await getPublicMedia(c, pub.id)) !== null, "single media rule");

    // taxonomies / terms
    check((await publicTaxonomies(c)).some((t) => t.key === "category"), "taxonomies");
    const terms = await listPublicTerms(c, "category", pageParams(q("")));
    check(terms.data.find((t) => t.slug === "news")?.count === 1, "term count only counts published posts");

    // users
    const users = await listPublicUsers(c, pageParams(q("")));
    check(users.data.map((u) => u.name).join() === "Ann Author" && users.data[0].post_count === 2, "authors with published content only");
    check((await getPublicUser(c, lurker.id)) === null && (await getPublicUser(c, author.id))?.name === "Ann Author", "single user rule");
    check(Object.keys(users.data[0]).sort().join() === "id,name,post_count", "user fields are minimal");
    check((await getPublicUser(await restContext(other.id, ""), author.id))?.post_count === 1, "counts are per site");
  } finally {
    await prisma.user.deleteMany({ where: { email: { startsWith: "sc-" } } });
    await deleteSite(site.id);
    await deleteSite(other.id);
  }
  if (failures) throw new Error(`${failures} public REST check(s) failed`);
  console.log("public REST self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
