import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { absolutePath } from "@/lib/media";
import { createZip, readZip, safeEntryName, type ZipEntry, type ZipLimits } from "@/lib/net/zip";
import { exportSite } from "./export";
import type { ImportReport } from "./format";
import { importSite, parseExport } from "./import";

/**
 * Backup = one zip:
 *   manifest.json   what is inside, with the sha256 of every file
 *   site.json       the site as a ReactPress export (lib/portability/format.ts), without embedded media
 *   media/<path>    the uploaded files
 * Restoring verifies every checksum first, then replaces the site (a "replace" import, which is
 * all-or-nothing). Users, passwords, memberships, tokens and webhooks are not part of a backup.
 */

export const BACKUP_FORMAT = "reactpress-backup";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 500 * 1024 * 1024;

const RESTORE_LIMITS: ZipLimits = { maxEntries: 100_000, maxTotalBytes: MAX_BACKUP_BYTES + 100 * 1024 * 1024, maxEntryBytes: 150 * 1024 * 1024 };

export class BackupError extends Error {}

const manifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  created_at: z.iso.datetime(),
  site: z.object({ name: z.string(), slug: z.string() }),
  counts: z.record(z.string(), z.number()),
  files: z.record(z.string(), z.object({ sha256: z.string().regex(/^[0-9a-f]{64}$/), size: z.number().int().nonnegative() })),
  missing_media: z.array(z.string()).default([]),
});

export type BackupManifest = z.infer<typeof manifestSchema>;

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export async function createBackup(siteId: string): Promise<{ zip: Buffer; manifest: BackupManifest }> {
  const data = await exportSite(siteId);
  const siteJson = Buffer.from(JSON.stringify(data));
  const entries: ZipEntry[] = [{ path: "site.json", data: siteJson }];
  const files: BackupManifest["files"] = { "site.json": { sha256: sha256(siteJson), size: siteJson.length } };
  const missing: string[] = [];
  let total = siteJson.length;

  for (const m of data.media) {
    const name = safeEntryName(`media/${m.path}`);
    if (!name) {
      missing.push(m.path);
      continue;
    }
    let bytes: Buffer;
    try {
      bytes = await readFile(absolutePath(m.path));
    } catch {
      missing.push(m.path); // a library row whose file is gone
      continue;
    }
    total += bytes.length;
    if (total > MAX_BACKUP_BYTES) throw new BackupError(`The site is over ${MAX_BACKUP_BYTES / 1024 / 1024} MB: back up the database and the storage folder directly instead`);
    entries.push({ path: name, data: bytes });
    files[name] = { sha256: sha256(bytes), size: bytes.length };
  }

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    site: data.site,
    counts: { posts: data.posts.length, pages: data.pages.length, media: Object.keys(files).length - 1, comments: data.comments.length, terms: data.terms.length },
    files,
    missing_media: missing,
  };
  return { zip: createZip([{ path: "manifest.json", data: Buffer.from(JSON.stringify(manifest, null, 2)) }, ...entries]), manifest };
}

/** Check an archive without touching the database. Returns the verified contents. */
export function verifyBackup(buf: Buffer) {
  let entries: ZipEntry[];
  try {
    entries = readZip(buf, RESTORE_LIMITS);
  } catch (e) {
    throw new BackupError(`Not a usable backup file: ${(e as Error).message}`);
  }
  const byName = new Map(entries.map((e) => [e.path, e.data]));
  const rawManifest = byName.get("manifest.json");
  if (!rawManifest) throw new BackupError("Not a ReactPress backup: manifest.json is missing");
  let manifest: BackupManifest;
  try {
    manifest = manifestSchema.parse(JSON.parse(rawManifest.toString("utf8")));
  } catch {
    throw new BackupError("Not a ReactPress backup: the manifest is invalid");
  }

  for (const name of byName.keys()) {
    if (name !== "manifest.json" && !manifest.files[name]) throw new BackupError(`The backup contains a file that is not in its manifest: ${name}`);
  }
  for (const [name, info] of Object.entries(manifest.files)) {
    const data = byName.get(name);
    if (!data) throw new BackupError(`The backup is incomplete: ${name} is missing`);
    if (data.length !== info.size || sha256(data) !== info.sha256) throw new BackupError(`The backup is damaged: ${name} does not match its checksum`);
  }
  const site = byName.get("site.json");
  if (!site) throw new BackupError("The backup is incomplete: site.json is missing");
  return { manifest, site, files: byName };
}

/** Restore a backup into a site, replacing what is there. All-or-nothing. */
export async function restoreBackup(siteId: string, buf: Buffer, opts: { importerId: string }): Promise<ImportReport & { backup: { created_at: string; site: string } }> {
  const { manifest, site, files } = verifyBackup(buf);
  let json: unknown;
  try {
    json = JSON.parse(site.toString("utf8"));
  } catch {
    throw new BackupError("The backup is damaged: site.json is not valid JSON");
  }
  const data = parseExport(json);
  const report = await importSite(siteId, data, {
    mode: "replace",
    importerId: opts.importerId,
    mediaSource: (entry) => files.get(`media/${entry.path}`) ?? null,
  });
  return { ...report, backup: { created_at: manifest.created_at, site: manifest.site.name } };
}
