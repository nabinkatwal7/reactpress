import path from "node:path";
import { mimeForFilename, MAX_UPLOAD_BYTES } from "@/lib/media";
import { safeFetch } from "@/lib/net/safe-fetch";
import { EXPORT_FORMAT, EXPORT_VERSION, type ImportReport, type SiteExport } from "@/lib/portability/format";
import { importSite, parseExport } from "@/lib/portability/import";
import { slugify } from "@/lib/slug";
import { htmlToBlocks } from "./html";
import { parseWxr, type WxrDoc, type WxrItem } from "./wxr";

export const MAX_ATTACHMENTS = 300;
const DOWNLOAD_CONCURRENCY = 4;

export type WordPressReport = ImportReport & { skipped: Record<string, number> };

/** WordPress slugs are often percent-encoded unicode; ours are plain ascii. */
export function toSlug(raw: string, title: string, fallback: string): string {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // keep it as is
  }
  const s = slugify(decoded || title);
  return s === "post" && !/^post$/i.test(decoded) ? fallback : s;
}

const iso = (wpDate: string | null) => (wpDate ? `${wpDate.replace(" ", "T")}Z` : new Date().toISOString());

function statusOf(item: WxrItem): { status: SiteExport["posts"][number]["status"]; scheduledAt: string | null } | null {
  switch (item.status) {
    case "publish": return { status: "publish", scheduledAt: null };
    case "draft": case "pending": return { status: "draft", scheduledAt: null };
    case "private": return { status: "private", scheduledAt: null };
    case "trash": return { status: "trash", scheduledAt: null };
    case "future": {
      const at = new Date(iso(item.date));
      return at.getTime() > Date.now() ? { status: "scheduled", scheduledAt: at.toISOString() } : { status: "publish", scheduledAt: null };
    }
    default: return null; // auto-draft, inherit, ...
  }
}

