import { readFile } from "node:fs/promises";
import { absolutePath } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { EXPORT_FORMAT, EXPORT_VERSION, type SiteExport } from "./format";

/** Embedded media is base64 inside the JSON; past this, use a backup (zip) instead. */
export const MAX_EMBEDDED_MEDIA_BYTES = 50 * 1024 * 1024;

const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);

export class ExportError extends Error {}

/** Everything about one site as a `SiteExport`. With `includeMedia`, uploaded files are embedded as base64. */
export async function exportSite(siteId: string, opts: { includeMedia?: boolean } = {}): Promise<SiteExport> {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { name: true, slug: true } });

  const [settings, taxonomies, postTypes, terms, media, posts, pages, comments, menus, locations, areas, themeInstalls, themeMods, parts, overrides, pluginInstalls, pluginData] =
    await Promise.all([
      prisma.setting.findMany({ where: { siteId }, orderBy: { key: "asc" } }),
      prisma.taxonomy.findMany({ where: { siteId }, orderBy: { key: "asc" } }),
      prisma.postType.findMany({ where: { siteId }, orderBy: { key: "asc" } }),
      prisma.term.findMany({ where: { siteId }, orderBy: [{ taxonomy: "asc" }, { slug: "asc" }] }),
      prisma.media.findMany({ where: { siteId }, orderBy: { createdAt: "asc" } }),
      prisma.post.findMany({
        where: { siteId },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { email: true } }, terms: { select: { termId: true } } },
      }),
      prisma.page.findMany({ where: { siteId }, orderBy: { createdAt: "asc" }, include: { author: { select: { email: true } } } }),
      prisma.comment.findMany({ where: { siteId }, orderBy: { createdAt: "asc" }, include: { user: { select: { email: true } } } }),
      prisma.menu.findMany({ where: { siteId }, orderBy: { createdAt: "asc" }, include: { items: { orderBy: { position: "asc" } } } }),
      prisma.menuLocation.findMany({ where: { siteId } }),
      prisma.widgetArea.findMany({ where: { siteId }, orderBy: { key: "asc" }, include: { widgets: { orderBy: { position: "asc" } } } }),
      prisma.themeInstall.findMany({ where: { siteId }, orderBy: { slug: "asc" } }),
      prisma.themeMods.findMany({ where: { siteId }, orderBy: { theme: "asc" } }),
      prisma.templatePart.findMany({ where: { siteId }, orderBy: [{ theme: "asc" }, { slug: "asc" }] }),
      prisma.templateOverride.findMany({ where: { siteId }, orderBy: [{ theme: "asc" }, { template: "asc" }] }),
      prisma.pluginInstall.findMany({ where: { siteId }, orderBy: { slug: "asc" } }),
      prisma.pluginData.findMany({ where: { siteId }, orderBy: [{ plugin: "asc" }, { key: "asc" }] }),
    ]);

  let embedded = 0;
  const mediaOut: SiteExport["media"] = [];
  for (const m of media) {
    const entry: SiteExport["media"][number] = {
      id: m.id,
      filename: m.filename,
      path: m.path,
      mime_type: m.mimeType,
      size: m.size,
      alt: m.altText,
      title: m.title,
      created_at: iso(m.createdAt),
    };
    if (opts.includeMedia) {
      try {
        const bytes = await readFile(absolutePath(m.path));
        embedded += bytes.length;
        if (embedded > MAX_EMBEDDED_MEDIA_BYTES) {
          throw new ExportError(`The media files are over ${MAX_EMBEDDED_MEDIA_BYTES / 1024 / 1024} MB: export without media, or use a backup (zip) instead`);
        }
        entry.data = bytes.toString("base64");
      } catch (e) {
        if (e instanceof ExportError) throw e;
        // a library row whose file is gone: keep the row, no data
      }
    }
    mediaOut.push(entry);
  }

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    site,
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    taxonomies: taxonomies.map((t) => ({ key: t.key, label: t.label, singular: t.singular, hierarchical: t.hierarchical })),
    post_types: postTypes.map((t) => ({ key: t.key, label: t.label, singular: t.singular, taxonomies: t.taxonomies })),
    terms: terms.map((t) => ({ id: t.id, taxonomy: t.taxonomy, name: t.name, slug: t.slug, description: t.description, parent_id: t.parentId })),
    media: mediaOut,
    posts: posts.map((p) => ({
      id: p.id,
      type: p.type,
      title: p.title,
      slug: p.slug,
      status: p.status,
      content: p.content as SiteExport["posts"][number]["content"],
      published_at: isoOrNull(p.publishedAt),
      scheduled_at: isoOrNull(p.scheduledAt),
      created_at: iso(p.createdAt),
      updated_at: iso(p.updatedAt),
      featured_media_id: p.featuredMediaId,
      term_ids: p.terms.map((t) => t.termId),
      author_email: p.author?.email ?? null,
    })),
    pages: pages.map((p) => ({
      id: p.id,
      parent_id: p.parentId,
      title: p.title,
      slug: p.slug,
      status: p.status,
      content: p.content as SiteExport["pages"][number]["content"],
      published_at: isoOrNull(p.publishedAt),
      scheduled_at: isoOrNull(p.scheduledAt),
      created_at: iso(p.createdAt),
      updated_at: iso(p.updatedAt),
      author_email: p.author?.email ?? null,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      post_id: c.postId,
      parent_id: c.parentId,
      user_email: c.user?.email ?? null,
      author_name: c.authorName,
      author_email: c.authorEmail,
      content: c.content,
      status: c.status,
      created_at: iso(c.createdAt),
    })),
    menus: menus.map((m) => ({
      id: m.id,
      name: m.name,
      items: m.items.map((i) => ({
        id: i.id,
        parent_id: i.parentId,
        label: i.label,
        object_type: i.objectType as "custom" | "post" | "page",
        object_id: i.objectId,
        url: i.url,
        position: i.position,
      })),
    })),
    menu_locations: Object.fromEntries(locations.map((l) => [l.location, l.menuId])),
    widget_areas: areas.map((a) => ({
      key: a.key,
      name: a.name,
      widgets: a.widgets.map((w) => ({ type: w.type, settings: w.settings as Record<string, unknown>, position: w.position })),
    })),
    themes: {
      installs: themeInstalls.map((t) => ({ slug: t.slug, version: t.version, active: t.active })),
      mods: themeMods.map((m) => ({ theme: m.theme, published: m.published as Record<string, unknown>, draft: (m.draft as Record<string, unknown> | null) ?? null })),
      parts: parts.map((p) => ({ theme: p.theme, slug: p.slug, content: p.content as SiteExport["themes"]["parts"][number]["content"] })),
      overrides: overrides.map((o) => ({ theme: o.theme, template: o.template, target: o.target })),
    },
    plugins: {
      installs: pluginInstalls.map((p) => ({ slug: p.slug, version: p.version, active: p.active, settings: p.settings as Record<string, unknown> })),
      data: pluginData.map((d) => ({ plugin: d.plugin, key: d.key, value: d.value })),
    },
  };
}
