import { absolutePath, createMedia } from "@/lib/media";
import { createMenu, saveMenuItems, setMenuLocation } from "@/lib/menus";
import { createPage } from "@/lib/pages";
import { createPost } from "@/lib/posts";
import { createPostType, createTaxonomy } from "@/lib/registry";
import { saveSettings } from "@/lib/settings";
import { createTerm } from "@/lib/terms";
import { addWidget } from "@/lib/widgets";
import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";
import { unlink } from "node:fs/promises";
import type { SiteExport } from "./format";

/** Shared by the portability and backup self-checks: a site with a bit of everything, and a way to compare two sites. */

export const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);

export async function removeMediaFiles(paths: string[]) {
  await Promise.all(paths.map((p) => unlink(absolutePath(p)).catch(() => {})));
}

/** The export with every database id replaced by a stable name, so two sites can be compared. */
export function normalize(e: SiteExport) {
  const term = new Map(e.terms.map((t) => [t.id, `${t.taxonomy}/${t.slug}`]));
  const post = new Map(e.posts.map((p) => [p.id, p.slug]));
  const page = new Map(e.pages.map((p) => [p.id, p.slug]));
  const media = new Map(e.media.map((m) => [m.id, m.filename]));
  const menu = new Map(e.menus.map((m) => [m.id, m.name]));
  const mediaPath = new Map(e.media.map((m) => [m.path, m.filename]));
  const comment = new Map(e.comments.map((c) => [c.id, `${c.author_name}:${c.content}`]));
  const urls = (v: unknown): unknown => {
    const s = JSON.stringify(v);
    return JSON.parse(s.replace(/\/media\/([^"\\]+)/g, (m, p: string) => `/media/${mediaPath.get(p) ?? p}`));
  };
  const sortBy = <T>(a: T[], k: (x: T) => string) => [...a].sort((x, y) => k(x).localeCompare(k(y)));
  return {
    settings: { ...e.settings, homepage_page_id: e.settings.homepage_page_id ? page.get(e.settings.homepage_page_id as string) : e.settings.homepage_page_id },
    taxonomies: e.taxonomies,
    post_types: e.post_types,
    terms: e.terms.map((t) => ({ ...t, id: term.get(t.id), parent_id: t.parent_id ? term.get(t.parent_id) : null })),
    media: e.media.map((m) => ({ filename: m.filename, mime: m.mime_type, size: m.size, alt: m.alt, title: m.title, created_at: m.created_at, sha: m.data ? createHash("sha256").update(Buffer.from(m.data, "base64")).digest("hex") : null })),
    posts: sortBy(e.posts, (p) => p.slug).map((p) => ({ ...p, id: post.get(p.id), content: urls(p.content), featured_media_id: p.featured_media_id ? media.get(p.featured_media_id) : null, term_ids: p.term_ids.map((t) => term.get(t)).sort() })),
    pages: sortBy(e.pages, (p) => p.slug).map((p) => ({ ...p, id: page.get(p.id), content: urls(p.content), parent_id: p.parent_id ? page.get(p.parent_id) : null })),
    comments: sortBy(e.comments, (c) => comment.get(c.id)!).map((c) => ({ ...c, id: comment.get(c.id), post_id: post.get(c.post_id), parent_id: c.parent_id ? comment.get(c.parent_id) : null })),
    menus: e.menus.map((m) => ({ name: m.name, items: m.items.map((i) => ({ label: i.label, type: i.object_type, url: i.url, position: i.position, parent: i.parent_id ? m.items.find((x) => x.id === i.parent_id)?.label : null, target: i.object_id ? (i.object_type === "post" ? post.get(i.object_id) : page.get(i.object_id)) : null })) })),
    menu_locations: Object.fromEntries(Object.entries(e.menu_locations).map(([l, id]) => [l, menu.get(id)])),
    widget_areas: e.widget_areas,
    themes: { ...e.themes, mods: urls(e.themes.mods), parts: urls(e.themes.parts) },
    plugins: e.plugins,
  };
}

/** Fill a site with posts, pages, terms, media, comments, menus, widgets, settings, theme and plugin data. Media paths are pushed to `created` for cleanup. */
export async function buildRichSite(siteId: string, admin: { id: string }, ann: { id: string; email?: string }, created: string[]) {
  await createTaxonomy(siteId, { key: "topic", label: "Topics", singular: "Topic", hierarchical: true });
  await createPostType(siteId, { key: "recipe", label: "Recipes", singular: "Recipe", taxonomies: ["topic", "category"] });
  const news = await createTerm(siteId, { taxonomy: "category", name: "News", slug: "news" });
  const topic = await createTerm(siteId, { taxonomy: "topic", name: "Cooking", slug: "cooking" });
  const sub = await createTerm(siteId, { taxonomy: "topic", name: "Baking", slug: "baking", parentId: topic.id });
  const logo = await createMedia(siteId, admin.id, new File([PNG], "logo.png"));
  const photo = await createMedia(siteId, ann.id, new File([new Uint8Array([...PNG, 1, 2, 3])], "photo.png"));
  await prisma.media.update({ where: { id: photo.id }, data: { altText: "A photo", title: "Photo!" } });
  created.push(logo.path, photo.path);
  const hello = await createPost(siteId, ann.id, {
    title: "Hello", slug: "hello", status: "publish", termIds: [news.id, sub.id], featuredMediaId: photo.id,
    content: [{ type: "heading", level: 2, text: "Hi" }, { type: "image", mediaId: photo.id, url: `/media/${photo.path}`, alt: "pic", text: "" }, { type: "paragraph", text: "text with \"quotes\" and \u00fcnic\u00f6de" }],
  });
  await createPost(siteId, admin.id, { title: "Draft one", slug: "draft-one", status: "draft", content: [] });
  await createPost(siteId, admin.id, { title: "Later", slug: "later", status: "scheduled", scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), content: [] });
  await createPost(siteId, admin.id, { title: "Soup", slug: "soup", type: "recipe", status: "publish", termIds: [topic.id], content: [] });
  const about = await createPage(siteId, admin.id, { title: "About", slug: "about", status: "publish", content: [{ type: "paragraph", text: "About us" }] });
  const team = await createPage(siteId, ann.id, { title: "Team", slug: "team", status: "publish", parentId: about.id, content: [] });
  await prisma.comment.create({ data: { siteId: siteId, postId: hello.id, authorName: "Bob", authorEmail: "bob@example.com", content: "Nice", status: "approved", ip: "203.0.113.9", userAgent: "UA-secret" } });
  const parentC = await prisma.comment.findFirstOrThrow({ where: { siteId: siteId } });
  await prisma.comment.create({ data: { siteId: siteId, postId: hello.id, parentId: parentC.id, userId: ann.id, authorName: "Ann", authorEmail: "sc-ann@example.com", content: "Thanks", status: "approved" } });
  const menu = await createMenu(siteId, "Main menu");
  await saveMenuItems(siteId, menu.id, [
    { label: "Home", objectType: "custom", url: "/", depth: 0 },
    { label: "About", objectType: "page", objectId: about.id, depth: 0 },
    { label: "Team", objectType: "page", objectId: team.id, depth: 1 },
    { label: "Hello", objectType: "post", objectId: hello.id, depth: 0 },
  ]);
  await setMenuLocation(siteId, "primary", menu.id);
  await saveSettings(siteId, { site_title: "Source Site", tagline: "tag", homepage_mode: "page", homepage_page_id: about.id, posts_per_page: 7 });
  await addWidget(siteId, "sidebar", "text", { title: "Hello", body: "Widget body" });
  await prisma.themeInstall.create({ data: { siteId: siteId, slug: "midnight", version: "1.0.0", active: true } });
  await prisma.themeMods.create({ data: { siteId: siteId, theme: "midnight", published: { logo: `/media/${logo.path}`, primary_color: "#ff0000" }, draft: { primary_color: "#00ff00" } } });
  await prisma.templatePart.create({ data: { siteId: siteId, theme: "midnight", slug: "footer", content: [{ type: "paragraph", text: "Footer text" }] } });
  await prisma.templateOverride.create({ data: { siteId: siteId, theme: "midnight", template: "page", target: "index" } });
  await prisma.pluginInstall.create({ data: { siteId: siteId, slug: "reading-time", version: "1.1.0", active: true, settings: { label: "minutes" } } });
  await prisma.pluginData.create({ data: { siteId: siteId, plugin: "reading-time", key: "counter", value: { n: 3 } } });
  return { hello, about, team, logo, photo };
}