/** `photo-300x200.jpg?x=1` and `photo.jpg` are the same picture. */
const imageKey = (url: string) => url.split(/[?#]/)[0].replace(/-\d+x\d+(\.[A-Za-z0-9]+)$/, "$1");

type Downloaded = { id: string; filename: string; ext: string; mime: string; bytes: Buffer; item: WxrItem };

async function downloadAttachments(items: WxrItem[], warnings: string[]): Promise<Downloaded[]> {
  const candidates = items.filter((i) => i.type === "attachment" && i.attachmentUrl && /^https?:\/\//i.test(i.attachmentUrl));
  if (candidates.length > MAX_ATTACHMENTS) warnings.push(`${candidates.length} attachments found: only the first ${MAX_ATTACHMENTS} were downloaded`);
  const todo = candidates.slice(0, MAX_ATTACHMENTS);
  const out: Downloaded[] = [];
  const failures: string[] = [];
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < todo.length; i = next++) {
      const item = todo[i];
      const url = item.attachmentUrl!;
      const filename = decodeURIComponent(path.posix.basename(url.split(/[?#]/)[0])) || `file-${item.id}`;
      const info = mimeForFilename(filename);
      if (!info) {
        failures.push(`${filename}: file type not allowed`);
        continue;
      }
      try {
        const res = await safeFetch(url, { maxBytes: MAX_UPLOAD_BYTES, timeoutMs: 15_000 });
        out.push({ id: item.id, filename, ext: info.ext, mime: info.mime, bytes: res.body, item });
      } catch (e) {
        failures.push(`${filename}: ${(e as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker));
  for (const f of failures.slice(0, 20)) warnings.push(`Media not imported: ${f}`);
  if (failures.length > 20) warnings.push(`...and ${failures.length - 20} more media files could not be imported`);
  return out;
}

/** Translate a parsed WXR file into the ReactPress export format. `media` maps attachment ids to downloaded files. */
export function wxrToExport(doc: WxrDoc, media: Downloaded[], warnings: string[]): { data: SiteExport; skipped: Record<string, number> } {
  const skipped: Record<string, number> = {};
  const skip = (what: string) => void (skipped[what] = (skipped[what] ?? 0) + 1);

  // ---- terms (categories and tags only)
  const terms = new Map<string, SiteExport["terms"][number]>();
  const termId = (taxonomy: "category" | "tag", slug: string) => `${taxonomy}:${slug}`;
  const addTerm = (taxonomy: "category" | "tag", rawSlug: string, name: string, parentSlug: string | null) => {
    const slug = toSlug(rawSlug, name, `term-${terms.size + 1}`);
    const id = termId(taxonomy, slug);
    const existing = terms.get(id);
    if (existing) {
      if (!existing.parent_id && parentSlug) existing.parent_id = termId(taxonomy, toSlug(parentSlug, parentSlug, "x"));
      return id;
    }
    terms.set(id, { id, taxonomy, name: name || slug, slug, description: null, parent_id: parentSlug ? termId(taxonomy, toSlug(parentSlug, parentSlug, "x")) : null });
    return id;
  };
  for (const c of doc.categories) addTerm("category", c.slug, c.name, c.parent);
  for (const t of doc.tags) addTerm("tag", t.slug, t.name, null);

  const authorEmail = new Map(doc.authors.map((a) => [a.login, a.email]));
  const byWpId = new Map(media.map((m) => [m.id, m]));
  const urlToPath = new Map<string, string>();
  const mediaEntries: SiteExport["media"] = media.map((m) => {
    const p = `wxr/${m.id}.${m.ext}`;
    urlToPath.set(imageKey(m.item.attachmentUrl!), p);
    return {
      id: `media-${m.id}`, filename: m.filename.slice(0, 200), path: p, mime_type: m.mime, size: m.bytes.length, alt: m.item.meta._wp_attachment_image_alt ?? "",
      title: m.item.title.slice(0, 200), created_at: iso(m.item.date), data: m.bytes.toString("base64"),
    };
  });
  const mapImage = (url: string) => {
    const local = urlToPath.get(imageKey(url));
    return local ? `/media/${local}` : url;
  };

  const posts: SiteExport["posts"] = [];
  const pages: SiteExport["pages"] = [];
  const pageIds = new Set(doc.items.filter((i) => i.type === "page" && statusOf(i)).map((i) => `page-${i.id}`));
  const unsupported = new Set<string>();

  for (const item of doc.items) {
    if (item.type === "attachment") continue;
    if (item.type !== "post" && item.type !== "page") {
      if (item.type) unsupported.add(item.type);
      skip(item.type || "unknown");
      continue;
    }
    const st = statusOf(item);
    if (!st) {
      skip(`${item.type} (${item.status})`);
      continue;
    }
    const created = iso(item.date);
    const common = {
      title: (item.title || "(no title)").slice(0, 500),
      slug: toSlug(item.slug, item.title, `${item.type}-${item.id}`),
      status: st.status,
      content: htmlToBlocks(item.content, { mapImage }) as SiteExport["posts"][number]["content"],
      published_at: st.status === "publish" || st.status === "private" ? created : null,
      scheduled_at: st.scheduledAt,
      created_at: created,
      updated_at: created,
      author_email: authorEmail.get(item.creator) || null,
    };
    if (item.type === "post") {
      const termIds: string[] = [];
      for (const t of item.terms) {
        if (t.domain === "category") termIds.push(addTerm("category", t.slug, t.name, null));
        else if (t.domain === "post_tag") termIds.push(addTerm("tag", t.slug, t.name, null));
        else if (t.domain) skip(`taxonomy "${t.domain}"`);
      }
      const thumb = item.meta._thumbnail_id;
      posts.push({ id: `post-${item.id}`, type: "post", ...common, featured_media_id: thumb && byWpId.has(thumb) ? `media-${thumb}` : null, term_ids: [...new Set(termIds)] });
    } else {
      pages.push({ id: `page-${item.id}`, parent_id: item.parent && item.parent !== "0" && pageIds.has(`page-${item.parent}`) ? `page-${item.parent}` : null, ...common });
    }
  }

  const comments = doc.items.reduce((n, i) => n + i.commentCount, 0);
  if (comments) warnings.push(`${comments} comments were not imported (comments are not part of this import)`);
  if (unsupported.size) warnings.push(`Skipped content of types ${[...unsupported].map((t) => `"${t}"`).join(", ")}: only posts and pages are imported`);

  return {
    skipped,
    data: {
      format: EXPORT_FORMAT, version: EXPORT_VERSION, exported_at: new Date().toISOString(), site: { name: doc.title.slice(0, 200), slug: "wordpress" },
      settings: {}, taxonomies: [], post_types: [], terms: [...terms.values()], media: mediaEntries, posts, pages, comments: [], menus: [], menu_locations: {}, widget_areas: [],
      themes: { installs: [], mods: [], parts: [], overrides: [] }, plugins: { installs: [], data: [] },
    },
  };
}

/**
 * Import a WordPress WXR file into a site, next to what is already there.
 * Posts, pages, categories and tags come across; images in content keep working. With
 * `downloadMedia`, attachments are fetched from the original site into the media library (and
 * image blocks and featured images point at the copies); without it, images keep their original URLs.
 */
export async function importWordPress(siteId: string, xml: string, opts: { importerId: string; downloadMedia?: boolean }): Promise<WordPressReport> {
  const doc = parseWxr(xml);
  const warnings: string[] = [];
  const attachments = doc.items.filter((i) => i.type === "attachment").length;
  const media = opts.downloadMedia ? await downloadAttachments(doc.items, warnings) : [];
  if (!opts.downloadMedia && attachments) warnings.push(`${attachments} attachments were not downloaded: images in posts keep pointing at their original addresses (tick "download media" to copy them)`);

  const { data, skipped } = wxrToExport(doc, media, warnings);
  const report = await importSite(siteId, parseExport(data), { mode: "merge", importerId: opts.importerId });
  return { ...report, warnings: [...warnings, ...report.warnings], skipped };
}
