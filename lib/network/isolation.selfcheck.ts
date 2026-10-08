/**
 * ponytail: run with `npx tsx lib/network/isolation.selfcheck.ts` (needs the dev database)
 * Site A must never read or change site B's content, through any lib entry point.
 */
import { PrismaClient } from "@prisma/client";
import { listApprovedComments, listComments, setCommentStatus, deleteComment, submitComment } from "@/lib/comments";
import { queryPages, queryPosts } from "@/lib/content-list";
import { getDashboardData } from "@/lib/dashboard";
import { createMedia, deleteMedia, getMedia, queryMedia, setFeaturedMedia, updateMedia } from "@/lib/media";
import { createMenu, deleteMenu, getMenu, getMenuForLocation, getResolvedMenu, saveMenuItems, setMenuLocation } from "@/lib/menus";
import { createPage, deletePage, getPage, listPages, updatePage } from "@/lib/pages";
import { createPost, deletePost, getPost, listPosts, updatePost } from "@/lib/posts";
import { createTaxonomy, createPostType, getPostType, getTaxonomy, listTaxonomies } from "@/lib/registry";
import { getRevision, listRevisions, restoreRevision } from "@/lib/revisions";
import { searchContent } from "@/lib/search";
import { loadSettings, saveSettings } from "@/lib/settings";
import { createTerm, deleteTerm, getTerm, listTerms, setPostTerms, updateTerm } from "@/lib/terms";
import { loadArchive, loadPage, loadPostList, loadSinglePost } from "@/lib/theme/data";
import { addWidget, listAreasWithWidgets, removeWidget, updateWidget } from "@/lib/widgets";
import { activateTheme, getActiveThemeSlug } from "@/lib/theme/themes";
import { setOverride } from "@/lib/theme/overrides";
import { loadTheme } from "@/lib/theme/themes";
import { createSite, deleteSite, getDefaultNetwork } from "./sites";

const prisma = new PrismaClient();
const fails = (fn: () => Promise<unknown>) => fn().then(() => false, () => true);
const none = (v: unknown) => v === null || v === false || v === undefined;
let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) failures += 1;
  console.assert(ok, msg);
};

