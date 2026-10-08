import { z } from "zod";

/**
 * Registry format: a JSON catalog of installable themes and plugins that anyone can host.
 *
 * {
 *   "format": "reactpress-registry", "version": 1, "name": "My registry",
 *   "items": [{
 *     "type": "theme" | "plugin", "slug": "my-theme", "name": "My Theme", "version": "1.2.0",
 *     "author": "Me", "description": "...", "homepage": "https://...",
 *     "download": "https://.../my-theme-1.2.0.zip",      // zip containing the package folder
 *     "sha256": "<hex of the zip>",                      // required: installs are verified against it
 *     "size": 12345
 *   }]
 * }
 *
 * `reactpress package <folder>` builds the zip and prints the entry.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const httpUrl = z.string().max(2000).refine((u) => /^https?:\/\//i.test(u), "must be an http(s) URL");

export const registryItemSchema = z.object({
  type: z.enum(["theme", "plugin"]),
  slug: z.string().regex(SLUG, "slug must be kebab-case"),
  name: z.string().min(1).max(60),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver (1.2.3)"),
  author: z.string().min(1).max(100),
  description: z.string().max(300).default(""),
  homepage: httpUrl.optional(),
  download: httpUrl,
  sha256: z.string().regex(/^[0-9a-f]{64}$/i, "sha256 must be 64 hex characters").transform((s) => s.toLowerCase()),
  size: z.number().int().positive().max(50 * 1024 * 1024).optional(),
});

export const registrySchema = z.object({
  format: z.literal("reactpress-registry"),
  version: z.literal(1),
  name: z.string().min(1).max(100),
  items: z.array(registryItemSchema).max(1000),
});

export type RegistryItem = z.infer<typeof registryItemSchema>;
export type Registry = z.infer<typeof registrySchema>;

/** Compare versions like "1.2.3": negative, 0 or positive, like a - b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}
