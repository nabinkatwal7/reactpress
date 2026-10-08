import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { MAX_UPLOAD_BYTES, absolutePath, mimeForFilename } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { SETTINGS, type SettingKey } from "@/lib/settings";
import { exportSchema, type ImportMode, type ImportReport, type SiteExport } from "./format";

export class ImportError extends Error {}

/** Parse and validate an export file's JSON. Throws `ImportError` with the first problem. */
export function parseExport(json: unknown): SiteExport {
  const parsed = exportSchema.safeParse(json);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    throw new ImportError(`Not a valid ReactPress export: ${i.path.join(".") || "(root)"} ${i.message}`);
  }
  assertUniqueIds(parsed.data);
  return parsed.data;
}

function assertUniqueIds(d: SiteExport) {
  for (const [name, list] of [["terms", d.terms], ["media", d.media], ["posts", d.posts], ["pages", d.pages], ["comments", d.comments], ["menus", d.menus]] as const) {
    const seen = new Set<string>();
    for (const row of list) {
      if (seen.has(row.id)) throw new ImportError(`Not a valid ReactPress export: duplicate id "${row.id}" in ${name}`);
      seen.add(row.id);
    }
  }
}

/** Supplies a media file's bytes when the export itself does not embed them (backups keep files separately). */
export type MediaSource = (entry: SiteExport["media"][number]) => Buffer | null;

export type ImportOptions = {
  mode: ImportMode;
  /** Fallback author for items whose author is not a user of this network. */
  importerId: string;
  mediaSource?: MediaSource;
};

const CHUNK = 500;
const newId = () => randomUUID().replace(/-/g, "");
const date = (s: string | null | undefined) => (s ? new Date(s) : null);

async function chunked<T>(rows: T[], insert: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await insert(rows.slice(i, i + CHUNK));
}