async function main() {
  const net = await getDefaultNetwork();
  const A = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  await prisma.site.deleteMany({ where: { slug: { startsWith: "sc-" } } });
  const B = await createSite(net.id, { name: "B", slug: "sc-b" });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });
  const a = A.id;
  const b = B.id;
  const created: { post?: string; page?: string } = {};

  try {
    // ---- seed B with one of everything --------------------------------------------------------
    const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "b.png");
    const bMedia = await createMedia(b, admin.id, png);
    const bPost = await createPost(b, admin.id, { title: "Secret needle B", slug: "hello", status: "publish", content: [{ type: "paragraph", text: "needleB" }] });
    const bPage = await createPage(b, admin.id, { title: "About B needle", slug: "about-b", status: "publish", content: [] });
    const bTerm = await createTerm(b, { taxonomy: "category", name: "B Cat", slug: "b-cat" });
    await setPostTerms(b, bPost.id, [bTerm.id]);
    const bMenu = await createMenu(b, "B menu");
    await saveMenuItems(b, bMenu.id, [{ label: "P", objectType: "post", objectId: bPost.id, depth: 0 }]);
    await setMenuLocation(b, "primary", bMenu.id);
    await saveSettings(b, { site_title: "Site B title" });
    const bWidget = await addWidget(b, "sidebar", "recent_posts", {});
    const bComment = await submitComment(b, { postId: bPost.id, authorName: "n", authorEmail: "n@x.io", content: "hi" }, { userId: admin.id });
    await createPostType(b, { key: "b-type", label: "B types", singular: "B type", taxonomies: [] });
    await createTaxonomy(b, { key: "b-tax", label: "B tax", singular: "B tax", hierarchical: false });
    await activateTheme(b, "midnight");
    const rev = (await listRevisions(b, "post", bPost.id))[0];
    check(!!bMedia && !!bComment && !!rev, "site B is seeded");

    // ---- A cannot see any of it ---------------------------------------------------------------
    check(none(await getPost(a, bPost.id)), "getPost");
    check((await listPosts(a)).every((p) => p.siteId === a), "listPosts only A");
    check(none(await getPage(a, bPage.id)), "getPage");
    check((await listPages(a)).every((p) => p.siteId === a), "listPages only A");
    check(none(await getMedia(a, bMedia.id)), "getMedia");
    check((await queryMedia(a)).items.every((m) => m.siteId === a), "queryMedia only A");
    check(none(await getTerm(a, bTerm.id)), "getTerm");
    check((await listTerms(a, "category")).every((t) => t.siteId === a), "listTerms only A");
    check(none(await getMenu(a, bMenu.id)), "getMenu");
    check((await getMenuForLocation(a, "primary")).length === 0, "A's primary menu is not B's");
    check(none(await getPostType(a, "b-type")) && none(await getTaxonomy(a, "b-tax")), "custom types/taxonomies are per site");
    check(!(await listTaxonomies(a)).some((t) => t.key === "b-tax"), "listTaxonomies");
    check(none(await getRevision(a, rev.id)) && (await listRevisions(a, "post", bPost.id)).length === 0, "revisions");
    check((await listComments(a)).every((c) => c.siteId === a), "listComments only A");
    check((await listApprovedComments(a, bPost.id)).length === 0, "approved comments of B's post");
    check((await loadSettings(a)).site_title !== "Site B title", "settings are per site");
    check((await searchContent(a, "needleB")).length === 0 && (await searchContent(b, "needleB")).length >= 1, "search is per site");
    check((await queryPosts(a, {})).items.every((p) => p.siteId === a) && (await queryPages(a, {})).items.every((p) => p.siteId === a), "list tables");
    check((await getDashboardData(a)).recentPublished.every((p) => p.id !== bPost.id), "dashboard");
    check(!(await listAreasWithWidgets(a)).some((area) => area.widgets.some((w) => w.id === bWidget.id)), "widgets");
    check((await getActiveThemeSlug(a)) !== "midnight", "active theme is per site");
    check((await getActiveThemeSlug(b)) === "midnight", "B keeps its own theme");

    // public (theme-facing) loaders
    check((await loadPostList(a, { page: 1 })).posts.every((p) => p.id !== bPost.id), "loadPostList");
    check((await loadSinglePost(a, "hello")) === null || (await loadSinglePost(a, "hello"))?.post.id !== bPost.id, "loadSinglePost by slug");
    check((await loadPage(a, "about-b")) === null, "loadPage by slug");
    check((await loadArchive(a, "category", "b-cat", 1)) === null, "loadArchive");

    // ---- A cannot change B's rows by guessing ids ---------------------------------------------
    check(none(await updatePost(a, bPost.id, { title: "hacked" })), "updatePost");
    check((await deletePost(a, bPost.id)) === false, "deletePost");
    check(none(await updatePage(a, bPage.id, { title: "hacked" })), "updatePage");
    check((await deletePage(a, bPage.id)) === false, "deletePage");
    check(none(await updateMedia(a, bMedia.id, { title: "hacked" })), "updateMedia");
    check((await deleteMedia(a, bMedia.id)) === false, "deleteMedia");
    check(none(await updateTerm(a, bTerm.id, { name: "hacked" })), "updateTerm");
    check((await deleteTerm(a, bTerm.id)) === false, "deleteTerm");
    check((await deleteMenu(a, bMenu.id)) === false, "deleteMenu");
    check((await saveMenuItems(a, bMenu.id, [])) === false, "saveMenuItems on B's menu");
    check(none(await updateWidget(a, bWidget.id, {})), "updateWidget");
    check((await removeWidget(a, bWidget.id)) === false, "removeWidget");
    check((await setCommentStatus(a, bComment!.id, "trash")) === false, "setCommentStatus");
    check((await deleteComment(a, bComment!.id)) === false, "deleteComment");
    check(none(await restoreRevision(a, rev.id, admin.id)), "restoreRevision");
    check((await prisma.post.findUniqueOrThrow({ where: { id: bPost.id } })).title === "Secret needle B", "B's post untouched");

    // ---- A cannot reference B's rows from its own content -------------------------------------
    check(await fails(() => createPost(a, admin.id, { title: "x", status: "draft", featuredMediaId: bMedia.id })), "featured media from B");
    check((await setFeaturedMedia(a, (await createPost(a, admin.id, { title: "A plain", status: "draft" })).id, bMedia.id).then(() => true, () => false)) === false, "setFeaturedMedia with B's media");
    const aPost = await createPost(a, admin.id, { title: "A with B term", status: "draft", termIds: [bTerm.id] });
    created.post = aPost.id;
    check((await prisma.postTerm.count({ where: { postId: aPost.id } })) === 0, "B's term is not attached to A's post");
    await setPostTerms(a, bPost.id, [(await createTerm(a, { taxonomy: "category", name: "A Cat" })).id]);
    check((await prisma.postTerm.findMany({ where: { postId: bPost.id } })).map((t) => t.termId).join() === bTerm.id, "A cannot rewrite B post's terms");
    check(await fails(() => createTerm(a, { taxonomy: "category", name: "child", parentId: bTerm.id })), "term parent from B");
    check(await fails(() => setMenuLocation(a, "primary", bMenu.id)), "menu from B as A's location");
    const aMenu = await createMenu(a, "A menu");
    await saveMenuItems(a, aMenu.id, [{ label: "leak", objectType: "post", objectId: bPost.id, depth: 0 }]).catch(() => {});
    check((await getResolvedMenu(a, aMenu.id)).length === 0, "menu item pointing at B's post does not resolve");
    check(await fails(() => saveSettings(a, { homepage_mode: "page", homepage_page_id: bPage.id })), "homepage = B's page");
    check(await fails(() => submitComment(a, { postId: bPost.id, authorName: "n", authorEmail: "n@x.io", content: "hi" }, {})), "comment on B's post via A");
    const midnight = (await loadTheme("midnight")).manifest;
    check(await fails(() => setOverride(a, midnight, "page", "nope")), "override target must exist");

    // ---- same slug in both sites is fine --------------------------------------------------------
    const aSame = await createPost(a, admin.id, { title: "Hello A", slug: "hello", status: "publish" });
    created.page = aSame.id;
    check((await loadSinglePost(a, "hello"))?.post.id === aSame.id && (await loadSinglePost(b, "hello"))?.post.id === bPost.id, "slugs are unique per site, not globally");
  } finally {
    if (created.post) await prisma.post.deleteMany({ where: { id: created.post } });
    if (created.page) await prisma.post.deleteMany({ where: { id: created.page } });
    await prisma.term.deleteMany({ where: { siteId: A.id, name: "A Cat" } });
    await prisma.menu.deleteMany({ where: { siteId: A.id, name: "A menu" } });
    await prisma.post.deleteMany({ where: { siteId: A.id, title: { in: ["A plain", "A with B term", "Hello A"] } } });
    await deleteSite(b);
  }
  if (failures) throw new Error(`${failures} isolation check(s) failed`);
  console.log("isolation self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
