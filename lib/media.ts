import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { withSiteId } from "@/lib/site";

/** Files live outside /public and are served through /media/[...path]. */
export const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Allow-list by extension; the stored MIME comes from here, never the client. SVG is excluded (script risk). */
const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
};

export function mimeForFilename(name: string): { ext: string; mime: string } | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const mime = TYPES[ext];
  return mime ? { ext, mime } : null;
}

export function isImage(mime: string) {
  return mime.startsWith("image/");
}

export function mediaUrl(relPath: string) {
  return `/media/${relPath}`;
}

export function absolutePath(relPath: string) {
  const abs = path.join(STORAGE_ROOT, relPath);
  if (!abs.startsWith(STORAGE_ROOT + path.sep)) throw new Error("Invalid path");
  return abs;
}

export async function createMedia(siteId: string, uploaderId: string, file: File) {
  const info = mimeForFilename(file.name);
  if (!info) throw new Error("File type not allowed");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File too large (max 10 MB)");
  if (file.size === 0) throw new Error("File is empty");

  const now = new Date();
  const id = randomUUID();
  const rel = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}.${info.ext}`;
  const abs = absolutePath(rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));

  try {
    return await prisma.media.create({
      data: {
        siteId,
        uploaderId,
        filename: file.name.slice(0, 200),
        path: rel,
        mimeType: info.mime,
        size: file.size,
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 200),
      },
    });
  } catch (e) {
    await unlink(abs).catch(() => {});
    throw e;
  }
}

export async function listMedia(siteId: string) {
  return prisma.media.findMany({
    where: withSiteId(siteId),
    orderBy: { createdAt: "desc" },
  });
}

export async function getMedia(siteId: string, id: string) {
  return prisma.media.findFirst({ where: withSiteId(siteId, { id }) });
}

export async function updateMedia(
  siteId: string,
  id: string,
  input: { altText?: string; title?: string },
) {
  const existing = await getMedia(siteId, id);
  if (!existing) return null;
  return prisma.media.update({ where: { id }, data: input });
}

export async function deleteMedia(siteId: string, id: string) {
  const existing = await getMedia(siteId, id);
  if (!existing) return false;
  await prisma.media.delete({ where: { id } });
  await unlink(absolutePath(existing.path)).catch(() => {});
  return true;
}

/** Attach (or detach with null) a media item as a post's featured image. */
export async function setFeaturedMedia(siteId: string, postId: string, mediaId: string | null) {
  if (mediaId && !(await getMedia(siteId, mediaId))) throw new Error("Media not found");
  const res = await prisma.post.updateMany({
    where: withSiteId(siteId, { id: postId }),
    data: { featuredMediaId: mediaId },
  });
  return res.count > 0;
}

export const MEDIA_PER_PAGE = 24;

/** Paged media list with filename search and an optional image/other filter. */
export async function queryMedia(
  siteId: string,
  q: { q?: string; kind?: "image" | "other"; page?: number } = {},
) {
  const search = q.q?.trim();
  const where = {
    siteId,
    ...(search ? { filename: { contains: search, mode: "insensitive" as const } } : {}),
    ...(q.kind === "image"
      ? { mimeType: { startsWith: "image/" } }
      : q.kind === "other"
        ? { NOT: { mimeType: { startsWith: "image/" } } }
        : {}),
  };
  const [items, total] = await Promise.all([
    prisma.media.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (Math.max(q.page ?? 1, 1) - 1) * MEDIA_PER_PAGE,
      take: MEDIA_PER_PAGE,
    }),
    prisma.media.count({ where }),
  ]);
  return { items, total, pages: Math.max(Math.ceil(total / MEDIA_PER_PAGE), 1) };
}

export async function bulkDeleteMedia(siteId: string, ids: string[]) {
  let count = 0;
  for (const id of ids.slice(0, 200)) {
    if (await deleteMedia(siteId, id)) count += 1;
  }
  return count;
}