/** Replace `/media/<old path>` with the new path anywhere inside JSON (post blocks, part content, widget and theme settings). */
export function rewriteMedia<T>(value: T, map: Map<string, string>): T {
  if (map.size === 0) return value;
  const re = new RegExp(`/media/(${[...map.keys()].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return v.includes("/media/") ? v.replace(re, (_, old: string) => `/media/${map.get(old)}`) : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

/** A slug not in `taken` (adds -2, -3 …) and remembers it. */
function claimSlug(base: string, taken: Set<string>): string {
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  taken.add(slug);
  return slug;
}

/** Break parent cycles (A -> B -> A) so a hostile file cannot create unreachable loops. */
function breakCycles(rows: { id: string; parent: string | null }[]) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const r of rows) {
    const seen = new Set<string>([r.id]);
    for (let p = r.parent ? byId.get(r.parent) : undefined; p; p = p.parent ? byId.get(p.parent) : undefined) {
      if (seen.has(p.id)) {
        r.parent = null;
        break;
      }
      seen.add(p.id);
    }
  }
}

/**
 * Import a validated export into one site.
 *  - merge:   adds posts, pages, terms, taxonomies, post types, media and comments next to what is
 *             there. Slugs that exist get a `-2` suffix; terms with the same taxonomy+slug are reused.
 *             Settings, menus, widgets, themes and plugins of the site are left alone.
 *  - replace: first removes everything the export covers, then imports all of it (settings, menus,
 *             widgets, themes, plugins included). Users, memberships, tokens and webhooks are kept.
 * All database changes happen in one transaction: a failure changes nothing.
 */
export async function importSite(siteId: string, data: SiteExport, opts: ImportOptions): Promise<ImportReport> {
  const replace = opts.mode === "replace";
  const warnings: string[] = [];
  const counts: Record<string, number> = {};
  const count = (k: string, n: number) => void (counts[k] = (counts[k] ?? 0) + n);

  // ---- people: match authors by email
  const emails = new Set<string>();
  for (const r of [...data.posts, ...data.pages]) if (r.author_email) emails.add(r.author_email.toLowerCase());
  for (const c of data.comments) if (c.user_email) emails.add(c.user_email.toLowerCase());
  const users = await prisma.user.findMany({ where: { email: { in: [...emails] } }, select: { id: true, email: true } });
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const authorOf = (email: string | null | undefined) => (email && userByEmail.get(email.toLowerCase())) || opts.importerId;

  // ---- media files first (outside the transaction); undone if anything later fails
  const mediaMap = new Map<string, string>(); // old path -> new path
  const mediaIds = new Map<string, string>(); // export id -> new id
  const mediaRows: Prisma.MediaCreateManyInput[] = [];
  const written: string[] = [];
  const dropFiles = async () => void (await Promise.all(written.map((rel) => unlink(absolutePath(rel)).catch(() => {}))));

  try {
    for (const m of data.media) {
      const info = mimeForFilename(m.filename);
      const bytes = m.data !== undefined ? Buffer.from(m.data, "base64") : (opts.mediaSource?.(m) ?? null);
      if (!bytes) {
        warnings.push(`Media "${m.filename}": the file is not in the export, so it was skipped`);
        continue;
      }
      if (!info) {
        warnings.push(`Media "${m.filename}": file type not allowed, skipped`);
        continue;
      }
      if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) {
        warnings.push(`Media "${m.filename}": empty or over ${MAX_UPLOAD_BYTES / 1024 / 1024} MB, skipped`);
        continue;
      }
      const created = new Date(m.created_at);
      const rel = `${created.getUTCFullYear()}/${String(created.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${info.ext}`;
      const abs = absolutePath(rel);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, bytes);
      written.push(rel);
      const id = newId();
      mediaIds.set(m.id, id);
      mediaMap.set(m.path, rel);
      mediaRows.push({ id, siteId, uploaderId: opts.importerId, filename: m.filename.slice(0, 200), path: rel, mimeType: info.mime, size: bytes.length, altText: m.alt, title: m.title, createdAt: created });
    }

    // ---- id maps and reference checks
    const slugsPosts = new Set<string>();
    const slugsPages = new Set<string>();
    const existingTerms = new Map<string, string>(); // "taxonomy/slug" -> id
    if (!replace) {
      for (const p of await prisma.post.findMany({ where: { siteId }, select: { slug: true } })) slugsPosts.add(p.slug);
      for (const p of await prisma.page.findMany({ where: { siteId }, select: { slug: true } })) slugsPages.add(p.slug);
      for (const t of await prisma.term.findMany({ where: { siteId }, select: { id: true, taxonomy: true, slug: true } })) existingTerms.set(`${t.taxonomy}/${t.slug}`, t.id);
    }

    const termIds = new Map<string, string>();
    const newTerms: Prisma.TermCreateManyInput[] = [];
    for (const t of data.terms) {
      const existing = existingTerms.get(`${t.taxonomy}/${t.slug}`);
      if (existing) {
        termIds.set(t.id, existing);
        continue;
      }
      const id = newId();
      termIds.set(t.id, id);
      newTerms.push({ id, siteId, taxonomy: t.taxonomy, name: t.name, slug: t.slug, description: t.description ?? null, parentId: null });
    }
    const termRows = newTerms.map((t) => ({ id: t.id as string, parent: null as string | null }));
    const parentOf = new Map(data.terms.map((t) => [termIds.get(t.id)!, t.parent_id ? (termIds.get(t.parent_id) ?? null) : null]));
    for (const r of termRows) r.parent = parentOf.get(r.id) ?? null;
    breakCycles(termRows);
    const termParent = new Map(termRows.map((r) => [r.id, r.parent]));
    for (const t of newTerms) t.parentId = termParent.get(t.id as string) ?? null;

    const postIds = new Map(data.posts.map((p) => [p.id, newId()]));
    const pageIds = new Map(data.pages.map((p) => [p.id, newId()]));

    const known = await knownPostTypes(siteId, data);
    const posts: Prisma.PostCreateManyInput[] = [];
    const postTerms: Prisma.PostTermCreateManyInput[] = [];
    const jobs: Prisma.JobCreateManyInput[] = [];
    for (const p of data.posts) {
      if (!known.has(p.type)) {
        warnings.push(`Post "${p.title}": unknown post type "${p.type}", skipped`);
        postIds.delete(p.id);
        continue;
      }
      const id = postIds.get(p.id)!;
      let featured: string | null = null;
      if (p.featured_media_id) {
        featured = mediaIds.get(p.featured_media_id) ?? null;
        if (!featured) warnings.push(`Post "${p.title}": featured image is not available, left out`);
      }
      const scheduledAt = date(p.scheduled_at);
      posts.push({
        id, siteId, authorId: authorOf(p.author_email), featuredMediaId: featured, type: p.type, title: p.title, slug: claimSlug(p.slug, slugsPosts), status: p.status,
        content: rewriteMedia(p.content, mediaMap) as Prisma.InputJsonValue, publishedAt: date(p.published_at), scheduledAt, createdAt: new Date(p.created_at), updatedAt: new Date(p.updated_at),
      });
      for (const t of new Set(p.term_ids)) {
        const termId = termIds.get(t);
        if (termId) postTerms.push({ postId: id, termId });
      }
      if (p.status === "scheduled" && scheduledAt) jobs.push({ siteId, type: "publish", runAt: scheduledAt, payload: { entityType: "post", entityId: id } });
    }

    const pageRows = data.pages.map((p) => ({ id: pageIds.get(p.id)!, parent: p.parent_id ? (pageIds.get(p.parent_id) ?? null) : null }));
    breakCycles(pageRows);
    const pageParent = new Map(pageRows.map((r) => [r.id, r.parent]));
    const pages: Prisma.PageCreateManyInput[] = data.pages.map((p) => {
      const id = pageIds.get(p.id)!;
      const scheduledAt = date(p.scheduled_at);
      if (p.status === "scheduled" && scheduledAt) jobs.push({ siteId, type: "publish", runAt: scheduledAt, payload: { entityType: "page", entityId: id } });
      return {
        id, siteId, authorId: authorOf(p.author_email), parentId: pageParent.get(id) ?? null, title: p.title, slug: claimSlug(p.slug, slugsPages), status: p.status,
        content: rewriteMedia(p.content, mediaMap) as Prisma.InputJsonValue, publishedAt: date(p.published_at), scheduledAt, createdAt: new Date(p.created_at), updatedAt: new Date(p.updated_at),
      };
    });

    const commentIds = new Map(data.comments.map((c) => [c.id, newId()]));
    const comments: Prisma.CommentCreateManyInput[] = [];
    for (const c of data.comments) {
      const postId = postIds.get(c.post_id);
      if (!postId) {
        warnings.push(`A comment by ${c.author_name} is on a post that was not imported, skipped`);
        commentIds.delete(c.id);
        continue;
      }
      comments.push({
        id: commentIds.get(c.id)!, siteId, postId, parentId: c.parent_id ? (commentIds.get(c.parent_id) ?? null) : null,
        userId: c.user_email ? (userByEmail.get(c.user_email.toLowerCase()) ?? null) : null,
        authorName: c.author_name, authorEmail: c.author_email, content: c.content, status: c.status, createdAt: new Date(c.created_at),
      });
    }

    // ---- replace-only parts
    const menuRows: Prisma.MenuCreateManyInput[] = [];
    const itemRows: Prisma.MenuItemCreateManyInput[] = [];
    const locationRows: Prisma.MenuLocationCreateManyInput[] = [];
    const settingRows: Prisma.SettingCreateManyInput[] = [];
    if (replace) {
      const menuIds = new Map(data.menus.map((m) => [m.id, newId()]));
      for (const m of data.menus) {
        const itemIds = new Map(m.items.map((i) => [i.id, newId()]));
        menuRows.push({ id: menuIds.get(m.id)!, siteId, name: m.name });
        // items that point at something that was not imported are dropped; their children move up
        const resolved = new Map<string, string | null>();
        for (const i of m.items) {
          if (i.object_type === "custom") continue;
          const target = (i.object_type === "post" ? postIds : pageIds).get(i.object_id ?? "");
          resolved.set(i.id, target ?? null);
          if (!target) warnings.push(`Menu "${m.name}": "${i.label}" points to something that was not imported, left out`);
        }
        const kept = new Set(m.items.filter((i) => i.object_type === "custom" || resolved.get(i.id)).map((i) => i.id));
        const rawParent = new Map(m.items.map((i) => [i.id, i.parent_id ?? null]));
        const loops = m.items.map((i) => ({ id: i.id, parent: rawParent.get(i.id)! }));
        breakCycles(loops);
        const parentOf = new Map(loops.map((r) => [r.id, r.parent]));
        const keptParent = (id: string): string | null => {
          let p = parentOf.get(id) ?? null;
          while (p && !kept.has(p)) p = parentOf.get(p) ?? null;
          return p;
        };
        for (const i of m.items) {
          if (!kept.has(i.id)) continue;
          const parent = keptParent(i.id);
          itemRows.push({
            id: itemIds.get(i.id)!, menuId: menuIds.get(m.id)!, parentId: parent ? itemIds.get(parent)! : null, label: i.label, objectType: i.object_type,
            objectId: i.object_type === "custom" ? null : resolved.get(i.id)!, url: i.object_type === "custom" ? (i.url ?? null) : null, position: i.position,
          });
        }
      }
      for (const [location, menu] of Object.entries(data.menu_locations)) {
        const menuId = menuIds.get(menu);
        if (menuId) locationRows.push({ siteId, location, menuId });
        else warnings.push(`Menu location "${location}" points to a menu that is not in the file`);
      }
      for (const [k, v] of Object.entries(data.settings)) {
        if (!(k in SETTINGS)) {
          warnings.push(`Unknown setting "${k}", skipped`);
          continue;
        }
        let value = v;
        if (k === "homepage_page_id" && typeof v === "string") value = pageIds.get(v) ?? null;
        const ok = SETTINGS[k as SettingKey].schema.safeParse(value);
        if (!ok.success) {
          warnings.push(`Setting "${k}" has an invalid value, skipped`);
          continue;
        }
        settingRows.push({ siteId, key: k, value: ok.data as Prisma.InputJsonValue });
      }
      const mode = settingRows.find((s) => s.key === "homepage_mode")?.value;
      if (mode === "page" && !settingRows.find((s) => s.key === "homepage_page_id")?.value) {
        warnings.push("The homepage page was not imported: the homepage shows the latest posts");
        const row = settingRows.find((s) => s.key === "homepage_mode")!;
        row.value = "latest";
      }
    }

    // ---- write everything at once
    const oldMedia = replace ? await prisma.media.findMany({ where: { siteId }, select: { path: true } }) : [];
    await prisma.$transaction(
      async (tx) => {
        if (replace) {
          // order matters only where there is no cascade
          await tx.job.deleteMany({ where: { siteId, type: "publish" } });
          await tx.revision.deleteMany({ where: { siteId } });
          await tx.comment.deleteMany({ where: { siteId } });
          await tx.menuLocation.deleteMany({ where: { siteId } });
          await tx.menu.deleteMany({ where: { siteId } });
          await tx.widgetArea.deleteMany({ where: { siteId } });
          await tx.post.deleteMany({ where: { siteId } });
          await tx.page.deleteMany({ where: { siteId } });
          await tx.term.deleteMany({ where: { siteId } });
          await tx.media.deleteMany({ where: { siteId } });
          await tx.taxonomy.deleteMany({ where: { siteId } });
          await tx.postType.deleteMany({ where: { siteId } });
          await tx.setting.deleteMany({ where: { siteId } });
          await tx.themeInstall.deleteMany({ where: { siteId } });
          await tx.themeMods.deleteMany({ where: { siteId } });
          await tx.templatePart.deleteMany({ where: { siteId } });
          await tx.templateOverride.deleteMany({ where: { siteId } });
          await tx.pluginInstall.deleteMany({ where: { siteId } });
          await tx.pluginData.deleteMany({ where: { siteId } });
        }

        const haveTax = new Set((await tx.taxonomy.findMany({ where: { siteId }, select: { key: true } })).map((t) => t.key));
        const taxRows = data.taxonomies.filter((t) => !haveTax.has(t.key)).map((t) => ({ siteId, key: t.key, label: t.label, singular: t.singular, hierarchical: t.hierarchical }));
        const haveTypes = new Set((await tx.postType.findMany({ where: { siteId }, select: { key: true } })).map((t) => t.key));
        const typeRows = data.post_types.filter((t) => !haveTypes.has(t.key)).map((t) => ({ siteId, key: t.key, label: t.label, singular: t.singular, taxonomies: t.taxonomies }));
        await tx.taxonomy.createMany({ data: taxRows });
        await tx.postType.createMany({ data: typeRows });
        count("taxonomies", taxRows.length);
        count("post_types", typeRows.length);

        await chunked(newTerms, (b) => tx.term.createMany({ data: b }));
        await chunked(mediaRows, (b) => tx.media.createMany({ data: b }));
        await chunked(posts, (b) => tx.post.createMany({ data: b }));
        await chunked(postTerms, (b) => tx.postTerm.createMany({ data: b, skipDuplicates: true }));
        await chunked(pages, (b) => tx.page.createMany({ data: b }));
        await chunked(comments, (b) => tx.comment.createMany({ data: b }));
        await tx.job.createMany({ data: jobs });
        count("terms", newTerms.length);
        count("media", mediaRows.length);
        count("posts", posts.length);
        count("pages", pages.length);
        count("comments", comments.length);

        if (replace) {
          await tx.menu.createMany({ data: menuRows });
          await tx.menuItem.createMany({ data: itemRows });
          await tx.menuLocation.createMany({ data: locationRows });
          await tx.setting.createMany({ data: settingRows });
          for (const a of data.widget_areas) {
            const area = await tx.widgetArea.create({ data: { siteId, key: a.key, name: a.name } });
            await tx.widget.createMany({ data: a.widgets.map((w) => ({ areaId: area.id, type: w.type, settings: rewriteMedia(w.settings, mediaMap) as Prisma.InputJsonValue, position: w.position })) });
          }
          await tx.themeInstall.createMany({ data: data.themes.installs.map((t) => ({ siteId, slug: t.slug, version: t.version, active: t.active })) });
          await tx.themeMods.createMany({
            data: data.themes.mods.map((m) => ({ siteId, theme: m.theme, published: rewriteMedia(m.published, mediaMap) as Prisma.InputJsonValue, draft: m.draft ? (rewriteMedia(m.draft, mediaMap) as Prisma.InputJsonValue) : undefined })),
          });
          await tx.templatePart.createMany({ data: data.themes.parts.map((p) => ({ siteId, theme: p.theme, slug: p.slug, content: rewriteMedia(p.content, mediaMap) as Prisma.InputJsonValue })) });
          await tx.templateOverride.createMany({ data: data.themes.overrides.map((o) => ({ siteId, theme: o.theme, template: o.template, target: o.target })) });
          await tx.pluginInstall.createMany({ data: data.plugins.installs.map((p) => ({ siteId, slug: p.slug, version: p.version, active: p.active, settings: p.settings as Prisma.InputJsonValue })) });
          await tx.pluginData.createMany({ data: data.plugins.data.map((d) => ({ siteId, plugin: d.plugin, key: d.key, value: d.value as Prisma.InputJsonValue })) });
          count("menus", menuRows.length);
          count("widget_areas", data.widget_areas.length);
          count("settings", settingRows.length);
        }
      },
      { timeout: 300_000, maxWait: 30_000 },
    );

    // committed: the replaced site's old files are no longer referenced
    await Promise.all(oldMedia.map((m) => unlink(absolutePath(m.path)).catch(() => {})));
    return { mode: opts.mode, counts, warnings };
  } catch (e) {
    await dropFiles();
    throw e;
  }
}

/** Post types the site can hold after this import: built in, already in the database, or in the file. */
async function knownPostTypes(siteId: string, data: SiteExport) {
  const { listPostTypes } = await import("@/lib/registry");
  const known = new Set((await listPostTypes(siteId)).map((t) => t.key));
  for (const t of data.post_types) known.add(t.key);
  return known;
}
